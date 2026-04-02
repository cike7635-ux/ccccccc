'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Layers, ChevronDown, X, Sparkles } from 'lucide-react';
import { listAvailableThemes } from "../actions";
import { memo } from 'react';
import Portal from '@/app/components/ui/portal';

interface ThemeSelectProps {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  initialThemes?: any[];
  onThemeSelect?: (themeId: string, themeTitle: string) => void;
}

function ThemeOptions({ onSelect, onClose, initialThemes }: { onSelect: (id: string, title: string) => void, onClose: () => void, initialThemes?: any[] }) {
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);
  const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  useEffect(() => {
    // 防止重复执行
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchThemes = async () => {
      try {
        const now = Date.now();

        // 如果有初始主题数据，直接使用
        if (initialThemes && initialThemes.length > 0) {
          setThemes(initialThemes);
          setLoading(false);
          
          // 更新缓存
          localStorage.setItem('themes_cache', JSON.stringify(initialThemes));
          localStorage.setItem('themes_cache_timestamp', now.toString());
          
          // 后台静默检查更新（不阻塞UI）
          try {
            const { data } = await listAvailableThemes();
            if (data && data.length > 0) {
              const cachedData = localStorage.getItem('themes_cache');
              if (JSON.stringify(data) !== cachedData) {
                setThemes(data);
                localStorage.setItem('themes_cache', JSON.stringify(data));
                localStorage.setItem('themes_cache_timestamp', Date.now().toString());
              }
            }
          } catch (e) {
            // 静默处理后台更新错误
          }
          return;
        }

        // 检查本地缓存
        const cachedData = localStorage.getItem('themes_cache');
        const cacheTimestamp = localStorage.getItem('themes_cache_timestamp');

        // 如果缓存有效，先使用缓存数据
        if (cachedData && cacheTimestamp && (now - parseInt(cacheTimestamp)) < CACHE_TTL) {
          setThemes(JSON.parse(cachedData));
          setLoading(false);
          
          // 后台静默检查更新
          try {
            const { data } = await listAvailableThemes();
            if (data && data.length > 0 && JSON.stringify(data) !== cachedData) {
              setThemes(data);
              localStorage.setItem('themes_cache', JSON.stringify(data));
              localStorage.setItem('themes_cache_timestamp', Date.now().toString());
            }
          } catch (e) {
            // 静默处理后台更新错误
          }
          return;
        }

        // 缓存无效，重新获取
        const { data } = await listAvailableThemes();
        const themesData = data || [];
        setThemes(themesData);
        
        // 更新缓存
        localStorage.setItem('themes_cache', JSON.stringify(themesData));
        localStorage.setItem('themes_cache_timestamp', now.toString());
      } catch (error) {
        console.error('Failed to fetch themes:', error);
        setThemes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchThemes();
  }, [initialThemes]); // 只依赖 initialThemes，避免无限循环

  const handleThemeClick = (themeId: string, themeTitle: string) => {
    onSelect(themeId, themeTitle);
    onClose();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-pink mx-auto mb-4"></div>
        <div className="text-slate-400 text-sm font-medium tracking-wide">加载中...</div>
      </div>
    );
  }

  if (!themes || themes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-5">
        <div className="w-18 h-18 flex items-center justify-center rounded-2xl bg-slate-800/50 border border-slate-700/30">
          <Sparkles className="w-9 h-9 text-rose-400/70" />
        </div>
        <div className="text-center text-slate-500 text-sm tracking-wide">
          主题库加载中，请稍候...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
      {themes.map((theme) => (
        <div
          key={theme.id}
          onClick={() => handleThemeClick(theme.id, theme.title)}
          className="group relative flex items-center justify-between p-4 rounded-2xl bg-slate-800/30 border border-slate-700/20 hover:bg-slate-800/60 hover:border-rose-400/30 cursor-pointer transition-all duration-200"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 group-hover:from-rose-500/20 group-hover:to-slate-700/50 flex items-center justify-center border border-slate-600/30 group-hover:border-rose-400/20 transition-all duration-200">
              <Layers className="w-5 h-5 text-slate-400 group-hover:text-rose-400 transition-colors duration-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-200 group-hover:text-white transition-colors">
                  {theme.title}
                </span>
                {theme.is_official && (
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400/80 text-[10px] font-medium rounded-full border border-amber-500/20">
                    官方
                  </span>
                )}
              </div>
              <div className="flex items-center mt-1.5">
                <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                  {theme.task_count || 0} 个任务
                </span>
              </div>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-rose-400 group-hover:-rotate-45 transition-all duration-200" />
        </div>
      ))}
    </div>
  );
}

const MemoizedThemeOptions = memo(ThemeOptions);

function ThemeSelect({ id, name, label, required = false, initialThemes, onThemeSelect }: ThemeSelectProps) {
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [selectedThemeTitle, setSelectedThemeTitle] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const cacheKey = `theme_select_${name}`;

  useEffect(() => {
    const savedTheme = localStorage.getItem(cacheKey);
    const savedThemeTitle = localStorage.getItem(`${cacheKey}_title`);
    if (savedTheme && savedThemeTitle) {
      setSelectedTheme(savedTheme);
      setSelectedThemeTitle(savedThemeTitle);
    }
  }, [cacheKey]);

  const handleThemeSelect = useCallback((themeId: string, themeTitle: string) => {
    console.log(`🎯 选择主题: ${themeId}, ${themeTitle}`);
    setSelectedTheme(themeId);
    setSelectedThemeTitle(themeTitle);
    localStorage.setItem(cacheKey, themeId);
    localStorage.setItem(`${cacheKey}_title`, themeTitle);
    if (onThemeSelect) {
      onThemeSelect(themeId, themeTitle);
    }
  }, [cacheKey, onThemeSelect]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    document.body.style.overflow = '';
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  }, [closeModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, closeModal]);

  return (
    <div className="w-full">
      <label htmlFor={id} className="block text-sm text-slate-300 mb-2">
        {label}{required && <span className="text-rose-400 ml-1">*</span>}
      </label>

      <button
        type="button"
        onClick={openModal}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-800/40 border border-slate-700/30 hover:bg-slate-800/60 hover:border-slate-600/50 transition-all duration-200 group"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-slate-700/50 flex items-center justify-center border border-slate-600/30 group-hover:border-rose-400/30 transition-all">
            <Layers className="w-5 h-5 text-slate-300 group-hover:text-rose-400 transition-colors" />
          </div>
          <span className="text-sm text-slate-200 group-hover:text-white transition-colors">
            {selectedThemeTitle || '请选择主题'}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:rotate-180 transition-all duration-200" />
      </button>

      {isModalOpen && (
        <Portal>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4"
            onClick={handleBackdropClick}
          >
            <div className="relative w-full max-w-md rounded-3xl bg-slate-900/95 border border-slate-700/30 overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-b from-slate-800/20 via-transparent to-transparent pointer-events-none"></div>

              <div className="relative">
                <div className="flex items-center justify-between p-5 border-b border-slate-700/20">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500/20 to-slate-700/50 flex items-center justify-center border border-slate-600/30">
                      <Layers className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">选择主题</h3>
                      <p className="text-xs text-slate-500 mt-0.5">选择一个主题开始任务</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/30 hover:border-slate-600/50 transition-all duration-150"
                  >
                    <X className="w-4 h-4 text-slate-400 hover:text-white" />
                  </button>
                </div>

                <div className="p-4">
                  <MemoizedThemeOptions
                    onSelect={handleThemeSelect}
                    onClose={closeModal}
                    initialThemes={initialThemes}
                  />
                </div>

                <div className="flex justify-end p-4 border-t border-slate-700/20">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-5 py-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/30 hover:border-slate-600/50 text-slate-300 hover:text-white text-sm transition-all duration-150"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      <input
        type="hidden"
        id={id}
        name={name}
        value={selectedTheme}
        required={required}
      />
      <div className="text-xs text-gray-500 mt-1">
        已选择: {selectedTheme ? selectedThemeTitle : '无'}
      </div>
    </div>
  );
}

export default memo(ThemeSelect);
