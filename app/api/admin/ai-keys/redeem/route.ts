// /app/api/admin/ai-keys/redeem/route.ts
import { NextRequest, NextResponse } from "next/server";
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

    // 2. 🔥 修复：使用服务角色密钥创建Supabase客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('缺少Supabase环境变量');
      return NextResponse.json(
        { error: "服务器配置错误" },
        { status: 500 }
      );
    }
    
    // 🔥 使用服务角色密钥创建客户端，可以绕过RLS策略
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });

    // 3. 从请求头中获取用户信息（因为使用服务角色密钥）
    // 我们需要从授权头或Cookie中获取用户ID
    const authHeader = request.headers.get('authorization');
    const cookies = request.headers.get('cookie');
    
    let userId = '';
    
    if (authHeader?.startsWith('Bearer ')) {
      // 从Bearer token解析用户ID
      // 这里需要根据你的认证逻辑来获取用户
      // 或者我们可以通过cookie来获取
    }
    
    // 🔥 替代方案：使用cookie中的session来获取用户
    if (cookies) {
      try {
        // 解析cookie找到session
        const sessionCookie = cookies.split(';').find(c => c.includes('sb-') && c.includes('access_token'));
        if (sessionCookie) {
          // 你可以在这里解析session或直接使用服务端角色查询
          // 简单起见，我们可以直接使用服务角色密钥查询用户
        }
      } catch (error) {
        console.error('解析cookie失败:', error);
      }
    }
    
    // 🔥 由于使用服务角色密钥，我们可以直接查询当前登录的用户
    // 但需要知道用户ID。我们可以从请求的其他部分获取，或者...
    // 实际上，更好的方式是使用标准的认证方式

    // 🔥 临时的解决方案：如果前端传递了userId，就使用它
    const { userId: requestUserId } = await request.json().catch(() => ({}));
    
    if (!requestUserId) {
      console.error('无法获取用户ID');
      return NextResponse.json(
        { error: "无法验证用户身份" },
        { status: 401 }
      );
    }
    
    const user = { id: requestUserId };

    console.log(`[兑换] 用户 ${user.id} 尝试兑换密钥: ${keyCode}`);

    // 4. 查找密钥（不区分大小写）
    const upperKeyCode = keyCode.trim().toUpperCase();
    const { data: key, error: keyError } = await supabase
      .from('ai_boost_keys')
      .select('*')
      .eq('key_code', upperKeyCode)
      .single();

    if (keyError || !key) {
      console.log(`[兑换] 密钥不存在: ${upperKeyCode}`, keyError);
      return NextResponse.json(
        { error: "密钥不存在" },
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
      // 如果为null则用120，否则加上增量
      updateValue = `COALESCE(custom_cycle_limit, 120) + ${key.increment_amount}`;
    } else if (key.boost_type === 'daily') {
      updateColumn = 'custom_daily_limit';
      // 如果为null则用10，否则加上增量
      updateValue = `COALESCE(custom_daily_limit, 10) + ${key.increment_amount}`;
    } else {
      return NextResponse.json(
        { error: "无效的密钥类型" },
        { status: 400 }
      );
    }

    console.log(`[兑换] 更新用户限制: ${updateColumn} = ${updateValue}`);

    // 8. 更新用户限制（使用原始SQL表达式）
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        [updateColumn]: supabase.raw(updateValue)
      })
      .eq('id', user.id);

    if (updateError) {
      console.error(`[兑换] 更新用户限制失败:`, updateError);
      throw updateError;
    }

    // 9. 更新密钥状态
    const { error: keyUpdateError } = await supabase
      .from('ai_boost_keys')
      .update({
        used_count: key.used_count + 1,
        used_by_user_id: user.id,
        used_at: new Date().toISOString(),
        expires_at: expiresAt || key.expires_at // 如果原密钥没有过期时间，使用计算的过期时间
      })
      .eq('id', key.id);

    if (keyUpdateError) {
      console.error(`[兑换] 更新密钥状态失败:`, keyUpdateError);
      throw keyUpdateError;
    }

    // 10. 获取更新后的用户信息
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('custom_daily_limit, custom_cycle_limit')
      .eq('id', user.id)
      .single();

    console.log(`[兑换] 兑换成功! 用户ID: ${user.id}, 密钥: ${key.key_code}`);
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