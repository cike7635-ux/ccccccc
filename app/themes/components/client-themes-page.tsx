// /app/themes/components/client-themes-page.tsx - 客户端组件，处理交互和分页
'use client';

import { useState, useCallback, memo } from 'react';
import Link from "next/link";
import DeleteThemeButton from '@/app/components/themes/delete-theme-button';
import ThemeCard from './theme-card';

interface ClientThemesPageProps {
  user: any;
  profile: any;
  themes: any[];
}

export default function ClientThemesPage({ user, profile, themes }: ClientThemesPageProps) {
  const [displayedThemes, setDisplayedThemes] = useState<any[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  
  // 每页显示10个主题
  const PAGE_SIZE = 10;

  // 初始加载数据
  useState(() => {
    const initialThemes = themes.slice(0, PAGE_SIZE);
    setDisplayedThemes(initialThemes);
    setHasMore(initialThemes.length < themes.length);
  });

  // 处理主题删除
  const handleThemeDelete = useCallback((themeId: string) => {
    setDisplayedThemes(prev => prev.filter(t => t.id !== themeId));
  }, []);

  // 加载更多主题
  const loadMoreThemes = useCallback(() => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const startIndex = (nextPage - 1) * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const newThemes = themes.slice(startIndex, endIndex);

      setDisplayedThemes(prev => [...prev, ...newThemes]);
      setPage(nextPage);
      setHasMore(endIndex < themes.length);
    } catch (err) {
      console.error('加载更多主题失败:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [page, themes, hasMore, loadingMore]);

  if (!user) {
    return null;
  }

  return renderThemesPage(user, profile, displayedThemes, loadMoreThemes, loadingMore, hasMore, handleThemeDelete);
}

function renderThemesPage(user: any, profile: any, themes: any[], loadMoreThemes: () => void, loadingMore: boolean, hasMore: boolean, handleThemeDelete: (themeId: string) => void) {
  return (
    <>
      <div className="max-w-md mx-auto min-h-svh flex flex-col pb-24 px-4">
        {/* 头部区域 */}
        <div className="pt-8 pb-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">主题库</h1>
            <p className="text-sm text-gray-500">我的主题 · {themes?.length || 0}</p>
          </div>

          {/* 会员状态 */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-white/5 to-white/3 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-1">会员状态</p>
                  <p className="text-white font-medium">
                    {profile?.account_expires_at ? 
                      `有效期至 ${new Date(profile.account_expires_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}` : 
                      '体验会员中'}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-brand-pink to-brand-purple flex items-center justify-center">
                  <span className="text-xs font-bold text-white">VIP</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 创建按钮 */}
        <Link
          href="/themes/new"
          className="w-full mb-6 block group"
        >
          <div className="bg-gradient-to-r from-brand-pink to-brand-purple rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-bold text-lg mb-1">创建新主题</div>
                <div className="text-white/80 text-sm">开始设计你们的专属体验</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </div>
        </Link>

        {/* 主题列表 */}
        <div className="flex-1">
          {themes?.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-white font-medium mb-2">还没有创建主题</h3>
              <p className="text-gray-400 text-sm mb-6">创建第一个主题来开始你们的游戏</p>
              <Link
                href="/themes/new"
                className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
              >
                立即创建
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {themes?.map((t, index) => (
                <MemoizedThemeCard 
                  key={t.id} 
                  theme={t} 
                  index={index} 
                  onDelete={() => handleThemeDelete(t.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 加载更多按钮 */}
        {themes && themes.length > 0 && hasMore && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMoreThemes}
              disabled={loadingMore}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  加载中...
                </div>
              ) : (
                '加载更多'
              )}
            </button>
          </div>
        )}

        {/* 底部说明 */}
        {themes && themes.length > 0 && (
          <div className="mt-6">
            <div className="bg-white/5 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-brand-pink/20 to-brand-purple/20 mb-2">
                  <svg className="w-4 h-4 text-brand-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400">点击主题卡片查看详情 · 悬停显示操作按钮</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// 使用React.memo包装主题卡片组件
const MemoizedThemeCard = memo(ThemeCard, (prevProps, nextProps) => {
  return prevProps.theme.id === nextProps.theme.id &&
         prevProps.theme.title === nextProps.theme.title &&
         prevProps.theme.description === nextProps.theme.description &&
         prevProps.theme.task_count === nextProps.theme.task_count &&
         prevProps.index === nextProps.index &&
         prevProps.onDelete === nextProps.onDelete;
});