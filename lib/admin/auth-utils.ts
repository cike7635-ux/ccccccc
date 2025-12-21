// /lib/admin/auth-utils.ts 
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'];
  return adminEmails.some(adminEmail => 
    adminEmail.trim().toLowerCase() === email.toLowerCase()
  );
}

export function verifyAdminKey(inputKey: string): boolean {
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY;
  console.log('验证管理员密钥:', {
    输入: inputKey,
    环境变量: adminKey ? '***已设置***' : '未设置',
    匹配: inputKey === adminKey
  });
  
  if (!adminKey) {
    console.error('管理员密钥环境变量未设置');
    return false;
  }
  
  return inputKey === adminKey;
}
