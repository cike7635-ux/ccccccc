// /lib/auth.ts - 完整的管理员认证工具
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 创建Supabase客户端（使用Service Role Key）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * 检查管理员认证状态
 * 1. 检查admin_key_verified cookie
 * 2. 验证用户邮箱是否在管理员列表中
 */
export async function checkAdminAuth(request: NextRequest) {
  try {
    console.log('🔐 开始管理员验证');
    
    // 1. 检查管理员cookie
    const adminCookie = request.cookies.get('admin_key_verified');
    console.log('🍪 管理员cookie:', adminCookie?.value);
    
    // 如果cookie存在且为true，直接通过（这是你的中间件设置的方式）
    if (adminCookie && adminCookie.value === 'true') {
      console.log('✅ 通过cookie验证');
      return null; // null表示验证通过
    }
    
    // 2. 如果没有cookie，尝试从Authorization头验证
    const authHeader = request.headers.get('authorization');
    console.log('📨 Authorization头存在:', !!authHeader);
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      console.log('🔑 Token长度:', token.length);
      
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError) {
        console.log('❌ Token验证失败:', authError.message);
      } else if (user) {
        // 3. 检查用户邮箱是否在管理员列表中
        const isAdmin = await isAdminEmail(user.email);
        if (isAdmin) {
          console.log(`✅ 通过邮箱验证: ${user.email}`);
          return null; // 验证通过
        } else {
          console.log(`❌ 非管理员邮箱: ${user.email}`);
        }
      }
    }
    
    // 4. 如果所有验证都失败
    console.log('❌ 管理员验证失败，返回401');
    return NextResponse.json(
      { error: '未授权访问管理员功能' },
      { status: 401 }
    );
    
  } catch (error) {
    console.error('🚨 管理员验证异常:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

/**
 * 检查邮箱是否在管理员列表中
 */
export async function isAdminEmail(email?: string | null): Promise<boolean> {
  if (!email) return false;
  
  try {
    // 从环境变量获取管理员邮箱列表
    const adminEmails = process.env.ADMIN_EMAILS || '';
    const adminEmailList = adminEmails
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0);
    
    console.log('📧 检查管理员邮箱:', {
      email: email.toLowerCase(),
      adminEmails: adminEmailList
    });
    
    return adminEmailList.includes(email.toLowerCase());
  } catch (error) {
    console.error('检查管理员邮箱失败:', error);
    return false;
  }
}

/**
 * 记录管理员操作日志（可选功能）
 */
export async function logAdminAction(
  adminId: string | undefined,
  action: string,
  description: string,
  metadata: any = {}
) {
  try {
    // 这里可以记录到专门的admin_logs表，这里先简单打印
    console.log('📋 管理员操作日志:', {
      adminId,
      action,
      description,
      metadata,
      timestamp: new Date().toISOString()
    });
    
    // 可选：保存到数据库
    // await supabaseAdmin
    //   .from('admin_logs')
    //   .insert({
    //     admin_id: adminId,
    //     action,
    //     description,
    //     metadata,
    //     created_at: new Date().toISOString()
    //   });
    
  } catch (error) {
    console.error('记录管理员操作失败:', error);
  }
}

/**
 * 验证Supabase用户是否为管理员
 */
export async function validateAdminUser(request: NextRequest): Promise<{
  user: any | null;
  error: NextResponse | null;
}> {
  try {
    // 1. 检查cookie
    const adminCookie = request.cookies.get('admin_key_verified');
    if (adminCookie && adminCookie.value === 'true') {
      // 如果通过cookie验证，不需要用户对象
      return { user: { id: 'cookie_verified' }, error: null };
    }
    
    // 2. 检查Authorization头
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return { user: null, error: null };
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return { user: null, error: null };
    }
    
    // 3. 验证邮箱是否为管理员
    const isAdmin = await isAdminEmail(user.email);
    if (!isAdmin) {
      return { 
        user: null, 
        error: NextResponse.json(
          { error: '您的邮箱不是管理员' },
          { status: 403 }
        )
      };
    }
    
    return { user, error: null };
    
  } catch (error) {
    console.error('验证管理员用户异常:', error);
    return { user: null, error: null };
  }
}