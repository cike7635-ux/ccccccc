import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ==================== 工具函数 ====================

/**
 * 从cookie中提取设备ID
 */
function extractDeviceId(request: NextRequest): string {
  const deviceIdCookie = request.cookies.get('love_ludo_device_id')
  if (deviceIdCookie && deviceIdCookie.value) {
    try {
      return decodeURIComponent(deviceIdCookie.value)
    } catch {
      return deviceIdCookie.value
    }
  }
  return 'unknown'
}

/**
 * 生成会话标识（包含设备ID）
 */
function generateSessionId(userId: string, accessToken: string, request: NextRequest): string {
  const tokenPart = accessToken.substring(0, 12)
  const deviceId = extractDeviceId(request)
  return `sess_${userId}_${deviceId}_${tokenPart}`
}

function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com']
  return adminEmails.some(adminEmail => 
    adminEmail.trim().toLowerCase() === email?.toLowerCase()
  )
}

function isProtectedGamePath(path: string): boolean {
  const exactPaths = ['/lobby', '/game', '/profile', '/themes', '/game-history', '/themes/new']
  if (exactPaths.includes(path)) return true
  const prefixPaths = ['/game/', '/themes/']
  return prefixPaths.some(prefix => path.startsWith(prefix))
}

function isPublicPath(path: string): boolean {
  const exactPublicPaths = ['/', '/login', '/account-expired', '/renew', '/admin/unauthorized', '/login/expired']
  if (exactPublicPaths.includes(path)) return true
  const prefixPublicPaths = ['/auth/', '/api/auth/']
  return prefixPublicPaths.some(prefix => path.startsWith(prefix))
}

function createMiddlewareClient(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              path: '/',
            })
          })
        },
      },
    }
  )

  return { supabase, response }
}

async function getVerifiedUser(supabase: any) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { user: null, error }
    }
    
    return { user, error: null }
  } catch (error: any) {
    return { user: null, error }
  }
}

async function getCurrentSession(supabase: any) {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  } catch (error: any) {
    return { session: null, error }
  }
}

async function updateUserSessionForLogin(supabase: any, userId: string, sessionId: string) {
  const now = new Date().toISOString()
  return await supabase
    .from('profiles')
    .update({
      last_login_at: now,
      last_login_session: sessionId,
      updated_at: now
    })
    .eq('id', userId)
}

async function updateUserActivity(supabase: any, userId: string) {
  const now = new Date().toISOString()
  await supabase
    .from('profiles')
    .update({
      last_login_at: now,
      updated_at: now
    })
    .eq('id', userId)
}

/**
 * 🔥 基于设备ID的多设备检测
 */
async function performDeviceBasedCheck(
  supabase: any, 
  user: any, 
  currentSessionId: string, 
  requestId: string,
  profile: any
): Promise<{ allowed: boolean; reason: string }> {
  
  // 1. 检查是否有会话标识
  if (!profile.last_login_session) {
    console.log(`[${requestId}] 用户无会话标识，设置为当前会话`)
    await updateUserSessionForLogin(supabase, user.id, currentSessionId)
    return { allowed: true, reason: 'session_initialized' }
  }
  
  // 2. 检查是否是初始会话（init_开头）
  if (profile.last_login_session.startsWith('init_')) {
    console.log(`[${requestId}] 更新初始会话为真实会话`)
    await updateUserSessionForLogin(supabase, user.id, currentSessionId)
    return { allowed: true, reason: 'initial_session_updated' }
  }
  
  // 3. 核心比对
  const storedSession = profile.last_login_session
  
  console.log(`[${requestId}] 🔍 会话检查详情:`, {
    current: currentSessionId,
    stored: storedSession,
    match: storedSession === currentSessionId
  })
  
  if (storedSession === currentSessionId) {
    console.log(`[${requestId}] ✅ 会话匹配，允许访问`)
    
    // 更新活动时间
    updateUserActivity(supabase, user.id).catch(() => {})
    
    return { allowed: true, reason: 'session_matched' }
  }
  
  // 4. 会话不匹配 → 检查是否是同一设备（比较设备ID部分）
  const extractDeviceIdFromSession = (session: string): string => {
    // 格式：sess_{userId}_{deviceId}_{tokenPart}
    const parts = session.split('_')
    if (parts.length >= 4) {
      // 设备ID可能是多部分的（如dev_时间戳_随机数），所以需要合并
      // sess_userId_dev_timestamp_random_tokenPart
      if (parts[2] === 'dev' && parts.length > 4) {
        // 合并从索引2到倒数第二部分作为设备ID
        return parts.slice(2, parts.length - 1).join('_')
      }
      return parts[2] // 设备ID是第三个部分
    }
    return 'unknown'
  }
  
  const storedDeviceId = extractDeviceIdFromSession(storedSession)
  const currentDeviceId = extractDeviceIdFromSession(currentSessionId)
  
  console.log(`[${requestId}] 设备ID检查:`, {
    storedDeviceId,
    currentDeviceId,
    sameDevice: storedDeviceId === currentDeviceId
  })
  
  // 5. 如果是同一设备，给予3秒宽限期（处理token刷新）
  if (storedDeviceId === currentDeviceId && storedDeviceId !== 'unknown') {
    const lastLoginTime = profile.last_login_at ? new Date(profile.last_login_at) : null
    if (lastLoginTime) {
      const timeSinceLastLogin = Date.now() - lastLoginTime.getTime()
      console.log(`[${requestId}] ⏰ 同一设备，时间差: ${timeSinceLastLogin}ms`)
      
      if (timeSinceLastLogin < 3000) {
        // 3秒内，认为是token刷新，更新会话标识
        console.log(`[${requestId}] 🔄 同一设备3秒内重新登录，更新会话标识`)
        await updateUserSessionForLogin(supabase, user.id, currentSessionId)
        return { allowed: true, reason: 'same_device_refresh' }
      }
    }
  }
  
  // 6. 不同设备或超时 → 拒绝访问
  console.log(`[${requestId}] 🚨 检测到多设备登录！立即踢出`)
  console.log(`[${requestId}] 存储设备: ${storedDeviceId}, 当前设备: ${currentDeviceId}`)
  
  return { allowed: false, reason: 'multi_device' }
}

// ==================== 管理员路径处理函数 ====================

/**
 * 🔐 管理员路径验证函数
 */
async function handleAdminPath(
  request: NextRequest,
  currentPath: string,
  requestId: string,
  response: NextResponse
) {
  try {
    console.log(`[${requestId}] 🔐 检查管理员路径: ${currentPath}`)
    
    // 管理员公开路径（允许无cookie访问）
    const adminPublicPaths = [
      '/admin/login',
      '/admin/login/',
      '/admin/unauthorized',
      '/admin/unauthorized/'
    ]
    
    // 管理员API公开路径（允许无cookie访问）
    const adminApiPublicPaths = [
      '/api/admin/login',
      '/api/admin/heartbeat',
      '/api/admin/check-auth'
    ]
    
    // 检查是否为公开路径
    if (adminPublicPaths.includes(currentPath)) {
      console.log(`[${requestId}] ✅ 访问管理员公开路径，允许访问`)
      return response
    }
    
    // 检查是否为管理员API公开路径
    if (adminApiPublicPaths.some(path => currentPath === path || currentPath.startsWith(path + '/'))) {
      console.log(`[${requestId}] ✅ 访问管理员API公开路径，允许访问`)
      return response
    }
    
    // 检查管理员cookie
    const adminCookie = request.cookies.get('admin_key_verified')?.value
    
    if (!adminCookie) {
      console.log(`[${requestId}] 🚨 未授权访问管理员路径: ${currentPath}`)
      
      // 记录未授权访问尝试
      console.log({
        timestamp: new Date().toISOString(),
        path: currentPath,
        ip: request.headers.get('x-forwarded-for') || request.ip || 'unknown',
        userAgent: request.headers.get('user-agent'),
        referer: request.headers.get('referer')
      })
      
      // 如果是API请求，返回401
      if (currentPath.startsWith('/api/admin')) {
        return NextResponse.json(
          { 
            success: false, 
            error: '未授权访问',
            redirect: '/admin/login'
          },
          { status: 401 }
        )
      }
      
      // 重定向到管理员登录页
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', currentPath)
      return NextResponse.redirect(loginUrl)
    }
    
    // 验证cookie有效性
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com']
    const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || 'Cike@7638'
    
    const isValidCookie = 
      adminCookie === adminKey || 
      adminEmails.some(email => adminCookie.includes(email))
    
    if (!isValidCookie) {
      console.log(`[${requestId}] 🚨 无效的管理员cookie: ${currentPath}`)
      
      // 清除无效cookie
      const errorResponse = currentPath.startsWith('/api/admin') 
        ? NextResponse.json(
            { success: false, error: '无效的管理员会话' },
            { status: 401 }
          )
        : NextResponse.redirect(new URL('/admin/login', request.url))
      
      errorResponse.cookies.delete('admin_key_verified')
      return errorResponse
    }
    
    console.log(`[${requestId}] ✅ 管理员已验证，允许访问: ${currentPath}`)
    return response
    
  } catch (error) {
    console.error(`[${requestId}] 管理员验证异常:`, error)
    
    // 如果是API请求，返回500
    if (currentPath.startsWith('/api/admin')) {
      return NextResponse.json(
        { success: false, error: '服务器内部错误' },
        { status: 500 }
      )
    }
    
    // 页面请求重定向到登录页
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', currentPath)
    return NextResponse.redirect(loginUrl)
  }
}

// ==================== 中间件主函数 ====================

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname
  const requestId = Math.random().toString(36).substring(7)
  
  // 跳过静态资源
  if (currentPath.startsWith('/_next') || 
      currentPath.startsWith('/favicon') ||
      currentPath.startsWith('/public/')) {
    return NextResponse.next()
  }
  
  // 记录请求（不包括静态资源）
  console.log(`[${requestId}] 中间件处理: ${currentPath}`)
  
  try {
    // 1. 处理管理员路径（最高优先级）
    if (currentPath.startsWith('/admin') || currentPath.startsWith('/api/admin')) {
      const response = NextResponse.next()
      return await handleAdminPath(request, currentPath, requestId, response)
    }
    
    // 2. 公开路径
    if (isPublicPath(currentPath)) {
      return NextResponse.next()
    }
    
    // 3. API路径（非管理员API）
    if (currentPath.startsWith('/api/')) {
      return NextResponse.next()
    }
    
    // 4. 受保护的游戏路径（原始逻辑）
    if (isProtectedGamePath(currentPath)) {
      const { supabase, response } = createMiddlewareClient(request)
      
      try {
        const { user, error: authError } = await getVerifiedUser(supabase)
        
        if (authError || !user) {
          console.log(`[${requestId}] 用户未登录，重定向到登录页`)
          const redirectUrl = new URL('/login', request.url)
          redirectUrl.searchParams.set('redirect', currentPath)
          return NextResponse.redirect(redirectUrl)
        }
        
        console.log(`[${requestId}] 用户已登录: ${user.email}`)
        
        const { session: currentSession, error: sessionError } = await getCurrentSession(supabase)
        
        if (sessionError || !currentSession) {
          console.warn(`[${requestId}] 获取会话失败`)
          const redirectUrl = new URL('/login', request.url)
          redirectUrl.searchParams.set('redirect', currentPath)
          return NextResponse.redirect(redirectUrl)
        }
        
        // 生成当前会话标识（包含设备ID）
        const currentSessionId = generateSessionId(user.id, currentSession.access_token, request)
        
        // 查询用户资料
        let profile = null
        try {
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, account_expires_at, last_login_at, last_login_session, created_at')
            .eq('id', user.id)
            .single()
          
          if (profileError) {
            console.error(`[${requestId}] 查询用户资料失败:`, profileError)
            const redirectUrl = new URL('/login', request.url)
            redirectUrl.searchParams.set('redirect', currentPath)
            return NextResponse.redirect(redirectUrl)
          }
          
          profile = data
        } catch (profileError) {
          console.error(`[${requestId}] 查询用户资料异常:`, profileError)
          const redirectUrl = new URL('/login', request.url)
          redirectUrl.searchParams.set('redirect', currentPath)
          return NextResponse.redirect(redirectUrl)
        }
        
        if (!profile) {
          const redirectUrl = new URL('/login', request.url)
          redirectUrl.searchParams.set('redirect', currentPath)
          return NextResponse.redirect(redirectUrl)
        }
        
        // 会员过期检查
        const now = new Date()
        if (!profile.account_expires_at) {
          console.log(`[${requestId}] 用户未设置会员有效期`)
          if (currentPath !== '/account-expired' && currentPath !== '/renew') {
            return NextResponse.redirect(new URL('/account-expired', request.url))
          }
        } else {
          const expiryDate = new Date(profile.account_expires_at)
          const isExpired = expiryDate < now
          
          if (isExpired) {
            console.log(`[${requestId}] 会员已过期`)
            if (currentPath !== '/account-expired' && currentPath !== '/renew') {
              return NextResponse.redirect(new URL('/account-expired', request.url))
            }
          }
        }
        
        // 🔥 执行基于设备ID的多设备检测
        const deviceCheck = await performDeviceBasedCheck(
          supabase, 
          user, 
          currentSessionId, 
          requestId,
          profile
        )
        
        if (!deviceCheck.allowed) {
          console.log(`[${requestId}] ❌ 多设备检测不通过: ${deviceCheck.reason}`)
          
          const redirectUrl = new URL('/login/expired', request.url)
          redirectUrl.searchParams.set('reason', deviceCheck.reason)
          redirectUrl.searchParams.set('email', user.email || '')
          
          return NextResponse.redirect(redirectUrl)
        }
        
        console.log(`[${requestId}] ✅ 安全检查通过，放行`)
        return response
        
      } catch (error) {
        console.error(`[${requestId}] 游戏路径验证异常:`, error)
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirect', currentPath)
        return NextResponse.redirect(redirectUrl)
      }
    }
    
    // 5. 其他路径直接放行
    return NextResponse.next()
    
  } catch (globalError) {
    console.error(`[${requestId}] 中间件全局异常:`, globalError)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    // 匹配所有路径（除了静态资源）
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}