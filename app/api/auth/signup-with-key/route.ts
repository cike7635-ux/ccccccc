import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    console.log('注册API被调用 - 开始处理注册请求');
    
    // 1. 解析请求数据
    let email = '';
    let password = '';
    let keyCode = '';
    
    try {
      const body = await request.json();
      email = body.email?.trim() || '';
      password = body.password?.trim() || '';
      keyCode = body.keyCode?.trim().toUpperCase() || '';
    } catch (parseError) {
      console.error('解析JSON失败:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: '请求格式错误',
        message: '请检查输入数据格式'
      }, { status: 400 });
    }
    
    // 2. 验证基本输入
    if (!email || !password || !keyCode) {
      return NextResponse.json({ 
        success: false, 
        error: '参数不全',
        message: '邮箱、密码和密钥均为必填项'
      }, { status: 400 });
    }
    
    // 3. 创建Supabase客户端（使用 Next.js 15 的正确方式）
    let supabase;
    try {
      // 注意：在 Next.js 15 中，cookies() 返回的是 Promise
      const cookieStore = await cookies();
      
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        {
          cookies: {
            // 使用异步方式获取所有 cookies
            getAll() {
              try {
                return cookieStore.getAll();
              } catch {
                return [];
              }
            },
            setAll(cookiesToSet) {
              // 静默处理，不抛出错误
              try {
                cookiesToSet.forEach(({ name, value, options }) => {
                  try {
                    cookieStore.set(name, value, options);
                  } catch {
                    // 忽略设置 cookie 的错误
                  }
                });
              } catch {
                // 忽略整体错误
              }
            },
          },
        }
      );
    } catch (clientError) {
      console.error('创建Supabase客户端失败:', clientError);
      return NextResponse.json({ 
        success: false, 
        error: '服务器配置错误',
        message: '系统配置异常，请联系管理员'
      }, { status: 500 });
    }
    
    // 4. 验证密钥有效性
    try {
      const { data: licenseKey, error: licenseError } = await supabase
        .from('license_keys')
        .select('id, key_code, is_used, expires_at')
        .eq('key_code', keyCode)
        .single();
      
      if (licenseError || !licenseKey) {
        return NextResponse.json({ 
          success: false, 
          error: '密钥无效',
          message: '请输入有效的产品密钥'
        }, { status: 400 });
      }
      
      // 检查密钥是否已使用
      if (licenseKey.is_used) {
        return NextResponse.json({ 
          success: false, 
          error: '密钥已使用',
          message: '该密钥已被使用，请使用新的密钥'
        }, { status: 400 });
      }
      
      // 检查密钥是否过期
      if (licenseKey.expires_at) {
        const expiryDate = new Date(licenseKey.expires_at);
        const now = new Date();
        if (expiryDate < now) {
          return NextResponse.json({ 
            success: false, 
            error: '密钥已过期',
            message: '该密钥已过期，请使用有效的密钥'
          }, { status: 400 });
        }
      }
    } catch (keyError) {
      console.error('验证密钥时出错:', keyError);
      return NextResponse.json({ 
        success: false, 
        error: '密钥验证失败',
        message: '验证密钥时发生错误，请稍后重试'
      }, { status: 500 });
    }
    
    // 5. 检查邮箱是否已注册
    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle(); // 使用 maybeSingle 避免未找到记录时报错
      
      if (existingUser) {
        return NextResponse.json({ 
          success: false, 
          error: '邮箱已注册',
          message: '该邮箱已被注册，请使用其他邮箱'
        }, { status: 400 });
      }
    } catch (emailCheckError) {
      console.error('检查邮箱时出错:', emailCheckError);
      // 这里不返回错误，继续流程，因为可能是网络问题
    }
    
    // 6. 创建用户（Supabase Auth）
    let userId = '';
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          // 禁用邮箱确认，直接验证邮箱
          emailConfirm: false,
          data: {
            email_confirmed_at: new Date().toISOString()
          }
        }
      });
      
      if (authError) {
        console.error('创建用户失败:', authError);
        return NextResponse.json({ 
          success: false, 
          error: '创建用户失败',
          message: `创建账户失败: ${authError.message}`
        }, { status: 500 });
      }
      
      if (authData.user) {
        userId = authData.user.id;
        console.log('用户创建成功，ID:', userId);
      } else {
        return NextResponse.json({ 
          success: false, 
          error: '用户创建失败',
          message: '无法创建用户账户'
        }, { status: 500 });
      }
    } catch (userCreateError) {
      console.error('创建用户时异常:', userCreateError);
      return NextResponse.json({ 
        success: false, 
        error: '用户创建异常',
        message: '创建用户时发生异常'
      }, { status: 500 });
    }
    
    // 7. 创建用户资料（profiles表）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30天有效期
    
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email.toLowerCase(),
          expires_at: expiresAt.toISOString(),
          license_key: keyCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      
      if (profileError) {
        console.error('创建用户资料失败:', profileError);
        
        // 尝试清理：删除已创建的Auth用户
        try {
          await supabase.auth.admin.deleteUser(userId);
        } catch (deleteError) {
          console.error('清理用户失败:', deleteError);
        }
        
        return NextResponse.json({ 
          success: false, 
          error: '创建资料失败',
          message: '创建用户资料失败，请重试'
        }, { status: 500 });
      }
    } catch (profileCreateError) {
      console.error('创建用户资料时异常:', profileCreateError);
      return NextResponse.json({ 
        success: false, 
        error: '资料创建异常',
        message: '创建用户资料时发生异常'
      }, { status: 500 });
    }
    
    // 8. 更新密钥状态
    try {
      const { error: updateKeyError } = await supabase
        .from('license_keys')
        .update({
          is_used: true,
          user_id: userId,
          used_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('key_code', keyCode);
      
      if (updateKeyError) {
        console.error('更新密钥状态失败:', updateKeyError);
        // 这里不返回错误，因为用户已创建成功
      }
    } catch (keyUpdateError) {
      console.error('更新密钥时异常:', keyUpdateError);
      // 继续流程，不影响用户注册成功
    }
    
    // 9. 返回成功响应
    console.log('注册流程完成，用户注册成功');
    
    return NextResponse.json({ 
      success: true, 
      message: '注册成功！您现在可以登录',
      user_id: userId,
      expires_at: expiresAt.toISOString(),
      license_key: keyCode,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: unknown) {
    console.error('注册API未知错误:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    return NextResponse.json({ 
      success: false, 
      error: '服务器内部错误',
      message: `服务器错误: ${errorMessage}`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: '注册API已就绪，请使用POST方法提交注册信息',
    timestamp: new Date().toISOString()
  });
}
