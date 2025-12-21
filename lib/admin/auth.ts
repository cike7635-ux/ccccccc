// /lib/admin/auth.ts
import { createClient } from '@/lib/supabase/server';

export async function validateAdminSession() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return { isAdmin: false, user: null };
    }

    // 检查是否是管理员邮箱
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'];
    const isAdmin = adminEmails.some(email => 
      email.trim().toLowerCase() === user.email?.toLowerCase()
    );
    
    if (!isAdmin) {
      return { isAdmin: false, user };
    }
    
    return { isAdmin: true, user };
    
  } catch (error) {
    return { isAdmin: false, user: null };
  }
}
