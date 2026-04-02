'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StartGameClient({ roomId, bothReady }: { roomId: string; bothReady: boolean }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleStartGame = async () => {
    if (!bothReady || isLoading) return;

    setIsLoading(true);
    console.log('🚀 开始游戏 clicked, roomId:', roomId);

    try {
      const formData = new FormData();
      formData.append('room_id', roomId);

      const response = await fetch('/api/start-game', {
        method: 'POST',
        body: formData,
      });

      console.log('📝 response:', response.ok, response.status);

      const data = await response.json();

      if (response.ok && data.success) {
        console.log('✅ 成功，跳转到', data.redirectTo);
        router.push(data.redirectTo);
      } else {
        console.error('❌ 错误:', data);
        alert(data.error || '开始游戏失败');
      }
    } catch (error) {
      console.error('❌ 异常:', error);
      alert('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleStartGame}
      disabled={!bothReady || isLoading}
      className={`w-full py-4 rounded-2xl font-semibold transition-all ${
        bothReady && !isLoading
          ? "gradient-primary glow-pink text-white hover:opacity-90"
          : "bg-white/10 text-white/50 cursor-not-allowed"
      }`}
    >
      {isLoading ? '处理中...' : bothReady ? '开始游戏' : '等待双方选择主题'}
    </button>
  );
}
