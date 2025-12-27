"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useRef } from "react";
import { Mail, Lock, Eye, EyeOff, Shuffle, Key, CheckCircle, AlertCircle } from "lucide-react";

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    e.stopPropagation();
    
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    // 验证密钥（必填）
    if (!licenseKey.trim()) {
      setError('请输入有效的产品密钥');
      setIsLoading(false);
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('请输入有效的邮箱地址');
      setIsLoading(false);
      return;
    }

    // 验证密码长度
    if (password.length < 6) {
      setError('密码长度至少6位');
      setIsLoading(false);
      return;
    }

    try {
      console.time('[SignUpForm] 注册总耗时');
      console.log('开始注册请求...', { email: email.trim(), isRandom });
      
      // 🔥 关键优化：并行处理注册和主题初始化
      const startTime = Date.now();
      
      const signUpResponse = await fetch('/api/auth/signup-with-key', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
          keyCode: licenseKey.trim().toUpperCase(),
        }),
      });

      console.log('注册API响应时间:', Date.now() - startTime, 'ms');
      console.log('注册响应状态:', signUpResponse.status);

      // 处理响应
      const contentType = signUpResponse.headers.get('content-type');
      let result;
      
      if (contentType && contentType.includes('application/json')) {
        result = await signUpResponse.json();
      } else {
        const errorText = await signUpResponse.text();
        console.error('非JSON响应:', errorText);
        throw new Error(`服务器返回格式错误 (${signUpResponse.status})`);
      }

      if (!signUpResponse.ok) {
        throw new Error(result.error || `注册失败 (${signUpResponse.status})`);
      }

      // 🔥 注册成功
      if (result.success) {
        console.log('注册成功:', result);
        
        // 立即显示成功消息
        setSuccessMessage('✅ 注册成功！');
        
        // 如果是随机账户，尝试自动登录
        if (isRandom) {
          try {
            console.log('随机账户尝试自动登录...');
            const supabase = createClient();
            
            // 尝试直接登录
            const { error: loginError, data: loginData } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password: password.trim(),
            });
            
            if (!loginError && loginData?.user) {
              console.log('随机账户自动登录成功');
              
              // 设置设备ID（与登录表单保持一致）
              const setDeviceIdToCookie = (deviceId: string) => {
                const cookieValue = `${encodeURIComponent(deviceId)}`;
                document.cookie = `love_ludo_device_id=${cookieValue}; path=/; max-age=31536000; SameSite=Lax`;
              };
              
              const getOrCreateDeviceId = () => {
                const key = 'love_ludo_device_id';
                let deviceId = localStorage.getItem(key);
                if (!deviceId) {
                  deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
                  localStorage.setItem(key, deviceId);
                }
                return deviceId;
              };
              
              const deviceId = getOrCreateDeviceId();
              setDeviceIdToCookie(deviceId);
              
              // 保存凭证到 localStorage（可选）
              try {
                localStorage.setItem(
                  "account_credentials",
                  JSON.stringify({ email: email.trim(), password: password.trim() })
                );
              } catch (storageError) {
                console.warn('localStorage保存失败:', storageError);
              }
              
              setSuccessMessage('✅ 注册成功！正在跳转到游戏大厅...');
              
              // 延迟跳转，让用户看到消息
              setTimeout(() => {
                window.location.href = "/lobby";
              }, 800);
              
              setIsLoading(false);
              return;
            }
          } catch (autoLoginError) {
            console.warn('随机账户自动登录失败，跳转到登录页:', autoLoginError);
          }
        }
        
        // 普通账户或自动登录失败，跳转到登录页
        setSuccessMessage('✅ 注册成功！正在跳转到登录页面...');
        
        // 🔥 异步处理主题初始化（不阻塞跳转）
        setTimeout(async () => {
          try {
            console.log('异步主题初始化...');
            const res = await fetch("/api/seed-default-tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            if (res.ok) {
              console.log('主题初始化成功');
            }
          } catch (err) {
            console.warn('主题初始化失败（可重试）:', err);
          }
        }, 3000);
        
        // 延迟跳转，让用户看到消息
        setTimeout(() => {
          window.location.href = result.redirect_to || `/login?email=${encodeURIComponent(email.trim())}&from=signup`;
        }, 800);
        
      } else {
        setError(result.error || '注册失败，请重试');
      }
      
      console.timeEnd('[SignUpForm] 注册总耗时');
      setIsLoading(false);
      
    } catch (error: unknown) {
      console.error('注册异常:', error);
      const errorMessage = error instanceof Error ? error.message : "注册过程中发生未知错误";
      setError(`❌ ${errorMessage}`);
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("", className)} {...props}>
      <form ref={formRef} onSubmit={handleSignUp} className="space-y-4">
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
              disabled={isLoading || !!successMessage}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 pl-1">
            本游戏为会员制，需购买密钥方可注册。请前往淘宝店铺《希夷书斋》购买，或联系微信客服: xiyi1397。
          </p>
        </div>

        <div>
          <Label htmlFor="email" className="block text-sm text-gray-300 mb-2">
            邮箱 <span className="text-red-500">*</span>
          </Label>
          <div className="glass rounded-xl p-3 flex items-center space-x-2">
            <Mail className="w-5 h-5 text-gray-400" />
            <Input
              id="email"
              type="email"
              placeholder="请输入邮箱（用于登录和找回密码）"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isLoading || !!successMessage}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="password" className="block text-sm text-gray-300 mb-2">
            密码 <span className="text-red-500">*</span> <span className="text-gray-500 text-xs">(至少6位)</span>
          </Label>
          <div className="glass rounded-xl p-3 flex items-center space-x-2">
            <Lock className="w-5 h-5 text-gray-400" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="请输入密码（至少6位字符）"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isLoading || !!successMessage}
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              disabled={isLoading || !!successMessage}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <Button
          type="button"
          onClick={generateRandomAccount}
          className="w-full glass py-3 rounded-xl font-medium hover:bg-white/10 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          disabled={isLoading || !!successMessage}
        >
          <Shuffle className="w-4 h-4" />
          <span>生成随机邮箱和密码</span>
        </Button>

        {/* 错误消息 */}
        {error && !successMessage && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-center text-red-400">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* 成功消息 */}
        {successMessage && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center text-green-400">
              <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{successMessage}</span>
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading || !!successMessage}
          className="w-full gradient-primary py-3.5 rounded-xl font-semibold glow-pink transition-all hover:scale-105 active:scale-95 mt-6 text-white disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              注册中...
            </div>
          ) : successMessage ? (
            <div className="flex items-center justify-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              注册成功
            </div>
          ) : (
            "立即注册"
          )}
        </Button>
        
        <div className="text-center mt-4">
          <p className="text-sm text-gray-400">
            已有账号？{" "}
            <a 
              href="/login" 
              className="text-blue-400 hover:text-blue-300 underline"
              onClick={(e) => {
                if (isLoading) e.preventDefault();
              }}
            >
              直接登录
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}