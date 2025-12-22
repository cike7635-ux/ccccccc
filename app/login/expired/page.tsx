// /app/login/expired/page.tsx
"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, AlertCircle, LogIn, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createBrowserClient } from '@supabase/ssr';

// 关键配置：将此页面标记为完全动态，跳过静态生成
export const dynamic = 'force-dynamic';

// 使用Suspense包装，以优雅地处理useSearchParams的客户端加载
function LoginExpiredContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const reason = searchParams.get('reason') || 'multi_device';
  const lastLoginTime = searchParams.get('last_login_time');

  useEffect(() => {
    // 自动清理会话Cookie
    const cleanupCookies = () => {
      document.cookie.split(';').forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        if (cookieName.includes('sb-') || cookieName === 'admin_key_verified') {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });
    };
    cleanupCookies();
  }, []);

  const handleClearAndLogin = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('清理会话失败:', error);
      router.push('/login');
    }
  };

  const getReasonMessage = () => {
    switch (reason) {
      case 'new_device_login':
        return {
          title: '检测到新设备登录',
          details: [
            '您的账号已在其他设备上重新登录。',
            '为确保账号安全，当前设备会话已自动失效。'
          ]
        };
      default:
        return {
          title: '登录会话已过期',
          details: [
            '您的登录会话因安全策略已自动失效。',
            '这通常发生在账号从其他设备登录后。'
          ]
        };
    }
  };

  const reasonInfo = getReasonMessage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950 p-4">
      <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700/50 w-full max-w-md overflow-hidden">
        {/* 红色警示头部 */}
        <div className="bg-gradient-to-r from-red-900/30 via-red-800/20 to-red-900/30 p-6 border-b border-red-800/30">
          <div className="flex items-center justify-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 rounded-full blur-md"></div>
              <div className="relative w-14 h-14 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center shadow-lg">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-white">
                {reasonInfo.title}
              </h1>
              <p className="text-gray-300 text-sm mt-1">
                会话安全异常
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 红色警示框 */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-medium mb-2">安全提示</p>
                <ul className="text-sm text-red-300/80 space-y-1.5">
                  {reasonInfo.details.map((detail, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>重新登录前，系统已自动为您清理本地会话。</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 账户信息 */}
          <div className="space-y-4">
            {email && (
              <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                <div className="flex items-center space-x-2 text-gray-300 mb-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm font-medium">受影响的账号</span>
                </div>
                <p className="text-white font-medium text-lg pl-4">{email}</p>
              </div>
            )}
            
            {lastLoginTime && (
              <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                <div className="flex items-center space-x-2 text-gray-300 mb-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium">新登录时间</span>
                </div>
                <p className="text-white font-medium pl-4">
                  {new Date(lastLoginTime).toLocaleString('zh-CN')}
                </p>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={handleClearAndLogin}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white py-3.5 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20 active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4 mr-2" />
              安全重新登录
            </Button>

            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full border-gray-600 hover:bg-white/5 hover:border-gray-500 text-gray-300 hover:text-white py-3.5 rounded-xl font-medium transition-all duration-200"
            >
              <Home className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </div>

          {/* 帮助信息 */}
          <div className="pt-6 border-t border-gray-700/50">
            <div className="text-center text-xs text-gray-500 space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-1.5 h-1.5 bg-red-500/50 rounded-full"></div>
                <p>如果此情况频繁发生，请检查账号安全性</p>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full"></div>
                <p>如需帮助请联系客服微信：xiyi1397</p>
              </div>
            </div>
          </div>
        </div>

        {/* 底部装饰 */}
        <div className="h-1 bg-gradient-to-r from-red-900/0 via-red-600/30 to-red-900/0"></div>
      </div>
    </div>
  );
}

// 默认导出包裹了Suspense的页面组件
export default function LoginExpiredPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-300 text-sm">正在检查您的会话状态...</p>
        </div>
      </div>
    }>
      <LoginExpiredContent />
    </Suspense>
  );
}
