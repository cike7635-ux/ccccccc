// /middleware.ts - 终极修复版本（强制检测 + 完整日志）
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
      console.log(`[${requestId}] 🛡️ 受保护路径: ${currentPath}`);
      
      // 3.1 验证用户登录状态
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.log(`[${requestId}] 🔐 用户未登录，重定向到登录页`);
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};