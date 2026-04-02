'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import GameView from "@/components/game-view";

// 🔥 简单的缓存机制
let sessionCache: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5秒缓存

// 🔥 简单的加载组件
const LoadingSpinner = () => (
  <div className="flex flex-col items-center gap-4">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-pink mx-auto mb-4"></div>
    <p className="text-sm text-gray-400">加载游戏中...</p>
  </div>
);

// 🔥 无游戏会话的组件
const NoActiveGame = () => (
  <div className="w-full max-w-md grid gap-6 text-center">
    <div className="space-y-2">
      <h2 className="text-xl font-bold">暂无进行中的游戏</h2>
      <p className="text-sm text-gray-400">
        请在大厅创建或加入房间并开始游戏
      </p>
    </div>
    <div>
      <Button asChild>
        <Link href="/lobby">返回大厅</Link>
      </Button>
    </div>
  </div>
);

// 🔥 游戏结束组件
const GameEndedState = ({ winner }: { winner?: string }) => (
  <div className="w-full max-w-md grid gap-6 text-center">
    <div className="space-y-2">
      <h2 className="text-xl font-bold">游戏已结束</h2>
      <p className="text-sm text-gray-400">
        {winner ? `胜者: ${winner}` : "游戏已经结束，可以返回大厅开始新的游戏"}
      </p>
    </div>
    <div>
      <Button asChild>
        <Link href="/lobby">返回大厅</Link>
      </Button>
    </div>
  </div>
);

// 🔥 错误状态组件
const ErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="w-full max-w-md grid gap-6 text-center">
    <div className="space-y-2">
      <h2 className="text-xl font-bold">加载失败</h2>
      <p className="text-sm text-gray-400">{error}</p>
    </div>
    <div className="flex gap-3 justify-center">
      <Button onClick={onRetry} variant="outline">
        重试
      </Button>
      <Button asChild>
        <Link href="/lobby">返回大厅</Link>
      </Button>
    </div>
  </div>
);

export default function GameClient({ initialSession }: { initialSession?: any }) {
  const router = useRouter();
  const supabase = createClient();

  const [session, setSession] = useState<any>(initialSession || null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialSession);
  const [error, setError] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [winner, setWinner] = useState<string | null>(null);

  const isInitializedRef = useRef(false);
  const lastFetchRef = useRef<number>(0);
  const subscriptionRef = useRef<any>(null);

  // 🔥 获取活跃会话的客户端版本
  const fetchActiveSession = useCallback(async (userId: string, ignoreCache: boolean = false) => {
    try {
      console.log('🔍 获取活跃游戏会话');

      // 检查缓存
      const now = Date.now();
      if (!ignoreCache && sessionCache && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log('💾 使用缓存的游戏会话');
        return sessionCache;
      }

      const { data, error } = await supabase
        .from('game_sessions')
        .select('*')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq('status', 'playing')
        .order('started_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('获取游戏会话失败:', error.message);
        return null;
      }

      if (data && data.length > 0) {
        console.log('🎲 找到进行中的游戏:', data[0].id);
        sessionCache = data[0];
        cacheTimestamp = now;
        return data[0];
      }

      // 如果没有找到进行中的游戏，尝试查找最近结束的游戏
      console.log('ℹ️ 没有进行中的游戏，尝试查找最近结束的游戏');
      const { data: endedData, error: endedError } = await supabase
        .from('game_sessions')
        .select('*')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .order('started_at', { ascending: false })
        .limit(1);

      if (endedError) {
        console.error('获取最近游戏会话失败:', endedError.message);
        return null;
      }

      if (endedData && endedData.length > 0) {
        console.log('🕒 找到最近结束的游戏:', endedData[0].id);
        sessionCache = endedData[0];
        cacheTimestamp = now;
        return endedData[0];
      }

      return null;
    } catch (error) {
      console.error('获取游戏会话异常:', error);
      return null;
    }
  }, [supabase]);

  // 🔥 清理订阅和缓存
  const cleanupSubscriptions = useCallback(() => {
    console.log('🧹 清理父组件订阅');
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
    sessionCache = null;
    cacheTimestamp = 0;
  }, [supabase]);

  // 🔥 获取胜者信息的函数
  const fetchWinnerInfo = useCallback(async (sessionData: any) => {
    try {
      const gs = sessionData.game_state ?? {};
      const boardSize = gs.board_size ?? 49;
      const p1Pos = gs.player1_position ?? 0;
      const p2Pos = gs.player2_position ?? 0;

      if (p1Pos >= boardSize - 1) {
        const { data: p1Profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', sessionData.player1_id)
          .single();
        return p1Profile?.nickname || '玩家 1';
      } else if (p2Pos >= boardSize - 1) {
        const { data: p2Profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', sessionData.player2_id)
          .single();
        return p2Profile?.nickname || '玩家 2';
      }
    } catch (e) {
      console.log('无法获取胜者信息:', e);
    }
    return null;
  }, [supabase]);

  // 🔥 初始化 - 只执行一次
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    console.log('🎮 游戏页面初始化');

    const initialize = async () => {
      try {
        // 1. 获取当前用户（这里已经在服务端检查过了，但客户端也检查一下更安全）
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          console.warn('用户未登录，跳转到登录页');
          router.push('/login');
          return;
        }

        console.log('✅ 用户已登录:', user.id);
        setUserId(user.id);

        // 2. 如果有 initialSession，优先使用
        if (initialSession) {
          console.log('🎲 使用服务端传递的游戏会话:', initialSession.id, '状态:', initialSession.status);
          setSession(initialSession);

          // 检查游戏是否已经结束
          if (initialSession.status === 'completed') {
            console.log('⏹️ 游戏已结束，不建立实时订阅');
            setGameEnded(true);
            // 获取胜者信息
            const winnerName = await fetchWinnerInfo(initialSession);
            setWinner(winnerName);
          }
          setIsLoading(false);
          return;
        }

        // 3. 没有 initialSession，获取活跃会话
        const activeSession = await fetchActiveSession(user.id);

        if (activeSession) {
          console.log('🎲 找到游戏会话:', activeSession.id, '状态:', activeSession.status);
          setSession(activeSession);

          // 🔥 检查游戏是否已经结束
          if (activeSession.status === 'completed') {
            console.log('⏹️ 游戏已结束，不建立实时订阅');
            setGameEnded(true);
            // 获取胜者信息
            const winnerName = await fetchWinnerInfo(activeSession);
            setWinner(winnerName);
          }
        } else {
          console.log('ℹ️ 暂无游戏会话');
        }

      } catch (error) {
        console.error('初始化失败:', error);
        setError('页面加载失败，请刷新重试');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      console.log('🧹 游戏页面清理');
      cleanupSubscriptions();
    };
  }, [router, supabase, fetchActiveSession, cleanupSubscriptions, fetchWinnerInfo, initialSession]);

  // 🔥 🔥 修复：简化的实时监听 - 只在游戏进行中且未结束时建立
  useEffect(() => {
    // 清理旧的订阅
    cleanupSubscriptions();

    if (!userId || !session?.id || gameEnded || session?.status === 'completed') {
      console.log('⏹️ 不建立父组件实时订阅:', {
        hasUserId: !!userId,
        hasSessionId: !!session?.id,
        gameEnded,
        sessionStatus: session?.status
      });
      return;
    }

    console.log(`📡 父组件监听游戏会话变化: ${session.id}`);

    const channel = supabase
      .channel(`game_page_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${session.id}`
        },
        // 🔥 修复：将回调函数改为 async
        async (payload) => {
          console.log('⚡ 父组件收到游戏会话更新');

          const newSession = payload.new as any;

          // 🔥 关键修复：游戏结束时停止所有订阅和更新
          if (newSession.status === 'completed') {
            console.log('🎉 父组件检测到游戏结束');
            setGameEnded(true);

            // 获取胜者信息
            const winnerName = await fetchWinnerInfo(newSession);
            setWinner(winnerName);

            // 清理缓存，强制重新获取
            sessionCache = null;
            cacheTimestamp = 0;

            return;
          }

          // 更新会话状态
          setSession(newSession);
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      console.log('🧹 父组件取消订阅');
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, session?.id, gameEnded, session?.status, supabase, fetchWinnerInfo, cleanupSubscriptions]);

  // 🔥 重新获取会话
  const handleRefresh = useCallback(async () => {
    if (userId) {
      const session = await fetchActiveSession(userId, true);
      if (session) {
        setSession(session);
        if (session.status === 'completed') {
          setGameEnded(true);
          const winnerName = await fetchWinnerInfo(session);
          setWinner(winnerName);
        }
      }
    }
  }, [userId, fetchActiveSession, fetchWinnerInfo]);

  // 🔥 重新开始按钮点击处理
  const handlePlayAgain = useCallback(() => {
    // 清理缓存和订阅
    sessionCache = null;
    cacheTimestamp = 0;
    cleanupSubscriptions();
    setSession(null);
    setGameEnded(false);
    setWinner(null);
    // 重新初始化
    isInitializedRef.current = false;
    handleRefresh();
  }, [cleanupSubscriptions, handleRefresh]);

  // 🔥 渲染游戏内容
  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={handleRefresh} />;
  }

  if (!session || !userId) {
    return <NoActiveGame />;
  }

  if (gameEnded || session.status === 'completed') {
    return <GameEndedState winner={winner || undefined} />;
  }

  return (
    <div className="min-h-svh">
      <GameView
        key={session?.id}
        session={session}
        userId={userId}
        onGameEnd={handlePlayAgain}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
