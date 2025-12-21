// /middleware.ts 
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// 辅助函数：从JWT中解析创建时间
function getJwtCreationTime(jwt: string): Date | null {
  try {
    const payloadBase64 = jwt.split('.')[1];
    if (!payloadBase64) return null;
    
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;
    
    const payloadJson = decodeURIComponent(
      atob(paddedBase64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const payload = JSON.parse(payloadJson);
    
    if (payload.iat) {
      return new Date(payload.iat * 1000);
    }
    
    return null;
  } catch (error) {
    console.error('解析JWT失败:', error);
    return null;
  }
}

// 检查是否是管理员（仅用于日志记录，不再用于权限控制）
function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'];
  return adminEmails.some(adminEmail => 
    adminEmail.trim().toLowerCase() === email.toLowerCase()
  );
}

// 检查是否受保护的游戏路径
function isProtectedGamePath(path: string): boolean {
  const protectedPaths = [
    '/lobby',
    '/game',
    '/profile',
    '/themes',
    '/game-history',
  ];
  return protectedPaths.some(p => path.startsWith(p));
}

// 检查是否公开路径
function isPublicPath(path: string): boolean {
  const publicPaths = [
    '/',
    '/login',
    '/login/expired',
    '/auth/forgot-password',
    '/auth/confirm',
    '/auth/error',
    '/account-expired',
    '/renew',
    '/api/auth/signup-with-key',
    '/api/auth/renew-account',
    '/admin',           // ⭐ 管理员页面也作为公开路径，由/admin自己处理验证
    '/admin/unauthorized',
  ];
  return publicPaths.some(p => path.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  console.log(`[中间件] 请求路径: ${currentPath}`);
  
  // 1. 创建响应对象
  const response = NextResponse.next();
  
  // 2. 创建Supabase客户端
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          const cookies: { name: string; value: string }[] = [];
          request.cookies.getAll().forEach(cookie => {
            cookies.push({ name: cookie.name, value: cookie.value });
          });
          return cookies;
        },
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 3. 公开路径直接放行（包括/admin，由/admin页面自己处理验证）
  if (isPublicPath(currentPath)) {
    console.log(`[中间件] 放行公开路径: ${currentPath}`);
    return response;
  }
  
  // 4. API路径处理
  if (currentPath.startsWith('/api/')) {
    console.log(`[中间件] API路径: ${currentPath}`);
    return response;
  }
  
  // 5. 受保护的游戏路径（需要完整验证）
  if (isProtectedGamePath(currentPath)) {
    console.log(`[中间件] 游戏路径验证: ${currentPath}`);
    
    try {
      // 5.1 检查用户是否登录
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log(`[中间件] 游戏路径未登录，重定向到/login`);
        
        // 创建重定向URL
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirect', currentPath);
        
        return NextResponse.redirect(redirectUrl);
      }
      
      console.log(`[中间件] 用户已登录: ${user.email} (管理员: ${isAdminEmail(user.email)})`);
      
      // ⭐ 关键修改：不再对管理员进行特殊处理，一视同仁
      
      // 5.2 获取用户资料
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_expires_at, last_login_at, last_login_session')
        .eq('id', user.id)
        .single();
      
      if (!profile) {
        console.log(`[中间件] 用户资料不存在: ${user.id}`);
        return NextResponse.redirect(new URL('/login?error=profile_not_found', request.url));
      }
      
      // 5.3 检查会员有效期
      const isExpired = !profile?.account_expires_at || 
                       new Date(profile.account_expires_at) < new Date();
      
      if (isExpired && currentPath !== '/account-expired') {
        console.log(`[中间件] 用户会员已过期: ${user.email}`);
        return NextResponse.redirect(new URL('/account-expired', request.url));
      }
      
      // 5.4 多设备登录验证
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        console.log(`[中间件] 会话不存在: ${user.id}`);
        return NextResponse.redirect(new URL('/login?error=no_session', request.url));
      }
      
      const sessionCreatedTime = getJwtCreationTime(currentSession.access_token);
      const lastLoginTime = profile.last_login_at ? new Date(profile.last_login_at) : null;
      const tolerance = 3000; // 3秒容差
      
      // ⭐ 关键修改：优化多设备检测逻辑
      // 只有当确实有新的登录时（last_login_time > session_created_time）才触发
      if (lastLoginTime && sessionCreatedTime) {
        const timeDiff = lastLoginTime.getTime() - sessionCreatedTime.getTime();
        
        if (timeDiff > tolerance) {
          console.log(`[中间件] 检测到多设备登录: ${user.email}`);
          console.log(`  - 会话创建时间: ${sessionCreatedTime.toISOString()}`);
          console.log(`  - 最后登录时间: ${lastLoginTime.toISOString()}`);
          console.log(`  - 时间差: ${timeDiff}ms`);
          
          // 清除会话cookie
          response.cookies.delete('sb-access-token');
          response.cookies.delete('sb-refresh-token');
          
          // 重定向到过期页面
          const userEmail = user.email || '';
          const lastLoginTimeStr = lastLoginTime.toISOString();
          const redirectUrl = new URL('/login/expired', request.url);
          redirectUrl.searchParams.set('email', userEmail);
          redirectUrl.searchParams.set('last_login_time', lastLoginTimeStr);
          
          return NextResponse.redirect(redirectUrl);
        }
      }
      
      console.log(`[中间件] 游戏路径验证通过: ${user.email}`);
      return response;
      
    } catch (error) {
      console.error(`[中间件] 游戏路径验证错误:`, error);
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }
  }
  
  // 6. 其他路径直接放行
  console.log(`[中间件] 放行其他路径: ${currentPath}`);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
