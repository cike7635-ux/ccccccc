// /middleware.ts - 完全重构的优化版本
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ==================== 配置与工具函数 ====================

/**
 * 检查是否是管理员邮箱
 */
function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'];
  return adminEmails.some(adminEmail => adminEmail.trim().toLowerCase() === email.toLowerCase());
}

/**
 * 检查是否受保护的游戏路径
 */
function isProtectedGamePath(path: string): boolean {
  const exactPaths = ['/lobby', '/game', '/profile', '/themes', '/game-history'];
  if (exactPaths.includes(path)) return true;
  const prefixPaths = ['/game/', '/themes/'];
  return prefixPaths.some(prefix => path.startsWith(prefix));
}

/**
 * 检查是否公开路径（不需要认证）
 */
function isPublicPath(path: string): boolean {
  const exactPublicPaths = ['/', '/login', '/account-expired', '/renew', '/admin', '/admin/unauthorized', '/login/expired'];
  if (exactPublicPaths.includes(path)) return true;
  const prefixPublicPaths = ['/auth/', '/api/auth/'];
  return prefixPublicPaths.some(prefix => path.startsWith(prefix));
}

/**
 * 在中间件中安全创建Supabase客户端
 */
function createMiddlewareClient(request: NextRequest) {
  // 创建一个响应对象
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 恢复Cookie设置功能，但简化处理
          cookiesToSet.forEach(({ name, value, options }) => {
            // 🔥 关键修复：为admin_key_verified设置正确的路径
            if (name === 'admin_key_verified') {
              response.cookies.set({
                name,
                value,
                path: '/', // 设置为根路径，对所有请求有效
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24, // 24小时
              });
            } else {
              response.cookies.set(name, value, options);
            }
          });
        },
      },
    }
  );

  return { supabase, response };
}

/**
 * 设置管理员验证Cookie（路径设为根目录）
 */
function setAdminKeyVerifiedCookie(response: NextResponse) {
  response.cookies.set({
    name: 'admin_key_verified',
    value: 'true',
    path: '/', // 🔥 关键：设置为根路径，使Cookie对所有请求有效
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24小时
  });
  return response;
}

// ==================== 核心功能：获取已验证的用户 ====================

/**
 * 获取已验证的用户信息（使用安全的getUser()方法）
 */
async function getVerifiedUser(supabase: any) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.warn('[已验证用户] 获取用户失败:', error.message);
      return { user: null, error };
    }
    
    return { user, error: null };
  } catch (error: any) {
    console.error('[已验证用户] 异常:', error.message);
    return { user: null, error };
  }
}

/**
 * 创建带有已验证用户头信息的响应
 */
function createResponseWithUserHeaders(request: NextRequest, user: any, isAdmin: boolean = false) {
  // 创建新的请求头
  const headers = new Headers(request.headers);
  
  // 添加已验证的用户信息到请求头
  headers.set('x-verified-user-id', user.id);
  
  if (user.email) {
    headers.set('x-verified-user-email', user.email);
  }
  
  if (user.user_metadata?.name) {
    headers.set('x-verified-user-name', user.user_metadata.name);
  }
  
  // 添加管理员标志
  if (isAdmin) {
    headers.set('x-admin-verified', 'true');
  }
  
  // 添加一个标志，表明这个用户已经经过中间件验证
  headers.set('x-user-verified-by-middleware', 'true');
  
  // 返回新的响应对象
  const response = NextResponse.next({
    request: {
      headers: headers,
    },
  });
  
  return response;
}

/**
 * 🔥 新增：智能多设备检测函数
 */
async function performSmartDeviceCheck(
  supabase: any,
  user: any,
  profile: any,
  requestId: string,
  request: NextRequest
) {
  const now = new Date();
  
  // 1. 首先获取当前会话（用于生成会话ID）
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  
  if (!currentSession) {
    console.warn(`[${requestId}] 无法获取当前会话`);
    return { shouldContinue: true };
  }
  
  // 生成当前会话标识
  const currentSessionId = `sess_${currentSession.user.id}_${currentSession.access_token.substring(0, 12)}`;
  
  // 2. 检查是否为初始化会话
  if (profile.last_login_session && profile.last_login_session.startsWith('init_')) {
    console.log(`[${requestId}] 检测到初始会话标识，更新为真实会话`);
    
    // 异步更新数据库
    supabase.from('profiles').update({
      last_login_session: currentSessionId,
      last_login_at: now.toISOString(),
      updated_at: now.toISOString()
    }).eq('id', user.id).then(() => {
      console.log(`[${requestId}] 初始会话已更新`);
    });
    
    return { shouldContinue: true };
  }
  
  // 3. 处理空会话标识
  if (!profile.last_login_session) {
    console.log(`[${requestId}] 用户会话标识为空，初始化会话`);
    
    supabase.from('profiles').update({
      last_login_session: currentSessionId,
      last_login_at: now.toISOString(),
      updated_at: now.toISOString()
    }).eq('id', user.id).then(() => {
      console.log(`[${requestId}] 空会话已初始化`);
    });
    
    return { shouldContinue: true };
  }
  
  // 4. 🔥 核心：时间差计算与3秒容忍度
  const lastLoginTime = profile.last_login_at ? new Date(profile.last_login_at) : null;
  const timeSinceLastLogin = lastLoginTime ? now.getTime() - lastLoginTime.getTime() : 0;
  
  // JWT签发时间检查（模拟3秒容忍度）
  const jwtIssuedAt = currentSession.created_at ? new Date(currentSession.created_at) : now;
  const timeSinceJWT = now.getTime() - jwtIssuedAt.getTime();
  
  // 🔥 3秒容忍度：如果JWT刚签发，跳过严格检查
  if (timeSinceJWT < 3000) {
    console.log(`[${requestId}] JWT签发 ${timeSinceJWT}ms 内，跳过严格检查`);
    
    // 更新会话标识为最新
    supabase.from('profiles').update({
      last_login_session: currentSessionId,
      updated_at: now.toISOString()
    }).eq('id', user.id).then(() => {
      console.log(`[${requestId}] JWT宽限期内会话已更新`);
    });
    
    return { shouldContinue: true };
  }
  
  // 5. 🔥 新用户5分钟无限制期检查
  const userCreatedAt = profile.created_at ? new Date(profile.created_at) : null;
  const isNewUser = userCreatedAt ? (now.getTime() - userCreatedAt.getTime() < 24 * 60 * 60 * 1000) : false;
  
  if (isNewUser && timeSinceLastLogin < 300000) { // 5分钟 = 300000ms
    console.log(`[${requestId}] 新用户 ${user.email} 处于5分钟无限制期`);
    
    // 异步更新会话标识
    supabase.from('profiles').update({
      last_login_session: currentSessionId,
      updated_at: now.toISOString()
    }).eq('id', user.id).then(() => {
      console.log(`[${requestId}] 新用户会话标识已更新`);
    });
    
    return { shouldContinue: true };
  }
  
  // 6. 🔥 5分钟宽限期检查（所有用户）
  if (timeSinceLastLogin < 300000) { // 5分钟
    console.log(`[${requestId}] 用户 ${user.email} 处于5分钟宽限期内`);
    
    // 异步更新会话标识
    supabase.from('profiles').update({
      last_login_session: currentSessionId,
      updated_at: now.toISOString()
    }).eq('id', user.id).then(() => {
      console.log(`[${requestId}] 宽限期内会话标识已更新`);
    });
    
    return { shouldContinue: true };
  }
  
  // 7. 🔥 严格会话匹配检查
  if (profile.last_login_session === currentSessionId) {
    console.log(`[${requestId}] 会话标识匹配，正常访问`);
    return { shouldContinue: true };
  }
  
  // 8. 🔥 同一用户但不同token（可能是token刷新）
  if (profile.last_login_session.startsWith(`sess_${user.id}_`)) {
    console.log(`[${requestId}] 同一用户不同token，可能是token刷新`);
    
    // 如果上次登录在30秒内，认为是token刷新
    if (timeSinceLastLogin < 30000) { // 30秒
      console.log(`[${requestId}] 30秒内token刷新，更新会话标识`);
      
      supabase.from('profiles').update({
        last_login_session: currentSessionId,
        updated_at: now.toISOString()
      }).eq('id', user.id).then(() => {
        console.log(`[${requestId}] token刷新会话标识已更新`);
      });
      
      return { shouldContinue: true };
    }
  }
  
  // 9. 🔥 多设备登录检测
  console.log(`[${requestId}] 检测到多设备登录，强制退出`);
  
  const redirectUrl = new URL('/login/expired', request.url);
  redirectUrl.searchParams.set('email', user.email || '');
  redirectUrl.searchParams.set('reason', 'multi_device');
  redirectUrl.searchParams.set('last_session', profile.last_login_session.substring(0, 20));
  if (lastLoginTime) {
    redirectUrl.searchParams.set('last_login_time', lastLoginTime.toISOString());
  }
  
  return { shouldContinue: false, redirectUrl };
}

// ==================== 中间件主函数 ====================

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  const requestId = Math.random().toString(36).substring(7);
  
  // 简化日志，避免过多输出
  if (!currentPath.startsWith('/_next') && !currentPath.startsWith('/favicon')) {
    console.log(`[${requestId}] 中间件: ${currentPath}`);
  }
  
  try {
    // 使用新的安全客户端创建方式
    const { supabase, response } = createMiddlewareClient(request);
    
    // ============ 路径分类处理 ============
    
    // 1. 公开路径直接放行
    if (isPublicPath(currentPath)) {
      if (currentPath === '/admin' || currentPath === '/admin/login') {
        // 管理员登录页特殊处理
        console.log(`[${requestId}] 管理员登录页，放行`);
      }
      return response;
    }
    
    // 2. API路径处理 - 特殊处理/admin/api路径
    if (currentPath.startsWith('/api/admin/')) {
      console.log(`[${requestId}] 处理管理API: ${currentPath}`);
      
      // 检查管理员Cookie
      const adminKeyVerified = request.cookies.get('admin_key_verified');
      
      if (!adminKeyVerified || adminKeyVerified.value !== 'true') {
        console.log(`[${requestId}] 管理API未通过密钥验证`);
        
        // 作为临时方案，也检查referer
        const referer = request.headers.get('referer');
        const isFromAdminPage = referer?.includes('/admin/');
        
        if (!isFromAdminPage) {
          return NextResponse.json(
            { success: false, error: '未授权访问管理API' },
            { status: 401 }
          );
        } else {
          console.log(`[${requestId}] 管理API通过referer验证: ${referer}`);
        }
      } else {
        console.log(`[${requestId}] 管理API通过Cookie验证`);
      }
      
      // 继续处理API请求
      return response;
    }
    
    // 其他API路径直接放行
    if (currentPath.startsWith('/api/')) {
      return response;
    }
    
    // 3. 管理员路径处理（独立验证）
    if (currentPath.startsWith('/admin')) {
      // 管理员登录页面直接放行
      if (currentPath === '/admin' || currentPath === '/admin/login') {
        return response;
      }
      
      // 其他管理员页面需要验证管理员密钥
      const adminKeyVerified = request.cookies.get('admin_key_verified');
      
      if (!adminKeyVerified || adminKeyVerified.value !== 'true') {
        console.log(`[${requestId}] 管理员未通过密钥验证`);
        const redirectUrl = new URL('/admin', request.url);
        redirectUrl.searchParams.set('redirect', currentPath);
        return NextResponse.redirect(redirectUrl);
      }
      
      // 获取已验证的用户
      const { user, error } = await getVerifiedUser(supabase);
      
      if (error || !user) {
        console.log(`[${requestId}] 管理员未登录`);
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      
      // 验证管理员邮箱
      if (!isAdminEmail(user.email)) {
        console.log(`[${requestId}] 非管理员访问后台: ${user.email}`);
        return NextResponse.redirect(new URL('/admin/unauthorized', request.url));
      }
      
      console.log(`[${requestId}] 管理员验证通过: ${user.email}`);
      
      // 重新设置Cookie，确保路径正确
      const adminResponse = setAdminKeyVerifiedCookie(
        createResponseWithUserHeaders(request, user, true)
      );
      
      return adminResponse;
    }
    
    // 4. 受保护的游戏路径（完整验证）
    if (isProtectedGamePath(currentPath)) {
      try {
        console.time(`[${requestId}] 完整验证`);
        
        // ============ 基础登录验证 ============
        console.time(`[${requestId}] 获取用户`);
        const { user, error: authError } = await getVerifiedUser(supabase);
        
        if (authError || !user) {
          console.timeEnd(`[${requestId}] 获取用户`);
          console.log(`[${requestId}] 用户未登录，重定向到登录页`);
          const redirectUrl = new URL('/login', request.url);
          redirectUrl.searchParams.set('redirect', currentPath);
          return NextResponse.redirect(redirectUrl);
        }
        
        console.timeEnd(`[${requestId}] 获取用户`);
        console.log(`[${requestId}] 用户已登录: ${user.email} (管理员: ${isAdminEmail(user.email)})`);
        
        // ============ 获取用户资料 ============
        console.time(`[${requestId}] 查询用户资料`);
        let profile = null;
        
        try {
          // 🔥 优化：使用 maybeSingle() 避免阻塞
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, account_expires_at, last_login_at, last_login_session, created_at, membership_level, nickname')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profileError) {
            console.warn(`[${requestId}] 查询用户资料失败: ${profileError.message}`);
            // 资料不存在时创建默认资料
            console.log(`[${requestId}] 创建默认用户资料: ${user.email}`);
            
            const now = new Date();
            const defaultExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const initialSessionId = `init_${user.id}_${Date.now()}`;
            
            const { data: newProfile } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                email: user.email,
                account_expires_at: defaultExpires.toISOString(),
                last_login_at: now.toISOString(),
                last_login_session: initialSessionId,
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
                nickname: user.email?.split('@')[0] || '用户',
                membership_level: 1,
              })
              .select()
              .single();
            
            profile = newProfile;
          } else {
            profile = data;
          }
        } catch (profileError) {
          console.error(`[${requestId}] 获取用户资料异常:`, profileError);
          // 出错时继续，不阻塞用户
        }
        
        console.timeEnd(`[${requestId}] 查询用户资料`);
        
        if (!profile) {
          console.log(`[${requestId}] 用户资料不存在，创建默认后放行`);
          return createResponseWithUserHeaders(request, user);
        }
        
        // ============ 会员过期验证 ============
        console.time(`[${requestId}] 会员验证`);
        const now = new Date();
        
        // 🔥 优化：智能处理会员有效期
        if (!profile.account_expires_at) {
          console.log(`[${requestId}] 用户 ${profile.email} 无会员有效期，异步修复`);
          
          // 异步修复，不阻塞当前请求
          setTimeout(async () => {
            try {
              const defaultExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
              await supabase
                .from('profiles')
                .update({ 
                  account_expires_at: defaultExpires.toISOString(),
                  membership_level: 1,
                  updated_at: now.toISOString()
                })
                .eq('id', user.id);
              console.log(`[${requestId}] 异步修复用户有效期完成`);
            } catch (asyncError) {
              console.error(`[${requestId}] 异步修复失败:`, asyncError);
            }
          }, 0);
        } 
        else if (new Date(profile.account_expires_at) < now) {
          // 确实过期了
          console.log(`[${requestId}] 会员已过期: ${profile.account_expires_at}`);
          
          // 如果是新用户（24小时内），宽容处理
          const userCreatedAt = profile.created_at ? new Date(profile.created_at) : new Date();
          const timeSinceCreation = now.getTime() - userCreatedAt.getTime();
          
          if (timeSinceCreation < 24 * 60 * 60 * 1000) {
            console.log(`[${requestId}] 新用户（24小时内）过期，自动续期并放行`);
            
            // 异步续期
            setTimeout(async () => {
              try {
                const newExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                await supabase
                  .from('profiles')
                  .update({ 
                    account_expires_at: newExpires.toISOString(),
                    updated_at: now.toISOString()
                  })
                  .eq('id', user.id);
              } catch (asyncError) {
                console.error(`[${requestId}] 自动续期失败:`, asyncError);
              }
            }, 0);
          } else {
            // 老用户过期，重定向
            console.timeEnd(`[${requestId}] 会员验证`);
            return NextResponse.redirect(new URL('/account-expired', request.url));
          }
        }
        
        console.timeEnd(`[${requestId}] 会员验证`);
        
        // ============ 🔥 智能多设备检测 ============
        console.time(`[${requestId}] 多设备检测`);
        const deviceCheck = await performSmartDeviceCheck(supabase, user, profile, requestId, request);
        
        if (!deviceCheck.shouldContinue) {
          console.timeEnd(`[${requestId}] 多设备检测`);
          console.timeEnd(`[${requestId}] 完整验证`);
          return NextResponse.redirect(deviceCheck.redirectUrl!);
        }
        
        console.timeEnd(`[${requestId}] 多设备检测`);
        console.timeEnd(`[${requestId}] 完整验证`);
        
        return createResponseWithUserHeaders(request, user);
        
      } catch (gamePathError) {
        console.error(`[${requestId}] 游戏路径验证异常:`, gamePathError);
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirect', currentPath);
        return NextResponse.redirect(redirectUrl);
      }
    }
    
    // 5. 其他未分类路径
    // 对于其他路径，我们仍然尝试获取用户信息（如果存在）
    try {
      const { user } = await getVerifiedUser(supabase);
      if (user) {
        // 如果有用户，将信息传递给页面
        return createResponseWithUserHeaders(request, user);
      }
    } catch (e) {
      // 忽略错误，继续处理
    }
    
    return response;
    
  } catch (globalError) {
    console.error(`[中间件] 全局异常:`, globalError);
    const redirectUrl = new URL('/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }
}

// ==================== 中间件配置 ====================

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};