"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 获取重定向参数（来自中间件）
  const redirectTo = searchParams.get('redirectedFrom') || "/lobby";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);
    setLoginSuccess(false);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError) {
        // 提供更友好的错误提示
        if (authError.message.includes('Invalid login credentials')) {
          throw new Error('邮箱或密码错误，请重试');
        } else if (authError.message.includes('Email not confirmed')) {
          throw new Error('邮箱未验证，请检查您的收件箱');
        } else {
          throw new Error(`登录失败: ${authError.message}`);
        }
      }

      // 标记登录成功，显示成功反馈
      setLoginSuccess(true);
      
      // 关键改进：等待并确认用户状态后再跳转
      // 方法1：短暂延迟后跳转（简单有效）
      setTimeout(async () => {
        // 可选：再次确认用户状态
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('✅ 登录验证完成，跳转到:', redirectTo);
          router.push(redirectTo);
        } else {
          // 如果状态异常，显示错误
          setError('登录状态异常，请刷新页面重试');
          setLoginSuccess(false);
        }
      }, 800); // 800ms延迟，让用户看到成功提示

      // 方法2（备选）：立即跳转但添加加载状态
      // router.push(redirectTo);

    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "登录过程中发生未知错误");
      setIsLoading(false);
    }
    // 注意：这里不设置 setIsLoading(false)，因为成功后会跳转页面
  };

  return (
    <div className={cn("", className)} {...props}>
      <form onSubmit={handleLogin} className="space-y-4">
        {/* 成功状态提示 */}
        {loginSuccess && (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 backdrop-blur p-4">
            <div className="flex items-center space-x-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">登录成功！正在跳转...</span>
            </div>
            <p className="text-sm text-green-400/80 mt-1">
              即将进入{redirectTo === '/lobby' ? '游戏大厅' : '目标页面'}
            </p>
          </div>
        )}

        <div>
          <Label htmlFor="email" className="block text-sm text-gray-300 mb-2">
            邮箱
          </Label>
          <div className="glass rounded-xl p-3 flex items-center space-x-2">
            <Mail className="w-5 h-5 text-gray-400" />
            <Input
              id="email"
              type="email"
              placeholder="请输入邮箱"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || loginSuccess}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password" className="block text-sm text-gray-300 mb-2">
            密码
          </Label>
          <div className="glass rounded-xl p-3 flex items-center space-x-2">
            <Lock className="w-5 h-5 text-gray-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="请输入密码"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || loginSuccess}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading || loginSuccess}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading || loginSuccess}
              className="w-4 h-4 rounded border-gray-600 disabled:opacity-50"
            />
            <span className="text-gray-400">记住我</span>
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-brand-pink hover:text-brand-rose transition-colors disabled:opacity-50"
          >
            忘记密码？
          </Link>
        </div>

        {error && !loginSuccess && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading || loginSuccess}
          className="w-full gradient-primary py-3.5 rounded-xl font-semibold glow-pink transition-all hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 text-white"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              登录中...
            </span>
          ) : loginSuccess ? (
            <span className="flex items-center justify-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              登录成功
            </span>
          ) : (
            "登录"
          )}
        </Button>

        {/* 调试信息：显示跳转目标（开发环境） */}
        {process.env.NODE_ENV === 'development' && redirectTo !== '/lobby' && (
          <div className="text-xs text-gray-500 pt-2 border-t border-white/10">
            登录后将跳转至: {redirectTo}
          </div>
        )}
      </form>
    </div>
  );
}
