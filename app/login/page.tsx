'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { SignUpForm } from "@/components/sign-up-form";
import { Button } from "@/components/ui/button";
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

// 检查是否是管理员 - 兼容两种环境变量命名
function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  
  // 尝试读取 NEXT_PUBLIC_ADMIN_EMAILS，如果不存在则使用 ADMIN_EMAILS
  const adminEmails = 
    (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS)?.split(',') || 
    ['2200691917@qq.com'];
  
  return adminEmails.some(adminEmail => 
    adminEmail.trim().toLowerCase() === email.toLowerCase()
  );
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [active, setActive] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(true);
  
  const tabParam = searchParams.get('tab');
  const redirectParam = searchParams.get('redirect') || '/lobby';

  // 根据URL参数设置active tab
  useEffect(() => {
    if (tabParam === 'signup') {
      setActive('signup');
    }
  }, [tabParam]);

  // 检查用户是否已登录
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 创建Supabase客户端 - 兼容两种环境变量命名
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || 
          process.env.SUPABASE_URL || 
          '',
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
          process.env.SUPABASE_ANON_KEY || 
          ''
        );
        
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('[登录页] 检查认证失败:', error.message);
          return;
        }
        
        if (user) {
          console.log(`[登录页] 用户已登录: ${user.email}`);
          setUser(user);
          
          // 处理重定向逻辑
          handleRedirect(user);
        }
      } catch (error: any) {
        console.error('[登录页] 认证检查异常:', error.message);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [redirectParam, searchParams]);

  // 重定向处理函数
  const handleRedirect = (user: any) => {
    const admin = isAdminEmail(user.email);
    let targetPath = redirectParam;
    
    console.log(`[登录页] 用户: ${user.email}, redirect参数: "${redirectParam}"`);
    console.log(`[登录页] 是否是管理员: ${admin}`);
    
    if (admin) {
      console.log(`[登录页] 管理员用户登录: ${user.email}`);
      
      // 管理员在游戏登录页登录，应该去游戏大厅
      // 除非有明确的redirect参数指向其他地方
      if (!searchParams.get('redirect')) {
        targetPath = "/lobby";
        console.log(`[登录页] 管理员玩游戏，重定向到: ${targetPath}`);
      }
    } else {
      console.log(`[登录页] 普通用户登录，重定向到: ${targetPath}`);
    }
    
    // 如果有redirect参数，优先使用
    if (searchParams.get('redirect')) {
      console.log(`[登录页] 使用redirect参数: ${redirectParam}`);
      targetPath = redirectParam;
    }
    
    console.log(`[登录页] 最终重定向到: ${targetPath}`);
    
    // 使用硬重定向，确保页面刷新和状态同步
    setTimeout(() => {
      window.location.href = targetPath;
    }, 100);
  };

  // 加载状态
  if (loading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-pink mx-auto mb-4"></div>
          <p className="text-gray-400">检查登录状态...</p>
        </div>
      </div>
    );
  }

  // 用户已登录，显示重定向中状态
  if (user) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-pink mx-auto mb-4"></div>
          <p className="text-gray-400">登录成功，正在跳转...</p>
        </div>
      </div>
    );
  }

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
          {active === "login" ? <LoginForm /> : <SignUpForm />}
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
