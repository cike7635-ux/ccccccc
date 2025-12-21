// /middleware.ts - 增强版本 (包含用户验证传递功能)
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
  // 创建一个不自动管理cookie的响应对象
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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

// ==================== 核心功能：获取已验证的用户 ====================

/**
 * 获取已验证的用户信息（使用安全的getUser()方法）
 */
async function getVerifiedUser(supabase: any) {
  try {
    // 🔥 关键修复：使用 getUser() 而不是 getSession()
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
 * 将已验证的用户信息添加到响应头中
 */
function addVerifiedUserHeaders(response: NextResponse, user: any) {
  if (!user) return response;
  
  // 创建新的请求头
  const requestHeaders = new Headers(response.request.headers);
  
  // 添加已验证的用户信息到请求头
  requestHeaders.set('x-verified-user-id', user.id);
  
  if (user.email) {
    requestHeaders.set('x-verified-user-email', user.email);
  }
  
  if (user.user_metadata?.name) {
    requestHeaders.set('x-verified-user-name', user.user_metadata.name);
  }
  
  // 添加一个标志，表明这个用户已经经过中间件验证
  requestHeaders.set('x-user-verified-by-middleware', 'true');
  
  // 创建一个新的响应，带有更新后的请求头
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
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
      if (currentPath === '/admin') {
        // 管理员登录页特殊处理
        console.log(`[${requestId}] 管理员登录页，放行`);
      }
      return response;
    }
    
    // 2. API路径处理
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
      
      // 将已验证的管理员信息添加到响应头
      return addVerifiedUserHeaders(response, user);
    }
    
    // 4. 受保护的游戏路径（完整验证）
    if (isProtectedGamePath(currentPath)) {
      try {
        // ============ 基础登录验证 ============
        const { user, error: authError } = await getVerifiedUser(supabase);
        
        if (authError || !user) {
          console.log(`[${requestId}] 用户未登录`);
          const redirectUrl = new URL('/login', request.url);
          redirectUrl.searchParams.set('redirect', currentPath);
          return NextResponse.redirect(redirectUrl);
        }
        
        console.log(`[${requestId}] 用户已登录: ${user.email} (管理员: ${isAdminEmail(user.email)})`);
        
        // ============ 获取用户资料 ============
        let profile = null;
        try {
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, account_expires_at, last_login_at, last_login_session')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.warn(`[${requestId}] 查询用户资料失败: ${profileError.message}`);
            // 资料不存在时允许继续，避免循环重定向
            // 但仍然将用户信息传递给页面
            return addVerifiedUserHeaders(response, user);
          }
          
          profile = data;
        } catch (profileError) {
          console.error(`[${requestId}] 获取用户资料异常:`, profileError);
          return addVerifiedUserHeaders(response, user);
        }
        
        if (!profile) {
          console.log(`[${requestId}] 用户资料不存在`);
          return addVerifiedUserHeaders(response, user);
        }
        
        // ============ 会员过期验证 ============
        const now = new Date();
        const isExpired = !profile.account_expires_at || new Date(profile.account_expires_at) < now;
        
        if (isExpired && currentPath !== '/account-expired') {
          console.log(`[${requestId}] 会员已过期: ${profile.account_expires_at}`);
          return NextResponse.redirect(new URL('/account-expired', request.url));
        }
        
        // ============ 优化的多设备登录验证 ============
        try {
          // 获取当前会话信息
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          
          if (!currentSession) {
            console.warn(`[${requestId}] 当前会话不存在`);
            const redirectUrl = new URL('/login', request.url);
            redirectUrl.searchParams.set('redirect', currentPath);
            return NextResponse.redirect(redirectUrl);
          }
          
          // 生成当前会话标识
          const currentSessionId = `sess_${currentSession.user.id}_${currentSession.access_token.substring(0, 12)}`;
          
          // 只有数据库中存在会话标识时才进行比对
          if (profile.last_login_session) {
            // 添加更宽松的匹配逻辑
            const isSessionMatch = 
              profile.last_login_session === currentSessionId ||
              profile.last_login_session.startsWith(`sess_${currentSession.user.id}_`);
            
            if (!isSessionMatch) {
              console.log(`[${requestId}] 检测到会话标识不匹配`);
              
              // 额外检查：最后登录时间
              const lastLoginTime = profile.last_login_at ? new Date(profile.last_login_at) : null;
              const timeSinceLastLogin = lastLoginTime ? now.getTime() - lastLoginTime.getTime() : 0;
              
              // 更宽松的时间判断：2分钟内认为是正常操作
              if (timeSinceLastLogin < 120000) { // 2分钟
                console.log(`[${requestId}] 最后登录发生在 ${timeSinceLastLogin}ms 前，认为是正常操作`);
                // 更新为当前会话标识
                await supabase
                  .from('profiles')
                  .update({ 
                    last_login_session: currentSessionId,
                    updated_at: now.toISOString()
                  })
                  .eq('id', user.id);
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
          } else {
            // 数据库中无会话标识，初始化新的会话
            await supabase
              .from('profiles')
              .update({ 
                last_login_at: now.toISOString(),
                last_login_session: currentSessionId,
                updated_at: now.toISOString()
              })
              .eq('id', user.id);
          }
          
        } catch (sessionError) {
          console.error(`[${requestId}] 会话验证错误:`, sessionError);
          // 出错时不中断用户访问
        }
        
        console.log(`[${requestId}] 游戏路径验证通过`);
        
        // ============ 关键：将已验证的用户信息传递给页面 ============
        return addVerifiedUserHeaders(response, user);
        
      } catch (gamePathError) {
        console.error(`[${requestId}] 游戏路径验证异常:`, gamePathError);
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
    
    // 5. 其他未分类路径
    // 对于其他路径，我们仍然尝试获取用户信息（如果存在）
    try {
      const { user } = await getVerifiedUser(supabase);
      if (user) {
        // 如果有用户，将信息传递给页面
        return addVerifiedUserHeaders(response, user);
      }
    } catch (e) {
      // 忽略错误，继续处理
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
