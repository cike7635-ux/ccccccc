// /app/themes/page.tsx - 服务器端组件
import { Suspense } from 'react';
import { getUserData } from '@/lib/server/auth';
import { listAllThemesForUser } from "./actions";
import ThemesSkeleton from './components/themes-skeleton';
import ClientThemesPage from './components/client-themes-page';

// 服务器端组件，利用服务端缓存
export default async function ThemesPage() {
  return (
    <Suspense fallback={<ThemesSkeleton />}>
      <ThemesContent />
    </Suspense>
  );
}

async function ThemesContent() {
  try {
    // 使用统一的缓存数据层
    const { user, profile, cacheHit } = await getUserData();
    
    console.log(`🎯 Themes页面加载 - 用户: ${user.email}, 缓存命中: ${cacheHit}`);
    
    // 获取主题列表（官方 + 用户）
    const { data: themes, error: themesError } = await listAllThemesForUser();
    
    if (themesError) {
      console.error('获取主题列表失败:', themesError);
      return renderEmptyState();
    }
    
    return (
      <ClientThemesPage user={user} profile={profile} themes={themes} />
    );
    
  } catch (error) {
    console.error('Themes页面加载失败:', error);
    
    // 检查是否是NEXT_REDIRECT错误，如果是则重新抛出
    if (error && typeof error === 'object' && 'digest' in error && 
        typeof error.digest === 'string' && error.digest.includes('NEXT_REDIRECT')) {
      throw error; // 重新抛出让Next.js处理重定向
    }
    
    return null;
  }
}

function renderEmptyState() {
  return (
    // 空状态UI
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-white font-medium mb-2">加载失败</h3>
        <p className="text-gray-400 text-sm mb-6">无法加载主题列表，请稍后重试</p>
        <a href="/themes" className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors">
          重新加载
        </a>
      </div>
    </div>
  );
}