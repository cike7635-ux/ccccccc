// /app/api/auth/signup-with-key/route.ts - 修复版
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js'; // 新增：用于管理员操作
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  console.log('[API] 注册开始');
  try {
    const cookieStore = await cookies();
    
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
              console.error('[注册API] 设置cookie失败:', error);
            }
          },
        },
      }
    );

    // 创建管理员客户端（用于更新access_keys）
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // 使用服务角色密钥
      { auth: { persistSession: false } }
    );

    const { email, password, keyCode } = await request.json();
    const formattedKeyCode = keyCode?.trim().toUpperCase();
    
    if (!email || !password || !keyCode) {
      return NextResponse.json({ error: '邮箱、密码和密钥必填' }, { status: 400 });
    }

    // 使用管理员客户端查询密钥（确保有权限）
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('access_keys')
      .select('id, key_code, used_count, max_uses, key_expires_at, account_valid_for_days, original_duration_hours, duration_unit, is_active')
      .eq('key_code', formattedKeyCode)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      console.error('[API] 密钥查询失败:', keyError);
      return NextResponse.json({ error: '产品密钥无效' }, { status: 400 });
    }
    
    // 检查是否已达到最大使用次数
    if (keyData.max_uses > 0 && keyData.used_count >= keyData.max_uses) {
      return NextResponse.json({ error: '密钥使用次数已达上限' }, { status: 400 });
    }
    
    // 检查是否过期
    if (keyData.key_expires_at && new Date() > new Date(keyData.key_expires_at)) {
      return NextResponse.json({ error: '密钥已过期' }, { status: 400 });
    }

    // 创建用户
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
      },
    });
    
    if (authError || !authData.user) {
      console.error('[API] 创建用户失败:', authError);
      return NextResponse.json({ error: `注册失败: ${authError?.message}` }, { status: 400 });
    }

    const now = new Date();
    const userId = authData.user.id;

    // 🔥 🔥 🔥 关键修复：更新 access_keys 表 🔥 🔥 🔥
    console.log('[API] 开始更新密钥状态:', { keyId: keyData.id, userId });
    
    // 1. 更新密钥使用次数和当前用户
    const { error: updateKeyError } = await supabaseAdmin
      .from('access_keys')
      .update({
        used_count: (keyData.used_count || 0) + 1,
        user_id: userId,  // 设置为当前用户
        used_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', keyData.id);

    if (updateKeyError) {
      console.error('[API] 更新密钥失败:', updateKeyError);
      // 回滚：删除已创建的用户
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (deleteError) {
        console.error('[API] 回滚删除用户失败:', deleteError);
      }
      return NextResponse.json({ 
        error: '注册失败，无法更新密钥状态' 
      }, { status: 500 });
    }

    // 2. 记录密钥使用历史
    const { error: historyError } = await supabaseAdmin
      .from('key_usage_history')
      .insert({
        access_key_id: keyData.id,
        user_id: userId,
        used_at: now.toISOString(),
        usage_type: 'activate',
        notes: '用户注册激活'
      });

    if (historyError) {
      console.error('[API] 记录密钥使用历史失败:', historyError);
      // 这里可以选择回滚，但至少密钥状态已更新
      // 继续执行，因为主要功能已完成
    }

    // 计算有效期
    let accountExpiresAt: string;
    
    if (keyData.original_duration_hours && keyData.duration_unit === 'hours') {
      const hours = parseFloat(keyData.original_duration_hours.toString());
      const expiryDate = new Date(now.getTime() + hours * 60 * 60 * 1000);
      accountExpiresAt = expiryDate.toISOString();
    } else {
      const validDays = keyData.account_valid_for_days || 30;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + validDays);
      accountExpiresAt = expiryDate.toISOString();
    }

    // 生成初始会话标识
    const initialSessionId = `init_${userId}_${Date.now()}`;
    
    console.log('[API] 创建用户资料:', {
      userId,
      sessionId: initialSessionId
    });
    
    // 创建用户资料
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      email: email.trim(),
      access_key_id: keyData.id,
      account_expires_at: accountExpiresAt,
      last_login_at: now.toISOString(),
      last_login_session: initialSessionId,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      avatar_url: '',
      preferences: {},
    });
    
    if (profileError) {
      console.error('[API] 创建用户资料失败:', profileError);
      // 注意：这里密钥状态已更新，所以不能简单删除用户
      // 可以尝试回滚密钥更新，但复杂，所以记录错误并继续
      console.warn('[API] 用户资料创建失败，但密钥状态已更新');
    }

    console.log('[API] 注册成功:', { 
      userId, 
      email: email.trim(),
      keyId: keyData.id,
      usedCount: (keyData.used_count || 0) + 1,
      expiresAt: accountExpiresAt
    });

    return NextResponse.json({
      success: true,
      message: '注册成功！请检查邮箱确认注册，然后登录',
      user: { 
        id: userId, 
        email: authData.user.email 
      },
      expires_at: accountExpiresAt,
      note: '请前往登录页面使用注册的邮箱和密码登录'
    });

  } catch (error: any) {
    console.error('[API] 注册异常:', error);
    return NextResponse.json({ 
      error: '服务器内部错误，请稍后重试或联系客服' 
    }, { status: 500 });
  }
}