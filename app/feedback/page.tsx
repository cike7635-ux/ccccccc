"use client";

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import {
    MessageSquare,
    Star,
    CheckCircle,
    Clock,
    Eye,
    ThumbsUp,
    Filter,
    ChevronRight,
    AlertCircle,
    MessageCircle,
    Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import FeedbackForm from '@/components/feedback-form';
import { toast } from 'sonner';
import Link from 'next/link';

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
    user_nickname: string;
}

export default function FeedbackPage() {
    const router = useRouter();
    const supabase = createClientComponentClient();

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

    // 检查用户登录状态
    useEffect(() => {
        checkUser();
    }, []);

    // 根据当前标签页加载数据
    useEffect(() => {
        if (user && activeTab === 'mine') {
            loadUserFeedback();
        } else if (activeTab === 'public') {
            loadPublicFeedback();
        }
    }, [activeTab, user]);

    const checkUser = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                router.push('/login?redirect=/feedback');
                return;
            }

            setUser(session.user);
        } catch (error) {
            console.error('检查用户状态失败:', error);
        }
    };

    const loadUserFeedback = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch('/api/feedback/my', {
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });

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
            case 'pending': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
            case 'replied': return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
            case 'resolved': return 'bg-green-500/20 text-green-600 border-green-500/30';
            default: return 'bg-gray-500/20 text-gray-600 border-gray-500/30';
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

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'bug': return 'bg-red-500/20 text-red-600 border-red-500/30';
            case 'suggestion': return 'bg-purple-500/20 text-purple-600 border-purple-500/30';
            case 'question': return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
            case 'feature_request': return 'bg-green-500/20 text-green-600 border-green-500/30';
            default: return 'bg-gray-500/20 text-gray-600 border-gray-500/30';
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

            {/* 主标签页 */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3 mb-8">
                    <TabsTrigger value="submit" className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        提交反馈
                    </TabsTrigger>
                    <TabsTrigger value="mine" className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        我的反馈
                        {stats.pending > 0 && (
                            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                                {stats.pending}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="public" className="flex items-center gap-2">
                        <ThumbsUp className="w-4 h-4" />
                        精选反馈
                    </TabsTrigger>
                </TabsList>

                {/* 提交反馈标签页 */}
                <TabsContent value="submit">
                    <Card className="border-0 glass">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="w-5 h-5" />
                                提交反馈
                            </CardTitle>
                            <CardDescription>
                                请详细描述您遇到的问题或建议，我们会认真阅读并尽快回复
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Suspense fallback={<div>加载表单...</div>}>
                                <FeedbackForm
                                    onSuccess={handleSubmitSuccess}
                                    hasPendingFeedback={hasPendingFeedback}
                                />
                            </Suspense>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 我的反馈标签页 */}
                <TabsContent value="mine">
                    <Card className="border-0 glass">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Eye className="w-5 h-5" />
                                    我的反馈记录
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={loadUserFeedback}
                                    disabled={isLoading}
                                >
                                    刷新
                                </Button>
                            </CardTitle>
                            <CardDescription>
                                查看您提交的反馈及其处理状态
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
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
                                        <div key={feedback.id} className="glass rounded-xl p-4">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-semibold text-lg">{feedback.title}</h3>
                                                        <Badge className={getStatusColor(feedback.status)}>
                                                            <span className="flex items-center gap-1">
                                                                {getStatusIcon(feedback.status)}
                                                                {feedback.status === 'pending' ? '待处理' :
                                                                    feedback.status === 'replied' ? '已回复' : '已解决'}
                                                            </span>
                                                        </Badge>
                                                        <Badge variant="outline" className={getCategoryColor(feedback.category)}>
                                                            {feedback.category === 'bug' ? '问题反馈' :
                                                                feedback.category === 'suggestion' ? '功能建议' :
                                                                    feedback.category === 'question' ? '使用疑问' : '功能请求'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-gray-400">
                                                        提交时间: {formatDate(feedback.created_at)}
                                                    </p>
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
                                                <>
                                                    <Separator className="my-4" />
                                                    <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg p-4">
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
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 精选反馈标签页 */}
                <TabsContent value="public">
                    <Card className="border-0 glass">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ThumbsUp className="w-5 h-5" />
                                精选反馈
                            </CardTitle>
                            <CardDescription>
                                查看其他用户的精选反馈和官方回复
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
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
                                                        <Badge variant="outline" className={getCategoryColor(feedback.category)}>
                                                            {feedback.category === 'bug' ? '问题反馈' :
                                                                feedback.category === 'suggestion' ? '功能建议' :
                                                                    feedback.category === 'question' ? '使用疑问' : '功能请求'}
                                                        </Badge>
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
                                                <>
                                                    <Separator className="my-6" />
                                                    <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl p-5">
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
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

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