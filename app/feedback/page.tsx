"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  MessageSquare,
  Star,
  CheckCircle,
  Clock,
  Eye,
  ThumbsUp,
  AlertCircle,
  MessageCircle,
  Heart,
  RefreshCw,
  LogOut,
  ArrowRight,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

// 初始化Supabase客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  }
);

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
  user_nickname: string;
}

export default function FeedbackPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('public'); // 默认显示公开反馈
  const [userFeedback, setUserFeedback] = useState<Feedback[]>([]);
  const [publicFeedback, setPublicFeedback] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [hasPendingFeedback, setHasPendingFeedback] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    replied: 0,
    resolved: 0
  });
  const [isClient, setIsClient] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoadingPublic, setIsLoadingPublic] = useState(false);
  const authCheckCountRef = useRef(0);

  useEffect(() => {
    setIsClient(true);
    checkSession();
  }, []);

  useEffect(() => {
    // 当用户状态或标签变化时加载数据
    if (!isCheckingAuth) {
      loadDataForCurrentTab();
    }
  }, [activeTab, user, isCheckingAuth]);

  const loadDataForCurrentTab = async () => {
    if (activeTab === 'public') {
      await loadPublicFeedback();
    } else if (activeTab === 'mine' && user) {
      await loadUserFeedback();
    }
  };

  const checkSession = async () => {
    try {
      setIsCheckingAuth(true);
      console.log('🔍 开始检查用户会话...');
      
      // 🔥 关键修复：先检查是否有缓存会话，不立即重定向
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log('会话检查结果:', {
        hasSession: !!session,
        userEmail: session?.user?.email,
        checkCount: ++authCheckCountRef.current
      });
      
      if (session?.user) {
        // ✅ 有会话，设置用户
        setUser(session.user);
        console.log('✅ 用户已登录:', session.user.email);
        
        // 如果是"我的反馈"标签，加载用户反馈
        if (activeTab === 'mine') {
          await loadUserFeedback();
        }
      } else {
        // ⚠️ 没有会话，但先不重定向
        console.log('⚠️ 未检测到用户会话，显示公开反馈');
        setUser(null);
        
        // 确保显示公开反馈标签
        if (activeTab !== 'public') {
          setActiveTab('public');
        }
        
        // 加载公开反馈
        await loadPublicFeedback();
      }
      
    } catch (error) {
      console.error('检查会话失败:', error);
      // 即使出错，也尝试加载公开反馈
      setUser(null);
      await loadPublicFeedback();
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const loadUserFeedback = async () => {
    if (!user) {
      console.log('⚠️ 未登录用户尝试加载个人反馈，自动切换到公开反馈');
      setActiveTab('public');
      await loadPublicFeedback();
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('📥 加载用户反馈');
      
      // 获取当前会话
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('❌ 会话不存在，重定向到登录');
        toast.error('请先登录');
        return;
      }
      
      const response = await fetch('/api/feedback/my', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (response.status === 401 || response.status === 403) {
        console.log('❌ Token无效或过期');
        setUser(null);
        toast.error('登录已过期');
        setActiveTab('public');
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ 成功加载用户反馈，数量:', result.data?.length || 0);
        setUserFeedback(result.data || []);
        setStats(result.stats || { pending: 0, replied: 0, resolved: 0 });
        setHasPendingFeedback(result.stats?.pending > 0);
      } else {
        console.error('加载用户反馈失败:', result.error);
        toast.error(result.error || '加载反馈失败');
      }
    } catch (error) {
      console.error('加载用户反馈异常:', error);
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        toast.error('网络错误，请检查您的网络连接');
      } else {
        toast.error('加载失败，请刷新页面重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadPublicFeedback = async () => {
    setIsLoadingPublic(true);
    try {
      console.log('📥 加载公开反馈');
      
      const response = await fetch('/api/feedback/public');
      const result = await response.json();

      if (result.success) {
        console.log('✅ 成功加载公开反馈，数量:', result.data?.length || 0);
        setPublicFeedback(result.data || []);
      } else {
        console.error('加载公开反馈失败:', result.error);
        toast.error(result.error || '加载公开反馈失败');
      }
    } catch (error) {
      console.error('加载公开反馈异常:', error);
      toast.error('网络错误，请检查连接');
    } finally {
      setIsLoadingPublic(false);
    }
  };

  const handleSubmitSuccess = async () => {
    // 重新加载用户反馈
    if (user) {
      await loadUserFeedback();
    }
    
    setActiveTab('mine');
    toast.success('反馈提交成功！我们会在3个工作日内回复您');
  };

  const handleRefresh = async () => {
    if (activeTab === 'mine' && user) {
      await loadUserFeedback();
    } else if (activeTab === 'public') {
      await loadPublicFeedback();
    }
  };

  const handleManualLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('已退出登录');
      setUser(null);
      setActiveTab('public');
      await loadPublicFeedback();
    } catch (error) {
      console.error('退出登录失败:', error);
      toast.error('退出登录失败');
    }
  };

  const handleTabChange = (tab: string) => {
    if ((tab === 'submit' || tab === 'mine') && !user) {
      toast.info('请先登录以使用此功能');
      router.push(`/login?redirect=/feedback&tab=${tab}`);
      return;
    }
    
    if (tab === 'submit' && hasPendingFeedback) {
      toast.error('您有待处理的反馈，请等待管理员回复后再提交新的反馈');
      return;
    }
    
    setActiveTab(tab);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-600';
      case 'replied': return 'bg-blue-500/20 text-blue-600';
      case 'resolved': return 'bg-green-500/20 text-green-600';
      default: return 'bg-gray-500/20 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'replied': return <MessageCircle className="w-3 h-3" />;
      case 'resolved': return <CheckCircle className="w-3 h-3" />;
      default: return null;
    }
  };

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

  // 动态导入FeedbackForm，避免服务器端渲染问题
  const [FeedbackFormComponent, setFeedbackFormComponent] = useState<React.ComponentType<any> | null>(null);
  
  useEffect(() => {
    if (activeTab === 'submit' && user) {
      import('@/components/feedback-form').then(module => {
        setFeedbackFormComponent(() => module.default);
      });
    }
  }, [activeTab, user]);

  // 显示认证检查状态
  if (isCheckingAuth) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 mb-4">
            <RefreshCw className="w-8 h-8 text-white animate-spin" />
          </div>
          <h1 className="text-3xl font-bold mb-2">正在加载...</h1>
          <p className="text-gray-400">请稍候，正在检查您的登录状态</p>
        </div>
      </div>
    );
  }

  // 显示未登录状态的完整页面
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">用户反馈中心</h1>
          <p className="text-gray-400">在这里查看其他用户的反馈和我们官方的回复</p>
          
          {/* 登录提示卡片 */}
          <div className="mt-6 glass rounded-2xl p-6 max-w-md mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">想要提交反馈？</h3>
                <p className="text-sm text-gray-400">登录后可以提交自己的反馈并查看处理进度</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/login?redirect=/feedback')}
              className="w-full px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 rounded-lg text-white font-medium flex items-center justify-center gap-2"
            >
              立即登录
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-gray-500 text-center mt-3">
              登录后可以访问所有功能
            </p>
          </div>
        </div>

        {/* 标签页导航 - 未登录时只显示公开反馈 */}
        <div className="flex border-b border-gray-800 mb-8 justify-center">
          <button
            onClick={() => setActiveTab('public')}
            className={`px-6 py-3 font-medium text-sm ${activeTab === 'public' ? 'border-b-2 border-pink-500 text-pink-500' : 'text-gray-400 hover:text-gray-300'}`}
          >
            精选反馈
          </button>
          <button
            onClick={() => {
              toast.info('请先登录以提交反馈');
              router.push('/login?redirect=/feedback&tab=submit');
            }}
            className="px-6 py-3 font-medium text-sm text-gray-400 hover:text-gray-300 flex items-center"
          >
            提交反馈
          </button>
          <button
            onClick={() => {
              toast.info('请先登录以查看个人反馈');
              router.push('/login?redirect=/feedback&tab=mine');
            }}
            className="px-6 py-3 font-medium text-sm text-gray-400 hover:text-gray-300 flex items-center"
          >
            我的反馈
          </button>
        </div>

        {/* 公开反馈内容 */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ThumbsUp className="w-5 h-5" />
              精选反馈
            </h2>
            <button
              onClick={handleRefresh}
              disabled={isLoadingPublic}
              className="text-sm text-gray-400 hover:text-white flex items-center disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingPublic ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>

          {isLoadingPublic ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
              <p className="text-gray-400 mt-2">加载中...</p>
            </div>
          ) : publicFeedback.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">暂无精选反馈</p>
              <p className="text-sm text-gray-500 mt-1">
                管理员会将有价值的反馈精选到这里
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {publicFeedback.map((feedback) => (
                <div key={feedback.id} className="glass rounded-xl p-6">
                  {feedback.is_featured && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Star className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">
                        置顶精选
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-xl mb-1">{feedback.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">
                          {feedback.user_nickname || '匿名用户'}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-sm text-gray-400">
                          {formatDate(feedback.created_at)}
                        </span>
                      </div>
                    </div>
                    {feedback.rating && (
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${i < feedback.rating!
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-400'
                              }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mb-6">
                    <p className="text-gray-300 text-lg whitespace-pre-wrap">{feedback.content}</p>
                  </div>

                  {feedback.admin_reply && (
                    <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">官方回复</div>
                          <div className="text-sm text-gray-400">
                            {feedback.replied_at && formatDate(feedback.replied_at)}
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-300 text-lg whitespace-pre-wrap">
                        {feedback.admin_reply}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 页面底部提示 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>我们重视每一条反馈，通常会在1-3个工作日内回复</p>
          <p className="mt-1">
            如需紧急帮助，请联系邮箱：<a href="mailto:support@xiyi.asia" className="text-pink-500 hover:underline">support@xiyi.asia</a>
          </p>
          <div className="mt-4">
            <button
              onClick={() => router.push('/login?redirect=/feedback')}
              className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 rounded-lg text-white text-sm"
            >
              立即登录以提交反馈
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 已登录用户的完整页面
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 页面标题和用户信息 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 mb-4">
          <MessageSquare className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-2">用户反馈</h1>
        <p className="text-gray-400">您的意见对我们非常重要，帮助我们改进产品</p>
        
        {/* 用户信息和控制 */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="text-sm text-gray-500 bg-gray-800/50 px-4 py-2 rounded-lg">
            当前用户: <span className="text-pink-400">{user.email}</span>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="text-xs px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              刷新
            </button>
            
            <button
              onClick={handleManualLogout}
              className="text-xs px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg flex items-center gap-1 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              退出登录
            </button>
          </div>
        </div>
      </div>

      {/* 警告提示 */}
      {hasPendingFeedback && activeTab === 'submit' && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
            <span className="text-yellow-500">
              您有待处理的反馈，请等待管理员回复后再提交新的反馈
            </span>
          </div>
        </div>
      )}

      {/* 标签页导航 */}
      <div className="flex border-b border-gray-800 mb-8">
        <button
          onClick={() => handleTabChange('submit')}
          className={`px-6 py-3 font-medium text-sm ${activeTab === 'submit' ? 'border-b-2 border-pink-500 text-pink-500' : 'text-gray-400 hover:text-gray-300'}`}
        >
          提交反馈
        </button>
        <button
          onClick={() => handleTabChange('mine')}
          className={`px-6 py-3 font-medium text-sm flex items-center ${activeTab === 'mine' ? 'border-b-2 border-pink-500 text-pink-500' : 'text-gray-400 hover:text-gray-300'}`}
        >
          我的反馈
          {stats.pending > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {stats.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('public')}
          className={`px-6 py-3 font-medium text-sm ${activeTab === 'public' ? 'border-b-2 border-pink-500 text-pink-500' : 'text-gray-400 hover:text-gray-300'}`}
        >
          精选反馈
        </button>
      </div>

      {/* 内容区域 */}
      {activeTab === 'submit' && (
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            提交反馈
          </h2>
          <p className="text-gray-400 mb-6">
            请详细描述您遇到的问题或建议，我们会认真阅读并尽快回复
          </p>
          {FeedbackFormComponent ? (
            <FeedbackFormComponent
              onSuccess={handleSubmitSuccess}
              hasPendingFeedback={hasPendingFeedback}
            />
          ) : (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
              <p className="text-gray-400 mt-2">加载反馈表单...</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Eye className="w-5 h-5" />
              我的反馈记录
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="text-sm text-gray-400 hover:text-white flex items-center disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
              <p className="text-gray-400 mt-2">加载中...</p>
            </div>
          ) : userFeedback.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">暂无反馈记录</p>
              <p className="text-sm text-gray-500 mt-1">
                快去提交第一条反馈吧！
              </p>
              <button
                onClick={() => setActiveTab('submit')}
                className="mt-4 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 rounded-lg text-white"
              >
                提交反馈
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 统计卡片 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
                  <div className="text-sm text-gray-400">待处理</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-500">{stats.replied}</div>
                  <div className="text-sm text-gray-400">已回复</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
                  <div className="text-sm text-gray-400">已解决</div>
                </div>
              </div>

              {/* 反馈列表 */}
              {userFeedback.map((feedback) => (
                <div key={feedback.id} className="glass rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{feedback.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(feedback.status)}`}>
                          {feedback.status === 'pending' ? '待处理' :
                            feedback.status === 'replied' ? '已回复' : '已解决'}
                        </span>
                        <span className="text-sm text-gray-400">
                          {formatDate(feedback.created_at)}
                        </span>
                      </div>
                    </div>
                    {feedback.rating && (
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i < feedback.rating!
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-400'
                              }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <p className="text-gray-300 whitespace-pre-wrap">{feedback.content}</p>
                  </div>

                  {feedback.admin_reply && (
                    <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-semibold">管理员回复</span>
                        <span className="text-xs text-gray-400">
                          {feedback.replied_at && formatDate(feedback.replied_at)}
                        </span>
                      </div>
                      <p className="text-gray-300 whitespace-pre-wrap">
                        {feedback.admin_reply}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'public' && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ThumbsUp className="w-5 h-5" />
              精选反馈
            </h2>
            <button
              onClick={handleRefresh}
              disabled={isLoadingPublic}
              className="text-sm text-gray-400 hover:text-white flex items-center disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingPublic ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>

          {isLoadingPublic ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
              <p className="text-gray-400 mt-2">加载中...</p>
            </div>
          ) : publicFeedback.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">暂无精选反馈</p>
              <p className="text-sm text-gray-500 mt-1">
                管理员会将有价值的反馈精选到这里
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {publicFeedback.map((feedback) => (
                <div key={feedback.id} className="glass rounded-xl p-6">
                  {feedback.is_featured && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Star className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">
                        置顶精选
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-xl mb-1">{feedback.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">
                          {feedback.user_nickname || '匿名用户'}
                        </span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-sm text-gray-400">
                          {formatDate(feedback.created_at)}
                        </span>
                      </div>
                    </div>
                    {feedback.rating && (
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${i < feedback.rating!
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-400'
                              }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mb-6">
                    <p className="text-gray-300 text-lg whitespace-pre-wrap">{feedback.content}</p>
                  </div>

                  {feedback.admin_reply && (
                    <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-lg">官方回复</div>
                          <div className="text-sm text-gray-400">
                            {feedback.replied_at && formatDate(feedback.replied_at)}
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-300 text-lg whitespace-pre-wrap">
                        {feedback.admin_reply}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 页面底部提示 */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>我们重视每一条反馈，通常会在1-3个工作日内回复</p>
        <p className="mt-1">
          如需紧急帮助，请联系邮箱：<a href="mailto:support@xiyi.asia" className="text-pink-500 hover:underline">support@xiyi.asia</a>
        </p>
        <div className="mt-4 text-xs text-gray-600">
          用户状态：已登录 | 检查次数：{authCheckCountRef.current}
        </div>
      </div>
    </div>
  );
}