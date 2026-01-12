// /app/admin/feedback/page.tsx - 修复版本
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Filter,
  Search,
  Clock,
  CheckCircle,
  Archive,
  Eye,
  EyeOff,
  Star,
  StarOff,
  Reply,
  Trash2,
  RefreshCw,
  Users
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
  byCategory: Record<string, number>;
  total: number;
}

// ==================== 工具函数 ====================
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '日期格式错误';
  }
};

// ==================== 简单UI组件（如果原组件不存在） ====================
const SimpleCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-gray-900 border border-gray-800 rounded-lg shadow ${className}`}>
    {children}
  </div>
);

const SimpleCardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6 border-b border-gray-800">
    {children}
  </div>
);

const SimpleCardContent = ({ children }: { children: React.ReactNode }) => (
  <div className="p-6">
    {children}
  </div>
);

const SimpleButton = ({ 
  children, 
  onClick, 
  disabled = false,
  variant = 'default',
  className = ''
}: { 
  children: React.ReactNode; 
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'destructive';
  className?: string;
}) => {
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantStyles = {
    default: "bg-blue-600 hover:bg-blue-700 text-white",
    outline: "border border-gray-700 hover:bg-gray-800 text-gray-300",
    destructive: "bg-red-600 hover:bg-red-700 text-white"
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
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
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}) => {
  const variantStyles = {
    default: "bg-gray-800 text-gray-300",
    success: "bg-green-900/30 text-green-400 border border-green-800/50",
    warning: "bg-yellow-900/30 text-yellow-400 border border-yellow-800/50",
    error: "bg-red-900/30 text-red-400 border border-red-800/50",
    info: "bg-blue-900/30 text-blue-400 border border-blue-800/50"
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}>
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
    className={`w-full bg-transparent border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
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
    className={`w-full bg-transparent border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${className}`}
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
    className={`w-full bg-transparent border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
  >
    {children}
  </select>
);

// ==================== 主组件 ====================
export default function AdminFeedbackPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(true); // 假设已通过中间件验证
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats>({
    byStatus: { pending: 0, replied: 0, resolved: 0, archived: 0 },
    byCategory: {},
    total: 0
  });
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc'
  });
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false
  });
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  // 加载反馈数据
  useEffect(() => {
    loadFeedbacks();
  }, [filters, pagination.offset]);

  const loadFeedbacks = async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.category !== 'all' && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      });

      const response = await fetch(`/api/admin/feedbacks?${queryParams}`);
      
      if (response.status === 401 || response.status === 403) {
        toast.error('无权访问，请重新登录');
        router.push('/admin');
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        setFeedbacks(result.data || []);
        setStats(result.stats || {
          byStatus: { pending: 0, replied: 0, resolved: 0, archived: 0 },
          byCategory: {},
          total: 0
        });
        setPagination(prev => ({
          ...prev,
          total: result.pagination?.total || 0,
          hasMore: result.pagination?.hasMore || false
        }));
      } else {
        toast.error(result.error || '加载反馈失败');
      }
    } catch (error) {
      console.error('加载反馈失败:', error);
      toast.error('加载失败，请检查网络连接');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReply = async (feedbackId: number) => {
    if (!replyText.trim()) {
      toast.error('请输入回复内容');
      return;
    }

    try {
      const response = await fetch(`/api/admin/feedbacks/${feedbackId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          admin_reply: replyText,
          status: 'replied'
        })
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
      console.error('回复失败:', error);
      toast.error('回复失败');
    }
  };

  const handleTogglePublic = async (feedback: Feedback) => {
    try {
      const response = await fetch(`/api/admin/feedbacks/${feedback.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_public: !feedback.is_public,
          status: feedback.is_public ? 'replied' : 'resolved'
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(feedback.is_public ? '已取消公开' : '已设为公开');
        loadFeedbacks();
      } else {
        toast.error(result.error || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  const handleToggleFeatured = async (feedback: Feedback) => {
    try {
      const response = await fetch(`/api/admin/feedbacks/${feedback.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          is_featured: !feedback.is_featured
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(feedback.is_featured ? '已取消置顶' : '已设为置顶');
        loadFeedbacks();
      } else {
        toast.error(result.error || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败');
    }
  };

  const handleDelete = async (feedbackId: number) => {
    if (!confirm('确定要归档此反馈吗？归档后用户将不可见。')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/feedbacks/${feedbackId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('反馈已归档');
        loadFeedbacks();
      } else {
        toast.error(result.error || '归档失败');
      }
    } catch (error) {
      console.error('归档失败:', error);
      toast.error('归档失败');
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
      case 'pending': return <Clock className="w-3 h-3 mr-1" />;
      case 'replied': return <Reply className="w-3 h-3 mr-1" />;
      case 'resolved': return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'archived': return <Archive className="w-3 h-3 mr-1" />;
      default: return null;
    }
  };

  const getCategoryName = (category: string) => {
    const categoryMap: Record<string, string> = {
      bug: '问题反馈',
      suggestion: '功能建议',
      question: '使用疑问',
      feature_request: '功能请求',
      general: '一般反馈'
    };
    return categoryMap[category] || category;
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">验证管理员权限...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">反馈管理</h1>
          <p className="text-gray-400 mt-1">管理用户反馈，回复用户问题</p>
        </div>
        <SimpleButton
          variant="outline"
          onClick={loadFeedbacks}
          disabled={isLoading}
          className="flex items-center"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </SimpleButton>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SimpleCard>
          <SimpleCardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.byStatus.pending}</div>
                <div className="text-sm text-gray-400">待处理</div>
              </div>
              <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </SimpleCardContent>
        </SimpleCard>
        
        <SimpleCard>
          <SimpleCardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.byStatus.replied}</div>
                <div className="text-sm text-gray-400">已回复</div>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Reply className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </SimpleCardContent>
        </SimpleCard>
        
        <SimpleCard>
          <SimpleCardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.byStatus.resolved}</div>
                <div className="text-sm text-gray-400">已解决</div>
              </div>
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </SimpleCardContent>
        </SimpleCard>
        
        <SimpleCard>
          <SimpleCardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-gray-400">总计反馈</div>
              </div>
              <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </SimpleCardContent>
        </SimpleCard>
      </div>

      {/* 筛选工具栏 */}
      <SimpleCard className="mb-6">
        <SimpleCardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 搜索框 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">搜索</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <SimpleInput
                  value={filters.search}
                  onChange={(value) => handleFilterChange('search', value)}
                  placeholder="搜索标题、内容或用户"
                  className="pl-10"
                />
              </div>
            </div>

            {/* 状态筛选 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">状态</label>
              <SimpleSelect
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value)}
              >
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="replied">已回复</option>
                <option value="resolved">已解决</option>
                <option value="archived">已归档</option>
              </SimpleSelect>
            </div>

            {/* 分类筛选 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">分类</label>
              <SimpleSelect
                value={filters.category}
                onChange={(value) => handleFilterChange('category', value)}
              >
                <option value="all">全部分类</option>
                {Object.keys(stats.byCategory).map(category => (
                  <option key={category} value={category}>
                    {getCategoryName(category)}
                  </option>
                ))}
              </SimpleSelect>
            </div>

            {/* 排序方式 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">排序</label>
              <SimpleSelect
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(value) => {
                  const [sortBy, sortOrder] = value.split('-');
                  handleFilterChange('sortBy', sortBy);
                  handleFilterChange('sortOrder', sortOrder);
                }}
              >
                <option value="created_at-desc">最新提交</option>
                <option value="created_at-asc">最早提交</option>
                <option value="rating-desc">评分最高</option>
                <option value="rating-asc">评分最低</option>
              </SimpleSelect>
            </div>
          </div>
        </SimpleCardContent>
      </SimpleCard>

      {/* 反馈列表 */}
      <SimpleCard>
        <SimpleCardHeader>
          <h2 className="text-xl font-bold">用户反馈列表</h2>
          <p className="text-gray-400 text-sm mt-1">
            共 {stats.total} 条反馈，{stats.byStatus.pending} 条待处理
          </p>
        </SimpleCardHeader>
        <SimpleCardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">加载中...</p>
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">暂无反馈数据</p>
              <p className="text-sm text-gray-500 mt-1">
                {filters.status !== 'all' || filters.category !== 'all' || filters.search
                  ? '尝试调整筛选条件'
                  : '用户还没有提交反馈'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {feedbacks.map((feedback) => (
                <div key={feedback.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                  {/* 反馈头部 */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{feedback.title}</h3>
                        <SimpleBadge variant={getStatusColor(feedback.status)}>
                          <span className="flex items-center">
                            {getStatusIcon(feedback.status)}
                            {feedback.status === 'pending' ? '待处理' : 
                             feedback.status === 'replied' ? '已回复' : 
                             feedback.status === 'resolved' ? '已解决' : '已归档'}
                          </span>
                        </SimpleBadge>
                        
                        {feedback.is_public && (
                          <SimpleBadge variant="success">
                            <span className="flex items-center">
                              <Eye className="w-3 h-3 mr-1" />
                              公开
                            </span>
                          </SimpleBadge>
                        )}
                        
                        {feedback.is_featured && (
                          <SimpleBadge variant="info">
                            <span className="flex items-center">
                              <Star className="w-3 h-3 mr-1" />
                              置顶
                            </span>
                          </SimpleBadge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {feedback.user_nickname || feedback.user_email}
                        </span>
                        <span>•</span>
                        <span>提交时间: {formatDate(feedback.created_at)}</span>
                        <span>•</span>
                        <span>{getCategoryName(feedback.category)}</span>
                        {feedback.rating !== null && (
                          <>
                            <span>•</span>
                            <span className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i < feedback.rating! 
                                      ? 'text-yellow-500 fill-yellow-500' 
                                      : 'text-gray-400'
                                  }`}
                                />
                              ))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* 操作按钮 - 简化版本 */}
                    <div className="flex flex-wrap gap-2">
                      <SimpleButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReplyingTo(feedback.id);
                          setReplyText(feedback.admin_reply || '');
                        }}
                      >
                        <Reply className="w-4 h-4 mr-1" />
                        {feedback.admin_reply ? '修改回复' : '回复'}
                      </SimpleButton>
                      
                      <SimpleButton
                        variant="outline"
                        size="sm"
                        onClick={() => handleTogglePublic(feedback)}
                      >
                        {feedback.is_public ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            取消公开
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            公开
                          </>
                        )}
                      </SimpleButton>
                      
                      <SimpleButton
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(feedback.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        归档
                      </SimpleButton>
                    </div>
                  </div>

                  {/* 反馈内容 */}
                  <div className="mb-4">
                    <p className="text-gray-300 whitespace-pre-wrap">{feedback.content}</p>
                  </div>

                  {/* 管理员回复区域 */}
                  {feedback.admin_reply && !replyingTo ? (
                    <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                          <Reply className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-semibold">我的回复</span>
                        <span className="text-xs text-gray-400">
                          {feedback.replied_at && formatDate(feedback.replied_at)}
                        </span>
                      </div>
                      <p className="text-gray-300 whitespace-pre-wrap">{feedback.admin_reply}</p>
                      <div className="flex justify-end mt-3">
                        <SimpleButton
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReplyingTo(feedback.id);
                            setReplyText(feedback.admin_reply || '');
                          }}
                        >
                          修改回复
                        </SimpleButton>
                      </div>
                    </div>
                  ) : replyingTo === feedback.id ? (
                    <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                      <div className="mb-3">
                        <label className="block text-sm font-medium mb-2">回复内容</label>
                        <SimpleTextarea
                          value={replyText}
                          onChange={setReplyText}
                          placeholder="请输入回复内容..."
                          rows={4}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <SimpleButton
                          variant="outline"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                        >
                          取消
                        </SimpleButton>
                        <SimpleButton
                          onClick={() => handleReply(feedback.id)}
                        >
                          发送回复
                        </SimpleButton>
                      </div>
                    </div>
                  ) : !feedback.admin_reply ? (
                    <div className="flex justify-end">
                      <SimpleButton
                        variant="outline"
                        onClick={() => {
                          setReplyingTo(feedback.id);
                          setReplyText('');
                        }}
                      >
                        <Reply className="w-4 h-4 mr-2" />
                        回复
                      </SimpleButton>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* 分页控制 */}
          {!isLoading && feedbacks.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center mt-8 pt-6 border-t border-gray-800 gap-4">
              <div className="text-sm text-gray-400">
                显示 {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} 条，共 {pagination.total} 条
              </div>
              <div className="flex gap-2">
                <SimpleButton
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                  disabled={pagination.offset === 0}
                >
                  上一页
                </SimpleButton>
                <SimpleButton
                  variant="outline"
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                  disabled={!pagination.hasMore}
                >
                  下一页
                </SimpleButton>
              </div>
            </div>
          )}
        </SimpleCardContent>
      </SimpleCard>

      {/* 页面底部提示 */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>✨ 提示：设为公开的反馈会在用户反馈页面展示，置顶的反馈会优先显示</p>
        <p className="mt-1">
          📊 数据统计：待处理 {stats.byStatus.pending} 条，已回复 {stats.byStatus.replied} 条，已解决 {stats.byStatus.resolved} 条
        </p>
      </div>
    </div>
  );
}