'use client';

import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteTheme } from '@/app/themes/actions';
import { useRouter } from 'next/navigation';

interface DeleteThemeButtonProps {
  themeId: string;
  themeTitle: string;
  onDelete?: () => void;
}

export default function DeleteThemeButton({ themeId, themeTitle, onDelete }: DeleteThemeButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`确定要删除主题 "${themeTitle}" 吗？\n\n这将删除该主题下的所有任务，此操作不可撤销！`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('id', themeId);
      await deleteTheme(formData);
      
      // 刷新页面数据
      if (onDelete) {
        onDelete();
      }
      
      // 重新加载页面
      router.refresh();
      
    } catch (error: any) {
      setError(error.message || '删除失败，请重试');
      console.error('删除主题失败:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative">
      <Button
        onClick={handleDelete}
        disabled={isDeleting}
        variant="ghost"
        size="icon"
        className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
        aria-label="删除主题"
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </Button>
      
      {error && (
        <div className="absolute top-full left-0 mt-1 bg-red-500/10 border border-red-500/20 rounded-lg p-2 z-10 min-w-[200px]">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
