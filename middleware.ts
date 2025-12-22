import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ==================== 配置与工具函数 ====================

function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'];
  return adminEmails.some(adminEmail => adminEmail.trim().toLowerCase() === email.toLowerCase());
}

function isProtectedGamePath(path: string): boolean {
  const exactPaths = ['/lobby', '/game', '/profile', '/themes', '/game-history'];
  if (exactPaths.includes(path)) return true;
  const prefixPaths = ['/game/', '/themes/'];
  return prefixPaths.some(prefix => path.startsWith(prefix));
}

function isPublicPath(path: string): boolean {
  const exactPublicPaths = ['/', '/login', '/account-expired', '/renew', '/admin', '/admin/unauthorized', '/login/expired'];
  if (exactPublicPaths.includes(path)) return true;
  const prefixPublicPaths = ['/auth/', '/api/auth/'];
  return prefixPublicPaths.some(prefix => path.startsWith(prefix));
}

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
 * 🔥 修复后的多设备检查函数
 * 主要修改：
 * 1. 从profiles表的created_at判断是否是新用户
 * 2. 宽限期改为5秒（您要求的）
 * 3. 新用户（注册10分钟内）完全跳过多设备检查
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
    // 🔥 检查是否有新用户标记Cookie（注册API设置的）
    const newUserCookie = request.cookies.get('new_user_grace_period');
    if (newUserCookie && newUserCookie.value === 'true') {
      console.log(`[${requestId}] 检测到新用户标记Cookie，跳过多设备检查`);
      
      // 清除这个Cookie，只允许第一次访问使用
      response.cookies.delete('new_user_grace_period');
      
      // 确保数据库中的session标识正确
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const currentSessionId = `sess_${session.user.id}_${session.access_token.substring(0, 12)}`;
        await supabase
          .from('profiles')
          .update({ 
            last_login_session: currentSessionId,
            last_login_at: new Date().toISOString()
          })
          .eq('id', user.id);
      }
      
      return null; // 通过检查
    }
    
    // 获取当前会话
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession) {
      console.warn(`[${requestId}] 当前会话不存在`);
      return null;
    }
    
    // 生成当前会话标识
    const currentSessionId = `sess_${currentSession.user.id}_${currentSession.access_token.substring(0, 12)}`;
    const now = new Date();
    
    // 🔥 新用户判断：检查profiles表中的created_at
    let isNewUser = false;
    if (profile.created_at) {
      const userCreatedAt = new Date(profile.created_at);
      isNewUser = (now.getTime() - userCreatedAt.getTime()) < 10 * 60 * 1000; // 10分钟内
    }
    
    // 🔥 首次登录：数据库中无last_login_session
    const isFirstLogin = !profile.last_login_session;
    
    // 🔥 如果是新用户或首次登录，完全跳过多设备检查
    if (isNewUser || isFirstLogin) {
      console.log(`[${requestId}] 新用户/首次登录，跳过多设备检查`, {
        email: user.email,
        isNewUser,
        isFirstLogin,
        userCreatedAt: profile.created_at
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
      return null;
    }
    
    // 🔥 老用户的多设备检查（5秒宽限期）
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
        
        // 🔥 宽限期改为5秒（您的要求）
        if (timeSinceLastLogin < 5000) { // 5秒
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
    
    return null;
  } catch (error) {
    console.error(`[${requestId}] 多设备检查异常:`, error);
    return null;
  }
}

// ==================== 中间件主函数 ====================

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  const requestId = Math.random().toString(36).substring(7);
  
  if (!currentPath.startsWith('/_next') && !currentPath.startsWith('/favicon')) {
    console.log(`[${requestId}] 中间件: ${currentPath}`);
  }
  
  try {
    const { supabase, response } = createMiddlewareClient(request);
    
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
      
      return createResponseWithUserHeaders(request, user);
    }
    
    // 4. 受保护的游戏路径
    if (isProtectedGamePath(currentPath)) {
      try {
        const { user, error: authError } = await getVerifiedUser(supabase);
        
        if (authError || !user) {
          console.log(`[${requestId}] 用户未登录，检查是否新用户`);
          
          // 🔥 检查是否是新注册用户（通过Cookie）
          const newUserCookie = request.cookies.get('new_user_grace_period');
          if (newUserCookie && newUserCookie.value === 'true') {
            console.log(`[${requestId}] 新注册用户，重定向到登录页（预填邮箱）`);
            const redirectUrl = new URL('/login', request.url);
            redirectUrl.searchParams.set('redirect', currentPath);
            redirectUrl.searchParams.set('from', 'signup');
            
            // 清除Cookie
            const redirectResponse = NextResponse.redirect(redirectUrl);
            redirectResponse.cookies.delete('new_user_grace_period');
            return redirectResponse;
          }
          
          // 原有逻辑
          console.log(`[${requestId}] 检查是否多设备被踢出`);
          const redirectUrl = new URL('/login/expired', request.url);
          redirectUrl.searchParams.set('reason', 'session_expired_maybe_multi_device');
          return NextResponse.redirect(redirectUrl);
        }
        
        console.log(`[${requestId}] 用户已登录: ${user.email} (管理员: ${isAdminEmail(user.email)})`);
        
        // 获取用户资料 - 🔥 现在包括created_at字段
        let profile = null;
        try {
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, account_expires_at, last_login_at, last_login_session, created_at')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.warn(`[${requestId}] 查询用户资料失败: ${profileError.message}`);
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
    
    // 5. 其他路径
    try {
      const { user, error: authError } = await getVerifiedUser(supabase);
      
      if (!authError && user) {
        console.log(`[${requestId}] 其他路径检测到登录用户: ${user.email}`);
        
        // 获取用户资料
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('last_login_session, last_login_at, created_at')
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
          // 忽略
        }
        
        return createResponseWithUserHeaders(request, user);
      }
    } catch (e) {
      // 忽略
    }
    
    return response;
    
  } catch (globalError) {
    console.error(`[中间件] 全局异常:`, globalError);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
