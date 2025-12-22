// /middleware.ts - 完整修复版本
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
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({
              name,
              value,
              ...options,
              path: options?.path || '/',
            });
          });
        },
      },
    }
  );

  return { supabase, response };
}

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
function createResponseWithUserHeaders(request: NextRequest, user: any) {
  const headers = new Headers(request.headers);
  headers.set('x-verified-user-id', user.id);
  
  if (user.email) {
    headers.set('x-verified-user-email', user.email);
  }
  
  if (user.user_metadata?.name) {
    headers.set('x-verified-user-name', user.user_metadata.name);
  }
  
  headers.set('x-user-verified-by-middleware', 'true');
  
  return NextResponse.next({
    request: {
      headers: headers,
    },
  });
}

/**
 * 🔥 修复后的多设备检查函数 - 统一处理
 */
async function handleMultiDeviceCheck(
  request: NextRequest,
  requestId: string,
  supabase: any,
  user: any,
  profile: any,
  response: NextResponse
): Promise<NextResponse | null> {
  try {
    // 获取当前会话
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession) {
      console.warn(`[${requestId}] 当前会话不存在`);
      return null;
    }
    
    // 生成当前会话标识
    const currentSessionId = `sess_${currentSession.user.id}_${currentSession.access_token.substring(0, 12)}`;
    const now = new Date();
    
    // 🔥 新用户特殊处理：注册10分钟内的用户
    const userCreatedAt = user?.created_at ? new Date(user.created_at) : null;
    const isNewUser = userCreatedAt && (now.getTime() - userCreatedAt.getTime() < 10 * 60 * 1000); // 10分钟内
    
    // 🔥 首次登录特殊处理：数据库中无last_login_session
    const isFirstLogin = !profile.last_login_session;
    
    // 🔥 如果用户注册后首次访问，完全跳过多设备检查
    if (isNewUser || isFirstLogin) {
      console.log(`[${requestId}] 新用户/首次登录，跳过多设备检查`, {
        email: user.email,
        isNewUser,
        isFirstLogin,
        userCreatedAt: user.created_at
      });
      
      // 确保数据库中的session标识正确
      await supabase
        .from('profiles')
        .update({ 
          last_login_session: currentSessionId,
          last_login_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', user.id);
      
      console.log(`[${requestId}] 已更新用户会话标识: ${currentSessionId}`);
      return null; // 返回null表示通过检查
    }
    
    // 🔥 老用户的多设备检查（宽松版）
    if (profile.last_login_session) {
      // 宽松匹配：只要前缀相同就认为是同一设备
      const isSessionMatch = 
        profile.last_login_session === currentSessionId ||
        profile.last_login_session.startsWith(`sess_${currentSession.user.id}_`);
      
      if (!isSessionMatch) {
        console.log(`[${requestId}] 检测到会话标识不匹配`);
        
        // 检查最后登录时间
        const lastLoginTime = profile.last_login_at ? new Date(profile.last_login_at) : null;
        const timeSinceLastLogin = lastLoginTime ? now.getTime() - lastLoginTime.getTime() : 0;
        
        // 🔥 延长宽限期到60秒（原来是3秒）
        if (timeSinceLastLogin < 60000) { // 60秒
          console.log(`[${requestId}] 最后登录发生在 ${timeSinceLastLogin}ms 前，认为是正常操作`);
          // 更新为当前会话标识
          await supabase
            .from('profiles')
            .update({ 
              last_login_session: currentSessionId,
              updated_at: now.toISOString()
            })
            .eq('id', user.id);
          return null;
        } else {
          console.log(`[${requestId}] 判定为多设备登录，强制退出`);
          
          // 清除会话cookie
          response.cookies.delete('sb-access-token');
          response.cookies.delete('sb-refresh-token');
          
          // 重定向到过期页面
          const redirectUrl = new URL('/login/expired', request.url);
          redirectUrl.searchParams.set('email', user.email || '');
          redirectUrl.searchParams.set('reason', 'multi_device');
          if (lastLoginTime) {
            redirectUrl.searchParams.set('last_login_time', lastLoginTime.toISOString());
          }
          
          return NextResponse.redirect(redirectUrl);
        }
      }
    }
    
    return null; // 通过检查
  } catch (error) {
    console.error(`[${requestId}] 多设备检查异常:`, error);
    return null; // 出错时放行，避免影响用户体验
  }
}

// ==================== 中间件主函数 ====================

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  const requestId = Math.random().toString(36).substring(7);
  
  // 简化日志
  if (!currentPath.startsWith('/_next') && !currentPath.startsWith('/favicon')) {
    console.log(`[${requestId}] 中间件: ${currentPath}`);
  }
  
  try {
    const { supabase, response } = createMiddlewareClient(request);
    
    // ============ 路径分类处理 ============
    
    // 1. 公开路径直接放行
    if (isPublicPath(currentPath)) {
      if (currentPath === '/admin') {
        console.log(`[${requestId}] 管理员登录页，放行`);
      }
      return response;
    }
    
    // 2. API路径处理
    if (currentPath.startsWith('/api/')) {
      return response;
    }
    
    // 3. 管理员路径处理
    if (currentPath.startsWith('/admin')) {
      if (currentPath === '/admin' || currentPath === '/admin/login') {
        return response;
      }
      
      const adminKeyVerified = request.cookies.get('admin_key_verified');
      if (!adminKeyVerified || adminKeyVerified.value !== 'true') {
        console.log(`[${requestId}] 管理员未通过密钥验证`);
        const redirectUrl = new URL('/admin', request.url);
        redirectUrl.searchParams.set('redirect', currentPath);
        return NextResponse.redirect(redirectUrl);
      }
      
      const { user, error } = await getVerifiedUser(supabase);
      
      if (error || !user) {
        console.log(`[${requestId}] 管理员未登录`);
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      
      if (!isAdminEmail(user.email)) {
        console.log(`[${requestId}] 非管理员访问后台: ${user.email}`);
        return NextResponse.redirect(new URL('/admin/unauthorized', request.url));
      }
      
      console.log(`[${requestId}] 管理员验证通过: ${user.email}`);
      
      // 🔥 管理员也需要检查多设备（但更宽松）
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('last_login_session, last_login_at')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          const multiDeviceResult = await handleMultiDeviceCheck(
            request, requestId, supabase, user, profile, response
          );
          
          if (multiDeviceResult) {
            return multiDeviceResult;
          }
        }
      } catch (profileError) {
        // 忽略profile错误，继续执行
        console.warn(`[${requestId}] 管理员profile查询失败:`, profileError);
      }
      
      return createResponseWithUserHeaders(request, user);
    }
    
    // 4. 受保护的游戏路径
    if (isProtectedGamePath(currentPath)) {
      try {
        const { user, error: authError } = await getVerifiedUser(supabase);
        
        if (authError || !user) {
          console.log(`[${requestId}] 用户未登录，重定向到登录页`);
          const redirectUrl = new URL('/login', request.url);
          redirectUrl.searchParams.set('redirect', currentPath);
          return NextResponse.redirect(redirectUrl);
        }
        
        console.log(`[${requestId}] 用户已登录: ${user.email} (管理员: ${isAdminEmail(user.email)})`);
        
        // 获取用户资料
        let profile = null;
        try {
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, account_expires_at, last_login_at, last_login_session')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.warn(`[${requestId}] 查询用户资料失败: ${profileError.message}`);
            // 返回用户信息，跳过后续检查
            return createResponseWithUserHeaders(request, user);
          }
          
          profile = data;
        } catch (profileError) {
          console.error(`[${requestId}] 获取用户资料异常:`, profileError);
          return createResponseWithUserHeaders(request, user);
        }
        
        if (!profile) {
          console.log(`[${requestId}] 用户资料不存在`);
          return createResponseWithUserHeaders(request, user);
        }
        
        // 会员过期验证
        const now = new Date();
        const isExpired = !profile.account_expires_at || new Date(profile.account_expires_at) < now;
        
        if (isExpired && currentPath !== '/account-expired') {
          console.log(`[${requestId}] 会员已过期: ${profile.account_expires_at}`);
          return NextResponse.redirect(new URL('/account-expired', request.url));
        }
        
        // 🔥 统一的多设备检查
        const multiDeviceResult = await handleMultiDeviceCheck(
          request, requestId, supabase, user, profile, response
        );
        
        if (multiDeviceResult) {
          return multiDeviceResult;
        }
        
        console.log(`[${requestId}] 游戏路径验证通过`);
        return createResponseWithUserHeaders(request, user);
        
      } catch (gamePathError) {
        console.error(`[${requestId}] 游戏路径验证异常:`, gamePathError);
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
    
    // 5. 其他路径 - 也进行多设备检查（修复的关键）
    // 🔥 修复：即使是其他路径，如果有登录用户，也检查多设备
    
    try {
      const { user, error: authError } = await getVerifiedUser(supabase);
      
      if (!authError && user) {
        console.log(`[${requestId}] 其他路径检测到登录用户: ${user.email}`);
        
        // 获取用户资料
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('last_login_session, last_login_at')
            .eq('id', user.id)
            .single();
          
          if (profile) {
            // 🔥 其他路径也进行多设备检查
            const multiDeviceResult = await handleMultiDeviceCheck(
              request, requestId, supabase, user, profile, response
            );
            
            if (multiDeviceResult) {
              return multiDeviceResult;
            }
          }
        } catch (profileError) {
          // 忽略profile错误
        }
        
        // 将用户信息传递给页面
        return createResponseWithUserHeaders(request, user);
      }
    } catch (e) {
      // 忽略错误
    }
    
    return response;
    
  } catch (globalError) {
    console.error(`[中间件] 全局异常:`, globalError);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// ==================== 中间件配置 ====================

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
