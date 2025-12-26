// /middleware.ts - 修复版本（严格单设备登录 + 详细日志）
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
            if (name === 'admin_key_verified') {
              response.cookies.set({
                name,
                value,
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24,
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
 * 设置管理员验证Cookie
 */
function setAdminKeyVerifiedCookie(response: NextResponse) {
  response.cookies.set({
    name: 'admin_key_verified',
    value: 'true',
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
  });
  return response;
}

/**
 * 获取已验证的用户信息
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
  const headers = new Headers(request.headers);
  headers.set('x-verified-user-id', user.id);
  
  if (user.email) {
    headers.set('x-verified-user-email', user.email);
  }
  
  if (user.user_metadata?.name) {
    headers.set('x-verified-user-name', user.user_metadata.name);
  }
  
  if (isAdmin) {
    headers.set('x-admin-verified', 'true');
  }
  
  headers.set('x-user-verified-by-middleware', 'true');
  
  return NextResponse.next({
    request: { headers },
  });
}

// ==================== 核心：多设备检测（严格单设备） ====================

/**
 * 执行严格单设备检测
 */
async function performStrictDeviceCheck(
  supabase: any,
  user: any,
  profile: any,
  requestId: string,
  request: NextRequest
) {
  try {
    const now = new Date();
    
    // 1. 获取当前会话
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession) {
      console.warn(`[${requestId}] 无法获取当前会话`);
      return { shouldContinue: true }; // 没有会话，让其他逻辑处理
    }
    
    // 2. 生成当前会话标识
    const currentSessionId = `sess_${user.id}_${currentSession.access_token.substring(0, 12)}`;
    
    // 🔥 添加详细日志
    console.log(`[${requestId}] 🔍 多设备检测详情:`, {
      用户: user.email,
      当前会话标识: currentSessionId,
      存储的会话标识: profile.last_login_session,
      存储的最后活动时间: profile.last_login_at,
      当前时间: now.toISOString()
    });
    
    // 3. 🔥 严格单设备检测逻辑
    
    // 情况A：用户没有会话记录（新用户或异常情况）
    if (!profile.last_login_session) {
      console.log(`[${requestId}] 用户无会话记录，设置初始会话: ${currentSessionId}`);
      
      // 同步设置会话记录
      await supabase
        .from('profiles')
        .update({
          last_login_session: currentSessionId,
          last_login_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', user.id);
      
      return { shouldContinue: true };
    }
    
    // 情况B：检测到初始会话标识（来自注册API）
    if (profile.last_login_session.startsWith('init_')) {
      console.log(`[${requestId}] 检测到初始会话 ${profile.last_login_session}，更新为真实会话 ${currentSessionId}`);
      
      await supabase
        .from('profiles')
        .update({
          last_login_session: currentSessionId,
          last_login_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', user.id);
      
      return { shouldContinue: true };
    }
    
    // 情况C：会话完全匹配 - 正常访问
    if (profile.last_login_session === currentSessionId) {
      console.log(`[${requestId}] ✅ 会话匹配: ${currentSessionId}，更新最后活动时间`);
      
      // 🔥 关键修复：每次请求都更新最后活动时间
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          last_login_at: now.toISOString(), // 实时更新时间！
          updated_at: now.toISOString()
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`[${requestId}] 更新活动时间失败:`, updateError);
      }
      
      return { shouldContinue: true };
    }
    
    // 情况D：会话不匹配 - 检查最后活动时间
    const lastLoginTime = profile.last_login_at ? new Date(profile.last_login_at) : null;
    const timeSinceLastLogin = lastLoginTime ? now.getTime() - lastLoginTime.getTime() : 0;
    
    console.log(`[${requestId}] ❌ 会话不匹配！`, {
      存储的会话: profile.last_login_session,
      当前会话: currentSessionId,
      时间差: `${timeSinceLastLogin}ms (${Math.round(timeSinceLastLogin/1000)}秒)`,
      是否在30秒内: timeSinceLastLogin < 3000
    });
    
    // 🔥 如果用户最后活动时间在30秒内，允许更新会话
    if (timeSinceLastLogin < 3000) { // 30秒 = 3000ms
      console.log(`[${requestId}] ⚡ 用户在30秒内有活动，更新会话标识为: ${currentSessionId}`);
      
      await supabase
        .from('profiles')
        .update({
          last_login_session: currentSessionId,
          last_login_at: now.toISOString(), // 同时更新时间！
          updated_at: now.toISOString()
        })
        .eq('id', user.id);
      
      return { shouldContinue: true };
    }
    
    // 情况E：多设备登录 - 强制退出
    console.log(`[${requestId}] 🔴 检测到多设备登录，强制退出: ${user.email}`, {
      原设备最后活动: lastLoginTime?.toISOString(),
      当前设备: currentSessionId,
      时间差超过: `${Math.round(timeSinceLastLogin/1000)}秒`
    });
    
    const redirectUrl = new URL('/login/expired', request.url);
    redirectUrl.searchParams.set('email', user.email || '');
    redirectUrl.searchParams.set('reason', 'multi_device');
    redirectUrl.searchParams.set('last_session', profile.last_login_session.substring(0, 20));
    redirectUrl.searchParams.set('current_session', currentSessionId.substring(0, 20));
    
    if (lastLoginTime) {
      redirectUrl.searchParams.set('last_login_time', lastLoginTime.toISOString());
    }
    
    return { shouldContinue: false, redirectUrl: redirectUrl.toString() };
    
  } catch (error) {
    console.error(`[${requestId}] 多设备检测异常:`, error);
    // 出错时允许继续，避免阻塞用户
    return { shouldContinue: true };
  }
}

// ==================== 核心：会员过期检测 ====================

/**
 * 执行会员过期检测（严格检查，无自动续期）
 */
async function performMembershipCheck(
  supabase: any,
  user: any,
  profile: any,
  requestId: string
) {
  const now = new Date();
  
  // 1. 检查会员有效期字段是否存在
  if (!profile.account_expires_at) {
    console.log(`[${requestId}] 用户 ${user.email} 无会员有效期记录`);
    
    // 无论是新用户还是老用户，无有效期就认为是过期
    // 用户需要通过购买密钥来设置有效期
    return { isExpired: true };
  }
  
  // 2. 检查是否已过期
  const expiresAt = new Date(profile.account_expires_at);
  
  if (expiresAt < now) {
    console.log(`[${requestId}] 🔴 会员已过期: ${expiresAt.toISOString()}`);
    return { isExpired: true };
  }
  
  // 3. 会员有效
  console.log(`[${requestId}] 会员有效，到期时间: ${expiresAt.toLocaleString('zh-CN')}`);
  return { isExpired: false };
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
      return response;
    }
    
    // 2. API路径处理
    if (currentPath.startsWith('/api/')) {
      if (currentPath.startsWith('/api/admin/')) {
        const adminKeyVerified = request.cookies.get('admin_key_verified');
        if (!adminKeyVerified || adminKeyVerified.value !== 'true') {
          const referer = request.headers.get('referer');
          if (!referer?.includes('/admin/')) {
            return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
          }
        }
      }
      return response;
    }
    
    // 3. 管理员路径处理
    if (currentPath.startsWith('/admin')) {
      if (currentPath === '/admin' || currentPath === '/admin/login') {
        return response;
      }
      
      const adminKeyVerified = request.cookies.get('admin_key_verified');
      if (!adminKeyVerified || adminKeyVerified.value !== 'true') {
        const redirectUrl = new URL('/admin', request.url);
        redirectUrl.searchParams.set('redirect', currentPath);
        return NextResponse.redirect(redirectUrl);
      }
      
      const { user, error } = await getVerifiedUser(supabase);
      if (error || !user || !isAdminEmail(user.email)) {
        return NextResponse.redirect(new URL('/admin/unauthorized', request.url));
      }
      
      const adminResponse = setAdminKeyVerifiedCookie(
        createResponseWithUserHeaders(request, user, true)
      );
      
      return adminResponse;
    }
    
    // 4. 受保护的游戏路径（完整验证）
    if (isProtectedGamePath(currentPath)) {
      try {
        // ============ 基础登录验证 ============
        const { user, error: authError } = await getVerifiedUser(supabase);
        
        if (authError || !user) {
          console.log(`[${requestId}] 用户未登录，重定向到登录页`);
          const redirectUrl = new URL('/login', request.url);
          redirectUrl.searchParams.set('redirect', currentPath);
          return NextResponse.redirect(redirectUrl);
        }
        
        console.log(`[${requestId}] 用户已登录: ${user.email}`);
        
        // ============ 获取用户资料 ============
        let profile = null;
        
        try {
          // 🔥 只查询实际存在的字段
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, account_expires_at, last_login_at, last_login_session, created_at, nickname')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profileError || !data) {
            console.warn(`[${requestId}] 查询用户资料失败或不存在:`, profileError?.message);
            
            // 创建默认用户资料（仅包含必要字段）
            const now = new Date();
            // 默认30天有效期（仅为了容错，实际应由注册API设置）
            const defaultExpires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            const initialSessionId = `init_${user.id}_${Date.now()}`;
            
            const { data: newProfile, error: createError } = await supabase
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
              })
              .select()
              .single();
            
            if (createError) {
              console.error(`[${requestId}] 创建用户资料失败:`, createError);
              // 创建失败，使用模拟数据继续
              profile = {
                id: user.id,
                email: user.email,
                account_expires_at: defaultExpires.toISOString(),
                last_login_at: now.toISOString(),
                last_login_session: initialSessionId,
                created_at: now.toISOString(),
                nickname: user.email?.split('@')[0] || '用户',
              };
            } else {
              profile = newProfile;
            }
          } else {
            profile = data;
          }
        } catch (profileError) {
          console.error(`[${requestId}] 获取用户资料异常:`, profileError);
          // 异常时创建简单资料继续
          const now = new Date();
          profile = {
            id: user.id,
            email: user.email,
            account_expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            last_login_at: now.toISOString(),
            last_login_session: `init_${user.id}_${Date.now()}`,
            created_at: now.toISOString(),
            nickname: user.email?.split('@')[0] || '用户',
          };
        }
        
        if (!profile) {
          console.log(`[${requestId}] 无法获取或创建用户资料，允许继续`);
          return createResponseWithUserHeaders(request, user);
        }
        
        // ============ 🔥 会员过期检测（优先检查）============
        const membershipCheck = await performMembershipCheck(supabase, user, profile, requestId);
        
        if (membershipCheck.isExpired) {
          console.log(`[${requestId}] 会员已过期，重定向到 /account-expired`);
          return NextResponse.redirect(new URL('/account-expired', request.url));
        }
        
        // ============ 🔥 多设备检测 ============
        const deviceCheck = await performStrictDeviceCheck(supabase, user, profile, requestId, request);
        
        if (!deviceCheck.shouldContinue) {
          console.log(`[${requestId}] 多设备检测失败，重定向到 /login/expired`);
          return NextResponse.redirect(new URL(deviceCheck.redirectUrl!, request.url));
        }
        
        // ============ 所有检查通过 ============
        console.log(`[${requestId}] 所有安全检查通过，放行用户`);
        
        // 🔥 双保险：确保更新用户最后活动时间
        try {
          const updateResult = await supabase
            .from('profiles')
            .update({
              last_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
          
          if (updateResult.error) {
            console.error(`[${requestId}] 最后活动时间更新失败:`, updateResult.error);
          }
        } catch (error) {
          console.error(`[${requestId}] 更新活动时间异常:`, error);
        }
        
        return createResponseWithUserHeaders(request, user);
        
      } catch (gamePathError) {
        console.error(`[${requestId}] 游戏路径验证异常:`, gamePathError);
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirect', currentPath);
        return NextResponse.redirect(redirectUrl);
      }
    }
    
    // 5. 其他未分类路径
    try {
      const { user } = await getVerifiedUser(supabase);
      if (user) {
        return createResponseWithUserHeaders(request, user);
      }
    } catch (e) {}
    
    return response;
    
  } catch (globalError) {
    console.error(`[中间件] 全局异常:`, globalError);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};