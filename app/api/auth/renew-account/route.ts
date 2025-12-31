// /app/api/auth/renew-account/route.ts - 修复版
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js'; // 新增：用于管理员操作
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

    // 2. 创建管理员客户端（用于更新密钥表）
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // 使用服务角色密钥
      { auth: { persistSession: false } }
    );

    // 3. 验证用户登录状态（续费必须是已登录用户）
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '用户未登录' }, { status: 401 });
    }

    const userId = user.id;

    // 4. 解析请求体（密钥）
    const { keyCode } = await request.json();
    if (!keyCode) {
      return NextResponse.json({ error: '请输入续费密钥' }, { status: 400 });
    }
    const formattedKeyCode = keyCode.trim().toUpperCase();

    console.log('[Renew API] 续费请求:', { userId, keyCode: formattedKeyCode });

    // 5. 验证续费密钥（使用管理员客户端确保有权限）
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('access_keys')
      .select(`
        id, key_code, account_valid_for_days, is_active, 
        used_count, max_uses, key_expires_at,
        original_duration_hours, duration_unit,
        user_id as current_user_id  // 当前使用者
      `)
      .eq('key_code', formattedKeyCode)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      console.error('[Renew API] 密钥查询失败:', keyError);
      return NextResponse.json({ error: '续费密钥无效或已被禁用' }, { status: 400 });
    }

    // 6. 检查密钥使用限制
    if (keyData.max_uses > 0 && keyData.used_count >= keyData.max_uses) {
      return NextResponse.json({ error: '该续费密钥使用次数已达上限' }, { status: 400 });
    }

    // 7. 检查密钥是否过期
    if (keyData.key_expires_at && new Date() > new Date(keyData.key_expires_at)) {
      return NextResponse.json({ error: '续费密钥已过期' }, { status: 400 });
    }

    // 8. 获取用户当前有效期
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('account_expires_at, access_key_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[Renew API] 获取用户信息失败:', profileError);
      return NextResponse.json({ error: '无法获取用户信息' }, { status: 500 });
    }

    const now = new Date();

    // 9. 🔥 关键修复：更新 access_keys 表
    console.log('[Renew API] 开始更新密钥状态:', {
      keyId: keyData.id,
      currentUsedCount: keyData.used_count,
      currentUser: keyData.current_user_id,
      newUser: userId
    });

    // 9.1 更新密钥使用次数、使用者和使用时间
    const { error: updateKeyError } = await supabaseAdmin
      .from('access_keys')
      .update({
        used_count: (keyData.used_count || 0) + 1,
        user_id: userId,  // 🔥 更新为当前续费用户
        used_at: now.toISOString(),  // 🔥 更新使用时间
        updated_at: now.toISOString()
      })
      .eq('id', keyData.id);

    if (updateKeyError) {
      console.error('[Renew API] 更新密钥失败:', updateKeyError);
      return NextResponse.json({ 
        error: '续费失败，无法更新密钥状态' 
      }, { status: 500 });
    }

    // 9.2 记录密钥使用历史（续费类型）
    const { error: historyError } = await supabaseAdmin
      .from('key_usage_history')
      .insert({
        access_key_id: keyData.id,
        user_id: userId,
        used_at: now.toISOString(),
        usage_type: 'renew',  // 使用类型为"续费"
        notes: `用户续费，原有效期至: ${profile?.account_expires_at || '无'}`
      });

    if (historyError) {
      console.error('[Renew API] 记录密钥使用历史失败:', historyError);
      // 这里不返回错误，因为核心的续费操作已完成
    }

    // 10. 计算新的有效期
    let newExpiryDate: Date;
    
    // 如果密钥有原始时长（小时级别）
    if (keyData.original_duration_hours && keyData.duration_unit === 'hours') {
      const hours = parseFloat(keyData.original_duration_hours.toString());
      newExpiryDate = new Date(now.getTime() + hours * 60 * 60 * 1000);
    } else {
      // 否则使用账户有效期天数
      const validDays = keyData.account_valid_for_days || 30;
      newExpiryDate = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);
    }

    // 11. 更新用户有效期（从当前时间开始，不是从原有效期累加）
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        account_expires_at: newExpiryDate.toISOString(),
        access_key_id: keyData.id,  // 更新用户当前使用的密钥ID
        updated_at: now.toISOString(),
      })
      .eq('id', userId);

    if (updateProfileError) {
      console.error('[Renew API] 更新用户有效期失败:', updateProfileError);
      return NextResponse.json({ error: '续费失败，更新数据库时出错' }, { status: 500 });
    }

    // 12. 返回成功
    console.log('[Renew API] 续费成功:', { 
      userId, 
      keyId: keyData.id,
      newUsedCount: (keyData.used_count || 0) + 1,
      newExpiry: newExpiryDate.toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `续费成功！您的账户有效期已延长至 ${newExpiryDate.toLocaleDateString('zh-CN')}`,
      expires_at: newExpiryDate.toISOString(),
      key_info: {
        id: keyData.id,
        key_code: keyData.key_code,
        used_count: (keyData.used_count || 0) + 1
      }
    });

  } catch (error: any) {
    console.error('[Renew API] 服务器内部错误:', error);
    return NextResponse.json({ 
      error: '服务器内部错误，请稍后重试或联系客服' 
    }, { status: 500 });
  }
}

// 可选：保留GET方法用于测试
export async function GET() {
  return NextResponse.json({
    success: true,
    message: '续费API已就绪，请使用POST方法提交续费密钥',
  });
}