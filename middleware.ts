// /middleware.ts
import { updateSession } from "@/lib/supabase/middleware";
import { createMiddlewareClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

export async function middleware(request: NextRequest) {
  // 1. 首先，执行原有的会话更新逻辑（保持你项目的原有功能）
  const updateSessionResponse = await updateSession(request);
  
  // 创建一个用于后续操作的响应对象
  const response = updateSessionResponse || NextResponse.next();
  
  // 2. 创建 Supabase 客户端
  const supabase = createMiddlewareClient<Database>({ req: request, res: response });

  try {
    // 3. 获取当前会话
    const { data: { session } } = await supabase.auth.getSession();
    
    // 4. 定义“安全区”路径（过期也能访问）
    const SAFE_PATHS = [
      '/',                     // 首页
      '/login',                // 登录页
      '/logout',               // 退出登录
      '/auth',                 // 所有认证相关
      '/renew',                // 续费页面（核心！必须能访问）
      '/api/auth',             // 认证API
      '/api/seed-default-tasks',
      '/help',
      '/profile/history',      // 仅查看历史记录允许
    ];
    
    const currentPath = request.nextUrl.pathname;
    
    // 5. 检查是否在安全区
    const isSafePath = SAFE_PATHS.some(path => 
      currentPath === path || currentPath.startsWith(`${path}/`)
    );
    
    // 如果在安全区，直接返回（不过期检查）
    if (isSafePath) {
      return response;
    }

    // 6. 用户未登录，且不在安全区 → 去登录
    if (!session) {
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirectedFrom', currentPath);
      return NextResponse.redirect(redirectUrl);
    }

    // 7. 用户已登录：检查账户有效期
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('account_expires_at')
      .eq('id', session.user.id)
      .single();
    
    if (profileError) {
      console.warn(`查询用户有效期失败: ${profileError.message}`);
      return response; // 查询失败则放行，避免误拦截
    }
    
    // 8. 判断是否过期
    let isExpired = true; // 默认视为过期（安全优先）
    
    if (profile?.account_expires_at) {
      const expiryDate = new Date(profile.account_expires_at);
      const now = new Date();
      isExpired = expiryDate < now;
    }
    
    // 9. 如果过期，重定向到续费页
    if (isExpired) {
      console.log(`拦截过期用户访问: ${session.user.email} -> ${currentPath}`);
      const renewUrl = new URL('/renew', request.url);
      renewUrl.searchParams.set('redirect', currentPath);
      return NextResponse.redirect(renewUrl);
    }
    
    // 10. 账户有效，放行
    return response;
    
  } catch (error) {
    console.error('中间件执行出错:', error);
    return response; // 出错时放行，保证网站可用
  }
}

// 配置中间件生效的路径范围
// 这里我们扩大了范围，确保所有需要保护的路由都被覆盖
export const config = {
  matcher: [
    // 保护所有游戏相关路由（包括你原有的）
    "/lobby/:path*",
    "/themes/:path*",
    "/profile/:path*",
    "/game/:path*",
    // 添加可能的新路由
    "/room/:path*",
    "/play/:path*",
    // 排除静态资源和API的具体规则已在上面的SAFE_PATHS逻辑中处理
  ],
};
