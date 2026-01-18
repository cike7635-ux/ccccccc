'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Theme {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

export default function EditThemePage() {
  const params = useParams();
  const router = useRouter();
  const themeId = params.id as string;
  
  const [theme, setTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  });

  useEffect(() => {
    // 模拟获取主题数据
    const fetchTheme = async () => {
      try {
        setLoading(true);
        // 这里应该是实际的 API 调用
        const mockTheme: Theme = {
          id: themeId,
          title: `主题 ${themeId.slice(0, 8)}`,
          description: '这是一个示例主题描述',
          createdAt: new Date().toISOString()
        };
        
        setTheme(mockTheme);
        setFormData({
          title: mockTheme.title,
          description: mockTheme.description
        });
      } catch (error) {
        console.error('获取主题失败:', error);
      } finally {
        setLoading(false);
      }
    };

    if (themeId) {
      fetchTheme();
    }
  }, [themeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // 模拟保存操作
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('保存主题:', { ...formData, id: themeId });
      
      // 保存成功后返回主题列表
      router.push('/themes');
    } catch (error) {
      console.error('保存主题失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">加载中...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-500">主题不存在</div>
            <Button onClick={() => router.push('/themes')} className="mt-4">
              返回主题列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">编辑主题</h1>
        <p className="text-gray-400">修改主题信息</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title" className="text-white">
                主题标题
              </Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="请输入主题标题"
                className="mt-1 bg-gray-800 border-gray-700 text-white"
                required
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-white">
                主题描述
              </Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="请输入主题描述"
                rows={4}
                className="mt-1 bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {saving ? '保存中...' : '保存更改'}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/themes')}
                disabled={saving}
              >
                取消
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}