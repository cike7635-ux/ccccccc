<<<<<<< HEAD
// /middleware.ts - 终极修复版本（强制检测 + 完整日志）
=======
// /middleware.ts
// 修复版本 - 添加初始会话识别，修复新用户多设备检测
>>>>>>> parent of a8d0af5 (登陆流程优化)
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// ==================== 配置 ====================

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

// ==================== 核心：用户资料获取（修复版） ====================

async function getUserProfile(supabase: any, userId: string, email: string, requestId: string) {
  console.log(`[${requestId}] 🔍 开始查询用户资料: ${email}`);
  
  try {
    // 尝试查询用户资料
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, account_expires_at, last_login_at, last_login_session, created_at, nickname')
      .eq('id', userId)
      .maybeSingle();
    
    if (error) {
      console.error(`[${requestId}] ❌ 查询用户资料失败:`, error);
      return null;
    }
    
    if (!data) {
      console.log(`[${requestId}] ⚠️ 用户资料不存在: ${email}`);
      return null;
    }
    
    console.log(`[${requestId}] ✅ 获取到用户资料:`, {
      email: data.email,
      last_login_at: data.last_login_at,
      last_login_session: data.last_login_session,
      account_expires_at: data.account_expires_at
    });
    
    return data;
  } catch (error) {
    console.error(`[${requestId}] 🚨 查询用户资料异常:`, error);
    return null;
  }
}

// ==================== 核心：严格单设备检测（修复版） ====================

async function performStrictDeviceCheck(
  supabase: any,
  user: any,
  profile: any,
  requestId: string,
  request: NextRequest
) {
  console.log(`[${requestId}] 🔥 执行严格单设备检测开始`);
  
  try {
    const now = new Date();
    
    // 1. 获取当前会话
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession) {
      console.warn(`[${requestId}] ⚠️ 无法获取当前会话`);
      return { shouldContinue: true, reason: 'no_session' };
    }
    
    // 2. 生成当前会话标识（必须与登录表单一致！）
    const tokenPrefix = currentSession.access_token.substring(0, 12);
    const currentSessionId = `sess_${user.id}_${tokenPrefix}`;
    
    console.log(`[${requestId}] 📋 设备检测详情:`, {
      用户: user.email,
      用户ID: user.id,
      当前设备会话标识: currentSessionId,
      存储的会话标识: profile.last_login_session || '空',
      存储的最后活动时间: profile.last_login_at || '空',
      token前缀: tokenPrefix
    });
    
    // 3. 如果没有会话记录，设置并允许
    if (!profile.last_login_session) {
      console.log(`[${requestId}] 🆕 首次设置会话标识: ${currentSessionId}`);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          last_login_session: currentSessionId,
          last_login_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`[${requestId}] ❌ 设置会话失败:`, updateError);
      }
      
      return { shouldContinue: true, reason: 'first_time_set' };
    }
    
    // 4. 如果是初始会话，更新为真实会话
    if (profile.last_login_session.startsWith('init_')) {
      console.log(`[${requestId}] 🔄 更新初始会话: ${profile.last_login_session} → ${currentSessionId}`);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          last_login_session: currentSessionId,
          last_login_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`[${requestId}] ❌ 更新初始会话失败:`, updateError);
      }
      
      return { shouldContinue: true, reason: 'init_session_update' };
    }
    
    // 5. 🔥 关键：检查会话是否匹配
    console.log(`[${requestId}] 🔍 检查会话匹配:`, {
      存储的: profile.last_login_session,
      当前的: currentSessionId,
      是否相同: profile.last_login_session === currentSessionId,
      存储长度: profile.last_login_session?.length,
      当前长度: currentSessionId?.length
    });
    
    if (profile.last_login_session === currentSessionId) {
      console.log(`[${requestId}] ✅ 会话匹配，更新活动时间`);
      
      // 更新最后活动时间
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          last_login_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`[${requestId}] ⚠️ 更新活动时间失败:`, updateError);
      }
      
      return { shouldContinue: true, reason: 'session_match' };
    }
    
    // 6. 🔴 会话不匹配 - 强制退出
    console.log(`[${requestId}] 🚨 会话不匹配！强制退出`, {
      原因: '设备冲突',
      原会话: profile.last_login_session,
      新会话: currentSessionId,
      用户: user.email
    });
    
    const redirectUrl = new URL('/login/expired', request.url);
    redirectUrl.searchParams.set('email', user.email || '');
    redirectUrl.searchParams.set('reason', 'device_conflict');
    redirectUrl.searchParams.set('old_device', profile.last_login_session.substring(0, 20));
    redirectUrl.searchParams.set('new_device', currentSessionId.substring(0, 20));
    
    return { shouldContinue: false, redirectUrl: redirectUrl.toString(), reason: 'session_mismatch' };
    
  } catch (error) {
    console.error(`[${requestId}] 💥 设备检测异常:`, error);
    return { shouldContinue: true, reason: 'error' };
  }
}

// ==================== 中间件主函数（简化版） ====================

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  const requestId = Math.random().toString(36).substring(2, 8);
  
  console.log(`[${requestId}] 🌐 中间件开始: ${currentPath}`);
  
  // 创建Supabase客户端
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
<<<<<<< HEAD
=======

  return { supabase, response };
}

/**
 * 设置管理员验证Cookie（路径设为根目录）
 */
function setAdminKeyVerifiedCookie(response: NextResponse) {
  response.cookies.set({
    name: 'admin_key_verified',
    value: 'true',
    path: '/', // 🔥 关键：设置为根路径，使Cookie对所有请求有效
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24小时
  });
  return response;
}

// ==================== 核心功能：获取已验证的用户 ====================

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
function createResponseWithUserHeaders(request: NextRequest, user: any, isAdmin: boolean = false) {
  // 创建新的请求头
  const headers = new Headers(request.headers);
  
  // 添加已验证的用户信息到请求头
  headers.set('x-verified-user-id', user.id);
  
  if (user.email) {
    headers.set('x-verified-user-email', user.email);
  }
  
  if (user.user_metadata?.name) {
    headers.set('x-verified-user-name', user.user_metadata.name);
  }
  
  // 添加管理员标志
  if (isAdmin) {
    headers.set('x-admin-verified', 'true');
  }
  
  // 添加一个标志，表明这个用户已经经过中间件验证
  headers.set('x-user-verified-by-middleware', 'true');
  
  // 返回新的响应对象
  const response = NextResponse.next({
    request: {
      headers: headers,
    },
  });
  
  return response;
}

// ==================== 中间件主函数 ====================

export async function middleware(request: NextRequest) {
  const currentPath = request.nextUrl.pathname;
  const requestId = Math.random().toString(36).substring(7);
  
  // 简化日志，避免过多输出
  if (!currentPath.startsWith('/_next') && !currentPath.startsWith('/favicon')) {
    console.log(`[${requestId}] 中间件: ${currentPath}`);
  }
>>>>>>> parent of a8d0af5 (登陆流程优化)
  
  try {
    // ============ 1. 公开路径直接放行 ============
    if (isPublicPath(currentPath)) {
      console.log(`[${requestId}] 🟢 公开路径: ${currentPath}`);
      return response;
    }
    
    // ============ 2. 管理员路径处理 ============
    if (currentPath.startsWith('/admin')) {
      // 简化处理，暂不考虑
      return response;
    }
    
    // ============ 3. 受保护的游戏路径（强制验证） ============
    if (isProtectedGamePath(currentPath)) {
<<<<<<< HEAD
      console.log(`[${requestId}] 🛡️ 受保护路径: ${currentPath}`);
      
      // 3.1 验证用户登录状态
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log(`[${requestId}] 🔐 用户未登录，重定向到登录页`);
=======
      try {
        // ============ 基础登录验证 ============
        const { user, error: authError } = await getVerifiedUser(supabase);
        
        if (authError || !user) {
          console.log(`[${requestId}] 用户未登录，重定向到登录页`);
          const redirectUrl = new URL('/login', request.url);
          redirectUrl.searchParams.set('redirect', currentPath);
          return NextResponse.redirect(redirectUrl);
        }
        
        console.log(`[${requestId}] 用户已登录: ${user.email} (管理员: ${isAdminEmail(user.email)})`);
        
        // 如果是管理员访问游戏路径，不要强制重定向到后台
        // 让管理员可以正常玩游戏
        if (isAdminEmail(user.email)) {
          console.log(`[${requestId}] 管理员访问游戏路径，正常处理`);
        }
        
        // ============ 获取用户资料 ============
        let profile = null;
        try {
          const { data, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, account_expires_at, last_login_at, last_login_session, created_at')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.warn(`[${requestId}] 查询用户资料失败: ${profileError.message}`);
            // 资料不存在时允许继续，避免循环重定向
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
          
          // 🔥 关键修复1：检测并处理初始会话标识
          if (profile.last_login_session && profile.last_login_session.startsWith('init_')) {
            console.log(`[${requestId}] 检测到初始会话标识，更新为真实会话`);
            
            await supabase
              .from('profiles')
              .update({ 
                last_login_session: currentSessionId,
                last_login_at: now.toISOString(),
                updated_at: now.toISOString()
              })
              .eq('id', user.id);
            
            console.log(`[${requestId}] 初始会话已更新，正常放行`);
            return createResponseWithUserHeaders(request, user);
          }
          
          // 🔥 关键修复2：处理空会话标识（兼容旧版本）
          if (!profile.last_login_session) {
            console.log(`[${requestId}] 用户会话标识为空，初始化为真实会话`);
            
            await supabase
              .from('profiles')
              .update({ 
                last_login_session: currentSessionId,
                last_login_at: now.toISOString(),
                updated_at: now.toISOString()
              })
              .eq('id', user.id);
            
            console.log(`[${requestId}] 空会话已初始化，正常放行`);
            return createResponseWithUserHeaders(request, user);
          }
          
          // 🔥 关键修复3：添加登录宽限期检测
          const lastLoginTime = profile.last_login_at ? new Date(profile.last_login_at) : null;
          const timeSinceLastLogin = lastLoginTime ? now.getTime() - lastLoginTime.getTime() : 0;
          
          // 为刚登录的用户提供5分钟宽限期
          if (timeSinceLastLogin < 300000) { // 5分钟
            console.log(`[${requestId}] 用户刚登录（${Math.round(timeSinceLastLogin/1000)}秒前），处于宽限期内`);
            
            // 确保会话标识是最新的
            await supabase
              .from('profiles')
              .update({ 
                last_login_session: currentSessionId,
                updated_at: now.toISOString()
              })
              .eq('id', user.id);
              
            console.log(`[${requestId}] 宽限期内会话标识已更新，正常放行`);
            return createResponseWithUserHeaders(request, user);
          }
          
          // 🔥 关键修复4：更智能的多设备检测逻辑
          if (profile.last_login_session) {
            // 情况1：会话完全匹配 - 正常访问
            if (profile.last_login_session === currentSessionId) {
              console.log(`[${requestId}] 会话标识匹配，正常访问`);
              return createResponseWithUserHeaders(request, user);
            }
            // 情况2：会话部分匹配（同一用户但不同token）- 可能是token刷新
            else if (profile.last_login_session.startsWith(`sess_${currentSession.user.id}_`)) {
              console.log(`[${requestId}] 同一用户不同token，可能是token刷新`);
              
              // 检查用户创建时间，如果是新用户（24小时内），宽松处理
              const userCreatedAt = profile.created_at ? new Date(profile.created_at) : null;
              const timeSinceCreation = userCreatedAt ? now.getTime() - userCreatedAt.getTime() : 0;
              
              if (timeSinceCreation < 24 * 60 * 60 * 1000) { // 24小时内
                console.log(`[${requestId}] 新用户（24小时内），更新会话标识`);
                await supabase
                  .from('profiles')
                  .update({ 
                    last_login_session: currentSessionId,
                    updated_at: now.toISOString()
                  })
                  .eq('id', user.id);
                return createResponseWithUserHeaders(request, user);
              } else {
                // 超过24小时，检查是否是短期内的token刷新（30秒内）
                if (timeSinceLastLogin < 30000) { // 30秒
                  console.log(`[${requestId}] 短时间内token刷新，更新会话标识`);
                  await supabase
                    .from('profiles')
                    .update({ 
                      last_login_session: currentSessionId,
                      updated_at: now.toISOString()
                    })
                    .eq('id', user.id);
                  return createResponseWithUserHeaders(request, user);
                } else {
                  // 超过30秒，认为是多设备登录
                  console.log(`[${requestId}] 检测到多设备登录，强制退出`);
                  
                  const redirectUrl = new URL('/login/expired', request.url);
                  redirectUrl.searchParams.set('email', user.email || '');
                  redirectUrl.searchParams.set('reason', 'multi_device');
                  redirectUrl.searchParams.set('last_session', profile.last_login_session.substring(0, 20));
                  if (lastLoginTime) {
                    redirectUrl.searchParams.set('last_login_time', lastLoginTime.toISOString());
                  }
                  
                  return NextResponse.redirect(redirectUrl);
                }
              }
            }
            // 情况3：完全不同 - 多设备登录
            else {
              console.log(`[${requestId}] 检测到完全不同的会话标识，判定为多设备登录`);
              
              // 检查用户创建时间，如果是新用户（24小时内），宽松处理
              const userCreatedAt = profile.created_at ? new Date(profile.created_at) : null;
              const timeSinceCreation = userCreatedAt ? now.getTime() - userCreatedAt.getTime() : 0;
              
              if (timeSinceCreation < 24 * 60 * 60 * 1000) { // 24小时内
                console.log(`[${requestId}] 新用户（24小时内），更新会话标识`);
                await supabase
                  .from('profiles')
                  .update({ 
                    last_login_session: currentSessionId,
                    last_login_at: now.toISOString(),
                    updated_at: now.toISOString()
                  })
                  .eq('id', user.id);
                return createResponseWithUserHeaders(request, user);
              } else {
                console.log(`[${requestId}] 老用户多设备登录，强制退出`);
                
                const redirectUrl = new URL('/login/expired', request.url);
                redirectUrl.searchParams.set('email', user.email || '');
                redirectUrl.searchParams.set('reason', 'multi_device_different_user');
                redirectUrl.searchParams.set('last_session', profile.last_login_session.substring(0, 20));
                
                return NextResponse.redirect(redirectUrl);
              }
            }
          } else {
            // 数据库中无会话标识，初始化新的会话
            console.log(`[${requestId}] 初始化新的会话标识`);
            await supabase
              .from('profiles')
              .update({ 
                last_login_at: now.toISOString(),
                last_login_session: currentSessionId,
                updated_at: now.toISOString()
              })
              .eq('id', user.id);
            return createResponseWithUserHeaders(request, user);
          }
          
        } catch (sessionError) {
          console.error(`[${requestId}] 会话验证错误:`, sessionError);
          // 出错时不中断用户访问
          return createResponseWithUserHeaders(request, user);
        }
        
      } catch (gamePathError) {
        console.error(`[${requestId}] 游戏路径验证异常:`, gamePathError);
>>>>>>> parent of a8d0af5 (登陆流程优化)
        const redirectUrl = new URL('/login', request.url);
        redirectUrl.searchParams.set('redirect', currentPath);
        return NextResponse.redirect(redirectUrl);
      }
      
      console.log(`[${requestId}] 👤 用户已登录: ${user.email}`);
      
      // 3.2 🔥 强制获取用户资料
      let profile = await getUserProfile(supabase, user.id, user.email, requestId);
      
      // 如果查询失败，创建临时资料
      if (!profile) {
        console.log(`[${requestId}] ⚠️ 使用临时用户资料`);
        profile = {
          id: user.id,
          email: user.email,
          account_expires_at: null,
          last_login_at: null,
          last_login_session: null,
          created_at: new Date().toISOString(),
          nickname: user.email?.split('@')[0] || '用户'
        };
      }
      
      // 3.3 🔥 强制执行多设备检测
      console.log(`[${requestId}] ⚡ 强制执行多设备检测`);
      const deviceCheck = await performStrictDeviceCheck(supabase, user, profile, requestId, request);
      
      if (!deviceCheck.shouldContinue) {
        console.log(`[${requestId}] 🚫 设备检测失败，重定向: ${deviceCheck.reason}`);
        return NextResponse.redirect(new URL(deviceCheck.redirectUrl!, request.url));
      }
      
      // 3.4 会员过期检查
      if (profile.account_expires_at) {
        const expiresAt = new Date(profile.account_expires_at);
        if (expiresAt < new Date()) {
          console.log(`[${requestId}] 💸 会员已过期: ${expiresAt.toISOString()}`);
          return NextResponse.redirect(new URL('/account-expired', request.url));
        }
      }
      
      // 3.5 更新最后活动时间
      try {
        await supabase
          .from('profiles')
          .update({
            last_login_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } catch (error) {
        console.error(`[${requestId}] ⚠️ 更新活动时间失败:`, error);
      }
      
      console.log(`[${requestId}] ✅ 所有检查通过，放行用户`);
      
      // 设置响应头
      const headers = new Headers(request.headers);
      headers.set('x-verified-user-id', user.id);
      headers.set('x-verified-user-email', user.email || '');
      headers.set('x-user-verified-by-middleware', 'true');
      
      return NextResponse.next({
        request: { headers },
      });
    }
    
    // ============ 4. 其他路径尝试验证用户 ============
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log(`[${requestId}] 👤 其他路径用户已登录: ${user.email}`);
        
        // 设置响应头
        const headers = new Headers(request.headers);
        headers.set('x-verified-user-id', user.id);
        headers.set('x-verified-user-email', user.email || '');
        
        return NextResponse.next({
          request: { headers },
        });
      }
    } catch (e) {
      // 忽略错误
    }
    
    return response;
    
  } catch (error) {
    console.error(`[${requestId}] 💥 中间件全局异常:`, error);
    return response;
  }
}

export const config = {
<<<<<<< HEAD
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};
=======
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
>>>>>>> parent of a8d0af5 (登陆流程优化)
