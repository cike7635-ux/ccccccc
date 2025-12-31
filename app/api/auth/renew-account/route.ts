// /app/api/auth/renew-account/route.ts - 最终修正版
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js'; // 用于管理员操作
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  console.log('[Renew API] 续费请求开始');
  
  try {
    // 1. 创建客户端
    const cookieStore = await cookies();
    
    // 普通客户端（用于用户操作）
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

    // 管理员客户端（用于密钥操作，绕过RLS）
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 2. 验证用户登录状态
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '用户未登录' }, { status: 401 });
    }

    const userId = user.id;
    console.log('[Renew API] 用户已验证:', userId);

    // 3. 解析请求体
    const { keyCode } = await request.json();
    if (!keyCode) {
      return NextResponse.json({ error: '请输入续费密钥' }, { status: 400 });
    }
    const formattedKeyCode = keyCode.trim().toUpperCase();

    console.log('[Renew API] 处理密钥:', formattedKeyCode);

    // 4. 验证续费密钥（使用管理员客户端，确保能看到所有密钥）
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('access_keys')
      .select('*')
      .eq('key_code', formattedKeyCode)
      .single();

    if (keyError || !keyData) {
      console.error('[Renew API] 密钥未找到:', keyError);
      return NextResponse.json({ error: '续费密钥不存在' }, { status: 400 });
    }

    // 5. 检查密钥状态
    const now = new Date();
    
    // 检查是否激活
    if (keyData.is_active === false) {
      return NextResponse.json({ error: '续费密钥已被禁用' }, { status: 400 });
    }
    
    // 检查是否过期（如果设置了过期时间）
    if (keyData.key_expires_at && new Date(keyData.key_expires_at) < now) {
      return NextResponse.json({ error: '续费密钥已过期' }, { status: 400 });
    }
    
    // 检查使用次数限制（如果设置了最大使用次数）
    if (keyData.max_uses > 0 && keyData.used_count >= keyData.max_uses) {
      return NextResponse.json({ error: '该续费密钥使用次数已达上限' }, { status: 400 });
    }

    console.log('[Renew API] 密钥验证通过:', {
      keyId: keyData.id,
      usedCount: keyData.used_count,
      maxUses: keyData.max_uses,
      expiresAt: keyData.key_expires_at
    });

    // 6. 获取用户当前有效期
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('account_expires_at')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[Renew API] 获取用户信息失败:', profileError);
      return NextResponse.json({ error: '无法获取用户信息' }, { status: 500 });
    }

    // 7. 🔥 关键修复：从用户当前有效期开始计算（而不是从现在开始）
    let newExpiryDate: Date;
    
    // 基准时间：用户当前有效期（如果未过期），否则从现在开始
    const currentExpiry = profile?.account_expires_at ? new Date(profile.account_expires_at) : now;
    const baseDate = currentExpiry > now ? currentExpiry : now;

    // 根据密钥类型计算新的有效期
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

    // 8. 🔥 关键修复：更新密钥状态 - 事务开始
    console.log('[Renew API] 开始更新密钥状态...');
    
    // 8.1 更新密钥使用次数和最后使用者
    const { error: updateKeyError } = await supabaseAdmin
      .from('access_keys')
      .update({
        used_count: (keyData.used_count || 0) + 1,
        user_id: userId,          // 记录最后使用者
        used_at: now.toISOString(), // 记录最后使用时间
        updated_at: now.toISOString()
      })
      .eq('id', keyData.id);

    if (updateKeyError) {
      console.error('[Renew API] 更新密钥失败:', updateKeyError);
      return NextResponse.json({ 
        error: '续费失败，无法更新密钥状态' 
      }, { status: 500 });
    }

    // 8.2 记录密钥使用历史
    const { error: historyError } = await supabaseAdmin
      .from('key_usage_history')
      .insert({
        access_key_id: keyData.id,
        user_id: userId,
        used_at: now.toISOString(),
        usage_type: 'renew',
        notes: `续费操作 - 原有效期至: ${profile?.account_expires_at || '无'}, 新有效期至: ${newExpiryDate.toISOString()}`
      });

    if (historyError) {
      console.warn('[Renew API] 记录密钥使用历史失败（不影响主流程）:', historyError);
    }

    // 9. 更新用户有效期（使用普通客户端，因为这是用户自己的数据）
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({
        account_expires_at: newExpiryDate.toISOString(),
        access_key_id: keyData.id,  // 记录当前使用的密钥
        updated_at: now.toISOString()
      })
      .eq('id', userId);

    if (updateProfileError) {
      console.error('[Renew API] 更新用户有效期失败:', updateProfileError);
      
      // 尝试回滚密钥更新（使用管理员客户端）
      await supabaseAdmin
        .from('access_keys')
        .update({
          used_count: keyData.used_count || 0,
          user_id: keyData.user_id,
          used_at: keyData.used_at,
          updated_at: keyData.updated_at
        })
        .eq('id', keyData.id);
      
      return NextResponse.json({ 
        error: '续费失败，更新用户信息时出错' 
      }, { status: 500 });
    }

    // 10. 返回成功响应
    console.log('[Renew API] 续费成功完成');
    
    return NextResponse.json({
      success: true,
      message: `续费成功！您的账户有效期已延长至 ${newExpiryDate.toLocaleDateString('zh-CN')}`,
      data: {
        expires_at: newExpiryDate.toISOString(),
        key_info: {
          id: keyData.id,
          key_code: keyData.key_code,
          used_count: (keyData.used_count || 0) + 1
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

// 可选：保留GET方法用于测试
export async function GET() {
  return NextResponse.json({
    success: true,
    message: '续费API已就绪，请使用POST方法提交续费密钥',
    environment: {
      node_env: process.env.NODE_ENV,
      has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      timestamp: new Date().toISOString()
    }
  });
}