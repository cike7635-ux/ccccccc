// /app/test-bare/page.tsx - 修复导入错误
import { getUserData } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function TestBarePage() {
  try {
    const { user } = await getUserData();
    
    return (
      <div className="p-10 text-white">
        <p>Test Bare Page - User: {user?.email}</p>
      </div>
    );
  } catch (error) {
    // 🔥 检查是否是 NEXT_REDIRECT 错误
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = (error as any).digest;
      if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
        // 🔥 如果是重定向错误，重新抛出让Next.js处理
        throw error;
      }
    }
    
    // 其他错误显示错误页面
    return (
      <div className="p-10 text-white">
        <p>Test Bare Page - Error</p>
        <p>错误: {error instanceof Error ? error.message : '未知错误'}</p>
      </div>
    );
  }
}