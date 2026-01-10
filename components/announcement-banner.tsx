// /components/announcement-banner.tsx
"use client";

import { useState, useEffect } from 'react';
import { 
  X, 
  Info, 
  AlertTriangle, 
  AlertCircle, 
  TrendingUp,
  CheckCircle,
  Megaphone,
  Clock,
  Calendar
} from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'maintenance' | 'update';
  priority: number;
  show_from: string;
  show_until?: string;
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 从sessionStorage加载已关闭的公告ID
  useEffect(() => {
    const dismissed = sessionStorage.getItem('dismissedAnnouncements');
    if (dismissed) {
      setDismissedIds(JSON.parse(dismissed));
    }
  }, []);

  // 获取公告数据
  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcements/current');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          setAnnouncements(result.data);
        }
      }
    } catch (error) {
      console.error('获取公告失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 关闭当前公告
  const dismissCurrentAnnouncement = () => {
    if (announcements.length === 0) return;
    
    const currentId = announcements[currentIndex].id;
    const newDismissed = [...dismissedIds, currentId];
    setDismissedIds(newDismissed);
    sessionStorage.setItem('dismissedAnnouncements', JSON.stringify(newDismissed));
    
    // 如果有下一个公告，显示下一个
    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setAnnouncements([]);
    }
  };

  // 获取公告类型配置
  const getAnnouncementConfig = (type: string) => {
    switch (type) {
      case 'warning':
        return {
          color: 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/40',
          icon: AlertTriangle,
          iconColor: 'text-yellow-400',
          textColor: 'text-yellow-300'
        };
      case 'maintenance':
        return {
          color: 'bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-500/40',
          icon: AlertCircle,
          iconColor: 'text-red-400',
          textColor: 'text-red-300'
        };
      case 'update':
        return {
          color: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-blue-500/40',
          icon: TrendingUp,
          iconColor: 'text-blue-400',
          textColor: 'text-blue-300'
        };
      default: // info
        return {
          color: 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/40',
          icon: Info,
          iconColor: 'text-green-400',
          textColor: 'text-green-300'
        };
    }
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 过滤已关闭的公告
  const filteredAnnouncements = announcements.filter(
    announcement => !dismissedIds.includes(announcement.id)
  );

  if (loading) {
    return null; // 加载时不显示
  }

  if (filteredAnnouncements.length === 0) {
    return null; // 没有公告时不显示
  }

  const currentAnnouncement = filteredAnnouncements[currentIndex];
  const config = getAnnouncementConfig(currentAnnouncement.type);
  const Icon = config.icon;

  return (
    <div className={`relative mb-4 rounded-2xl border p-4 ${config.color} animate-fade-in`}>
      {/* 公告标题和类型 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className={`p-2 rounded-xl ${config.color.replace('bg-gradient-to-r', 'bg-current')} bg-opacity-20`}>
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <div>
            <div className={`font-semibold ${config.textColor}`}>
              {currentAnnouncement.title}
            </div>
            {filteredAnnouncements.length > 1 && (
              <div className="text-xs text-gray-400 mt-1">
                {currentIndex + 1} / {filteredAnnouncements.length}
              </div>
            )}
          </div>
        </div>
        
        <button
          onClick={dismissCurrentAnnouncement}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="关闭公告"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* 公告内容 */}
      <div 
        className="text-sm text-gray-200 mb-3 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: currentAnnouncement.content }}
      />

      {/* 时间信息和导航 */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <div className="flex items-center space-x-4 text-xs text-gray-400">
          <div className="flex items-center">
            <Clock className="w-3 h-3 mr-1" />
            {formatTime(currentAnnouncement.show_from)}
          </div>
          {currentAnnouncement.show_until && (
            <div className="flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              至 {formatTime(currentAnnouncement.show_until)}
            </div>
          )}
        </div>

        {/* 多公告导航 */}
        {filteredAnnouncements.length > 1 && (
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="p-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 rounded-lg"
              aria-label="上一个公告"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={() => setCurrentIndex(Math.min(filteredAnnouncements.length - 1, currentIndex + 1))}
              disabled={currentIndex === filteredAnnouncements.length - 1}
              className="p-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 rounded-lg"
              aria-label="下一个公告"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 公告指示点 */}
      {filteredAnnouncements.length > 1 && (
        <div className="flex justify-center space-x-1 mt-3">
          {filteredAnnouncements.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                index === currentIndex 
                  ? 'bg-white' 
                  : 'bg-white/30 hover:bg-white/50'
              }`}
              aria-label={`切换到第 ${index + 1} 个公告`}
            />
          ))}
        </div>
      )}
    </div>
  );
}