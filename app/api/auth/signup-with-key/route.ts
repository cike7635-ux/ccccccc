// /app/api/auth/signup-with-key/route.ts - 完善版
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  console.log('[Signup API] 注册请求开始');
  
  try {
    const cookieStore = await cookies();
    
    // 1. 创建普通客户端
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
              console.error('[Signup API] 设置cookie失败:', error);
            }
          },
        },
      }
    );

    // 2. 创建管理员客户端（用于密钥操作）
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { email, password, keyCode } = await request.json();
    
    if (!email || !password || !keyCode) {
      return NextResponse.json({ error: '邮箱、密码和密钥必填' }, { status: 400 });
    }

    const formattedKeyCode = keyCode.trim().toUpperCase();
    
    // 3. 验证密钥（使用普通客户端）
    const { data: keyData, error: keyError } = await supabase
      .from('access_keys')
      .select(`
        id, key_code, is_active, used_count, max_uses, 
        key_expires_at, account_valid_for_days,
        original_duration_hours, duration_unit
      `)
      .eq('key_code', formattedKeyCode)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      console.error('[Signup API] 密钥查询失败:', keyError);
      return NextResponse.json({ error: '产品密钥无效或已被禁用' }, { status: 400 });
    }
    
    // 检查使用次数限制
    if (keyData.max_uses && keyData.max_uses > 0 && keyData.used_count >= keyData.max_uses) {
      return NextResponse.json({ error: '密钥使用次数已达上限' }, { status: 400 });
    }
    
    // 检查是否过期
    if (keyData.key_expires_at && new Date() > new Date(keyData.key_expires_at)) {
      return NextResponse.json({ error: '密钥已过期' }, { status: 400 });
    }

    const now = new Date();
    
    // 4. 检查邮箱是否已注册
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email.trim());
    
    if (userExists) {
      return NextResponse.json({ error: '该邮箱已注册' }, { status: 400 });
    }

    // 5. 创建Auth用户
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        emailRedirectTo: `${request.nextUrl.origin}/login`,
        data: {
          key_used: keyData.key_code,
          registered_at: now.toISOString()
        }
      },
    });
    
    if (authError || !authData.user) {
      console.error('[Signup API] 创建用户失败:', authError);
      return NextResponse.json({ 
        error: authError?.message.includes('already registered') 
          ? '该邮箱已注册' 
          : `注册失败: ${authError?.message || '未知错误'}` 
      }, { status: 400 });
    }

    const userId = authData.user.id;
    
    // 6. 计算有效期
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

    // 7. 🔥 修复偏好设置：创建正确的JSON对象
    const initialPreferences = {
      theme: 'light',
      language: 'zh-CN',
      notifications: true,
      privacy: {
        show_online_status: true,
        allow_friend_requests: true
      },
      created_at: now.toISOString()
    };

    // 🔥 修复：生成标准的会话ID格式（与登录流程一致）
    // 生成标准的设备ID格式
    const standardDeviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    // 生成标准的会话ID格式：sess_{userId}_{deviceId}_{tokenPart}
    const initialSessionId = `sess_${userId}_${standardDeviceId}_init`;
    
    // 🔥 新增：在注册时设置设备ID到cookie中（与登录流程一致）
    try {
      cookieStore.set('love_ludo_device_id', standardDeviceId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 365天
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
      });
      console.log(`🆔 注册流程设置设备ID到cookie: ${standardDeviceId}`);
    } catch (cookieError) {
      console.error('❌ 设置设备ID cookie失败:', cookieError);
      // 静默失败，不影响注册主流程
    }
    
    console.log('[Signup API] 创建用户资料:', {
      userId,
      sessionId: initialSessionId,
      deviceId: standardDeviceId,
      preferences: initialPreferences
    });
    
    // 8. 创建用户资料
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: email.trim(),
        access_key_id: keyData.id,
        account_expires_at: accountExpiresAt,
        last_login_at: now.toISOString(),
        last_login_session: initialSessionId,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        avatar_url: null,
        nickname: email.split('@')[0], // 默认昵称
        preferences: initialPreferences // 🔥 使用正确的JSON对象
      }, {
        onConflict: 'id',
        ignoreDuplicates: true
      });
    
    if (profileError) {
      console.error('[Signup API] 创建用户资料失败:', profileError);
      
      // 尝试清理：删除刚创建的Auth用户
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (deleteError) {
        console.error('[Signup API] 删除用户失败:', deleteError);
      }
      
      return NextResponse.json({ 
        error: '注册失败，用户资料创建错误' 
      }, { status: 500 });
    }

    // 9. 🔥 更新密钥状态（使用管理员客户端）
    const { error: updateKeyError } = await supabaseAdmin
      .from('access_keys')
      .update({
        used_count: keyData.used_count + 1,
        user_id: userId,
        used_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', keyData.id);

    if (updateKeyError) {
      console.error('[Signup API] 更新密钥失败:', updateKeyError);
      // 不返回错误，因为用户注册已成功
    }

    // 10. 记录密钥使用历史
    const { error: historyError } = await supabaseAdmin
      .from('key_usage_history')
      .insert({
        access_key_id: keyData.id,
        user_id: userId,
        used_at: now.toISOString(),
        usage_type: 'activate',
        notes: `新用户注册 - 邮箱: ${email.trim()}`
      });

    if (historyError) {
      console.error('[Signup API] 记录使用历史失败:', historyError);
    }

    // 11. 验证计次
    const { data: updatedKey } = await supabaseAdmin
      .from('access_keys')
      .select('used_count')
      .eq('id', keyData.id)
      .single();

    if (updatedKey && updatedKey.used_count - keyData.used_count === 2) {
      console.warn('[Signup API] 警告：注册一次计次增加了2次，修复中...');
      // 修复计次
      await supabaseAdmin
        .from('access_keys')
        .update({ used_count: keyData.used_count + 1 })
        .eq('id', keyData.id);
    }

    console.log('[Signup API] 注册成功:', { 
      userId, 
      email: email.trim(),
      expiresAt: accountExpiresAt,
      keyUsed: keyData.key_code
    });

    // 🔥 新增：为新用户自动初始化默认主题（必须在return之前！）
    try {
      console.log(`🎯 开始为新用户 ${userId} 初始化默认主题`);
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.join(process.cwd(), "lib", "tasks.json");
      const content = await fs.readFile(filePath, "utf-8");
      const templates: { title: string; description?: string; tasks: string[] }[] = JSON.parse(content);

      let initializedThemeCount = 0;
      
      for (const tpl of templates) {
        // 检查是否已存在同名主题
        const { data: existing } = await supabaseAdmin
          .from("themes")
          .select("id")
          .eq("creator_id", userId)
          .eq("title", tpl.title)
          .maybeSingle();
        
        let themeId: string | null = existing?.id ?? null;
        
        if (!themeId) {
          console.log(`📝 创建主题: ${tpl.title}`);
          const { data: created } = await supabaseAdmin
            .from("themes")
            .insert({
              title: tpl.title,
              description: tpl.description ?? null,
              creator_id: userId,
              is_public: false,
              task_count: (tpl.tasks?.length ?? 0),
            })
            .select("id")
            .single();
          themeId = created?.id ?? null;
        }
        
        if (themeId && tpl.tasks?.length > 0) {
          // 批量插入任务
          const tasksToInsert = tpl.tasks.map((desc, index) => ({
            theme_id: themeId,
            description: desc,
            type: "default",
            order_index: index,
            is_ai_generated: false,
          }));
          
          console.log(`📦 批量插入 ${tasksToInsert.length} 个任务到主题: ${tpl.title}`);
          const { error: insertError } = await supabaseAdmin
            .from("tasks")
            .insert(tasksToInsert);
          
          if (insertError) {
            console.error(`❌ 插入任务失败: ${insertError.message}`);
          } else {
            initializedThemeCount++;
          }
        }
      }
      
      console.log(`✅ 新用户主题初始化完成: ${initializedThemeCount} 个主题`);
    } catch (themeError) {
      console.error('❌ 主题初始化失败:', themeError);
      // 静默失败，不影响注册主流程
    }

    // 🔥 返回成功响应（必须在所有操作完成后）
    return NextResponse.json({
      success: true,
      message: '注册成功！请检查邮箱确认注册（如需要），然后登录',
      data: {
        user: { 
          id: userId, 
          email: email.trim() 
        },
        expires_at: accountExpiresAt,
        key_info: {
          id: keyData.id,
          key_code: keyData.key_code,
          used_count: keyData.used_count + 1
        },
        note: '请前往登录页面使用注册的邮箱和密码登录'
      }
    });

  } catch (error: any) {
    console.error('[Signup API] 注册异常:', error);
    return NextResponse.json({ 
      success: false,
      error: '服务器内部错误，请稍后重试或联系客服',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

// 添加GET方法用于测试
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: '注册API已就绪',
    method: 'POST',
    required_fields: ['email', 'password', 'keyCode'],
    example: {
      email: 'user@example.com',
      password: 'your_password',
      keyCode: 'YOUR_KEY_CODE'
    }
  });
}