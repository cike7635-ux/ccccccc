// /middleware.ts - 完整修正版
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ==================== 工具函数 ====================

/**
 * 从JWT令牌中解析创建时间（iat字段）
 */
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
    console.error('[中间件] 解析JWT失败:', error);
    return null;
  }
}

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
 * 这些路径需要完整的用户验证（登录、会员状态、多设备检查）
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
    // 2. 创建Supabase客户端（用于服务器端认证）
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
    
    // 3.3 管理员路径处理（独立验证，不进入游戏路径逻辑）
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
        // 根据表结构查询正确的字段：id, email, account_expires_at, last_login_at, last_login_session
        let profile = null;
        try {
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, account_expires_at, last_login_at, last_login_session, access_key_id')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.warn(`[中间件] 查询用户资料失败: ${profileError.message}`);
            
            // 关键修复：如果profiles记录不存在，允许继续访问
            // 避免无限重定向循环，让页面逻辑处理创建profiles记录
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
        
        // ============ 多设备登录验证 ============
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          
          if (!currentSession) {
            console.warn(`[中间件] 当前会话不存在`);
            // 会话不存在，让用户重新登录
            const redirectUrl = new URL('/login', request.url);
            redirectUrl.searchParams.set('redirect', currentPath);
            return NextResponse.redirect(redirectUrl);
          }
          
          // 解析当前会话的创建时间
          const sessionCreatedTime = getJwtCreationTime(currentSession.access_token);
          const lastLoginTime = profile.last_login_at ? new Date(profile.last_login_at) : null;
          const tolerance = 3000; // 3秒容差，避免时间同步问题
          
          // 只有在有足够数据时才进行多设备检测
          if (lastLoginTime && sessionCreatedTime) {
            const timeDiff = lastLoginTime.getTime() - sessionCreatedTime.getTime();
            
            console.log(`[中间件] 多设备检查:`);
            console.log(`  - 会话创建时间: ${sessionCreatedTime.toISOString()}`);
            console.log(`  - 最后登录时间: ${lastLoginTime.toISOString()}`);
            console.log(`  - 时间差: ${timeDiff}ms`);
            console.log(`  - 容差: ${tolerance}ms`);
            
            // 如果最后登录时间比会话创建时间晚（超过容差），说明有新设备登录
            if (timeDiff > tolerance) {
              console.log(`[中间件] 检测到多设备登录，强制退出: ${user.email}`);
              
              // 清除会话cookie
              response.cookies.delete('sb-access-token');
              response.cookies.delete('sb-refresh-token');
              
              // 重定向到过期页面
              const userEmail = user.email || '';
              const lastLoginTimeStr = lastLoginTime.toISOString();
              
              const redirectUrl = new URL('/login/expired', request.url);
              redirectUrl.searchParams.set('email', userEmail);
              redirectUrl.searchParams.set('last_login_time', lastLoginTimeStr);
              redirectUrl.searchParams.set('session_created', sessionCreatedTime.toISOString());
              
              const elapsedTime = Date.now() - startTime;
              console.log(`[中间件] 多设备登录验证完成，重定向 (${elapsedTime}ms)`);
              
              return NextResponse.redirect(redirectUrl);
            }
          } else {
            console.log(`[中间件] 多设备检查数据不足:`);
            console.log(`  - lastLoginTime: ${lastLoginTime ? lastLoginTime.toISOString() : 'null'}`);
            console.log(`  - sessionCreatedTime: ${sessionCreatedTime ? sessionCreatedTime.toISOString() : 'null'}`);
          }
          
        } catch (multiDeviceError) {
          console.error(`[中间件] 多设备验证错误:`, multiDeviceError);
          // 多设备验证出错时，不阻止用户访问，仅记录日志
        }
        
        // ============ 验证通过，更新最后登录时间 ============
        // 所有用户（包括管理员）都更新最后登录时间
        try {
          // 更新最后登录时间和会话标识
          await supabase
            .from('profiles')
            .update({ 
              last_login_at: new Date().toISOString(),
              last_login_session: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              updated_at: new Date().toISOString() // 同时更新updated_at字段
            })
            .eq('id', user.id);
        } catch (updateError) {
          console.warn(`[中间件] 更新最后登录时间失败:`, updateError);
        }
        
        const elapsedTime = Date.now() - startTime;
        console.log(`[中间件] 验证全部通过: ${user.email} (${elapsedTime}ms)`);
        console.log(`  - 会员过期时间: ${profile.account_expires_at}`);
        console.log(`  - 是否管理员: ${isAdminEmail(user.email)}`);
        
        return response;
        
      } catch (gamePathError) {
        console.error(`[中间件] 游戏路径验证异常:`, gamePathError);
        
        // 发生异常时，重定向到登录页，但不带redirect参数避免循环
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
    
    // 4. 其他未分类路径直接放行
    const elapsedTime = Date.now() - startTime;
    console.log(`[中间件] 其他路径: ${currentPath} (${elapsedTime}ms)`);
    return response;
    
  } catch (globalError) {
    console.error(`[中间件] 全局异常:`, globalError);
    
    // 发生全局异常时，返回500错误或重定向到错误页
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

// ==================== 中间件配置 ====================

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     * - public文件夹下的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
