// /app/api/auth/renew-account/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  console.log('[Renew API] 续费请求开始');
  
  try {
    // 1. 创建Supabase客户端
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

    // 2. 验证用户登录状态（续费必须是已登录用户）
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '用户未登录' }, { status: 401 });
    }

    // 3. 解析请求体（密钥）
    const { keyCode } = await request.json();
    if (!keyCode) {
      return NextResponse.json({ error: '请输入续费密钥' }, { status: 400 });
    }
    const formattedKeyCode = keyCode.trim().toUpperCase();

    // 4. 验证续费密钥（逻辑与注册时类似）
    const { data: keyData, error: keyError } = await supabase
      .from('access_keys')
      .select('id, key_code, account_valid_for_days, is_active, used_count, max_uses')
      .eq('key_code', formattedKeyCode)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: '续费密钥无效或已被禁用' }, { status: 400 });
    }
    if (keyData.used_count >= keyData.max_uses) {
      return NextResponse.json({ error: '该续费密钥使用次数已达上限' }, { status: 400 });
    }

    // 5. 获取用户当前有效期，并计算新的有效期
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_expires_at')
      .eq('id', user.id)
      .single();

    // 计算新的过期时间：从当前过期时间开始追加，如果已过期则从现在开始
    const currentExpiry = profile?.account_expires_at ? new Date(profile.account_expires_at) : new Date();
    const now = new Date();
    const baseDate = currentExpiry > now ? currentExpiry : now; // 选择较晚的那个作为基准
    
    const validDays = keyData.account_valid_for_days || 30;
    const newExpiryDate = new Date(baseDate);
    newExpiryDate.setDate(newExpiryDate.getDate() + validDays);

    // 6. 更新用户有效期
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        account_expires_at: newExpiryDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[Renew API] 更新用户有效期失败:', updateError);
      return NextResponse.json({ error: '续费失败，更新数据库时出错' }, { status: 500 });
    }

    // 7. 标记密钥已使用（此步骤可选，根据业务决定是否消耗续费密钥）
    const { error: keyUpdateError } = await supabase
      .from('access_keys')
      .update({
        used_count: (keyData.used_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', keyData.id);

    if (keyUpdateError) {
      console.error('[Renew API] 更新密钥状态失败:', keyUpdateError);
      // 这里不返回错误，因为用户续费核心操作已成功
    }

    // 8. 返回成功
    console.log('[Renew API] 续费成功:', { userId: user.id, newExpiry: newExpiryDate.toISOString() });
    return NextResponse.json({
      success: true,
      message: `续费成功！您的账户有效期已延长至 ${newExpiryDate.toLocaleDateString('zh-CN')}`,
      expires_at: newExpiryDate.toISOString(),
    });

  } catch (error: any) {
    console.error('[Renew API] 服务器内部错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// 可选：保留GET方法用于测试
export async function GET() {
  return NextResponse.json({
    success: true,
    message: '续费API已就绪，请使用POST方法提交续费密钥',
  });
}
