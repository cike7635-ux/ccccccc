// /middleware.ts - 改进的多设备检测版本
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ==================== 工具函数 ====================

/**
 * 检查是否是管理员邮箱（仅用于日志记录）
 */
function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'];
  return adminEmails.some(adminEmail => 
    adminEmail.trim().toLowerCase() === email.toLowerCase()
  );
}

/**
 * 检查是否受保护的游戏路径
 */
function isProtectedGamePath(path: string): boolean {
  const protectedPaths = [
    '/lobby',
    '/game',
    '/profile',
    '/themes',
    '/game-history',
  ];
  
  // 精确匹配
  if (protectedPaths.includes(path)) {
    return true;
  }
  
  // 前缀匹配（例如 /themes/123）
  return protectedPaths.some(p => path.startsWith(p + '/'));
}

/**
 * 检查是否公开路径（不需要任何认证）
 */
function isPublicPath(path: string): boolean {
  // 精确匹配的公开路径
  const exactPublicPaths = [
    '/',
    '/login',
    '/account-expired',
    '/renew',
    '/admin',
    '/admin/unauthorized',
    '/login/expired',
  ];
  
  // 前缀匹配的公开路径（但排除游戏路径）
  const prefixPublicPaths = [
    '/auth/',
    '/api/auth/',
  ];
  
  // 1. 精确匹配
  if (exactPublicPaths.includes(path)) {
    return true;
  }
  
  // 2. 前缀匹配
  for (const prefix of prefixPublicPaths) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }
  
  // 3. 特殊处理：/login 的子路径（除了已经定义的）
  if (path.startsWith('/login/') && path !== '/login/expired') {
    return true;
  }
  
  return false;
}

// ==================== 中间件主函数 ====================

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  const startTime = Date.now();
  
  // 1. 创建响应对象
  const response = NextResponse.next();
  
  try {
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

    // ============ 路径分类处理 ============
    
    // 3.1 公开路径直接放行
    if (isPublicPath(currentPath)) {
      const elapsedTime = Date.now() - startTime;
      console.log(`[中间件] 公开路径: ${currentPath} (${elapsedTime}ms)`);
      return response;
    }
    
    // 3.2 API路径处理
    if (currentPath.startsWith('/api/')) {
      const elapsedTime = Date.now() - startTime;
      console.log(`[中间件] API路径: ${currentPath} (${elapsedTime}ms)`);
      return response;
    }
    
    // 3.3 管理员路径处理（独立验证）
    if (currentPath.startsWith('/admin')) {
      // 管理员登录页面直接放行
      if (currentPath === '/admin' || currentPath === '/admin/login') {
        const elapsedTime = Date.now() - startTime;
        console.log(`[中间件] 管理员登录页: ${currentPath} (${elapsedTime}ms)`);
        return response;
      }
      
      // 其他管理员页面需要验证管理员密钥
      const adminKeyVerified = request.cookies.get('admin_key_verified');
      if (!adminKeyVerified || adminKeyVerified.value !== 'true') {
        console.log(`[中间件] 管理员未通过密钥验证，重定向到管理员登录页`);
        
        const redirectUrl = new URL('/admin', request.url);
        redirectUrl.searchParams.set('redirect', currentPath);
        return NextResponse.redirect(redirectUrl);
      }
      
      // 验证管理员身份
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          console.log(`[中间件] 管理员验证失败，用户未登录`);
          return NextResponse.redirect(new URL('/admin', request.url));
        }
        
        // 检查是否是管理员邮箱
        if (!isAdminEmail(user.email)) {
          console.log(`[中间件] 非管理员访问后台: ${user.email}`);
          return NextResponse.redirect(new URL('/admin/unauthorized', request.url));
        }
        
        const elapsedTime = Date.now() - startTime;
        console.log(`[中间件] 管理员验证通过: ${user.email} (${elapsedTime}ms)`);
        return response;
      } catch (adminError) {
        console.error(`[中间件] 管理员验证错误:`, adminError);
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    }
    
    // 3.4 受保护的游戏路径（完整验证）
    if (isProtectedGamePath(currentPath)) {
      console.log(`[中间件] 开始验证游戏路径: ${currentPath}`);
      
      try {
        // ============ 基础登录验证 ============
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          const elapsedTime = Date.now() - startTime;
          console.log(`[中间件] 未登录，重定向到登录页 (${elapsedTime}ms)`);
          
          const redirectUrl = new URL('/login', request.url);
          redirectUrl.searchParams.set('redirect', currentPath);
          return NextResponse.redirect(redirectUrl);
        }
        
        console.log(`[中间件] 用户已登录: ${user.email} (管理员: ${isAdminEmail(user.email)})`);
        
        // ============ 获取用户资料 ============
        let profile = null;
        try {
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, account_expires_at, last_login_at, last_login_session')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.warn(`[中间件] 查询用户资料失败: ${profileError.message}`);
            
            // 关键修复：如果profiles记录不存在，允许继续访问
            const elapsedTime = Date.now() - startTime;
            console.log(`[中间件] Profiles记录缺失，允许继续访问 (${elapsedTime}ms)`);
            return response;
          }
          
          profile = data;
        } catch (profileError) {
          console.error(`[中间件] 获取用户资料异常:`, profileError);
          // 发生异常时也允许继续访问，避免循环
          return response;
        }
        
        if (!profile) {
          console.log(`[中间件] 用户profiles记录不存在，允许继续: ${user.id}`);
          return response;
        }
        
        // ============ 会员过期验证 ============
        const now = new Date();
        const isExpired = !profile.account_expires_at || 
                         new Date(profile.account_expires_at) < now;
        
        if (isExpired && currentPath !== '/account-expired') {
          const elapsedTime = Date.now() - startTime;
          console.log(`[中间件] 会员已过期，重定向到过期页 (${elapsedTime}ms)`);
          console.log(`  - 过期时间: ${profile.account_expires_at}`);
          console.log(`  - 当前时间: ${now.toISOString()}`);
          
          return NextResponse.redirect(new URL('/account-expired', request.url));
        }
        
        // ============ 简化的多设备登录验证（基于会话标识） ============
        try {
          // 获取当前会话
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          
          if (!currentSession) {
            console.warn(`[中间件] 当前会话不存在`);
            // 会话不存在，让用户重新登录
            const redirectUrl = new URL('/login', request.url);
            redirectUrl.searchParams.set('redirect', currentPath);
            return NextResponse.redirect(redirectUrl);
          }
          
          // 生成当前会话的标识符
          const currentSessionId = `session_${currentSession.user.id}_${currentSession.access_token.substring(0, 20)}`;
          
          // 如果用户没有last_login_session，说明是首次登录或旧的会话
          if (!profile.last_login_session) {
            console.log(`[中间件] 首次登录或旧的会话，更新会话标识`);
            
            // 更新会话标识
            await supabase
              .from('profiles')
              .update({ 
                last_login_session: currentSessionId,
                last_login_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id);
            
          } else if (profile.last_login_session !== currentSessionId) {
            // 如果会话标识不匹配，说明是新设备登录
            console.log(`[中间件] 检测到新设备登录: ${user.email}`);
            console.log(`  - 存储的会话标识: ${profile.last_login_session}`);
            console.log(`  - 当前会话标识: ${currentSessionId}`);
            
            // 清除会话cookie
            response.cookies.delete('sb-access-token');
            response.cookies.delete('sb-refresh-token');
            
            // 重定向到过期页面
            const redirectUrl = new URL('/login/expired', request.url);
            redirectUrl.searchParams.set('email', user.email || '');
            redirectUrl.searchParams.set('reason', 'new_device_login');
            
            const elapsedTime = Date.now() - startTime;
            console.log(`[中间件] 重定向到过期页面 (${elapsedTime}ms)`);
            
            return NextResponse.redirect(redirectUrl);
          } else {
            // 会话匹配，正常访问
            console.log(`[中间件] 会话验证通过: ${currentSessionId.substring(0, 20)}...`);
          }
          
        } catch (multiDeviceError) {
          console.error(`[中间件] 会话验证错误:`, multiDeviceError);
          // 验证出错时，不阻止用户访问，仅记录日志
        }
        
        const elapsedTime = Date.now() - startTime;
        console.log(`[中间件] 验证全部通过: ${user.email} (${elapsedTime}ms)`);
        console.log(`  - 会员过期时间: ${profile.account_expires_at}`);
        
        return response;
        
      } catch (gamePathError) {
        console.error(`[中间件] 游戏路径验证异常:`, gamePathError);
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
    
    // 4. 其他未分类路径直接放行
    const elapsedTime = Date.now() - startTime;
    console.log(`[中间件] 其他路径: ${currentPath} (${elapsedTime}ms)`);
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
