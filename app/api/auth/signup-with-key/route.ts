// /app/api/auth/signup-with-key/route.ts - 修复版（不使用membership_level）
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  console.log('[API] 注册开始');
  
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // 1. 解析数据
    const { email, password, keyCode } = await request.json();
    const formattedKeyCode = keyCode?.trim().toUpperCase();
    
    if (!email || !password || !keyCode) {
      return NextResponse.json({ error: '邮箱、密码和密钥必填' }, { status: 400 });
    }

    // 2. 查询密钥
    const { data: keyData, error: keyError } = await supabase
      .from('access_keys')
      .select('id, key_code, used_count, max_uses, key_expires_at, account_valid_for_days')
      .eq('key_code', formattedKeyCode)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      console.error('[API] 密钥查询失败:', keyError);
      return NextResponse.json({ error: '产品密钥无效' }, { status: 400 });
    }
    
    if (keyData.used_count >= keyData.max_uses) {
      return NextResponse.json({ error: '密钥使用次数已达上限' }, { status: 400 });
    }
    
    if (keyData.key_expires_at && new Date() > new Date(keyData.key_expires_at)) {
      return NextResponse.json({ error: '密钥已过期' }, { status: 400 });
    }

    // 3. 创建用户
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
      },
    });
    
    if (authError || !authData.user) {
      console.error('[API] 创建用户失败:', authError);
      return NextResponse.json({ error: `注册失败: ${authError?.message}` }, { status: 400 });
    }

    // 4. 同步创建用户资料（使用现有字段）
    const now = new Date();
    const validDays = keyData.account_valid_for_days || 30;
    const accountExpiresAt = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000).toISOString();
    
    // 时间缓冲：向前调整2秒，给中间件缓冲时间
    const adjustedNow = new Date(now.getTime() - 2000);
    const initialSessionId = `init_${authData.user.id}_${Date.now()}`;
    
    // 插入用户资料（只使用实际存在的字段）
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      email: email.trim(),
      access_key_id: keyData.id,
      account_expires_at: accountExpiresAt,
      last_login_at: adjustedNow.toISOString(),
      last_login_session: initialSessionId,
      created_at: adjustedNow.toISOString(),
      updated_at: adjustedNow.toISOString(),
      nickname: email.split('@')[0] || '用户',
    });

    if (profileError) {
      console.error('[API] 创建用户资料失败:', profileError);
      // 尝试更新（可能已存在）
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        email: email.trim(),
        access_key_id: keyData.id,
        account_expires_at: accountExpiresAt,
        last_login_at: adjustedNow.toISOString(),
        last_login_session: initialSessionId,
        updated_at: adjustedNow.toISOString(),
        nickname: email.split('@')[0] || '用户',
      });
    }

    // 5. 异步更新密钥使用次数
    setTimeout(async () => {
      try {
        await supabase
          .from('access_keys')
          .update({ 
            used_count: (keyData.used_count || 0) + 1, 
            updated_at: now.toISOString() 
          })
          .eq('id', keyData.id);
        console.log('[API] 密钥使用次数已更新');
      } catch (keyUpdateError) {
        console.error('[API] 更新密钥失败:', keyUpdateError);
      }
    }, 0);

    console.log('[API] 注册成功:', { 
      userId: authData.user.id, 
      email: email.trim(),
      expiresAt: accountExpiresAt,
      sessionId: initialSessionId
    });

    // 6. 返回成功响应
    return NextResponse.json({
      success: true,
      message: '注册成功！请使用注册的邮箱和密码登录',
      user: { 
        id: authData.user.id, 
        email: authData.user.email 
      },
      expires_at: accountExpiresAt,
      note: '请前往登录页面使用注册的邮箱和密码登录'
    });

  } catch (error: any) {
    console.error('[API] 注册异常:', error);
    return NextResponse.json({ 
      error: '服务器内部错误，请稍后重试或联系客服' 
    }, { status: 500 });
  }
}