import Link from "next/link";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { getUserData } from "@/lib/server/auth";

export default async function Home() {
  // 使用统一的用户数据层（包含设备检查和会员检查）
  try {
    await getUserData(true);
    // 如果没有重定向，说明检查通过，进入大厅
    redirect("/lobby");
  } catch (error: any) {
    // 如果是 NEXT_REDIRECT 异常，说明需要重定向到登录页，让 Next.js 处理
    if (error?.digest?.includes('NEXT_REDIRECT')) {
      throw error;
    }
  }

  // 未登录用户显示登录页面
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">

      {/* 背景装饰 - 更柔和 */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full blur-[100px] opacity-20 bg-gradient-to-br from-[#FF6B9D] to-[#8B5A8E]" />
      </div>

      <section className="w-full max-w-sm text-center space-y-8">
        {/* 徽章 - 简化样式 */}
        <div className="inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-medium bg-white/5 backdrop-blur-xl border border-white/10">
          Love Game
        </div>

        {/* 标题 - 更大留白 */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-white leading-tight">
            一起玩一盘
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FF6B9D] to-[#8B5A8E]">
              甜甜的飞行棋
            </span>
          </h1>
          <p className="text-base text-white/50 font-light">
            双主题任务 · 实时对战 · AI 生成
          </p>
        </div>

        {/* 按钮 - 更圆润 */}
        <div className="pt-4">
          <Button 
            asChild 
            size="lg" 
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#FF6B9D] to-[#8B5A8E] text-white text-base font-semibold shadow-lg shadow-pink-500/25 hover:shadow-xl hover:shadow-pink-500/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Link href="/login">快速开始</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
