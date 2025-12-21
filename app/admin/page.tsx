// /app/admin/page.tsx - 强制密钥验证的版本
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('🔐 开始管理员登录验证...');
      
      // ⭐ 强制验证1：管理员密钥
      const requiredAdminKey = process.env.NEXT_PUBLIC_ADMIN_KEY;
      console.log('期望的管理员密钥:', requiredAdminKey);
      console.log('输入的管理员密钥:', adminKey);
      
      if (!requiredAdminKey) {
        throw new Error('系统配置错误：管理员密钥未设置');
      }
      
      if (adminKey !== requiredAdminKey) {
        throw new Error('管理员密钥错误');
      }
      
      console.log('✅ 管理员密钥验证通过');

      // ⭐ 强制验证2：管理员邮箱
      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'];
      const emailLower = email.trim().toLowerCase();
      const isAdmin = adminEmails.some(adminEmail => 
        adminEmail.trim().toLowerCase() === emailLower
      );
      
      if (!isAdmin) {
        throw new Error('非管理员邮箱');
      }
      
      console.log('✅ 管理员邮箱验证通过');

      // 登录 Supabase
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      console.log('✅ 管理员登录成功，跳转到仪表板');
      router.push('/admin/dashboard');
      router.refresh();

    } catch (err: any) {
      console.error('❌ 管理员登录失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">管理员登录</h1>
          <p className="text-gray-600 mt-2">需要管理员邮箱、密码和密钥</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                管理员邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="2200691917@qq.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                管理员密钥
                <span className="text-xs text-gray-500 ml-2">（必须输入正确的密钥）</span>
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder={`输入: ${process.env.NEXT_PUBLIC_ADMIN_KEY || 'Cike@7638'}`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
                disabled={loading}
              />
              <div className="mt-2 flex items-center">
                <span className="text-sm text-gray-600 mr-2">当前密钥:</span>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  process.env.NEXT_PUBLIC_ADMIN_KEY 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {process.env.NEXT_PUBLIC_ADMIN_KEY ? '已配置' : '未配置'}
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  验证中...
                </>
              ) : (
                '登录后台管理系统'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              普通用户请访问{' '}
              <a href="/login" className="text-blue-600 hover:text-blue-800">
                游戏登录页面
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
