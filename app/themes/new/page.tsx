'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createTheme } from "../actions";

export default function NewThemePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('主题标题不能为空');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('is_public', 'false'); // 默认不公开
      
      const result = await createTheme(formData);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // 创建成功，跳转到主题详情页
      router.push(`/themes/${result.data?.id}`);
      
    } catch (err: any) {
      console.error('创建主题失败:', err);
      setError(err.message || '创建主题失败，请重试');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-svh flex flex-col p-6 pb-24">
      <div className="flex items-center justify-between mb-6 pt-4">
        <Link 
          href="/themes" 
          className="w-10 h-10 glass rounded-xl flex items-center justify-center hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-xl font-bold">创建新主题</h2>
        <div className="w-10" />
      </div>

      <div className="glass rounded-2xl p-6">
        <p className="text-sm text-gray-400 mb-6">
          创建一个新的任务主题，可以包含多个相关任务
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="block text-sm text-gray-300 mb-2">
              主题标题 *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：甜蜜约会、运动打卡"
              required
              className="glass border-white/10 bg-white/5 text-white placeholder-gray-500"
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="description" className="block text-sm text-gray-300 mb-2">
              主题描述
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full glass rounded-xl border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-brand-pink transition-colors"
              placeholder="简单描述该主题的使用场景和包含的任务类型"
              maxLength={500}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button
              type="button"
              onClick={() => router.back()}
              className="flex-1 glass py-3 rounded-xl font-medium hover:bg-white/10 transition-all"
              disabled={loading}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="flex-1 gradient-primary py-3 rounded-xl font-semibold glow-pink text-white"
              disabled={loading || !title.trim()}
            >
              {loading ? '创建中...' : '创建主题'}
            </Button>
          </div>
        </form>
      </div>

      <div className="mt-6 glass rounded-xl p-4">
        <h3 className="text-sm font-semibold mb-2 flex items-center">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-pink mr-2"></span>
          提示
        </h3>
        <ul className="text-xs text-gray-400 space-y-1.5 ml-3.5">
          <li>• 创建主题后可以在主题详情页添加任务</li>
          <li>• 每个主题可以包含多个相关任务</li>
          <li>• 游戏中会根据选择的主题随机抽取任务</li>
          <li>• 可以使用 AI 功能快速生成任务建议</li>
        </ul>
      </div>
    </div>
  );
}