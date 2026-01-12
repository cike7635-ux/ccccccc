// /app/admin/feedback/page.tsx - 修复后的版本
"use client";
// 修复顶部导入
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js'; // ✅ 已导入
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
  AlertCircle,
  Users,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

// 反馈类型定义
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
  user: {
    email: string;
    nickname: string | null;
    avatar_url: string | null;
    created_at: string;
  } | null;
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

export default function AdminFeedbackPage() {
  const router = useRouter();
  // 🔥 修复这一行：使用正确的Supabase客户端
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);

  // 检查管理员权限
  useEffect(() => {
    checkAdmin();
  }, []);

  // 加载反馈数据
  useEffect(() => {
    if (isAdmin) {
      loadFeedbacks();
    }
  }, [isAdmin, filters, pagination.offset]);

  const checkAdmin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/admin/login');
        return;
      }

      // 检查是否是管理员（通过环境变量中的邮箱）
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
      const isAdminUser = adminEmails.includes(session.user.email!);
      
      setIsAdmin(isAdminUser);
      
      if (!isAdminUser) {
        toast.error('无权访问管理页面');
        router.push('/');
      }
    } catch (error) {
      console.error('检查管理员权限失败:', error);
      router.push('/admin/login');
    }
  };

  const loadFeedbacks = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const queryParams = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.category !== 'all' && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      });

      const response = await fetch(`/api/admin/feedbacks?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setFeedbacks(result.data);
        setStats(result.stats);
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total,
          hasMore: result.pagination.hasMore
        }));
      } else {
        toast.error(result.error || '加载反馈失败');
      }
    } catch (error) {
      console.error('加载反馈失败:', error);
      toast.error('加载反馈失败');
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
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/admin/feedbacks/${feedbackId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
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
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/admin/feedbacks/${feedback.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
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
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/admin/feedbacks/${feedback.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
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
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/admin/feedbacks/${feedbackId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
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
      case 'pending': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
      case 'replied': return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
      case 'resolved': return 'bg-green-500/20 text-green-600 border-green-500/30';
      case 'archived': return 'bg-gray-500/20 text-gray-600 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-600 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'replied': return <Reply className="w-3 h-3" />;
      case 'resolved': return <CheckCircle className="w-3 h-3" />;
      case 'archived': return <Archive className="w-3 h-3" />;
      default: return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <Button
          variant="outline"
          onClick={loadFeedbacks}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.byStatus.pending}</div>
                <div className="text-sm text-gray-400">待处理</div>
              </div>
              <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.byStatus.replied}</div>
                <div className="text-sm text-gray-400">已回复</div>
              </div>
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Reply className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.byStatus.resolved}</div>
                <div className="text-sm text-gray-400">已解决</div>
              </div>
              <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-gray-400">总计反馈</div>
              </div>
              <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选工具栏 */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 搜索框 */}
            <div>
              <Label className="block text-sm text-gray-400 mb-2">搜索</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索标题、内容或用户"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 状态筛选 */}
            <div>
              <Label className="block text-sm text-gray-400 mb-2">状态</Label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full bg-transparent border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="replied">已回复</option>
                <option value="resolved">已解决</option>
                <option value="archived">已归档</option>
              </select>
            </div>

            {/* 分类筛选 */}
            <div>
              <Label className="block text-sm text-gray-400 mb-2">分类</Label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full bg-transparent border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">全部分类</option>
                {Object.keys(stats.byCategory).map(category => (
                  <option key={category} value={category}>
                    {category === 'bug' ? '问题反馈' :
                     category === 'suggestion' ? '功能建议' :
                     category === 'question' ? '使用疑问' :
                     category === 'feature_request' ? '功能请求' : '一般反馈'}
                  </option>
                ))}
              </select>
            </div>

            {/* 排序方式 */}
            <div>
              <Label className="block text-sm text-gray-400 mb-2">排序</Label>
              <select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-');
                  handleFilterChange('sortBy', sortBy);
                  handleFilterChange('sortOrder', sortOrder);
                }}
                className="w-full bg-transparent border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="created_at-desc">最新提交</option>
                <option value="created_at-asc">最早提交</option>
                <option value="rating-desc">评分最高</option>
                <option value="rating-asc">评分最低</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 反馈列表 */}
      <Card>
        <CardHeader>
          <CardTitle>用户反馈列表</CardTitle>
          <CardDescription>
            共 {stats.total} 条反馈，{stats.byStatus.pending} 条待处理
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                <div key={feedback.id} className="glass rounded-xl p-6">
                  {/* 反馈头部 */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{feedback.title}</h3>
                        <Badge className={getStatusColor(feedback.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(feedback.status)}
                            {feedback.status === 'pending' ? '待处理' : 
                             feedback.status === 'replied' ? '已回复' : 
                             feedback.status === 'resolved' ? '已解决' : '已归档'}
                          </span>
                        </Badge>
                        
                        {feedback.is_public && (
                          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                            <Eye className="w-3 h-3 mr-1" />
                            公开
                          </Badge>
                        )}
                        
                        {feedback.is_featured && (
                          <Badge className="bg-pink-500/20 text-pink-600 border-pink-500/30">
                            <Star className="w-3 h-3 mr-1" />
                            置顶
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {feedback.user_nickname || feedback.user_email}
                        </span>
                        <span>•</span>
                        <span>提交时间: {formatDate(feedback.created_at)}</span>
                        <span>•</span>
                        <span>
                          {feedback.category === 'bug' ? '问题反馈' :
                           feedback.category === 'suggestion' ? '功能建议' :
                           feedback.category === 'question' ? '使用疑问' : '功能请求'}
                        </span>
                        {feedback.rating && (
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
                    
                    {/* 操作按钮 */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Filter className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>操作</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                          setSelectedFeedback(feedback);
                          setReplyingTo(feedback.id);
                        }}>
                          <Reply className="w-4 h-4 mr-2" />
                          {feedback.admin_reply ? '修改回复' : '回复'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePublic(feedback)}>
                          {feedback.is_public ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" />
                              取消公开
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              设为公开
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleFeatured(feedback)}>
                          {feedback.is_featured ? (
                            <>
                              <StarOff className="w-4 h-4 mr-2" />
                              取消置顶
                            </>
                          ) : (
                            <>
                              <Star className="w-4 h-4 mr-2" />
                              设为置顶
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(feedback.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          归档反馈
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* 反馈内容 */}
                  <div className="mb-4">
                    <p className="text-gray-300 whitespace-pre-wrap">{feedback.content}</p>
                  </div>

                  {/* 管理员回复区域 */}
                  {feedback.admin_reply ? (
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
                    </div>
                  ) : replyingTo === feedback.id ? (
                    <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                      <div className="mb-3">
                        <Label htmlFor={`reply-${feedback.id}`} className="block mb-2">
                          回复内容
                        </Label>
                        <textarea
                          id={`reply-${feedback.id}`}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="请输入回复内容..."
                          rows={4}
                          className="w-full bg-transparent border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                        >
                          取消
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReply(feedback.id)}
                        >
                          发送回复
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedFeedback(feedback);
                          setReplyingTo(feedback.id);
                        }}
                      >
                        <Reply className="w-4 h-4 mr-2" />
                        回复
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 分页控制 */}
          {!isLoading && feedbacks.length > 0 && (
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-800">
              <div className="text-sm text-gray-400">
                显示 {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} 条，共 {pagination.total} 条
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                  disabled={pagination.offset === 0}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                  disabled={!pagination.hasMore}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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