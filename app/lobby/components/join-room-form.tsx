'use client';

import { useState, useTransition } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import ThemeSelect from './theme-select';
import RoomCodeInput from '@/components/room-code-input';
import { joinRoom } from '../actions';
import { LogIn, Loader2 } from 'lucide-react';

interface JoinRoomFormProps {
  initialThemes?: any[];
}

export default function JoinRoomForm({ initialThemes }: JoinRoomFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (formData: FormData) => {
    setError(null);

    const themeId = formData.get('player2_theme_id') as string;
    const roomCode = formData.get('room_code') as string;

    if (!themeId) {
      setError('请选择主题');
      return;
    }

    if (!roomCode || roomCode.trim() === '') {
      setError('请输入房间码');
      return;
    }

    startTransition(async () => {
      try {
        await joinRoom(formData);
      } catch (e) {
        // 重定向错误，不需要处理
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <div>
        <ThemeSelect
          id="player2_theme_id"
          name="player2_theme_id"
          label="选择主题"
          initialThemes={initialThemes}
          onThemeSelect={() => setError(null)}
        />
      </div>

      <div>
        <Label className="block text-sm text-gray-300 mb-2">房间码</Label>
        <RoomCodeInput
          id="room_code"
          name="room_code"
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
        className="w-full gradient-secondary py-3.5 rounded-xl font-semibold glow-blue transition-all hover:scale-105 active:scale-95 text-white"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <LogIn className="w-4 h-4 mr-2" />
        )}
        {isPending ? '加入中...' : '加入房间'}
      </Button>
    </form>
  );
}