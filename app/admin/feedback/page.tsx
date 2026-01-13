// /app/admin/feedback/page.tsx - 完全优化版本
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Filter,
  Search,
  Clock,
  CheckCircle,
  Eye,
  EyeOff,
  Star,
  StarOff,
  Reply,
  Trash2,
  RefreshCw,
  Users,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Mail,
  Calendar,
  Tag,
  ExternalLink,
  MoreVertical
} from 'lucide-react';
import { toast } from 'sonner';

// ==================== 类型定义 ====================
interface Feedback {
  id: number;
  title: string;
  content: string;
  category: string;
  rating: number | null;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  is_public: boolean;
  is_featured: boolean;
  created_at: string;
  user_id: string;
  user_email: string;
  user_nickname: string | null;
}

interface FeedbackStats {
  byStatus: {
    pending: number;
    replied: number;
    resolved: number;
    archived: number;
  };
  total: number;
}

// ==================== 工具函数 ====================
const formatDate = (dateString: string | null): string => {
  if (!dateString) return '刚刚';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '日期无效';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '日期错误';
  }
};

const formatLongDate = (dateString: string | null): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
};

// 提取邮箱用户名部分（@之前）
const extractUsername = (email: string): string => {
  if (!email) return '用户';
  const parts = email.split('@');
  return parts[0] || '用户';
};

// 安全截断文本
const truncateText = (text: string, maxLength: number = 80): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// ==================== 简单UI组件（优化版） ====================
const SimpleCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-gray-900/50 border border-gray-800 rounded-xl shadow-xl backdrop-blur-sm ${className}`}>
    {children}
  </div>
);

const SimpleCardHeader = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-6 border-b border-gray-800/50 ${className}`}>
    {children}
  </div>
);

const SimpleCardContent = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`p-6 ${className}`}>
    {children}
  </div>
);

const SimpleButton = ({ 
  children, 
  onClick, 
  disabled = false,
  variant = 'default',
  size = 'md',
  className = '',
  type = 'button'
}: { 
  children: React.ReactNode; 
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'destructive' | 'success' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}) => {
  const baseStyles = "font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 rounded-lg";
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base"
  };
  
  const variantStyles = {
    default: "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-900/30",
    secondary: "bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700",
    outline: "border border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-300 hover:text-white",
    destructive: "bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-900/30",
    success: "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-900/30"
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const SimpleBadge = ({ 
  children, 
  variant = 'default',
  className = ''
}: { 
  children: React.ReactNode; 
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  className?: string;
}) => {
  const variantStyles = {
    default: "bg-gray-800 text-gray-300 border border-gray-700",
    success: "bg-green-900/30 text-green-300 border border-green-800/50",
    warning: "bg-yellow-900/30 text-yellow-300 border border-yellow-800/50",
    error: "bg-red-900/30 text-red-300 border border-red-800/50",
    info: "bg-blue-900/30 text-blue-300 border border-blue-800/50",
    purple: "bg-purple-900/30 text-purple-300 border border-purple-800/50"
  };
  
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
};

const SimpleInput = ({ 
  value, 
  onChange, 
  placeholder,
  className = ''
}: { 
  value: string; 
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500 text-gray-100 ${className}`}
  />
);

const SimpleTextarea = ({ 
  value, 
  onChange, 
  placeholder,
  rows = 4,
  className = ''
}: { 
  value: string; 
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className={`w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-500 text-gray-100 resize-none ${className}`}
  />
);

const SimpleSelect = ({ 
  value, 
  onChange, 
  children,
  className = ''
}: { 
  value: string; 
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-100 appearance-none ${className}`}
  >
    {children}
  </select>
);

// ==================== 主组件 ====================
export default function AdminFeedbackPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(true);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({
    byStatus: { pending: 0, replied: 0, resolved: 0, archived: 0 },
    total: 0
  });
  
  // 🔥 修复：状态和排序栏使用明显的颜色
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  
  const [pagination, setPagination] = useState({
    limit: 10,
    offset: 0,
    total: 0,
    hasMore: false
  });
  
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 添加调试日志
  const addDebugLog = (message: string) => {
    console.log(`🔍 ${message}`);
    setDebugLogs(prev => [...prev.slice(-10), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // 加载反馈数据
  useEffect(() => {
    loadFeedbacks();
  }, [filters, pagination.offset]);

  const loadFeedbacks = async () => {
    setIsLoading(true);
    try {
      addDebugLog('开始加载反馈列表...');
      
      const queryParams = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      });

      // 🔥 修复：只有在不是"all"时才添加筛选参数
      if (filters.status && filters.status !== 'all') {
        queryParams.append('status', filters.status);
      }

      if (filters.search && filters.search.trim()) {
        queryParams.append('search', filters.search.trim());
      }

      const apiUrl = `/api/admin/feedbacks?${queryParams}`;
      addDebugLog(`请求API: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (response.status === 401 || response.status === 403) {
        addDebugLog(`权限错误: ${response.status}`);
        toast.error('无权访问，请重新登录');
        router.push('/admin');
        return;
      }
      
      const result = await response.json();
      
      addDebugLog(`API响应: ${result.success ? '成功' : '失败'}, 数据量: ${result.data?.length || 0}`);
      
      if (result.success) {
        setFeedbacks(result.data || []);
        setStats(result.stats || {
          byStatus: { pending: 0, replied: 0, resolved: 0, archived: 0 },
          total: 0
        });
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
          hasMore: result.pagination?.hasMore || false
        }));
        
        if (result.data?.length === 0 && (filters.search || filters.status !== 'all')) {
          toast.info('未找到匹配的反馈');
        } else {
          toast.success(`已加载 ${result.data?.length || 0} 条反馈`);
        }
      } else {
        addDebugLog(`加载失败: ${result.error}`);
        toast.error(result.error || '加载反馈失败');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      addDebugLog(`加载失败异常: ${errorMsg}`);
      toast.error('加载失败，请检查网络连接');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 修复：搜索防抖
  const handleSearchChange = (value: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      handleFilterChange('search', value);
    }, 500);
  };

  const handleReply = async (feedbackId: number) => {
    if (!replyText.trim()) {
      toast.error('请输入回复内容');
      return;
    }

    try {
      addDebugLog(`开始回复反馈 #${feedbackId}`);
      
      const requestBody = {
        admin_reply: replyText.trim(),
        status: 'replied' as const
      };
      
      const response = await fetch(`/api/admin/feedbacks/${feedbackId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('回复成功');
        setReplyingTo(null);
        setReplyText('');
        loadFeedbacks();
      } else {
        toast.error(result.error || '回复失败');
      }
    } catch (error) {
      toast.error('回复失败');
    }
  };

  const handleTogglePublic = async (feedback: Feedback) => {
    try {
      const newPublicState = !feedback.is_public;
      
      const requestBody = {
        is_public: newPublicState,
        status: newPublicState ? 'resolved' as const : 'pending'
      };
      
      const response = await fetch(`/api/admin/feedbacks/${feedback.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(newPublicState ? '已设为公开' : '已取消公开');
        loadFeedbacks();
      } else {
        toast.error(result.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const handleToggleFeatured = async (feedback: Feedback) => {
    try {
      const newFeaturedState = !feedback.is_featured;
      
      const requestBody = {
        is_featured: newFeaturedState
      };
      
      const response = await fetch(`/api/admin/feedbacks/${feedback.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(newFeaturedState ? '已设为置顶' : '已取消置顶');
        loadFeedbacks();
      } else {
        toast.error(result.error || '操作失败');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const handleDelete = async (feedbackId: number) => {
    if (!confirm('⚠️ 确定要永久删除此反馈吗？此操作不可撤销！')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/feedbacks/${feedbackId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('反馈已永久删除');
        // 从本地状态中移除已删除的反馈
        setFeedbacks(prev => prev.filter(f => f.id !== feedbackId));
        // 更新统计信息
        setStats(prev => ({
          ...prev,
          total: prev.total - 1
        }));
      } else {
        toast.error(result.error || '删除失败');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'replied': return 'info';
      case 'resolved': return 'success';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'replied': return <Reply className="w-3 h-3" />;
      case 'resolved': return <CheckCircle className="w-3 h-3" />;
      case 'archived': return <AlertCircle className="w-3 h-3" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待处理';
      case 'replied': return '已回复';
      case 'resolved': return '已解决';
      case 'archived': return '已归档';
      default: return '未知';
    }
  };

  const getCategoryText = (category: string) => {
    const categoryMap: Record<string, string> = {
      bug: '问题反馈',
      suggestion: '功能建议',
      question: '使用疑问',
      feature_request: '功能请求',
      general: '一般反馈'
    };
    return categoryMap[category] || category;
  };

  // 生成星级评分显示
  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`}
          />
        ))}
        <span className="text-xs text-gray-500 ml-1">({rating}/5)</span>
      </div>
    );
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400 text-lg">验证管理员权限...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 页面标题和操作栏 */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/30">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  反馈管理
                </h1>
                <p className="text-gray-400 mt-1">管理用户反馈，及时回复用户问题</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <SimpleButton
              variant="outline"
              onClick={loadFeedbacks}
              disabled={isLoading}
              className="min-w-[120px]"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? '加载中...' : '刷新数据'}
            </SimpleButton>
            
            <div className="lg:hidden">
              <SimpleButton
                variant="secondary"
                onClick={() => setDebugLogs([])}
                size="sm"
              >
                清空日志
              </SimpleButton>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <SimpleCard>
            <SimpleCardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{stats.byStatus.pending}</div>
                  <div className="text-sm text-gray-400">待处理</div>
                </div>
                <div className="w-12 h-12 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </SimpleCardContent>
          </SimpleCard>
          
          <SimpleCard>
            <SimpleCardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-400">{stats.byStatus.replied}</div>
                  <div className="text-sm text-gray-400">已回复</div>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <Reply className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </SimpleCardContent>
          </SimpleCard>
          
          <SimpleCard>
            <SimpleCardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-400">{stats.byStatus.resolved}</div>
                  <div className="text-sm text-gray-400">已解决</div>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </SimpleCardContent>
          </SimpleCard>
          
          <SimpleCard>
            <SimpleCardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-400">{stats.total}</div>
                  <div className="text-sm text-gray-400">总计反馈</div>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </SimpleCardContent>
          </SimpleCard>
        </div>

        {/* 🔥 修复：筛选工具栏 - 使用明显的颜色 */}
        <SimpleCard className="mb-8">
          <SimpleCardHeader>
            <h2 className="text-xl font-bold text-gray-100">筛选与搜索</h2>
            <p className="text-gray-400 text-sm mt-1">快速查找和管理用户反馈</p>
          </SimpleCardHeader>
          
          <SimpleCardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* 搜索框 */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">搜索反馈</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <SimpleInput
                    value={filters.search}
                    onChange={handleSearchChange}
                    placeholder="搜索标题、内容或用户..."
                    className="pl-10 bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-500"
                  />
                </div>
              </div>

              {/* 🔥 修复：状态筛选 - 使用明显的背景和文字颜色 */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">状态筛选</label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <SimpleSelect
                    value={filters.status}
                    onChange={(value) => handleFilterChange('status', value)}
                    className="pl-10 bg-gray-800 border-gray-700 text-gray-100"
                  >
                    <option value="all" className="bg-gray-800 text-gray-100">全部状态</option>
                    <option value="pending" className="bg-gray-800 text-yellow-400">待处理</option>
                    <option value="replied" className="bg-gray-800 text-blue-400">已回复</option>
                    <option value="resolved" className="bg-gray-800 text-green-400">已解决</option>
                  </SimpleSelect>
                </div>
              </div>

              {/* 排序方式 */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">排序方式</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <SimpleSelect
                    value={`${filters.sortBy}-${filters.sortOrder}`}
                    onChange={(value) => {
                      const [sortBy, sortOrder] = value.split('-');
                      handleFilterChange('sortBy', sortBy);
                      handleFilterChange('sortOrder', sortOrder);
                    }}
                    className="pl-10 bg-gray-800 border-gray-700 text-gray-100"
                  >
                    <option value="created_at-desc" className="bg-gray-800 text-gray-100">最新提交</option>
                    <option value="created_at-asc" className="bg-gray-800 text-gray-100">最早提交</option>
                    <option value="rating-desc" className="bg-gray-800 text-gray-100">评分最高</option>
                    <option value="rating-asc" className="bg-gray-800 text-gray-100">评分最低</option>
                  </SimpleSelect>
                </div>
              </div>

              {/* 每页显示数量 */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">每页显示</label>
                <SimpleSelect
                  value={pagination.limit.toString()}
                  onChange={(value) => setPagination(prev => ({ ...prev, limit: parseInt(value), offset: 0 }))}
                  className="bg-gray-800 border-gray-700 text-gray-100"
                >
                  <option value="5" className="bg-gray-800 text-gray-100">5 条</option>
                  <option value="10" className="bg-gray-800 text-gray-100">10 条</option>
                  <option value="20" className="bg-gray-800 text-gray-100">20 条</option>
                  <option value="50" className="bg-gray-800 text-gray-100">50 条</option>
                </SimpleSelect>
              </div>
            </div>

            {/* 当前筛选信息 */}
            {(filters.search || filters.status !== 'all') && (
              <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-gray-300">当前筛选：</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filters.search && (
                    <SimpleBadge variant="info">
                      搜索: "{filters.search}"
                    </SimpleBadge>
                  )}
                  {filters.status !== 'all' && (
                    <SimpleBadge variant={getStatusColor(filters.status)}>
                      状态: {getStatusText(filters.status)}
                    </SimpleBadge>
                  )}
                  <button
                    onClick={() => {
                      setFilters({
                        status: 'all',
                        category: 'all',
                        search: '',
                        sortBy: 'created_at',
                        sortOrder: 'desc'
                      });
                      toast.info('已清除所有筛选');
                    }}
                    className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
                  >
                    清除所有筛选
                  </button>
                </div>
              </div>
            )}
          </SimpleCardContent>
        </SimpleCard>

        {/* 反馈列表 */}
        <SimpleCard>
          <SimpleCardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-100">反馈列表</h2>
                <p className="text-gray-400 text-sm mt-1">
                  共 {stats.total} 条反馈，{stats.byStatus.pending} 条待处理
                </p>
              </div>
              <div className="text-sm text-gray-300">
                显示 {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} 条
              </div>
            </div>
          </SimpleCardHeader>
          
          <SimpleCardContent>
            {isLoading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-400 mt-4 text-lg">加载反馈数据中...</p>
              </div>
            ) : feedbacks.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare className="w-20 h-20 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">暂无反馈数据</p>
                <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                  {filters.status !== 'all' || filters.search
                    ? '没有找到匹配筛选条件的反馈，尝试调整筛选条件'
                    : '用户还没有提交任何反馈'}
                </p>
                {(filters.status !== 'all' || filters.search) && (
                  <button
                    onClick={() => {
                      setFilters({
                        status: 'all',
                        category: 'all',
                        search: '',
                        sortBy: 'created_at',
                        sortOrder: 'desc'
                      });
                    }}
                    className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm"
                  >
                    查看所有反馈
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {feedbacks.map((feedback) => (
                  <div 
                    key={feedback.id} 
                    className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 transition-all duration-300 hover:border-gray-700 hover:shadow-xl"
                  >
                    {/* 反馈头部 */}
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between mb-6 gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <h3 className="font-bold text-xl text-gray-100 break-words">{feedback.title}</h3>
                          <SimpleBadge variant={getStatusColor(feedback.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(feedback.status)}
                              {getStatusText(feedback.status)}
                            </span>
                          </SimpleBadge>
                          
                          {feedback.is_public && (
                            <SimpleBadge variant="success">
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                公开
                              </span>
                            </SimpleBadge>
                          )}
                          
                          {feedback.is_featured && (
                            <SimpleBadge variant="purple">
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3" />
                                置顶
                              </span>
                            </SimpleBadge>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            {/* 🔥 修复：只显示邮箱用户名部分 */}
                            <span className="text-gray-300 font-medium">
                              {extractUsername(feedback.user_email)}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {formatDate(feedback.created_at)}
                          </span>
                          <span className="flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            {getCategoryText(feedback.category)}
                          </span>
                          {feedback.rating !== null && feedback.rating > 0 && (
                            <span className="flex items-center gap-2">
                              {renderStars(feedback.rating)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* 操作按钮组 */}
                      <div className="flex flex-wrap gap-2">
                        <SimpleButton
                          variant={replyingTo === feedback.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            if (replyingTo === feedback.id) {
                              setReplyingTo(null);
                            } else {
                              setReplyingTo(feedback.id);
                              setReplyText(feedback.admin_reply || '');
                            }
                          }}
                          className="min-w-[100px]"
                        >
                          <Reply className="w-4 h-4" />
                          {feedback.admin_reply ? '修改回复' : '回复'}
                        </SimpleButton>
                        
                        <SimpleButton
                          variant={feedback.is_public ? "success" : "outline"}
                          size="sm"
                          onClick={() => handleTogglePublic(feedback)}
                          className="min-w-[100px]"
                        >
                          {feedback.is_public ? (
                            <>
                              <EyeOff className="w-4 h-4" />
                              取消公开
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4" />
                              公开
                            </>
                          )}
                        </SimpleButton>
                        
                        <SimpleButton
                          variant={feedback.is_featured ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleFeatured(feedback)}
                          className="min-w-[100px]"
                        >
                          {feedback.is_featured ? (
                            <>
                              <StarOff className="w-4 h-4" />
                              取消置顶
                            </>
                          ) : (
                            <>
                              <Star className="w-4 h-4" />
                              置顶
                            </>
                          )}
                        </SimpleButton>
                        
                        <SimpleButton
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(feedback.id)}
                          className="min-w-[100px]"
                        >
                          <Trash2 className="w-4 h-4" />
                          删除
                        </SimpleButton>
                      </div>
                    </div>

                    {/* 🔥 修复：反馈内容 - 确保换行 */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-4 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-400">反馈内容</span>
                      </div>
                      <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-5">
                        <p className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                          {feedback.content}
                        </p>
                      </div>
                    </div>

                    {/* 管理员回复区域 */}
                    {feedback.admin_reply && !replyingTo ? (
                      <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border border-blue-800/30">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center">
                            <Reply className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <span className="font-bold text-lg text-gray-100">我的回复</span>
                            <div className="text-sm text-gray-400">
                              {feedback.replied_at && formatLongDate(feedback.replied_at)}
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-900/30 border border-blue-800/20 rounded-lg p-4">
                          <p className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                            {feedback.admin_reply}
                          </p>
                        </div>
                        <div className="flex justify-end mt-4">
                          <SimpleButton
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReplyingTo(feedback.id);
                              setReplyText(feedback.admin_reply || '');
                            }}
                          >
                            <Reply className="w-4 h-4" />
                            修改回复
                          </SimpleButton>
                        </div>
                      </div>
                    ) : replyingTo === feedback.id ? (
                      <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-800/30">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl flex items-center justify-center">
                            <Reply className="w-5 h-5 text-white" />
                          </div>
                          <span className="font-bold text-lg text-gray-100">回复内容</span>
                        </div>
                        <div className="mb-4">
                          <SimpleTextarea
                            value={replyText}
                            onChange={setReplyText}
                            placeholder="请输入回复内容..."
                            rows={4}
                            className="bg-gray-900/50 border-gray-700 text-gray-100"
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            用户将在"我的反馈"中看到此回复
                          </p>
                        </div>
                        <div className="flex justify-end gap-3">
                          <SimpleButton
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReplyingTo(null);
                              setReplyText('');
                            }}
                          >
                            取消
                          </SimpleButton>
                          <SimpleButton
                            size="sm"
                            onClick={() => handleReply(feedback.id)}
                          >
                            发送回复
                          </SimpleButton>
                        </div>
                      </div>
                    ) : !feedback.admin_reply ? (
                      <div className="flex justify-center pt-2">
                        <SimpleButton
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReplyingTo(feedback.id);
                            setReplyText('');
                          }}
                        >
                          <Reply className="w-4 h-4" />
                          回复用户
                        </SimpleButton>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {/* 分页控制 */}
            {!isLoading && feedbacks.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center mt-10 pt-8 border-t border-gray-800 gap-6">
                <div className="text-sm text-gray-400">
                  显示 {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} 条，共 {pagination.total} 条
                </div>
                <div className="flex gap-3">
                  <SimpleButton
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ 
                      ...prev, 
                      offset: Math.max(0, prev.offset - prev.limit) 
                    }))}
                    disabled={pagination.offset === 0}
                    className="min-w-[120px]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    上一页
                  </SimpleButton>
                  <SimpleButton
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ 
                      ...prev, 
                      offset: prev.offset + prev.limit 
                    }))}
                    disabled={!pagination.hasMore}
                    className="min-w-[120px]"
                  >
                    下一页
                    <ChevronRight className="w-4 h-4" />
                  </SimpleButton>
                </div>
              </div>
            )}
          </SimpleCardContent>
        </SimpleCard>

        {/* 调试面板（仅在开发环境显示） */}
        {process.env.NODE_ENV === 'development' && debugLogs.length > 0 && (
          <div className="mt-8">
            <SimpleCard>
              <SimpleCardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">调试日志</h3>
                  <button 
                    onClick={() => setDebugLogs([])}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    清空
                  </button>
                </div>
              </SimpleCardHeader>
              <SimpleCardContent>
                <div className="text-xs text-gray-500 max-h-40 overflow-y-auto font-mono">
                  {debugLogs.map((log, index) => (
                    <div key={index} className="py-2 border-b border-gray-800 last:border-0">
                      {log}
                    </div>
                  ))}
                </div>
              </SimpleCardContent>
            </SimpleCard>
          </div>
        )}

        {/* 页面底部提示 */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center justify-center gap-3 text-sm text-gray-500 mb-4">
            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
            <span>LOVE LUDO 反馈管理系统</span>
            <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
          </div>
          <p className="text-sm text-gray-600">
            系统版本: v2.0 | 最后更新: {new Date().toLocaleDateString('zh-CN')}
          </p>
        </div>
      </div>
    </div>
  );
}