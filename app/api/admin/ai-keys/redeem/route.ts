// /app/api/admin/ai-keys/redeem/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求
    const { keyCode } = await request.json();
    if (!keyCode) {
      return NextResponse.json(
        { error: "请提供密钥代码" },
        { status: 400 }
      );
    }

    // 2. 获取当前登录用户
    const cookieStore = await cookies();
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
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              console.error('设置cookie失败:', error);
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('无法获取用户ID:', authError);
      return NextResponse.json(
        { error: "无法验证用户身份，请重新登录" },
        { status: 401 }
      );
    }

    console.log(`[兑换] 用户 ${user.email} (${user.id}) 尝试兑换密钥: ${keyCode}`);

    // 3. 创建服务端客户端用于数据库操作
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    // 4. 查找密钥（不区分大小写）
    const upperKeyCode = keyCode.trim().toUpperCase();
    const { data: key, error: keyError } = await supabaseAdmin
      .from('ai_boost_keys')
      .select('*')
      .eq('key_code', upperKeyCode)
      .single();

    if (keyError || !key) {
      console.log(`[兑换] 密钥不存在: ${upperKeyCode}`, keyError);
      return NextResponse.json(
        { error: "密钥不存在或无效" },
        { status: 404 }
      );
    }

    console.log(`[兑换] 找到密钥: ID=${key.id}, 类型=${key.boost_type}, 次数=${key.increment_amount}`);

    // 5. 验证密钥状态
    if (!key.is_active) {
      return NextResponse.json(
        { error: "密钥已被禁用" },
        { status: 400 }
      );
    }

    if (key.used_count >= key.max_uses) {
      return NextResponse.json(
        { error: "密钥已使用" },
        { status: 400 }
      );
    }

    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "密钥已过期" },
        { status: 400 }
      );
    }

    // 6. 计算过期时间（如果需要）
    let expiresAt = null;
    if (key.duration_days) {
      expiresAt = new Date(Date.now() + key.duration_days * 24 * 60 * 60 * 1000).toISOString();
      console.log(`[兑换] 密钥有效天数: ${key.duration_days}天, 过期时间: ${expiresAt}`);
    }

    // 7. 根据密钥类型更新用户限制
    let updateColumn = '';
    let updateValue = null;
    
    if (key.boost_type === 'cycle') {
      updateColumn = 'custom_cycle_limit';
      updateValue = `COALESCE(custom_cycle_limit, 120) + ${key.increment_amount}`;
    } else if (key.boost_type === 'daily') {
      updateColumn = 'custom_daily_limit';
      updateValue = `COALESCE(custom_daily_limit, 10) + ${key.increment_amount}`;
    } else {
      return NextResponse.json(
        { error: "无效的密钥类型" },
        { status: 400 }
      );
    }

    console.log(`[兑换] 更新用户限制: ${updateColumn} = ${updateValue}`);

    // 8. 更新用户限制
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        [updateColumn]: supabaseAdmin.raw(updateValue)
      })
      .eq('id', user.id);

    if (updateError) {
      console.error(`[兑换] 更新用户限制失败:`, updateError);
      throw updateError;
    }

    // 9. 更新密钥状态
    const { error: keyUpdateError } = await supabaseAdmin
      .from('ai_boost_keys')
      .update({
        used_count: key.used_count + 1,
        used_by_user_id: user.id,
        used_at: new Date().toISOString(),
        expires_at: expiresAt || key.expires_at
      })
      .eq('id', key.id);

    if (keyUpdateError) {
      console.error(`[兑换] 更新密钥状态失败:`, keyUpdateError);
      throw keyUpdateError;
    }

    // 10. 获取更新后的用户信息
    const { data: updatedProfile } = await supabaseAdmin
      .from('profiles')
      .select('custom_daily_limit, custom_cycle_limit')
      .eq('id', user.id)
      .single();

    console.log(`[兑换] 兑换成功! 用户: ${user.email}, 密钥: ${key.key_code}`);
    console.log(`[兑换] 更新后限制 - 每日: ${updatedProfile?.custom_daily_limit}, 周期: ${updatedProfile?.custom_cycle_limit}`);

    // 11. 返回成功响应
    return NextResponse.json({
      success: true,
      message: `兑换成功！获得${key.increment_amount}次AI${key.boost_type === 'cycle' ? '周期' : '每日'}使用次数`,
      data: {
        boostType: key.boost_type,
        amount: key.increment_amount,
        newLimits: {
          daily: updatedProfile?.custom_daily_limit || 10,
          cycle: updatedProfile?.custom_cycle_limit || 120
        }
      }
    });

  } catch (error: any) {
    console.error('[兑换API] 未捕获的错误:', error);
    return NextResponse.json(
      { 
        error: error.message || "兑换失败，请重试",
        details: error.details || error.hint || null
      },
      { status: 500 }
    );
  }
}