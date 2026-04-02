'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Layers, ChevronDown, Sparkles, X } from 'lucide-react';
import { listAvailableThemes, setMyTheme } from "../actions";
import { memo } from 'react';
import Portal from '@/app/components/ui/portal';

interface ThemeOption {
  id: string;
  title: string;
  is_official?: boolean;
  task_count?: number;
}

interface ThemeSelectClientProps {
  roomId: string;
  currentThemeId: string | null;
  myRole: 'player1' | 'player2';
  currentThemeTitle?: string | null;
}

function ThemeOptionsList({ onSelect }: { onSelect: (theme: ThemeOption) => void }) {
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);
  const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchThemes = async () => {
      try {
        const now = Date.now();

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
            // 静默处理
          }
          return;
        }

        // 缓存无效，重新获取
        const { data } = await listAvailableThemes();
        const themesData = data || [];
        setThemes(themesData);
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
  }, []);

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
          onClick={() => onSelect(theme)}
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

export default function ThemeSelectClient({ roomId, currentThemeId, myRole, currentThemeTitle }: ThemeSelectClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (isModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isModalOpen, closeModal]);

  const handleThemeSelect = useCallback(async (theme: ThemeOption) => {
    setSelectedTheme(theme);
    closeModal();

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('room_id', roomId);
    formData.append('my_theme_id', theme.id);

    try {
      await setMyTheme(formData);
    } catch (e) {
      // redirect 会抛出异常，不需要处理
    } finally {
      setIsSubmitting(false);
    }
  }, [roomId, closeModal]);

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="text-lg font-semibold mb-4">我的主题选择</h3>

      <button
        onClick={openModal}
        disabled={isSubmitting}
        className="w-full glass rounded-xl p-3 flex items-center justify-between hover:bg-white/5 transition-all disabled:opacity-50"
      >
        <div className="flex items-center space-x-3">
          <Layers className="w-5 h-5 text-brand-pink" />
          <span className="text-white">
            {selectedTheme?.title || currentThemeTitle || '请选择主题'}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isModalOpen && (
        <Portal>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4"
            onClick={handleBackdropClick}
          >
            <div className="glass rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">选择主题</h3>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-lg glass flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ThemeOptionsList onSelect={handleThemeSelect} />
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}