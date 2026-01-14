// /components/admin/login-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminLoginFormProps {
  redirectParam: string;
}

export default function AdminLoginForm({ redirectParam }: AdminLoginFormProps) {
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
      console.log('正在验证管理员登录...');
      console.log('邮箱:', email);
      console.log('重定向参数:', redirectParam);
      
      // 1. 验证管理员密钥
      const validAdminKey = process.env.NEXT_PUBLIC_ADMIN_KEY;
      
      if (!validAdminKey) {
        console.error('管理员密钥环境变量未设置');
        setError('系统配置错误，请联系管理员');
        setLoading(false);
        return;
      }

      if (adminKey !== validAdminKey) {
        console.log('管理员密钥验证失败');
        setError('管理员密钥错误');
        setLoading(false);
        return;
      }

      console.log('✅ 管理员密钥验证通过');

      // 2. 检查邮箱是否是管理员邮箱
      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'];
      const emailLower = email.trim().toLowerCase();
      const isAdminEmail = adminEmails.some(email => email.trim().toLowerCase() === emailLower);
      
      if (!isAdminEmail) {
        console.log('非管理员邮箱:', email);
        setError('非管理员邮箱');
        setLoading(false);
        return;
      }

      console.log('✅ 管理员邮箱验证通过');

      // 3. 使用 Supabase 登录
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        console.error('Supabase 登录错误:', signInError);
        throw signInError;
      }

      console.log(`✅ 管理员登录成功: ${email}`);
      console.log(`重定向到: ${redirectParam}`);
      
      // 登录成功，重定向
      router.push(redirectParam);
      router.refresh();

    } catch (err: any) {
      console.error('管理员登录失败:', err);
      setError(err.message || '登录失败，请检查邮箱和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
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
          <span className="text-xs text-gray-500 ml-2">
            （必须输入正确的管理员密钥才能登录）
          </span>
        </label>
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="请输入管理员密钥"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
          disabled={loading}
        />
        <div className="mt-2 text-sm">
          <div className="flex items-center">
            <span className="text-gray-600 mr-2">密钥状态:</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              process.env.NEXT_PUBLIC_ADMIN_KEY 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {process.env.NEXT_PUBLIC_ADMIN_KEY ? '已配置' : '未配置'}
            </span>
          </div>
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
            登录中...
          </>
        ) : (
          '登录后台系统'
        )}
      </button>
    </form>
  );
}
