'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import GameView from "@/components/game-view";
import { logger } from '@/lib/utils/logger';

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
      logger.log('🔍 获取活跃游戏会话');

      // 检查缓存
      const now = Date.now();
      if (!ignoreCache && sessionCache && (now - cacheTimestamp) < CACHE_DURATION) {
        logger.log('💾 使用缓存的游戏会话');
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
        logger.error('获取游戏会话失败:', error.message);
        return null;
      }

      if (data && data.length > 0) {
        logger.log('🎲 找到进行中的游戏:', data[0].id);
        sessionCache = data[0];
        cacheTimestamp = now;
        return data[0];
      }

      // 如果没有找到进行中的游戏，尝试查找最近结束的游戏
      logger.log('ℹ️ 没有进行中的游戏，尝试查找最近结束的游戏');
      const { data: endedData, error: endedError } = await supabase
        .from('game_sessions')
        .select('*')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .order('started_at', { ascending: false })
        .limit(1);

      if (endedError) {
        logger.error('获取最近游戏会话失败:', endedError.message);
        return null;
      }

      if (endedData && endedData.length > 0) {
        logger.log('🕒 找到最近结束的游戏:', endedData[0].id);
        sessionCache = endedData[0];
        cacheTimestamp = now;
        return endedData[0];
      }

      return null;
    } catch (error) {
      logger.error('获取游戏会话异常:', error);
      return null;
    }
  }, [supabase]);

  // 🔥 清理订阅和缓存
  const cleanupSubscriptions = useCallback(() => {
    logger.log('🧹 清理父组件订阅');
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
      logger.log('无法获取胜者信息:', e);
    }
    return null;
  }, [supabase]);

  // 🔥 初始化 - 只执行一次
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    logger.log('🎮 游戏页面初始化');

    let gameSessionChannel: any = null;
    let pollInterval: any = null;

    const initialize = async () => {
      try {
        // 1. 获取当前用户（这里已经在服务端检查过了，但客户端也检查一下更安全）
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          logger.warn('用户未登录，跳转到登录页');
          router.push('/login');
          return;
        }

        logger.log('✅ 用户已登录:', user.id);
        setUserId(user.id);

        // 2. 如果有 initialSession，优先使用
        if (initialSession) {
          logger.log('🎲 使用服务端传递的游戏会话:', initialSession.id, '状态:', initialSession.status);
          setSession(initialSession);

          // 检查游戏是否已经结束
          if (initialSession.status === 'completed') {
            logger.log('⏹️ 游戏已结束，不建立实时订阅');
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
          logger.log('🎲 找到游戏会话:', activeSession.id, '状态:', activeSession.status);
          setSession(activeSession);

          // 🔥 检查游戏是否已经结束
          if (activeSession.status === 'completed') {
            logger.log('⏹️ 游戏已结束，不建立实时订阅');
            setGameEnded(true);
            // 获取胜者信息
            const winnerName = await fetchWinnerInfo(activeSession);
            setWinner(winnerName);
          }
          setIsLoading(false);
          return;
        }

        // 4. 没有找到游戏会话，建立监听 + 轮询
        logger.log('ℹ️ 暂无游戏会话，开始监听游戏会话创建...');
        setIsLoading(false);

        // 🔥 建立实时订阅监听游戏会话创建
        gameSessionChannel = supabase
          .channel('game_session_watch')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'game_sessions'
            },
            async (payload) => {
              logger.log('🎲 检测到新游戏会话创建:', payload.new);
              const newSession = payload.new as any;
              if ((newSession.player1_id === user.id || newSession.player2_id === user.id) && newSession.status === 'playing') {
                logger.log('🎲 这是我的游戏会话，开始游戏！');
                setSession(newSession);
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'game_sessions'
            },
            async (payload) => {
              logger.log('🎲 检测到游戏会话更新:', payload.new);
              const updatedSession = payload.new as any;
              if ((updatedSession.player1_id === user.id || updatedSession.player2_id === user.id) && updatedSession.status === 'playing') {
                logger.log('🎲 这是我的游戏会话，开始游戏！');
                setSession(updatedSession);
              }
            }
          )
          .subscribe();

        // 🔥 同时启动轮询（每2秒检查一次，双重保障）
        pollInterval = setInterval(async () => {
          logger.log('🔍 轮询检查游戏会话...');
          const session = await fetchActiveSession(user.id, true);
          if (session && session.status === 'playing') {
            logger.log('🎲 轮询找到游戏会话:', session.id);
            setSession(session);
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }, 2000);

      } catch (error) {
        logger.error('初始化失败:', error);
        setError('页面加载失败，请刷新重试');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      logger.log('🧹 游戏页面清理');
      if (gameSessionChannel) {
        supabase.removeChannel(gameSessionChannel);
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      cleanupSubscriptions();
    };
  }, [router, supabase, fetchActiveSession, cleanupSubscriptions, fetchWinnerInfo, initialSession]);

  // 🔥 移除父组件实时订阅，避免双重订阅 - 子组件会通过回调通知游戏结束

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

  // 🔥 子组件回调：游戏结束时调用
  const handleGameEndFromChild = useCallback((winnerName?: string) => {
    logger.log('🎉 收到子组件游戏结束通知');
    setGameEnded(true);
    if (winnerName) {
      setWinner(winnerName);
    }
    // 清理缓存，强制重新获取
    sessionCache = null;
    cacheTimestamp = 0;
  }, []);

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
        onGameEnd={handleGameEndFromChild}
      />
    </div>
  );
}
