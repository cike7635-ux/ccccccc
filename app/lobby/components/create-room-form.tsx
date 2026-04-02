'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import ThemeSelect from './theme-select';
import { createRoom } from '../actions';
import { Users, Loader2 } from 'lucide-react';

interface CreateRoomFormProps {
  initialThemes?: any[];
}

export default function CreateRoomForm({ initialThemes }: CreateRoomFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    const themeId = formData.get('player1_theme_id') as string;

    if (!themeId) {
      setError('请选择主题');
      return;
    }

    startTransition(async () => {
      try {
        await createRoom(formData);
      } catch (e) {
        // 重定向错误，不需要处理
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <ThemeSelect
          id="player1_theme_id"
          name="player1_theme_id"
          label="选择主题"
          required
          initialThemes={initialThemes}
          onThemeSelect={() => setError(null)}
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-3">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full gradient-primary py-3.5 rounded-xl font-semibold glow-pink transition-all hover:scale-105 active:scale-95 text-white"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Users className="w-4 h-4 mr-2" />
        )}
        {isPending ? '创建中...' : '创建房间'}
      </Button>
    </form>
  );
}