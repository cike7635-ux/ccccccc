// /app/login/page.tsx - 修复版本
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { SignUpForm } from "@/components/sign-up-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// 辅助函数：检查是否是管理员邮箱
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
  // 获取用户信息
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // 解析搜索参数
  const params = await searchParams;
  const active = params?.tab === "signup" ? "signup" : "login";
  const redirectTo = params?.redirect || "/lobby";

  // 如果用户已登录，根据用户类型重定向
  if (user) {
    console.log(`[登录页] 用户已登录: ${user.email}, 跳转目标: ${redirectTo}`);
    
    // 检查是否是管理员
    if (isAdminEmail(user.email)) {
      console.log(`[登录页] 管理员 ${user.email} 已登录`);
      
      // 管理员访问登录页的情况：
      // 1. 如果是从/admin重定向过来的，重定向回/admin（避免循环）
      // 2. 如果是直接访问/login，重定向到/admin/dashboard
      // 3. 如果redirect参数是/admin开头的，重定向到/admin/dashboard
      
      if (redirectTo.startsWith('/admin')) {
        console.log(`[登录页] 管理员重定向到: ${redirectTo}`);
        redirect(redirectTo);
      } else {
        console.log(`[登录页] 管理员重定向到后台仪表板`);
        redirect("/admin/dashboard");
      }
    } else {
      // 普通用户重定向到游戏大厅或指定页面
      console.log(`[登录页] 普通用户重定向到: ${redirectTo}`);
      redirect(redirectTo);
    }
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

        {/* 管理员登录提示 */}
        {active === "login" && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 mb-2">
              管理员请访问{" "}
              <Link
                href="/admin"
                className="text-blue-500 hover:text-blue-700 font-medium"
              >
                后台管理登录页
              </Link>
            </p>
          </div>
        )}

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
