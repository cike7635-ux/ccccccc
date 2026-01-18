'use client';

import { memo } from 'react';
import Link from "next/link";
import DeleteThemeButton from '@/app/components/themes/delete-theme-button';

interface ThemeCardProps {
  theme: {
    id: string;
    title: string;
    description: string;
    task_count: number;
    created_at: string;
  };
  index: number;
}

function ThemeCard({ theme, index }: ThemeCardProps) {
  const colors = [
    'from-brand-pink to-brand-purple',
    'from-blue-500 to-purple-500',
    'from-green-500 to-teal-500',
    'from-orange-500 to-red-500',
    'from-purple-500 to-pink-500',
  ];
  
  const colorClass = colors[index % colors.length];

  return (
    <Link
      href={`/themes/${theme.id}`}
      className="block group relative"
    >
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
        <div className="flex items-start gap-3">
          {/* 序号装饰 */}
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${colorClass} flex items-center justify-center flex-shrink-0`}>
            <span className="text-white font-bold text-sm">{index + 1}</span>
          </div>
          
          {/* 主题内容 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium truncate mb-1 group-hover:text-brand-pink transition-colors">
              {theme.title}
            </h3>
            <p className="text-gray-400 text-sm line-clamp-2 mb-3">
              {theme.description || '暂无描述'}
            </p>
            
            {/* 操作按钮和任务数量 */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="flex gap-4">
                {/* 编辑按钮 */}
                <Link
                  href={`/themes/${theme.id}/edit`}
                  className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  编辑
                </Link>
                
                {/* 删除按钮 */}
                <DeleteThemeButton
                  themeId={theme.id}
                  themeTitle={theme.title}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
                />
              </div>
              
              {/* 任务数量 */}
              <div className="text-xs text-gray-500 bg-white/5 rounded-full px-2 py-1">
                {theme.task_count || 0} 个任务
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// 使用React.memo优化组件性能
export default memo(ThemeCard, (prevProps, nextProps) => {
  return prevProps.theme.id === nextProps.theme.id &&
         prevProps.theme.title === nextProps.theme.title &&
         prevProps.theme.description === nextProps.theme.description &&
         prevProps.theme.task_count === nextProps.theme.task_count &&
         prevProps.index === nextProps.index;
});