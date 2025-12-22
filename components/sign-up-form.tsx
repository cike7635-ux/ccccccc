"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Shuffle, Key } from "lucide-react";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRandom, setIsRandom] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const router = useRouter();

  const generateRandomAccount = () => {
    const randomStr = Math.random().toString(36).substring(2, 11);
    const randomEmail = `user_${randomStr}@example.com`;
    const randomPass =
      Math.random().toString(36).substring(2, 14) +
      Math.random().toString(36).substring(2, 6).toUpperCase();
    setEmail(randomEmail);
    setPassword(randomPass);
    setIsRandom(true);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    // 验证密钥（必填）
    if (!licenseKey.trim()) {
      setError('请输入有效的产品密钥');
      setIsLoading(false);
      return;
    }

    try {
      const signUpResponse = await fetch('/api/auth/signup-with-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          keyCode: licenseKey.trim().toUpperCase(),
        }),
      });

      // ============ 核心修复：在解析JSON前先检查状态 ============
      if (!signUpResponse.ok) {
        const contentType = signUpResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await signUpResponse.json();
          throw new Error(errorData.error || `注册失败 (${signUpResponse.status})`);
        } else {
          const errorText = await signUpResponse.text();
          const cleanError = errorText.includes('404') 
            ? '注册接口未找到(404)，请联系管理员检查服务状态。' 
            : `服务器错误 (${signUpResponse.status}): ${errorText.substring(0, 100)}...`;
          throw new Error(cleanError);
        }
      }
      // ============ 核心修复结束 ============

      // 3. 只有状态码是200-299时，才安全地解析JSON
      const result = await signUpResponse.json();

      // ============ 新的自动登录处理逻辑 ============
      if (result.auto_login) {
        // API已自动登录成功
        setError('✅ 注册成功！正在自动登录...');
        setIsLoading(false);
        
        // 延迟后跳转到游戏大厅
        setTimeout(() => {
          window.location.href = '/lobby';
        }, 1200);
      } else {
        // API自动登录失败，前端尝试登录
        setError('✅ 注册成功！正在尝试登录...');
        
        try {
          // 使用Supabase客户端尝试登录
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password.trim(),
          });
          
          if (loginError) {
            throw loginError;
          }
          
          // 登录成功
          setError('✅ 登录成功！正在跳转到游戏大厅...');
          setIsLoading(false);
          
          // 延迟后跳转
          setTimeout(() => {
            window.location.href = '/lobby';
          }, 800);
          
        } catch (loginError: any) {
          // 前端登录也失败，跳转到登录页
          console.error('前端自动登录失败:', loginError);
          setError('✅ 注册成功！请点击这里手动登录');
          setIsLoading(false);
          
          // 创建可点击的登录链接
          const loginUrl = `/login?email=${encodeURIComponent(email.trim())}&redirect=/lobby`;
          
          // 延迟后跳转到登录页（预填邮箱）
          setTimeout(() => {
            window.location.href = loginUrl;
          }, 1500);
        }
      }
      // ============ 替换结束 ============
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "注册过程中发生未知错误");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("", className)} {...props}>
      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <Label htmlFor="licenseKey" className="block text-sm text-gray-300 mb-2">
            产品密钥 <span className="text-red-500">*</span>
          </Label>
          <div className="glass rounded-xl p-3 flex items-center space-x-2">
            <Key className="w-5 h-5 text-gray-400" />
            <Input
              id="licenseKey"
              type="text"
              placeholder="请输入您购买的产品密钥（如：XY-30-ABC123）"
              required
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 pl-1">
            本游戏为会员制，需购买密钥方可注册。请前往淘宝店铺《希夷书斋》购买，或联系微信客服: xiyi1397。
          </p>
        </div>

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
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <Button
          type="button"
          onClick={generateRandomAccount}
          className="w-full glass py-3 rounded-xl font-medium hover:bg-white/10 transition-all flex items-center justify-center space-x-2"
        >
          <Shuffle className="w-4 h-4" />
          <span>生成随机邮箱和密码</span>
        </Button>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full gradient-primary py-3.5 rounded-xl font-semibold glow-pink transition-all hover:scale-105 active:scale-95 mt-6 text-white"
        >
          {isLoading ? "注册中，需要等待几十秒，注册完成后可尝试刷新页面..." : "注册"}
        </Button>
      </form>
    </div>
  );
}
