// /app/login/page.tsx - 修复重定向逻辑
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { SignUpForm } from "@/components/sign-up-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// 检查是否是管理员
function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'];
  return adminEmails.some(adminEmail => 
    adminEmail.trim().toLowerCase() === email.toLowerCase()
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; redirect?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const params = await searchParams;
  const active = params?.tab === "signup" ? "signup" : "login";
  const redirectParam = params?.redirect || "";

  if (user) {
    console.log(`[登录页] 用户已登录: ${user.email}, redirect参数: "${redirectParam}"`);
    
    // 检查是否是管理员
    const admin = isAdminEmail(user.email);
    
    // ⭐⭐ 关键修复：新的重定向逻辑
    let targetPath = redirectParam || "/lobby"; // 默认去游戏大厅
    
    if (admin) {
      console.log(`[登录页] 管理员用户登录: ${user.email}`);
      
      // ⭐ 重要：管理员在游戏登录页登录，清除管理员验证标记
      // 这样管理员玩游戏时不会被强制重定向到后台
      // 注意：这是在服务器端，我们需要告诉客户端清除cookie
      // 我们将在客户端组件中处理这个
      
      // 管理员在游戏登录页登录，应该去游戏大厅
      // 除非有明确的redirect参数指向其他地方
      if (!redirectParam) {
        targetPath = "/lobby";
        console.log(`[登录页] 管理员玩游戏，重定向到: ${targetPath}`);
      }
    } else {
      console.log(`[登录页] 普通用户登录，重定向到: ${targetPath}`);
    }
    
    // 如果有redirect参数，优先使用
    if (redirectParam) {
      console.log(`[登录页] 使用redirect参数: ${redirectParam}`);
      targetPath = redirectParam;
    }
    
    console.log(`[登录页] 最终重定向到: ${targetPath}`);
    redirect(targetPath);
  }

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
            asChild
            variant="ghost"
            className={`flex-1 rounded-xl transition-all ${
              active === "login"
                ? "gradient-primary text-white hover:opacity-90"
                : "text-gray-400 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            <Link href="/login?tab=login">登录</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className={`flex-1 rounded-xl transition-all ${
              active === "signup"
                ? "gradient-primary text-white hover:opacity-90"
                : "text-gray-400 hover:text-gray-300 hover:bg-white/5"
            }`}
          >
            <Link href="/login?tab=signup">注册</Link>
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
