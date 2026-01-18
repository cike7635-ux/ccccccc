// /middleware.ts - 极简但安全版
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ==================== 工具函数 ====================

/**
 * 检查是否是管理员页面
 */
function isAdminPath(path: string): boolean {
  return path.startsWith('/admin') && path !== '/admin' && path !== '/admin/login';
}

/**
 * 检查是否是受保护的游戏路径
 */
function isProtectedGamePath(path: string): boolean {
  const exactPaths = ['/lobby', '/game', '/profile', '/themes', '/game-history', '/themes/new', '/feedback'];
  if (exactPaths.includes(path)) return true;
  const prefixPaths = ['/game/', '/themes/'];
  return prefixPaths.some(prefix => path.startsWith(prefix));
}

/**
 * 检查是否是公开路径
 */
function isPublicPath(path: string): boolean {
  const exactPublicPaths = ['/', '/login', '/account-expired', '/renew', '/admin/unauthorized', '/login/expired'];
  if (exactPublicPaths.includes(path)) return true;
  const prefixPublicPaths = ['/auth/', '/api/auth/'];
  return prefixPublicPaths.some(prefix => path.startsWith(prefix));
}

/**
 * 检查是否是API路径
 */
function isApiPath(path: string): boolean {
  return path.startsWith('/api/');
}

/**
 * 创建Supabase客户端（极简版，不调用任何API）
 */
function createMiddlewareClient(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              path: '/',
            });
          });
        },
      },
    }
  );

  return { supabase, response };
}

/**
 * 🔥 确保设备ID存在（不检查，只设置）
 */
function ensureDeviceId(request: NextRequest, response: NextResponse): string {
  const existingDeviceId = request.cookies.get('love_ludo_device_id')?.value;
  
  if (existingDeviceId) {
    return existingDeviceId;
  }
  
  // 生成唯一的设备ID
  const newDeviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  
  // 设置到响应cookie中
  response.cookies.set({
    name: 'love_ludo_device_id',
    value: newDeviceId,
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 365天
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  });
  
  console.log(`🆔 生成新设备ID: ${newDeviceId}`);
  return newDeviceId;
}

// ==================== 中间件主函数 ====================

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  
  // 🕒 性能监控开始
  const startTime = Date.now();
  
  // 1. 公开路径 - 直接放行
  if (isPublicPath(currentPath)) {
    return NextResponse.next();
  }
  
  // 2. API路径 - 直接放行
  if (isApiPath(currentPath)) {
    return NextResponse.next();
  }
  
  // 3. 管理员路径 - 🔐 保持严格验证
  if (isAdminPath(currentPath)) {
    const { supabase, response } = createMiddlewareClient(request);
    
    const adminCookie = request.cookies.get('admin_key_verified')?.value;
    
    if (!adminCookie) {
      console.log(`🚨 未授权访问管理员页面: ${currentPath}`);
      
      const loginUrl = new URL('/admin', request.url);
      loginUrl.searchParams.set('redirect', currentPath);
      return NextResponse.redirect(loginUrl);
    }
    
    // 🔥 管理员页面也需要认证Cookie
    const hasAuthCookie = request.cookies.has('sb-zjiyuqafcztiozonhncz-auth-token');
    if (!hasAuthCookie) {
      console.log(`🚨 管理员页面但无认证Cookie: ${currentPath}`);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', currentPath);
      return NextResponse.redirect(loginUrl);
    }
    
    const execTime = Date.now() - startTime;
    console.log(`✅ 管理员访问: ${currentPath} (${execTime}ms)`);
    return response;
  }
  
  // 4. 受保护的游戏路径 - 🔥 极简检查
  if (isProtectedGamePath(currentPath)) {
    const { supabase, response } = createMiddlewareClient(request);
    
    // 🔥 快速检查：是否有认证Cookie
    const hasAuthCookie = request.cookies.has('sb-zjiyuqafcztiozonhncz-auth-token');
    
    if (!hasAuthCookie) {
      console.log(`❌ 无认证Cookie，重定向到登录页: ${currentPath}`);
      
      const redirectUrl = new URL('/login', request.url);
      redirectUrl.searchParams.set('redirect', currentPath);
      return NextResponse.redirect(redirectUrl);
    }
    
    // 🔥 确保设备ID存在（不检查，只设置）
    ensureDeviceId(request, response);
    
    const execTime = Date.now() - startTime;
    console.log(`✅ 快速放行受保护页面: ${currentPath} (${execTime}ms)`);
    return response;
  }
  
  // 5. 其他路径 - 直接放行
  const execTime = Date.now() - startTime;
  console.log(`⚡ 其他路径: ${currentPath} (${execTime}ms)`);
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};