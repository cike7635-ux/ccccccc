// /app/api/auth/check-login-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  try {
    const { isLoginPage = false, redirectPath = '/lobby' } = await request.json();
    const cookieStore = cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              // 静默处理
            }
          },
        },
      }
    );
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return NextResponse.json({ loggedIn: false });
    }
    
    // 🔥 这里模拟调用 getUserData 的逻辑，但只在服务端进行设备ID检查
    const deviceIdCookie = cookieStore.get('love_ludo_device_id');
    const currentDeviceId = deviceIdCookie?.value || 'unknown';
    
    // 查询用户profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('last_login_session, account_expires_at')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      return NextResponse.json({ loggedIn: false });
    }
    
    // 检查会员是否过期
    if (profile.account_expires_at) {
      const expiryDate = new Date(profile.account_expires_at);
      const now = new Date();
      if (expiryDate < now) {
        // 会员过期，重定向到过期页面
        return NextResponse.redirect(new URL('/account-expired', request.url));
      }
    }
    
    // 检查设备ID（简化逻辑，实际应该调用 getUserData）
    if (profile.last_login_session) {
      const parts = profile.last_login_session.split('_');
      const storedDeviceId = parts.length >= 4 ? (parts[2] === 'dev' && parts.length > 4 ? parts.slice(2, parts.length - 1).join('_') : parts[2]) : 'unknown';
      
      if (storedDeviceId !== currentDeviceId && !isLoginPage) {
        // 🔥 设备ID不匹配且不是登录页，重定向到过期页面
        console.log(`🔴 API检测到设备ID不匹配，重定向到 /login/expired`);
        return NextResponse.redirect(new URL('/login/expired', request.url));
      }
    }
    
    return NextResponse.json({ 
      loggedIn: true, 
      email: user.email,
      user: {
        id: user.id,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('检查登录状态异常:', error);
    return NextResponse.json({ loggedIn: false, error: '检查失败' }, { status: 500 });
  }
}