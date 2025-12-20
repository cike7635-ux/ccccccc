// /lib/auth/validate-session.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// 辅助函数：从JWT中解析创建时间
function getJwtCreationTime(jwt: string): Date | null {
  try {
    const payloadBase64 = jwt.split('.')[1];
    if (!payloadBase64) return null;
    
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const paddedBase64 = pad ? base64 + '='.repeat(4 - pad) : base64;
    
    if (typeof Buffer !== 'undefined') {
      const payloadJson = Buffer.from(paddedBase64, 'base64').toString();
      const payload = JSON.parse(payloadJson);
      
      if (payload.iat) {
        return new Date(payload.iat * 1000);
      }
    }
    return null;
  } catch (error) {
    console.error('解析JWT失败:', error);
    return null;
  }
}

// 验证结果类型
export interface ValidationResult {
  user: any;
  profile: any;
  supabase: any;
  session: any;
}

export async function validateSession(): Promise<ValidationResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { 
      cookies: { 
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            console.error('设置cookie失败:', error);
          }
        }
      }
    }
  );
  
  // 1. 检查用户登录状态
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }
  
  // 2. 获取当前会话
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession) {
    await supabase.auth.signOut();
    redirect('/login?error=no_session');
  }
  
  // 3. 获取用户资料
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_expires_at, last_login_at, last_login_session, nickname, email')
    .eq('id', user.id)
    .single();
  
  if (!profile) {
    redirect('/login?error=profile_not_found');
  }
  
  // 4. 检查会员有效期
  const isExpired = !profile?.account_expires_at || new Date(profile.account_expires_at) < new Date();
  if (isExpired) {
    redirect('/account-expired');
  }
  
  // 5. 多设备登录验证
  const sessionCreatedTime = getJwtCreationTime(currentSession.access_token);
  const lastLoginTime = profile.last_login_at ? new Date(profile.last_login_at) : null;
  const tolerance = 3000; // 3秒容差
  
  if (lastLoginTime && sessionCreatedTime) {
    const timeDiff = lastLoginTime.getTime() - sessionCreatedTime.getTime();
    
    if (timeDiff > tolerance) {
      console.log(`[严格模式] 检测到新登录，强制退出用户: ${user.email}`);
      await supabase.auth.signOut();
      
      const userEmail = user.email || '';
      const lastLoginTimeStr = lastLoginTime.toISOString();
      redirect(`/login/expired?email=${encodeURIComponent(userEmail)}&last_login_time=${encodeURIComponent(lastLoginTimeStr)}`);
    }
  }
  
  console.log(`[验证通过] 用户 ${user.email}`);
  
  return {
    user,
    profile,
    supabase,
    session: currentSession
  };
}
