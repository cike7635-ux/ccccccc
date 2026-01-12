// app\feedback\page.tsx
"use client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Star,
  CheckCircle,
  Clock,
  Eye,
  ThumbsUp,
  ChevronRight,
  AlertCircle,
  MessageCircle,
  Heart
} from 'lucide-react';
import FeedbackForm from '@/components/feedback-form';
import { toast } from 'sonner';
import Link from 'next/link';

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
  const [activeTab, setActiveTab] = useState('submit');
  const [userFeedback, setUserFeedback] = useState<Feedback[]>([]);
  const [publicFeedback, setPublicFeedback] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [hasPendingFeedback, setHasPendingFeedback] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    replied: 0,
    resolved: 0
  });

  useEffect(() => {
    // 简单检查用户是否登录
    useEffect(() => {
      // 只在客户端执行
      if (typeof window === 'undefined') return;

      const userEmail = localStorage.getItem('user_email');
      if (!userEmail) {
        router.push('/login?redirect=/feedback');
        return;
      }
      setUser({ email: userEmail });

      if (activeTab === 'mine') {
        loadUserFeedback();
      } else if (activeTab === 'public') {
        loadPublicFeedback();
      }
    }, [activeTab]);
  const loadUserFeedback = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/feedback/my');
      const result = await response.json();

      if (result.success) {
        setUserFeedback(result.data);
        setStats(result.stats);
        setHasPendingFeedback(result.stats.pending > 0);
      }
    } catch (error) {
      console.error('加载用户反馈失败:', error);
      toast.error('加载反馈失败');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPublicFeedback = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/feedback/public');
      const result = await response.json();

      if (result.success) {
        setPublicFeedback(result.data);
      }
    } catch (error) {
      console.error('加载公开反馈失败:', error);
      toast.error('加载公开反馈失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitSuccess = () => {
    setActiveTab('mine');
    loadUserFeedback();
    toast.success('反馈提交成功！我们会在3个工作日内回复您');
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
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 mb-4">
          <MessageSquare className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold mb-2">用户反馈</h1>
        <p className="text-gray-400">您的意见对我们非常重要，帮助我们改进产品</p>
      </div>

      {/* 警告提示 */}
      {hasPendingFeedback && (
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
          onClick={() => setActiveTab('submit')}
          className={`px-6 py-3 font-medium text-sm ${activeTab === 'submit' ? 'border-b-2 border-pink-500 text-pink-500' : 'text-gray-400'}`}
        >
          提交反馈
        </button>
        <button
          onClick={() => setActiveTab('mine')}
          className={`px-6 py-3 font-medium text-sm flex items-center ${activeTab === 'mine' ? 'border-b-2 border-pink-500 text-pink-500' : 'text-gray-400'}`}
        >
          我的反馈
          {stats.pending > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {stats.pending}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('public')}
          className={`px-6 py-3 font-medium text-sm ${activeTab === 'public' ? 'border-b-2 border-pink-500 text-pink-500' : 'text-gray-400'}`}
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
          <FeedbackForm
            onSuccess={handleSubmitSuccess}
            hasPendingFeedback={hasPendingFeedback}
          />
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Eye className="w-5 h-5" />
              我的反馈记录
            </h2>
            <button
              onClick={loadUserFeedback}
              disabled={isLoading}
              className="text-sm text-gray-400 hover:text-white"
            >
              刷新
            </button>
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
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <ThumbsUp className="w-5 h-5" />
            精选反馈
          </h2>

          {isLoading ? (
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
      </div>
    </div>
  );
}