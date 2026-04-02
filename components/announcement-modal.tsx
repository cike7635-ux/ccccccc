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
  updated_at: string;
}

// 自定义钩子：检测是否为手机端
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    // 初始检查
    checkMobile();
    
    // 添加resize监听
    window.addEventListener('resize', checkMobile);
    
    // 清理函数
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export default function AnnouncementModal() {
  const isMobile = useIsMobile();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 处理公告内容中的换行符
  const formatAnnouncementContent = (content: string) => {
    if (!content) return '';
    
    // 将换行符转换为HTML换行标签
    const contentWithLineBreaks = content
      .replace(/\r\n/g, '\n')  // 标准化换行符
      .replace(/\n/g, '<br />'); // 转换为HTML换行
    
    // 添加段落间距样式
    return `<div style="line-height: 1.6; white-space: pre-wrap;">${contentWithLineBreaks}</div>`;
  };

  // 初始化：获取公告和用户已读状态
  useEffect(() => {
    checkAndShowAnnouncements();
  }, []);

  // 格式化时间函数（根据屏幕宽度返回不同格式）
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    
    if (isMobile) {
      // 手机端：简洁格式（月/日 时:分）
      return date.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      // 桌面端：完整格式
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        // 如果是今天，只显示时间
        return `今天 ${date.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      } else {
        // 否则显示日期和时间
        return date.toLocaleDateString('zh-CN', {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    }
  };

  const checkAndShowAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcements/current');
      
      if (!response.ok) {
        return;
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data || !result.data.length) {
        return;
      }
      
      // 获取当前用户的已读记录
      const readAnnouncements = getReadAnnouncements();
      
      // 智能筛选：只显示用户未读的公告
      const unreadAnnouncements = result.data.filter((ann: Announcement) => {
        const readRecord = readAnnouncements[ann.id];
        if (!readRecord) {
          return true; // 从未读过
        }
        
        // 检查公告是否有更新（比较更新时间）
        const announcementUpdated = new Date(ann.updated_at).getTime();
        const lastReadTime = readRecord.readAt;
        
        // 如果公告更新了，重新显示
        return announcementUpdated > lastReadTime;
      });

      if (unreadAnnouncements.length > 0) {
        setAnnouncements(unreadAnnouncements);
        setShowModal(true);
      }
    } catch (error) {
      console.error('检查公告失败:', error);
    } finally {
      setLoading(false);
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
          bgColor: 'bg-gradient-to-br from-yellow-500/10 to-orange-500/10',
          label: '警告'
        };
      case 'maintenance':
        return {
          color: 'from-red-500/20 to-pink-500/20 border-red-500/40',
          icon: AlertCircle,
          iconColor: 'text-red-400',
          bgColor: 'bg-gradient-to-br from-red-500/10 to-pink-500/10',
          label: '维护'
        };
      case 'update':
        return {
          color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40',
          icon: TrendingUp,
          iconColor: 'text-blue-400',
          bgColor: 'bg-gradient-to-br from-blue-500/10 to-cyan-500/10',
          label: '更新'
        };
      default: // info
        return {
          color: 'from-green-500/20 to-emerald-500/20 border-green-500/40',
          icon: Info,
          iconColor: 'text-green-400',
          bgColor: 'bg-gradient-to-br from-green-500/10 to-emerald-500/10',
          label: '信息'
        };
    }
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

  if (loading) {
    return null;
  }

  if (!showModal) {
    return null;
  }

  if (announcements.length === 0) {
    return null;
  }

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
      
      {/* 弹窗主体 - 手机端优化 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in">
        <div 
          className={`relative w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto glass rounded-2xl sm:rounded-3xl border ${config.color} shadow-2xl`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 - 手机端优化 */}
          <div className={`sticky top-0 z-10 p-4 sm:p-6 border-b ${config.color} backdrop-blur-lg rounded-t-2xl sm:rounded-t-3xl`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start flex-1 min-w-0 pr-3">
                <div className={`p-2 sm:p-3 rounded-lg sm:rounded-2xl ${config.bgColor} flex-shrink-0`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${config.iconColor}`} />
                </div>
                
                <div className="ml-3 flex-1 min-w-0">
                  {/* 公告类型标签 */}
                  <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-1.5 sm:mb-2"
                       style={{
                         backgroundColor: config.iconColor.replace('text-', 'bg-') + '/20',
                         color: config.iconColor.replace('text-', '')
                       }}>
                    {config.label}
                  </div>
                  
                  {/* 标题 */}
                  <h2 className="text-base sm:text-xl font-bold text-white break-words line-clamp-2">
                    {currentAnnouncement.title}
                  </h2>
                  
                  {/* 🔥 手机端优化后的日期布局 */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center text-xs sm:text-sm text-gray-300">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 flex-shrink-0" />
                      <span className="truncate" title={`开始时间: ${new Date(currentAnnouncement.show_from).toLocaleString('zh-CN')}`}>
                        {isMobile ? '开始: ' : '开始时间: '}{formatTime(currentAnnouncement.show_from)}
                      </span>
                    </div>
                    
                    {currentAnnouncement.show_until && (
                      <div className="flex items-center text-xs sm:text-sm text-gray-300">
                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 flex-shrink-0" />
                        <span className="truncate" title={`结束时间: ${new Date(currentAnnouncement.show_until).toLocaleString('zh-CN')}`}>
                          {isMobile ? '结束: ' : '结束时间: '}{formatTime(currentAnnouncement.show_until)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={closeCurrentAnnouncement}
                className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                aria-label="关闭"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300" />
              </button>
            </div>
          </div>

          {/* 内容区域 - 手机端优化 */}
          <div className="p-4 sm:p-6">
            <div 
              className="prose prose-sm sm:prose-lg max-w-none text-gray-200 break-words"
              style={{
                fontSize: isMobile ? '14px' : '16px',
                lineHeight: isMobile ? '1.6' : '1.7'
              }}
              dangerouslySetInnerHTML={{ __html: formatAnnouncementContent(currentAnnouncement.content) }}
            />
          </div>

          {/* 底部操作栏 - 手机端优化 */}
          <div className="sticky bottom-0 p-4 sm:p-6 border-t border-white/10 backdrop-blur-lg rounded-b-2xl sm:rounded-b-3xl">
            <div className="flex flex-col space-y-4 sm:space-y-0">
              {/* 多公告导航 */}
              {announcements.length > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between">
                  <div className="flex items-center justify-center w-full sm:w-auto mb-3 sm:mb-0">
                    <button
                      onClick={goToPrevAnnouncement}
                      disabled={currentIndex === 0}
                      className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="上一条"
                    >
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    
                    <div className="mx-4 flex flex-col items-center">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1.5">
                          {announcements.map((_, index) => (
                            <div
                              key={index}
                              className={`w-2 h-2 rounded-full transition-all ${
                                index === currentIndex 
                                  ? 'bg-white' 
                                  : 'bg-white/40'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 mt-1">
                        {currentIndex + 1} / {announcements.length}
                      </span>
                    </div>
                    
                    <button
                      onClick={goToNextAnnouncement}
                      disabled={currentIndex === announcements.length - 1}
                      className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="下一条"
                    >
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                  
                  {isMobile && announcements.length > 1 && (
                    <div className="text-xs text-center text-gray-400 mb-2">
                      左右滑动切换公告
                    </div>
                  )}
                </div>
              )}
              
              {/* 操作按钮 - 手机端优化 */}
              <div className={`flex ${announcements.length > 1 ? 'flex-col sm:flex-row' : 'flex-row'} gap-3`}>
                {announcements.length > 1 && (
                  <Button
                    onClick={closeAllAnnouncements}
                    variant="outline"
                    size={isMobile ? "default" : "default"}
                    className={`border-white/20 text-white hover:bg-white/10 ${isMobile ? 'w-full py-2.5' : 'px-6'}`}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {isMobile ? '全部标记为已读' : '不再显示所有公告'}
                  </Button>
                )}
                
                <Button
                  onClick={closeCurrentAnnouncement}
                  size={isMobile ? "default" : "default"}
                  className={`bg-gradient-to-r from-pink-500 to-purple-600 text-white ${isMobile ? 'w-full py-2.5' : 'px-8'}`}
                >
                  {announcements.length > 1 ? (
                    <>
                      {isMobile ? '下一条' : '下一个公告'}
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    isMobile ? '知道了' : '我知道了'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}