// /app/login/page.tsx
// 优化版本 - 移除双重认证检查，依赖中间件验证
'use client';

import { Suspense } from 'react';
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { SignUpForm } from "@/components/sign-up-form";
import { Button } from "@/components/ui/button";

// 检查是否是管理员 - 兼容两种环境变量命名
function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  
  const adminEmails = 
    (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS)?.split(',') || 
    ['2200691917@qq.com'];
  
  return adminEmails.some(adminEmail => 
    adminEmail.trim().toLowerCase() === email.toLowerCase()
  );
}

// Suspense 的 fallback 组件
function LoginLoading() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-pink mx-auto mb-4"></div>
        <p className="text-gray-400">加载登录页面...</p>
      </div>
    </div>
  );
}

// 主页面组件 - 使用 Suspense 包裹
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}

// 内容组件 - 使用 useSearchParams
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [active, setActive] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false); // 🔥 改为false，因为中间件已经检查过
  
  const tabParam = searchParams.get('tab');
  const fromSignup = searchParams.get('from') === 'signup';
  const emailParam = searchParams.get('email');

  // 根据URL参数设置active tab
  useEffect(() => {
    if (tabParam === 'signup') {
      setActive('signup');
    }
  }, [tabParam]);

  // 🔥 关键修复：移除不必要的认证检查
  // 中间件已经验证过用户状态，如果用户已登录会直接重定向
  // 所以这里不需要再检查一次

  // 如果是注册跳转过来的，显示欢迎消息
  useEffect(() => {
    if (fromSignup && emailParam) {
      console.log(`[登录页] 注册用户跳转: ${emailParam}`);
      // 可以在这里显示一个短暂的欢迎消息
    }
  }, [fromSignup, emailParam]);

  // 用户未登录，显示登录/注册表单
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-brand-pink via-brand-rose to-brand-pink bg-clip-text text-transparent">
            情侣飞行棋
          </h1>
          <p className="text-gray-400">让爱更有趣</p>
        </div>

        <div className="glass rounded-2xl p-1 flex mb-8">
          <Button
            variant="ghost"
            onClick={() => setActive('login')}
            className={`flex-1 rounded-xl transition-all ${
              active === "login"
                ? "gradient-primary text-white hover:opacity-90"
                : "text-gray-400 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            登录
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActive('signup')}
            className={`flex-1 rounded-xl transition-all ${
              active === "signup"
                ? "gradient-primary text-white hover:opacity-90"
                : "text-gray-400 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            注册
          </Button>
        </div>

        <div className="space-y-4">
          {active === "login" ? (
            <Suspense fallback={
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-pink mx-auto mb-2"></div>
                <p className="text-gray-400 text-sm">加载登录表单...</p>
              </div>
            }>
              <LoginForm />
            </Suspense>
          ) : (
            <SignUpForm />
          )}
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          继续即表示同意{" "}
          <Link
            href="#"
            className="text-brand-pink hover:text-brand-rose transition-colors"
          >
            服务条款
          </Link>
          {" "}和{" "}
          <Link
            href="#"
            className="text-brand-pink hover:text-brand-rose transition-colors"
          >
            隐私政策
          </Link>
        </p>
      </div>
    </div>
  );
}