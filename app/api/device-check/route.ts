// /app/api/device-check/route.ts - 设备检查API（简化版）
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
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
    
    // 验证用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ 
        allowed: false, 
        reason: 'not_authenticated',
        email: user?.email || ''
      }, { status: 401 });
    }
    
    // 获取当前设备ID
    const deviceIdCookie = cookieStore.get('love_ludo_device_id');
    const currentDeviceId = deviceIdCookie?.value || 'unknown';
    
    // 查询用户资料
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('last_login_session, email')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      return NextResponse.json({ 
        allowed: false, 
        reason: 'profile_not_found',
        email: user.email
      }, { status: 404 });
    }
    
    // 提取存储的设备ID
    const extractDeviceId = (session: string): string => {
      if (!session) return 'unknown';
      const parts = session.split('_');
      if (parts.length >= 4) {
        if (parts[2] === 'dev' && parts.length > 4) {
          return parts.slice(2, parts.length - 1).join('_');
        }
        return parts[2];
      }
      return 'unknown';
    };
    
    const storedDeviceId = profile.last_login_session ? 
      extractDeviceId(profile.last_login_session) : 'unknown';
    
    console.log(`🔍 设备检查: 存储设备=${storedDeviceId}, 当前设备=${currentDeviceId}`);
    
    // 设备检查逻辑
    if (storedDeviceId === 'unknown' || !profile.last_login_session) {
      // 新用户或无设备记录，允许通过
      return NextResponse.json({ 
        allowed: true, 
        reason: 'new_user_or_no_device_record',
        deviceId: currentDeviceId,
        email: user.email
      });
    }
    
    if (storedDeviceId === currentDeviceId) {
      // 设备匹配，允许通过
      return NextResponse.json({ 
        allowed: true, 
        reason: 'device_matched',
        deviceId: currentDeviceId,
        email: user.email
      });
    } else {
      // 设备不匹配，拒绝访问
      console.log(`🚨 设备不匹配！存储设备: ${storedDeviceId}, 当前设备: ${currentDeviceId}`);
      return NextResponse.json({ 
        allowed: false, 
        reason: 'device_mismatch',
        storedDeviceId,
        currentDeviceId,
        email: user.email,
        message: '您的账号已在其他设备登录'
      }, { status: 403 });
    }
    
  } catch (error) {
    console.error('❌ 设备检查API异常:', error);
    return NextResponse.json(
      { allowed: false, reason: 'server_error', message: '服务器内部错误' },
      { status: 500 }
    );
  }
}