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
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand-pink border-t-transparent"></div>
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

export default function GamePage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [session, setSession] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
        .limit(1)
        .single();
      
      if (error) {
        // 如果没有找到进行中的游戏，尝试查找最近结束的游戏
        if (error.code === 'PGRST116') {
          console.log('ℹ️ 没有进行中的游戏，尝试查找最近结束的游戏');
          const { data: endedData } = await supabase
            .from('game_sessions')
            .select('*')
            .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
            .order('started_at', { ascending: false })
            .limit(1)
            .single();
          
          if (endedData) {
            console.log('🕒 找到最近结束的游戏:', endedData.id);
            return endedData;
          }
        }
        console.error('获取游戏会话失败:', error.message);
        return null;
      }
      
      // 更新缓存
      sessionCache = data;
      cacheTimestamp = now;
      
      return data;
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
        // 1. 获取当前用户
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          console.warn('用户未登录，跳转到登录页');
          router.push('/login');
          return;
        }
        
        console.log('✅ 用户已登录:', user.id);
        setUserId(user.id);
        
        // 2. 检查会员有效期
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('account_expires_at')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('获取用户资料失败:', profileError.message);
          setError('无法获取用户信息');
          setIsLoading(false);
          return;
        }
        
        const isExpired = !profile?.account_expires_at || new Date(profile.account_expires_at) < new Date();
        if (isExpired) {
          console.warn('会员已过期，跳转到过期页面');
          router.push('/account-expired');
          return;
        }
        
        console.log('✅ 会员状态正常');
        
        // 3. 获取活跃会话
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
  }, [router, supabase, fetchActiveSession, cleanupSubscriptions, fetchWinnerInfo]);

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
            
            // 清理订阅
            cleanupSubscriptions();
            
            // 更新会话状态（但不再重新获取）
            setSession(newSession);
            
            // 获取胜者信息
            try {
              const winnerName = await fetchWinnerInfo(newSession);
              setWinner(winnerName);
            } catch (e) {
              console.log('获取胜者信息失败:', e);
            }
          }
          // 其他状态更新时不重新获取会话
          else if (newSession.status !== 'playing') {
            console.log(`ℹ️ 游戏状态变为: ${newSession.status}，更新会话但不重新获取`);
            setSession(newSession);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 父组件订阅状态: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ 父组件订阅连接成功');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.log(`ℹ️ 父组件订阅断开: ${status}`);
        }
      });
    
    subscriptionRef.current = channel;
    
    return () => {
      cleanupSubscriptions();
    };
  }, [supabase, session?.id, userId, gameEnded, cleanupSubscriptions, fetchWinnerInfo]);

  // 🔥 重试获取会话
  const handleRetry = async () => {
    setIsLoading(true);
    setError(null);
    setGameEnded(false);
    setWinner(null);
    
    if (userId) {
      const activeSession = await fetchActiveSession(userId, true); // 忽略缓存
      setSession(activeSession);
    }
    
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <ErrorState error={error} onRetry={handleRetry} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <NoActiveGame />
      </div>
    );
  }

  // 🔥 游戏结束时显示结束界面
  if (gameEnded || session.status === 'completed') {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <GameEndedState winner={winner || undefined} />
      </div>
    );
  }

  // 🔥 关键：游戏进行中时传递GameView
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <GameView key={session.id} session={session} userId={userId!} />
    </div>
  );
}