'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function StartGameClient({ roomId, bothReady }: { roomId: string; bothReady: boolean }) {
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);

  const handleStartGame = useCallback(async () => {
    if (!bothReady || isLoadingRef.current) return;

    isLoadingRef.current = true;
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
        console.log('✅ 成功，等待RoomWatcher跳转到游戏页面');
        
        // 等待2秒后如果还没有跳转到游戏页面，就手动跳转
        setTimeout(() => {
          console.log('⏳ 2秒后手动跳转到游戏页面');
          router.push(data.redirectTo);
        }, 2000);
      } else {
        console.error('❌ 错误:', data);
        alert(data.error || '开始游戏失败');
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    } catch (error) {
      console.error('❌ 异常:', error);
      alert('网络错误');
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [bothReady, roomId, router]);

  const isDisabled = !bothReady || isLoading || isLoadingRef.current;

  return (
    <button
      onClick={handleStartGame}
      disabled={isDisabled}
      className={`w-full py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 ${
        bothReady && !isDisabled
          ? "gradient-primary glow-pink text-white hover:opacity-90"
          : "bg-white/10 text-white/50 cursor-not-allowed"
      }`}
    >
      {isDisabled && (isLoading || isLoadingRef.current) ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>处理中...</span>
        </>
      ) : (
        <span>{bothReady ? '开始游戏' : '等待双方选择主题'}</span>
      )}
    </button>
  );
}
