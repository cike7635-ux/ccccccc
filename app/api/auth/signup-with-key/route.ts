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
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    );

    // 1. 解析数据
    const { email, password, keyCode } = await request.json();
    const formattedKeyCode = keyCode?.trim().toUpperCase();
    if (!email || !password || !keyCode) {
      return NextResponse.json({ error: '邮箱、密码和密钥必填' }, { status: 400 });
    }

    // 2. 查询密钥（使用新表结构）
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
    });
    if (authError || !authData.user) {
      console.error('[API] 创建用户失败:', authError);
      return NextResponse.json({ error: `注册失败: ${authError?.message}` }, { status: 400 });
    }

    // 4. 计算有效期（使用新字段 account_valid_for_days）
    const validDays = keyData.account_valid_for_days || 30;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + validDays);
    const accountExpiresAt = expiryDate.toISOString();

    // 5. 更新用户资料（profiles 表）
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      email: email.trim(),
      access_key_id: keyData.id,
      account_expires_at: accountExpiresAt,
      updated_at: new Date().toISOString(),
    });
    if (profileError) console.error('[API] 更新profiles失败（非关键）:', profileError);

    // 6. 更新密钥使用次数
    await supabase
      .from('access_keys')
      .update({ used_count: (keyData.used_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', keyData.id);

    console.log('[API] 注册成功:', { userId: authData.user.id, expiresAt: accountExpiresAt });
    return NextResponse.json({
      success: true,
      message: '注册成功',
      user: { id: authData.user.id, email: authData.user.email },
      expires_at: accountExpiresAt,
    });

  } catch (error: any) {
    console.error('[API] 未处理异常:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
