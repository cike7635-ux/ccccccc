import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  console.log('[API] 注册请求开始');

  try {
    // 1. 创建 Supabase 客户端（使用您刚配置的环境变量）
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try { cookieStore.set(name, value, options); } catch {}
            });
          },
        },
      }
    );

    // 2. 解析请求数据
    const { email, password, keyCode } = await request.json();
    console.log('[API] 接收到数据:', { email, keyCode: keyCode?.toUpperCase() });

    if (!email || !password || !keyCode) {
      return NextResponse.json(
        { error: '邮箱、密码和产品密钥均为必填' },
        { status: 400 }
      );
    }

    const formattedKeyCode = keyCode.trim().toUpperCase();

    // 3. 验证产品密钥（请确认您的表名是 'access_keys'）
    console.log('[API] 正在验证密钥:', formattedKeyCode);
    const { data: keyData, error: keyError } = await supabase
      .from('access_keys') // 🔁 如果表名不对，请修改此处！
      .select('*')
      .eq('key_code', formattedKeyCode)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      console.error('[API] 密钥无效:', keyError);
      return NextResponse.json(
        { error: '产品密钥无效、已被禁用或不存在' },
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

    // 4. 创建用户账户
    console.log('[API] 正在创建用户...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      // 注意：移除了会导致错误的 emailConfirm 选项
    });

    if (authError) {
      console.error('[API] 创建用户失败:', authError);
      return NextResponse.json(
        { error: `注册失败: ${authError.message}` },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: '用户创建失败，未返回用户信息' },
        { status: 500 }
      );
    }

    console.log('[API] 用户创建成功，ID:', authData.user.id);

    // 5. 计算账户有效期并更新用户资料
    let accountExpiresAt = null;
    if (keyData.account_valid_for_days) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + keyData.account_valid_for_days);
      accountExpiresAt = expiryDate.toISOString();
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      email: email.trim(),
      access_key_id: keyData.id,
      account_expires_at: accountExpiresAt,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error('[API] 更新用户资料失败:', profileError);
      // 注意：这里不进行用户回滚，因为Auth用户已创建成功
    }

    // 6. 更新密钥使用次数
    const { error: updateKeyError } = await supabase
      .from('access_keys')
      .update({
        used_count: (keyData.used_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', keyData.id);

    if (updateKeyError) {
      console.error('[API] 更新密钥状态失败:', updateKeyError);
    }

    // 7. 返回最终成功响应
    console.log('[API] 注册流程全部完成');
    return NextResponse.json({
      success: true,
      message: '注册成功！',
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      expires_at: accountExpiresAt
    });

  } catch (error: any) {
    // 8. 捕获任何未预期的异常
    console.error('[API] 服务器内部捕获到未处理异常:', error);
    return NextResponse.json(
      { error: `服务器内部错误: ${error.message}` },
      { status: 500 }
    );
  }
}
