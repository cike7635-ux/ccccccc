"use client";

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle,
  MessageSquare,
  Star,
  Send,
  Loader2
} from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface FeedbackFormProps {
  onSuccess: () => void;
  hasPendingFeedback: boolean;
}

export default function FeedbackForm({ onSuccess, hasPendingFeedback }: FeedbackFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [rating, setRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    getSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (hasPendingFeedback) {
      toast.error('您有待处理的反馈，请等待管理员回复后再提交新的反馈');
      return;
    }

    if (!title.trim() || title.length < 2) {
      toast.error('标题至少需要2个字符');
      return;
    }

    if (!content.trim() || content.length < 10) {
      toast.error('内容至少需要10个字符');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!session) {
        toast.error('请先登录');
        return;
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category,
          rating: rating || null
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success('反馈提交成功！');
        setTitle('');
        setContent('');
        setCategory('general');
        setRating(null);
        onSuccess();
      } else {
        toast.error(result.error || '提交失败，请重试');
      }
    } catch (error) {
      console.error('提交反馈失败:', error);
      toast.error('网络错误，请检查连接后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-400">请先登录以提交反馈</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 标题输入 */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-2">
          标题 *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="简要描述您的反馈内容"
          className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          required
          maxLength={200}
        />
        <p className="text-xs text-gray-500 mt-1">标题长度：{title.length}/200</p>
      </div>

      {/* 分类选择 */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
          分类
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
        >
          <option value="general" className="bg-gray-800">一般反馈</option>
          <option value="bug" className="bg-gray-800">问题反馈</option>
          <option value="suggestion" className="bg-gray-800">功能建议</option>
          <option value="question" className="bg-gray-800">使用疑问</option>
          <option value="feature_request" className="bg-gray-800">功能请求</option>
        </select>
      </div>

      {/* 评分选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          满意度评分（可选）
        </label>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star === rating ? null : star)}
              className="p-1 hover:scale-110 transition-transform"
            >
              <Star
                className={`w-8 h-8 ${
                  rating && star <= rating
                    ? 'text-yellow-500 fill-yellow-500'
                    : 'text-gray-400'
                }`}
              />
            </button>
          ))}
          <span className="text-sm text-gray-400 ml-2">
            {rating ? `您给了 ${rating} 星` : '请点击星星评分'}
          </span>
        </div>
      </div>

      {/* 内容输入 */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-300 mb-2">
          详细内容 *
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="请详细描述您遇到的问题、建议或想法..."
          rows={6}
          className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none whitespace-pre-wrap break-words"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          内容长度：{content.length} 字符（最少10个）
        </p>
      </div>

      {/* 提交按钮 */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting || hasPendingFeedback}
          className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 ${
            hasPendingFeedback
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 text-white'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              提交反馈
            </>
          )}
        </button>
        
        {hasPendingFeedback && (
          <p className="text-sm text-yellow-500 mt-2 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            您有待处理的反馈，请等待管理员回复后再提交新的反馈
          </p>
        )}
        
        <p className="text-xs text-gray-500 mt-3">
          💡 提示：请尽量详细描述问题，提供截图或步骤说明，这样我们能更快为您解决问题。
        </p>
      </div>
    </form>
  );
}