// /components/feedback-form.tsx - 完整修复版本
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr'; // 🔥 添加这行
import { 
  AlertCircle, 
  Star, 
  MessageSquare,
  Bug,
  Lightbulb,
  HelpCircle,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// 🔥 添加Supabase客户端
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface FeedbackFormProps {
  onSuccess?: () => void;
  hasPendingFeedback?: boolean;
}

export default function FeedbackForm({ onSuccess, hasPendingFeedback = false }: FeedbackFormProps) {
  const router = useRouter();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general' as 'general' | 'bug' | 'suggestion' | 'question' | 'feature_request',
    rating: 0
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = [
    { value: 'bug', label: '问题反馈', icon: Bug, description: '报告程序错误或问题' },
    { value: 'suggestion', label: '功能建议', icon: Lightbulb, description: '提出改进建议' },
    { value: 'question', label: '使用疑问', icon: HelpCircle, description: '咨询使用方法' },
    { value: 'feature_request', label: '功能请求', icon: Zap, description: '请求新功能' },
    { value: 'general', label: '一般反馈', icon: MessageSquare, description: '其他反馈' }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleCategoryChange = (value: string) => {
    setFormData(prev => ({ ...prev, category: value as any }));
  };

  const handleRatingChange = (rating: number) => {
    setFormData(prev => ({ ...prev, rating }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = '请输入标题';
    } else if (formData.title.length < 2) {
      newErrors.title = '标题至少2个字符';
    } else if (formData.title.length > 100) {
      newErrors.title = '标题最多100个字符';
    }

    if (!formData.content.trim()) {
      newErrors.content = '请输入反馈内容';
    } else if (formData.content.length < 10) {
      newErrors.content = '内容至少10个字符';
    } else if (formData.content.length > 1000) {
      newErrors.content = '内容最多1000个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (hasPendingFeedback) {
      toast.error('您有待处理的反馈，请等待管理员回复后再提交新的反馈');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // 🔥 关键修复：获取当前会话
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('请先登录');
        setIsSubmitting(false);
        return;
      }

      console.log('🔑 发送token，长度:', session.access_token.length);
      
      // 提交反馈 - 必须发送Authorization头
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // 🔥 必须发送
        },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
          category: formData.category,
          rating: formData.rating > 0 ? formData.rating : undefined
        })
      });

      console.log('📨 API响应状态:', response.status);
      
      const result = await response.json();
      
      console.log('📨 API响应结果:', result);

      if (result.success) {
        // 重置表单
        setFormData({
          title: '',
          content: '',
          category: 'general',
          rating: 0
        });
        
        toast.success(result.message);
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(result.error || '提交失败，请重试');
      }
    } catch (error) {
      console.error('提交反馈失败:', error);
      toast.error('提交失败，请检查网络连接');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 分类选择 */}
      <div className="space-y-3">
        <Label>反馈类型</Label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {categories.map((category) => {
            const Icon = category.icon;
            const isSelected = formData.category === category.value;
            
            return (
              <button
                key={category.value}
                type="button"
                onClick={() => handleCategoryChange(category.value)}
                className={`flex flex-col items-center justify-center p-4 glass rounded-xl cursor-pointer transition-all hover:bg-white/5 ${
                  isSelected 
                    ? 'bg-gradient-to-r from-pink-500/20 to-purple-600/20 border border-pink-500/40' 
                    : ''
                }`}
              >
                <Icon className="w-5 h-5 mb-2" />
                <span className="text-sm font-medium">{category.label}</span>
                <span className="text-xs text-gray-400 mt-1 text-center">{category.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 标题输入 */}
      <div className="space-y-2">
        <Label htmlFor="title">标题 *</Label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={handleInputChange}
          placeholder="请简要描述反馈内容"
          disabled={isSubmitting}
          className={errors.title ? 'border-red-500' : ''}
        />
        {errors.title && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.title}
          </p>
        )}
      </div>

      {/* 内容输入 */}
      <div className="space-y-2">
        <Label htmlFor="content">详细描述 *</Label>
        <Textarea
          id="content"
          name="content"
          value={formData.content}
          onChange={handleInputChange}
          placeholder="请详细描述您遇到的问题或建议，我们会认真阅读并尽快回复"
          rows={6}
          disabled={isSubmitting}
          className={`resize-none ${errors.content ? 'border-red-500' : ''}`}
        />
        <div className="flex justify-between items-center">
          {errors.content ? (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.content}
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              {formData.content.length}/1000 字符
            </p>
          )}
          <p className="text-sm text-gray-400">
            剩余 {1000 - formData.content.length} 字符
          </p>
        </div>
      </div>

      {/* 评分（可选） */}
      <div className="space-y-2">
        <Label>满意度评分（可选）</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => handleRatingChange(star)}
              className="p-1 hover:scale-110 transition-transform"
              disabled={isSubmitting}
            >
              <Star
                className={`w-8 h-8 ${
                  star <= formData.rating
                    ? 'text-yellow-500 fill-yellow-500'
                    : 'text-gray-400'
                }`}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-400">
            {formData.rating === 0 ? '请选择评分' : `${formData.rating}星`}
          </span>
        </div>
      </div>

      {/* 提交按钮 */}
      <div className="pt-4">
        {hasPendingFeedback ? (
          <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-yellow-500 mr-2" />
              <div>
                <p className="text-yellow-500 font-medium">无法提交新反馈</p>
                <p className="text-sm text-yellow-600/80 mt-1">
                  您有待处理的反馈，请等待管理员回复后再提交新的反馈
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-6 text-lg bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                提交中...
              </>
            ) : (
              '提交反馈'
            )}
          </Button>
        )}
        
        <p className="text-sm text-gray-400 text-center mt-3">
          提交即表示您同意我们的反馈政策。我们通常会在1-3个工作日内回复。
        </p>
      </div>
    </form>
  );
}