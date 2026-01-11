"use client";

import { useState, useEffect } from 'react';
import { 
  X, 
  Info, 
  AlertTriangle, 
  AlertCircle, 
  TrendingUp,
  Clock,
  Calendar,
  ExternalLink,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Announcement {
  id: number;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'maintenance' | 'update';
  priority: number;
  show_from: string;
  show_until?: string;
  updated_at: string; // 新增：更新时间戳
}

export default function AnnouncementModal() {
  console.log('🎯 1. AnnouncementModal组件开始加载');
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 初始化：获取公告和用户已读状态
  useEffect(() => {
    console.log('🎯 2. useEffect执行，开始检查公告');
    checkAndShowAnnouncements();
  }, []);

  const checkAndShowAnnouncements = async () => {
    try {
      console.log('🎯 3. 开始获取公告API');
      const response = await fetch('/api/announcements/current');
      console.log('🎯 4. API响应状态:', response.status);
      console.log('🎯 5. API响应URL:', response.url);
      
      if (!response.ok) {
        console.error('🎯 API请求失败:', response.statusText);
        return;
      }
      
      const result = await response.json();
      console.log('🎯 6. API返回完整结果:', result);
      console.log('🎯 7. success字段:', result.success);
      console.log('🎯 8. data字段类型:', typeof result.data);
      console.log('🎯 9. data字段长度:', result.data?.length);
      
      if (!result.success) {
        console.error('🎯 10. API返回success为false');
        return;
      }
      
      if (!result.data || !result.data.length) {
        console.log('🎯 11. 没有公告数据，返回空');
        return;
      }
      
      console.log('🎯 12. 有公告数据，显示弹窗');
      console.log('🎯 13. 原始公告数据:', result.data);
      
      // 获取当前用户的已读记录
      const readAnnouncements = getReadAnnouncements();
      console.log('🎯 14. 已读记录:', readAnnouncements);
      
      // 智能筛选：只显示用户未读的公告
      const unreadAnnouncements = result.data.filter((ann: Announcement) => {
        const readRecord = readAnnouncements[ann.id];
        if (!readRecord) {
          console.log(`🎯 公告 ${ann.id} 从未读过`);
          return true; // 从未读过
        }
        
        // 检查公告是否有更新（比较更新时间）
        const announcementUpdated = new Date(ann.updated_at).getTime();
        const lastReadTime = readRecord.readAt;
        
        console.log(`🎯 公告 ${ann.id} 比较时间:`, {
          announcementUpdated,
          lastReadTime,
          isUpdated: announcementUpdated > lastReadTime
        });
        
        // 如果公告更新了，重新显示
        return announcementUpdated > lastReadTime;
      });
      
      console.log('🎯 15. 未读公告:', unreadAnnouncements);
      console.log('🎯 16. 未读公告数量:', unreadAnnouncements.length);

      if (unreadAnnouncements.length > 0) {
        setAnnouncements(unreadAnnouncements);
        setShowModal(true);
        console.log('🎯 17. showModal设置为:', true);
      } else {
        console.log('🎯 没有未读公告');
      }
    } catch (error) {
      console.error('🎯 检查公告失败:', error);
    } finally {
      setLoading(false);
      console.log('🎯 18. loading设置为:', false);
    }
  };

  // 获取用户已读的公告记录
  const getReadAnnouncements = (): Record<number, { readAt: number }> => {
    if (typeof window === 'undefined') {
      console.log('🎯 19. 服务器端，返回空已读记录');
      return {};
    }
    
    try {
      const read = localStorage.getItem('readAnnouncements');
      console.log('🎯 20. 从localStorage读取:', read);
      return read ? JSON.parse(read) : {};
    } catch (error) {
      console.error('🎯 读取localStorage失败:', error);
      return {};
    }
  };

  // 标记当前公告为已读
  const markAsRead = () => {
    if (announcements.length === 0) return;
    
    const currentAnnouncement = announcements[currentIndex];
    const readAnnouncements = getReadAnnouncements();
    
    // 记录阅读时间和公告更新时间
    readAnnouncements[currentAnnouncement.id] = {
      readAt: Date.now(),
      announcementUpdatedAt: new Date(currentAnnouncement.updated_at).getTime()
    };
    
    console.log('🎯 21. 标记公告为已读:', {
      announcementId: currentAnnouncement.id,
      readAt: Date.now()
    });
    
    localStorage.setItem('readAnnouncements', JSON.stringify(readAnnouncements));
  };

  // 关闭当前公告
  const closeCurrentAnnouncement = () => {
    console.log('🎯 22. 关闭当前公告，索引:', currentIndex);
    markAsRead();
    
    // 如果有下一个公告，显示下一个
    if (currentIndex < announcements.length - 1) {
      setCurrentIndex(currentIndex + 1);
      console.log('🎯 23. 切换到下一个公告，新索引:', currentIndex + 1);
    } else {
      // 没有更多公告，关闭弹窗
      setShowModal(false);
      setCurrentIndex(0);
      setAnnouncements([]);
      console.log('🎯 24. 关闭弹窗');
    }
  };

  // 关闭所有公告（不再显示）
  const closeAllAnnouncements = () => {
    console.log('🎯 25. 关闭所有公告');
    
    announcements.forEach(announcement => {
      const readAnnouncements = getReadAnnouncements();
      readAnnouncements[announcement.id] = {
        readAt: Date.now(),
        announcementUpdatedAt: new Date(announcement.updated_at).getTime()
      };
      localStorage.setItem('readAnnouncements', JSON.stringify(readAnnouncements));
    });
    
    setShowModal(false);
    setCurrentIndex(0);
    setAnnouncements([]);
  };

  // 获取公告类型配置
  const getAnnouncementConfig = (type: string) => {
    switch (type) {
      case 'warning':
        return {
          color: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/40',
          icon: AlertTriangle,
          iconColor: 'text-yellow-400',
          bgColor: 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10'
        };
      case 'maintenance':
        return {
          color: 'from-red-500/20 to-pink-500/20 border-red-500/40',
          icon: AlertCircle,
          iconColor: 'text-red-400',
          bgColor: 'bg-gradient-to-br from-red-500/10 to-pink-500/10'
        };
      case 'update':
        return {
          color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40',
          icon: TrendingUp,
          iconColor: 'text-blue-400',
          bgColor: 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10'
        };
      default: // info
        return {
          color: 'from-green-500/20 to-emerald-500/20 border-green-500/40',
          icon: Info,
          iconColor: 'text-green-400',
          bgColor: 'bg-gradient-to-br from-green-500/10 to-emerald-500/10'
        };
    }
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 导航到上一条公告
  const goToPrevAnnouncement = () => {
    if (currentIndex > 0) {
      console.log('🎯 导航到上一条公告');
      setCurrentIndex(currentIndex - 1);
    }
  };

  // 导航到下一条公告
  const goToNextAnnouncement = () => {
    if (currentIndex < announcements.length - 1) {
      console.log('🎯 导航到下一条公告');
      setCurrentIndex(currentIndex + 1);
    }
  };

  console.log('🎯 26. 渲染前状态:', {
    loading,
    showModal,
    announcementsLength: announcements.length,
    currentIndex,
    windowAvailable: typeof window !== 'undefined'
  });

  if (loading) {
    console.log('🎯 27. 正在加载，返回null');
    return null;
  }

  if (!showModal) {
    console.log('🎯 28. showModal为false，返回null');
    return null;
  }

  if (announcements.length === 0) {
    console.log('🎯 29. 没有公告数据，返回null');
    return null;
  }

  console.log('🎯 30. 准备渲染弹窗');

  const currentAnnouncement = announcements[currentIndex];
  const config = getAnnouncementConfig(currentAnnouncement.type);
  const Icon = config.icon;

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fade-in"
        onClick={closeCurrentAnnouncement}
      />
      
      {/* 弹窗主体 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
        <div 
          className={`relative max-w-2xl w-full max-h-[85vh] overflow-y-auto glass rounded-3xl border ${config.color} shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className={`sticky top-0 z-10 p-6 border-b ${config.color} backdrop-blur-lg rounded-t-3xl`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-2xl ${config.bgColor}`}>
                  <Icon className={`w-6 h-6 ${config.iconColor}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {currentAnnouncement.title}
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatTime(currentAnnouncement.show_from)}
                    </div>
                    {currentAnnouncement.show_until && (
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        至 {formatTime(currentAnnouncement.show_until)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={closeCurrentAnnouncement}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                aria-label="关闭"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* 内容区域 */}
          <div className="p-6">
            <div 
              className="prose prose-lg max-w-none text-gray-200"
              dangerouslySetInnerHTML={{ __html: currentAnnouncement.content }}
            />
          </div>

          {/* 底部操作栏 */}
          <div className="sticky bottom-0 p-6 border-t border-white/10 backdrop-blur-lg rounded-b-3xl">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
              {/* 多公告导航 */}
              {announcements.length > 1 && (
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={goToPrevAnnouncement}
                      disabled={currentIndex === 0}
                      className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="上一条"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center space-x-3">
                      <div className="text-sm text-gray-400">
                        公告 {currentIndex + 1} / {announcements.length}
                      </div>
                      <div className="flex space-x-1">
                        {announcements.map((_, index) => (
                          <div
                            key={index}
                            className={`w-2 h-2 rounded-full transition-all ${
                              index === currentIndex 
                                ? 'bg-white' 
                                : 'bg-white/30'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <button
                      onClick={goToNextAnnouncement}
                      disabled={currentIndex === announcements.length - 1}
                      className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="下一条"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* 操作按钮 */}
              <div className="flex space-x-3">
                <Button
                  onClick={closeAllAnnouncements}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <Check className="w-4 h-4 mr-2" />
                  不再显示所有公告
                </Button>
                
                {announcements.length > 1 ? (
                  <Button
                    onClick={closeCurrentAnnouncement}
                    className="bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                  >
                    下一个公告
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={closeCurrentAnnouncement}
                    className="bg-gradient-to-r from-pink-500 to-purple-600 text-white"
                  >
                    知道了
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}