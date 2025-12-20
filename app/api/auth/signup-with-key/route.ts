// /app/api/auth/signup-with-key/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { email, password, keyCode } = await request.json();

    if (!email || !password || !keyCode) {
      return NextResponse.json(
        { error: '邮箱、密码和产品密钥均为必填' },
        { status: 400 }
      );
    }

    // 验证密钥
    const { data: keyData, error: keyError } = await supabase
      .from('access_keys')
      .select('*')
      .eq('key_code', keyCode.trim().toUpperCase())
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json(
        { error: '产品密钥无效或已被禁用' },
        { status: 400 }
      );
    }

    if (keyData.used_count >= keyData.max_uses) {
      return NextResponse.json(
        { error: '产品密钥使用次数已达上限' },
        { status: 400 }
      );
    }

    if (keyData.key_expires_at && new Date() > new Date(keyData.key_expires_at)) {
      return NextResponse.json(
        { error: '产品密钥已过期' },
        { status: 400 }
      );
    }

    // 创建用户
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    });

    if (authError) {
      return NextResponse.json(
        { error: `注册失败: ${authError.message}` },
        { status: 400 }
      );
    }

    // 更新用户资料和密钥状态
    if (authData.user) {
      let accountExpiresAt = null;
      if (keyData.account_valid_for_days) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + keyData.account_valid_for_days);
        accountExpiresAt = expiryDate.toISOString();
      }

      await supabase.from('profiles').upsert({
        id: authData.user.id,
        email: email.trim(),
        access_key_id: keyData.id,
        account_expires_at: accountExpiresAt,
        updated_at: new Date().toISOString(),
      });

      await supabase
        .from('access_keys')
        .update({
          used_count: (keyData.used_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', keyData.id);
    }

    return NextResponse.json({
      success: true,
      message: '注册成功！',
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
      }
    });
  } catch (error: any) {
    console.error('注册API错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
  }
}
