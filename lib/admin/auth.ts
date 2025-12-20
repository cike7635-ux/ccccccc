// /lib/admin/auth.ts - 改进版本
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function validateAdminSession() {
  try {
    console.log('🔍 开始验证管理员会话...');
    
    const supabase = await createClient();
    console.log('✅ Supabase客户端创建成功');
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    console.log('📋 用户信息:', {
      用户邮箱: user?.email,
      用户ID: user?.id?.substring(0, 8) + '...',
      是否有错误: !!error,
      错误信息: error?.message
    });
    
    if (error || !user) {
      console.log('❌ 验证失败: 用户未登录或会话无效');
      console.log('详细错误:', error);
      return { isAdmin: false, user: null, error: '未登录' };
    }

    // 获取环境变量
    const adminEmailsRaw = process.env.ADMIN_EMAILS;
    console.log('📧 原始环境变量:', adminEmailsRaw);
    
    const adminEmails = adminEmailsRaw?.split(',') || [];
    console.log('📋 管理员邮箱列表:', adminEmails);
    console.log('👤 当前用户邮箱:', user.email);
    
    const isAdmin = adminEmails.includes(user.email || '');
    console.log('🔐 管理员验证结果:', isAdmin ? '✅ 通过' : '❌ 拒绝');
    
    if (!isAdmin) {
      console.log(`❌ 非管理员访问: ${user.email}`);
      return { isAdmin: false, user, error: '非管理员' };
    }
    
    console.log(`✅ 管理员验证成功: ${user.email}`);
    return { isAdmin: true, user, error: null };
    
  } catch (error: any) {
    console.error('🔥 验证过程中出错:', error);
    return { isAdmin: false, user: null, error: error.message };
  }
}

export async function requireAdmin() {
  const { isAdmin, user, error } = await validateAdminSession();
  
  console.log('📊 验证最终结果:', {
    是否管理员: isAdmin,
    用户邮箱: user?.email,
    错误类型: error
  });
  
  if (!isAdmin) {
    // 如果不是管理员，根据错误类型重定向
    if (error === '未登录') {
      console.log('➡️ 重定向到登录页');
      redirect('/login?redirect=/admin');
    } else {
      // 已登录但不是管理员
      console.log('➡️ 重定向到无权限页');
      redirect('/admin/unauthorized');
    }
  }
  
  console.log('🎯 管理员验证通过，继续渲染');
}
