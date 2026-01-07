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

    console.log(`[兑换] 找到密钥: ID=${key.id}, 类型=${key.boost_type}, 次数=${key.increment_amount}, 临时=${key.is_temporary}, 有效期=${key.temp_duration_days}天`);

    // 5. 验证密钥状态
    if (!key.is_active) {
      return NextResponse.json(
        { error: "密钥已被禁用" },
        { status: 400 }
      );
    }

    if (key.used_count >= key.max_uses) {
      return NextResponse.json(
        { error: "密钥已达到最大使用次数" },
        { status: 400 }
      );
    }

    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "密钥已过期" },
        { status: 400 }
      );
    }

    if (key.used_by_user_id) {
      return NextResponse.json(
        { error: "密钥已被使用" },
        { status: 400 }
      );
    }

    // 6. 查询用户当前限制
    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('custom_daily_limit, custom_cycle_limit')
      .eq('id', user.id)
      .single();

    if (profileError || !currentProfile) {
      console.error(`[兑换] 查询用户资料失败:`, profileError);
      return NextResponse.json(
        { error: "无法获取用户资料" },
        { status: 404 }
      );
    }

    console.log(`[兑换] 用户当前限制 - 每日: ${currentProfile.custom_daily_limit}, 周期: ${currentProfile.custom_cycle_limit}`);

    // 7. 根据密钥类型进行处理
    const userId = user.id;
    let resultMessage = '';
    let isTemporary = key.is_temporary;

    if (isTemporary) {
      // 🔥 临时密钥：记录到 temporary_ai_boosts 表
      const validFrom = new Date();
      const validTo = new Date();
      const durationDays = key.temp_duration_days || 7;
      validTo.setDate(validTo.getDate() + durationDays);
      
      // 插入临时加成记录
      const { error: tempBoostError } = await supabaseAdmin
        .from('temporary_ai_boosts')
        .insert({
          user_id: userId,
          ai_boost_key_id: key.id,
          boost_type: key.boost_type,
          increment_amount: key.increment_amount,
          valid_from: validFrom.toISOString(),
          valid_to: validTo.toISOString(),
          is_active: true
        });
      
      if (tempBoostError) {
        console.error(`[兑换] 插入临时加成失败:`, tempBoostError);
        throw tempBoostError;
      }
      
      resultMessage = `成功兑换临时${key.boost_type === 'daily' ? '每日' : '周期'}AI次数+${key.increment_amount}次，有效期${durationDays}天`;
      
    } else {
      // 🔥 永久密钥：更新用户的永久限制
      let updateData: Record<string, number> = {};
      
      if (key.boost_type === 'cycle') {
        const currentLimit = currentProfile.custom_cycle_limit;
        const defaultLimit = 120;
        const newLimit = (currentLimit !== null && currentLimit !== undefined ? currentLimit : defaultLimit) + key.increment_amount;
        updateData.custom_cycle_limit = newLimit;
        console.log(`[兑换] 永久增加周期限制: ${currentLimit} -> ${newLimit}`);
        
      } else if (key.boost_type === 'daily') {
        const currentLimit = currentProfile.custom_daily_limit;
        const defaultLimit = 10;
        const newLimit = (currentLimit !== null && currentLimit !== undefined ? currentLimit : defaultLimit) + key.increment_amount;
        updateData.custom_daily_limit = newLimit;
        console.log(`[兑换] 永久增加每日限制: ${currentLimit} -> ${newLimit}`);
        
      } else {
        return NextResponse.json(
          { error: "无效的密钥类型" },
          { status: 400 }
        );
      }
      
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', userId);
      
      if (updateError) {
        console.error(`[兑换] 更新用户限制失败:`, updateError);
        throw updateError;
      }
      
      resultMessage = `成功永久增加${key.boost_type === 'daily' ? '每日' : '周期'}AI次数+${key.increment_amount}次`;
    }

    // 8. 更新密钥状态
    const { error: keyUpdateError } = await supabaseAdmin
      .from('ai_boost_keys')
      .update({
        used_count: key.used_count + 1,
        used_by_user_id: userId,
        used_at: new Date().toISOString()
      })
      .eq('id', key.id);

    if (keyUpdateError) {
      console.error(`[兑换] 更新密钥状态失败:`, keyUpdateError);
      throw keyUpdateError;
    }

    // 9. 获取更新后的用户信息
    const { data: updatedProfile } = await supabaseAdmin
      .from('profiles')
      .select('custom_daily_limit, custom_cycle_limit')
      .eq('id', userId)
      .single();

    console.log(`[兑换] 兑换成功! 用户: ${user.email}, 密钥: ${key.key_code}, 类型: ${isTemporary ? '临时' : '永久'}`);
    console.log(`[兑换] 更新后限制 - 每日: ${updatedProfile?.custom_daily_limit}, 周期: ${updatedProfile?.custom_cycle_limit}`);

    // 10. 返回成功响应
    return NextResponse.json({
      success: true,
      message: resultMessage,
      data: {
        boostType: key.boost_type,
        amount: key.increment_amount,
        isTemporary: isTemporary,
        temporaryDuration: isTemporary ? (key.temp_duration_days || 7) : null,
        newLimits: {
          daily: updatedProfile?.custom_daily_limit || 10,
          cycle: updatedProfile?.custom_cycle_limit || 120
        }
      }
    });

  } catch (error: any) {
    console.error('[兑换API] 未捕获的错误:', error);
    
    const errorMessage = error.message || "兑换失败，请重试";
    const errorDetails = error.details || error.hint || error.code || null;
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}