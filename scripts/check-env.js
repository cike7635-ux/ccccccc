// /scripts/check-env.js - 
console.log('🔍 检查环境变量配置:');
console.log('=====================');
console.log('ADMIN_EMAILS:', process.env.ADMIN_EMAILS);
console.log('NEXT_PUBLIC_ADMIN_KEY:', process.env.NEXT_PUBLIC_ADMIN_KEY ? '***已设置***' : '未设置');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '已设置' : '未设置');
console.log('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? '已设置' : '未设置');

const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY;
const requiredKey = 'Cike@7638';

if (adminKey === requiredKey) {
  console.log('✅ 管理员密钥配置正确');
} else if (adminKey) {
  console.log('❌ 管理员密钥不匹配');
  console.log('   期望:', requiredKey);
  console.log('   实际:', adminKey);
} else {
  console.log('❌ 管理员密钥未设置');
}
