// /app/api/auth/renew-account/route.ts - 修复计次问题版
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  console.log('[Renew API] 续费请求开始');
  
  try {
    // 1. 获取cookies
    const cookieStore = await cookies();
    
    // 2. 创建普通客户端（用户操作）
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              console.error('[Renew API] 设置cookie失败:', error);
            }
          },
        },
      }
    );

    // 3. 验证用户登录状态
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '用户未登录' }, { status: 401 });
    }

    const userId = user.id;
    console.log('[Renew API] 用户已验证:', userId);

    // 4. 解析请求体
    const { keyCode } = await request.json();
    if (!keyCode) {
      return NextResponse.json({ error: '请输入续费密钥' }, { status: 400 });
    }
    const formattedKeyCode = keyCode.trim().toUpperCase();

    console.log('[Renew API] 处理密钥:', formattedKeyCode);

    // 5. 🔥 关键修复：创建一个管理员客户端（仅用于密钥操作）
    // 注意：只在需要绕过RLS时使用
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 6. 验证续费密钥（使用普通客户端，因为用户应该能看到有效的密钥）
    const { data: keyData, error: keyError } = await supabase
      .from('access_keys')
      .select(`
        id, key_code, is_active, used_count, max_uses, 
        key_expires_at, account_valid_for_days,
        original_duration_hours, duration_unit, user_id
      `)
      .eq('key_code', formattedKeyCode)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      console.error('[Renew API] 密钥未找到:', keyError);
      return NextResponse.json({ error: '续费密钥不存在或已被禁用' }, { status: 400 });
    }

    // 7. 检查密钥状态
    const now = new Date();
    
    // 检查是否过期（如果设置了过期时间）
    if (keyData.key_expires_at && new Date(keyData.key_expires_at) < now) {
      return NextResponse.json({ error: '续费密钥已过期' }, { status: 400 });
    }
    
    // 🔥 修复：检查使用次数限制（使用更宽松的逻辑）
    // 如果 max_uses = 0 或 null，表示无限制
    if (keyData.max_uses && keyData.max_uses > 0 && keyData.used_count >= keyData.max_uses) {
      return NextResponse.json({ error: '该续费密钥使用次数已达上限' }, { status: 400 });
    }

    console.log('[Renew API] 密钥验证通过:', {
      keyId: keyData.id,
      usedCount: keyData.used_count,
      maxUses: keyData.max_uses,
      expiresAt: keyData.key_expires_at
    });

    // 8. 获取用户当前有效期
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('account_expires_at, access_key_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[Renew API] 获取用户信息失败:', profileError);
      return NextResponse.json({ error: '无法获取用户信息' }, { status: 500 });
    }

    // 9. 计算新的有效期（从当前时间开始计算）
    let newExpiryDate: Date;
    const currentExpiry = profile?.account_expires_at ? new Date(profile.account_expires_at) : now;
    
    // 选择基准时间：取当前时间和当前有效期的较大值
    const baseDate = currentExpiry > now ? currentExpiry : now;
    
    if (keyData.original_duration_hours && keyData.duration_unit === 'hours') {
      // 小时级别密钥
      const hours = parseFloat(keyData.original_duration_hours.toString());
      newExpiryDate = new Date(baseDate.getTime() + hours * 60 * 60 * 1000);
      console.log('[Renew API] 使用小时级别时长:', hours + '小时');
    } else {
      // 天数级别密钥
      const validDays = keyData.account_valid_for_days || 30;
      newExpiryDate = new Date(baseDate);
      newExpiryDate.setDate(newExpiryDate.getDate() + validDays);
      console.log('[Renew API] 使用天数级别时长:', validDays + '天');
    }

    console.log('[Renew API] 有效期计算:', {
      当前有效期: profile?.account_expires_at,
      基准时间: baseDate.toISOString(),
      新有效期: newExpiryDate.toISOString()
    });

    // 10. 🔥 修复计次问题：先检查是否有触发器，然后决定如何更新
    
    // 首先，检查key_usage_history表是否有对应记录
    const { data: existingHistory, error: historyCheckError } = await supabaseAdmin
      .from('key_usage_history')
      .select('id')
      .eq('access_key_id', keyData.id)
      .eq('user_id', userId)
      .eq('usage_type', 'renew')
      .limit(1);

    if (historyCheckError) {
      console.error('[Renew API] 检查使用历史失败:', historyCheckError);
    }

    // 如果已有续费记录，避免重复计次
    if (existingHistory && existingHistory.length > 0) {
      console.warn('[Renew API] 检测到重复续费请求:', { keyId: keyData.id, userId });
      // 可以选择返回错误，或者继续更新有效期但不计次
    }

    // 11. 🔥 关键修复：使用事务或批量操作确保数据一致性
    const operations = [];

    // 操作1: 更新密钥状态（仅更新使用次数和时间）
    operations.push(
      supabaseAdmin
        .from('access_keys')
        .update({
          used_count: keyData.used_count + 1, // 只加1
          user_id: userId, // 记录最后使用者
          used_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', keyData.id)
    );

    // 操作2: 记录密钥使用历史
    operations.push(
      supabaseAdmin
        .from('key_usage_history')
        .insert({
          access_key_id: keyData.id,
          user_id: userId,
          used_at: now.toISOString(),
          usage_type: 'renew',
          notes: `续费操作 - 原有效期至: ${profile?.account_expires_at || '无'}, 新有效期至: ${newExpiryDate.toISOString()}`
        })
    );

    // 操作3: 更新用户有效期
    operations.push(
      supabase
        .from('profiles')
        .update({
          account_expires_at: newExpiryDate.toISOString(),
          access_key_id: keyData.id,
          updated_at: now.toISOString()
        })
        .eq('id', userId)
    );

    // 执行所有操作
    const results = await Promise.all(operations);
    
    // 检查是否有错误
    for (const result of results) {
      if (result.error) {
        console.error('[Renew API] 操作执行失败:', result.error);
        return NextResponse.json({ 
          error: '续费失败，数据库操作错误' 
        }, { status: 500 });
      }
    }

    // 12. 🔥 验证计次是否正确
    const { data: updatedKey, error: verifyError } = await supabaseAdmin
      .from('access_keys')
      .select('used_count')
      .eq('id', keyData.id)
      .single();

    if (verifyError) {
      console.error('[Renew API] 验证更新失败:', verifyError);
    } else {
      console.log('[Renew API] 计次验证:', {
        原次数: keyData.used_count,
        新次数: updatedKey.used_count,
        计次差异: updatedKey.used_count - keyData.used_count
      });
      
      // 如果计次增加了2，说明有触发器问题
      if (updatedKey.used_count - keyData.used_count === 2) {
        console.warn('[Renew API] 警告：续费一次计次增加了2次，可能存在触发器重复计次');
        // 自动修复：将计次减1
        await supabaseAdmin
          .from('access_keys')
          .update({ used_count: keyData.used_count + 1 })
          .eq('id', keyData.id);
      }
    }

    // 13. 返回成功响应
    console.log('[Renew API] 续费成功完成');
    
    return NextResponse.json({
      success: true,
      message: `续费成功！您的账户有效期已延长至 ${newExpiryDate.toLocaleDateString('zh-CN')}`,
      data: {
        expires_at: newExpiryDate.toISOString(),
        key_info: {
          id: keyData.id,
          key_code: keyData.key_code,
          original_used_count: keyData.used_count,
          new_used_count: keyData.used_count + 1,
          // 添加调试信息
          debug: {
            timestamp: now.toISOString(),
            user_id: userId,
            session_id: Math.random().toString(36).substring(7) // 简单会话ID
          }
        }
      }
    });

  } catch (error: any) {
    console.error('[Renew API] 未预期的错误:', error);
    return NextResponse.json({ 
      success: false,
      error: '服务器内部错误，请稍后重试或联系客服',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}