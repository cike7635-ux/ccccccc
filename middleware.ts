// /middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 1. 创建对中间件友好的Supabase客户端
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // 在中间件中设置Cookie需要特殊处理
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          // 注意：在Next.js中间件中，实际上需要通过NextResponse来设置cookie
          // 下面我们会用另一种方式实现
        },
      },
    }
  );

  // 2. 定义路径规则（可根据需要调整）
  const publicPaths = [
    '/',
    '/login',
    '/auth/forgot-password',
    '/auth/confirm',
    '/auth/error',
    '/account-expired', // 过期页面本身应可访问
    '/renew',          // 续费页面应可访问
    '/api/auth/signup-with-key', // 注册API
  ];
  
  const protectedPaths = [
    '/lobby',
    '/game',
    '/profile',
    '/tasks',
    '/themes',
  ];
  
  const currentPath = request.nextUrl.pathname;
  
  // 3. 判断当前请求路径
  const isPublicPath = publicPaths.some(path => currentPath.startsWith(path));
  const isProtectedPath = protectedPaths.some(path => currentPath.startsWith(path));
  const isApiPath = currentPath.startsWith('/api/');
  
  // 4. 公开路径直接放行
  if (isPublicPath && !isApiPath) {
    return NextResponse.next();
  }
  
  // 5. 对于受保护路径和受保护API，进行验证
  if (isProtectedPath || (isApiPath && !currentPath.includes('/auth/'))) {
    try {
      // 5.1 检查用户是否登录
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        // 未登录，重定向到登录页，并携带来源地址以便登录后返回
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirectedFrom', currentPath);
        return NextResponse.redirect(redirectUrl);
      }
      
      // 5.2 检查会员有效期（核心新增逻辑）
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('account_expires_at')
        .eq('id', user.id)
        .single();
      
      // 判断是否过期：没有记录、记录为空、或过期时间早于现在
      const isExpired = !profile || 
                       !profile.account_expires_at || 
                       new Date(profile.account_expires_at) < new Date();
      
      // 如果已过期，且当前不是过期页面本身，则重定向
      if (isExpired && currentPath !== '/account-expired') {
        console.log(`[Middleware] 用户 ${user.email} 会员已过期，重定向`);
        return NextResponse.redirect(new URL('/account-expired', request.url));
      }
      
      // 5.3 验证通过，继续请求
      const response = NextResponse.next();
      
      // 可选：将用户信息添加到请求头，供后续处理使用
      response.headers.set('x-user-id', user.id);
      response.headers.set('x-user-email', user.email || '');
      
      return response;
      
    } catch (error) {
      console.error('[Middleware] 验证过程中发生错误:', error);
      // 发生错误时，保守起见重定向到登录页
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }
  }
  
  // 6. 其他路径（如公开API、静态资源等）直接放行
  return NextResponse.next();
}

// 7. 配置中间件生效的路径
export const config = {
  matcher: [
    // 匹配所有路径，排除_next等内部路径
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
