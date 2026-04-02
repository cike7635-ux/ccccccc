import { redirect } from 'next/navigation';
import { getUserData } from "@/lib/server/auth";
import GameClient from "./game-client";

export const dynamic = 'force-dynamic';

export default async function GamePage() {
  // 使用统一的用户数据层（包含设备检查和会员检查）
  try {
    await getUserData();
  } catch (error: any) {
    // 如果是 NEXT_REDIRECT 异常，让 Next.js 处理重定向
    if (error?.digest?.includes('NEXT_REDIRECT')) {
      throw error;
    }
    // 其他错误也重定向到登录页
    redirect('/login');
  }

  // 检查通过，渲染游戏客户端组件
  return <GameClient />;
}
