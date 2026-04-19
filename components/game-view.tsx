"use client";

import { useEffect, useMemo, useState, useTransition, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { rollDice, confirmTaskExecution, verifyTask } from "@/app/game/actions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Settings, MapPin, Heart, Zap, Trophy, Dice6, MessageSquareHeart, Plane, PlaneTakeoff, Rocket } from "lucide-react";

// 简单的LRU缓存实现
class LRUCache {
  cache: Map<string, number>;
  maxSize: number;
  
  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
  
  set(key: string): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, Date.now());
  }
}

type GameSession = {
  id: string;
  room_id: string;
  player1_id: string;
  player2_id: string;
  current_player_id: string | null;
  current_turn: number;
  status: string;
  game_state: {
    player1_position?: number;
    player2_position?: number;
    board_size?: number;
    special_cells?: Record<number, string>;
    pending_task?: {
      type: "star" | "trap" | "collision";
      position: number;
      executor_id: string;
      observer_id: string;
      status: "pending" | "executed";
      task?: { id: string; description: string; type?: string } | null;
      metadata?: { dice?: number; attacker_old_position?: number; penalty?: number };
    };
  } | null;
};

export default function GameView({ session, userId, onGameEnd }: { session: GameSession; userId: string; onGameEnd?: (winner?: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();

  // ========== 第一步：先定义所有 useRef ==========
  const stateRef = useRef({
    player1Pos: Number(session.game_state?.player1_position ?? 0),
    player2Pos: Number(session.game_state?.player2_position ?? 0),
    pendingTask: session.game_state?.pending_task ?? null,
    status: session.status,
    currentPlayerId: session.current_player_id ?? null,
    currentTurn: session.current_turn ?? 1,
    specialCells: session.game_state?.special_cells ?? {},
  });

  // 🔥 游戏结束状态锁
  const gameEndedRef = useRef<boolean>(false);
  const finalWinnerRef = useRef<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<any>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pageHiddenRef = useRef<boolean>(false);
  const lastRealtimeUpdateRef = useRef<number>(Date.now());
  const pollingActiveRef = useRef<boolean>(false);
  const lastPollSuccessRef = useRef<number>(Date.now());
  const isOfflineRef = useRef<boolean>(!navigator.onLine);
  const subscriptionResubscribeRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 10;
  const isExecutingRef = useRef<boolean>(false);
  const lastOperationTimeRef = useRef<number>(0);
  const operationCooldown = 1000;
  const isSettingUpChannelRef = useRef<boolean>(false);
  const isCleaningUpRef = useRef<boolean>(false);
  const disconnectTimeRef = useRef<number>(0);
  
  // 🔥 新增：消息去重缓存
  const processedMessagesRef = useRef(new LRUCache(100));

  // 🔥 新增：函数引用，避免重建导致的问题
  const getPollIntervalRef = useRef<() => number>(() => 20000);
  const pollGameStateRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const resetPollTimerRef = useRef<() => void>(() => {});
  const handleGameEndedRef = useRef<(sessionData: any) => void>(() => {});
  const syncStateImmediatelyRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const resubscribeRealtimeRef = useRef<() => void>(() => {});

  // ========== 第二步：定义所有 useState ==========
  const [status, setStatus] = useState<string>(session.status);
  const [currentPlayerId, setCurrentPlayerId] = useState(session.current_player_id ?? null);
  const [currentTurn, setCurrentTurn] = useState(session.current_turn ?? 1);
  const [player1Pos, setPlayer1Pos] = useState<number>(Number(session.game_state?.player1_position ?? 0));
  const [player2Pos, setPlayer2Pos] = useState<number>(Number(session.game_state?.player2_position ?? 0));
  const [displayP1Pos, setDisplayP1Pos] = useState<number>(Number(session.game_state?.player1_position ?? 0));
  const [displayP2Pos, setDisplayP2Pos] = useState<number>(Number(session.game_state?.player2_position ?? 0));
  const [boardSize] = useState<number>(Number(session.game_state?.board_size ?? 49));
  const [specialCells, setSpecialCells] = useState<Record<number, string>>(() => {
    const sc = session.game_state?.special_cells ?? {};
    if (Object.keys(sc).length === 0) {
      const stars = [2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46];
      const traps = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 47];
      const defaults: Record<number, string> = {};
      for (const i of stars) defaults[i] = "star";
      for (const i of traps) defaults[i] = "trap";
      return defaults;
    }
    return sc;
  });
  const [lastDice, setLastDice] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingTask, setPendingTask] = useState<{
    type: "star" | "trap" | "collision";
    position: number;
    executor_id: string;
    observer_id: string;
    status: "pending" | "executed";
    task?: { id: string; description: string; type?: string } | null;
    metadata?: { dice?: number; attacker_old_position?: number; penalty?: number };
  } | null>(session.game_state?.pending_task ?? null);
  const [p1Nickname, setP1Nickname] = useState<string>("");
  const [p2Nickname, setP2Nickname] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [isButtonLoading, setIsButtonLoading] = useState(false);

  // ========== 第三步：定义派生状态 ==========
  
  // 🔥 增强版游戏结束处理
  const handleGameEnded = useCallback(async (finalState: any = null) => {
    if (gameEndedRef.current) return;
    
    console.log('🎉 检测到游戏结束，彻底停止所有网络活动');
    gameEndedRef.current = true;
    
    // 1. 立即停止所有轮询和订阅
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
    
    let winnerName: string | undefined;
    
    // 2. 获取最终状态并确定胜者
    try {
      const { data } = await supabase
        .from('game_sessions')
        .select('game_state, status')
        .eq('id', session.id)
        .maybeSingle();
      
      let finalP1Pos = player1Pos;
      let finalP2Pos = player2Pos;
      
      if (data) {
        const gs = data.game_state ?? {};
        finalP1Pos = Number(gs.player1_position ?? player1Pos);
        finalP2Pos = Number(gs.player2_position ?? player2Pos);
      } else if (finalState) {
        const gs = (finalState.game_state ?? {}) as any;
        finalP1Pos = Number(gs.player1_position ?? player1Pos);
        finalP2Pos = Number(gs.player2_position ?? player2Pos);
      }
      
      // 判断胜者
      const isP1Winner = finalP1Pos >= boardSize - 1;
      const isP2Winner = finalP2Pos >= boardSize - 1;
      
      if (isP1Winner) {
        finalWinnerRef.current = p1Nickname || "玩家 1";
      } else if (isP2Winner) {
        finalWinnerRef.current = p2Nickname || "玩家 2";
      } else {
        finalWinnerRef.current = "未知";
      }
      
      winnerName = finalWinnerRef.current;
      
      console.log(`🏆 最终胜者: ${finalWinnerRef.current}`);
      
      // 强制更新到最终位置
      setPlayer1Pos(finalP1Pos);
      setPlayer2Pos(finalP2Pos);
      setDisplayP1Pos(finalP1Pos);
      setDisplayP2Pos(finalP2Pos);
      
    } catch (error) {
      console.log('⚠️ 获取最终状态失败，使用当前状态');
      finalWinnerRef.current = "未知";
    }
    
    // 3. 显示结束弹窗，清理其他状态
    setStatus('completed');
    setCurrentPlayerId(null);
    setPendingTask(null);
    setShowEndModal(true);
    
    // 4. 通知父组件游戏结束
    if (onGameEnd) {
      onGameEnd(winnerName);
    }
    
    console.log('✅ 游戏结束处理完成，所有网络活动已停止');
  }, [supabase, session.id, player1Pos, player2Pos, boardSize, p1Nickname, p2Nickname, onGameEnd]);

  // 🔥 修复：canRoll 使用 ref 避免竞态条件
  const canRoll = useCallback(() => {
    return (
      !gameEndedRef.current &&
      stateRef.current.status === "playing" &&
      stateRef.current.currentPlayerId === userId &&
      !stateRef.current.pendingTask
    );
  }, [userId]);

  // 🔥 智能轮询间隔 - 平衡速度和 CPU（优化版）
  const getPollInterval = useCallback(() => {
    if (gameEndedRef.current) return 0;
    
    const { status: currentStatus } = stateRef.current;
    
    if (currentStatus !== 'playing') return 30000;
    
    if (isSubscribedRef.current) {
      // 订阅健康时：30秒（兼顾CPU和同步）
      return 30000;
    } else {
      // 订阅断开时
      const timeSinceDisconnect = Date.now() - disconnectTimeRef.current;
      if (timeSinceDisconnect < 60000) {
        // 前 60 秒：快速轮询（3秒）
        console.log(`⏱️ 订阅断开初期，快速轮询: 3秒 (断开后 ${Math.floor(timeSinceDisconnect/1000)}秒)`);
        return 3000;
      } else {
        // 60 秒后：慢速轮询（10秒）
        console.log(`⏱️ 订阅断开后期，慢速轮询: 10秒`);
        return 10000;
      }
    }
  }, []);

  // 🔥 优化：安全轮询函数 - 加入消息指纹去重和骰子备份查询
  const pollGameState = useCallback(async () => {
    // 🔥 立即检查游戏结束状态
    if (gameEndedRef.current) {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }
    
    // 🔥 防止重复轮询
    if (pollingActiveRef.current) {
      console.log('⏭️ 跳过重复轮询，上一个轮询仍在进行');
      return;
    }
    
    pollingActiveRef.current = true;
    
    try {
      const interval = getPollIntervalRef.current();
      if (interval === 0) return;
      
      console.log(`🔄 轮询获取游戏状态，间隔: ${interval}ms`);
      
      // 🔥 并行查询：游戏状态 + 最新骰子（作为实时订阅的备份）
      const [gameResult, diceResult] = await Promise.all([
        supabase
          .from('game_sessions')
          .select('id, current_player_id, current_turn, status, game_state')
          .eq('id', session.id)
          .single(),
        supabase
          .from('game_moves')
          .select('id, dice_value, player_id, created_at')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
      ]);
      
      const { data: sessionData, error: gameError } = gameResult;
      const { data: latestMove } = diceResult;
      
      // 处理游戏结束 - PGRST116 表示查询结果为空（游戏会话不存在）
      if (gameError && (gameError.code === 'PGRST116' || gameError.code === '406' || gameError.message?.includes('PGRST116') || gameError.message?.includes('406'))) {
        console.log('🎉 轮询检测到游戏会话不存在，视为游戏结束');
        handleGameEndedRef.current(null);
        return;
      }
      
      if (gameError) {
        console.error('❌ 轮询失败:', gameError.message);
        pollingActiveRef.current = false;
        return;
      }
      
      if (!sessionData) {
        console.log('🎉 轮询检测到游戏会话为空，视为游戏结束');
        handleGameEndedRef.current(null);
        return;
      }
      
      // 🔥 同步骰子备份：轮询同步骰子（作为实时订阅的备份）
      if (latestMove && typeof latestMove.dice_value === 'number') {
        const moveFingerprint = `poll.game_moves.${latestMove.id}.INSERT.${latestMove.created_at}_${latestMove.dice_value}`;
        if (!processedMessagesRef.current.has(moveFingerprint)) {
          processedMessagesRef.current.set(moveFingerprint);
          console.log(`🔄 轮询同步骰子: ${latestMove.dice_value}`);
          setIsRolling(true);
          setTimeout(() => {
            setLastDice(latestMove.dice_value);
            setIsRolling(false);
          }, 600);
        }
      }
      
      // 🔥 游戏状态同步：加入消息指纹去重
      const s = sessionData as any;
      const gs = (s.game_state ?? {}) as any;
      const stateHash = `${s.status}_${s.current_turn}_${JSON.stringify(gs)}`;
      const stateFingerprint = `poll.game_sessions.${sessionData.id}.UPDATE.${Date.now()}_${stateHash}`;
      if (processedMessagesRef.current.has(stateFingerprint)) {
        console.log(`⏭️ 跳过已处理的轮询状态更新`);
      } else {
        processedMessagesRef.current.set(stateFingerprint);
      }
      
      // 检查游戏是否结束
      if (s.status === 'completed') {
        console.log('🎉 轮询检测到游戏结束');
        handleGameEndedRef.current(s);
        return;
      }
      
      // 优化状态更新
      const newP1Pos = Number(gs.player1_position ?? 0);
      const newP2Pos = Number(gs.player2_position ?? 0);
      const newPendingTask = gs.pending_task ?? null;
      
      // 🔥 使用 stateRef 避免依赖状态变量
      const currentState = stateRef.current;
      
      // 🔥 记录状态变化，避免不必要的更新
      let needsUpdate = false;
      
      if (s.status !== currentState.status) {
        setStatus(s.status);
        needsUpdate = true;
      }
      
      if (s.current_player_id !== currentState.currentPlayerId) {
        setCurrentPlayerId(s.current_player_id);
        needsUpdate = true;
      }
      
      if (s.current_turn !== currentState.currentTurn) {
        setCurrentTurn(s.current_turn);
        needsUpdate = true;
      }
      
      if (newP1Pos !== currentState.player1Pos) {
        setPlayer1Pos(newP1Pos);
        needsUpdate = true;
      }
      
      if (newP2Pos !== currentState.player2Pos) {
        setPlayer2Pos(newP2Pos);
        needsUpdate = true;
      }
      
      if (JSON.stringify(newPendingTask) !== JSON.stringify(currentState.pendingTask)) {
        setPendingTask(newPendingTask);
        needsUpdate = true;
      }
      
      // 更新 ref
      stateRef.current = {
        ...stateRef.current,
        player1Pos: newP1Pos,
        player2Pos: newP2Pos,
        pendingTask: newPendingTask,
        status: s.status,
        currentPlayerId: s.current_player_id,
        currentTurn: s.current_turn ?? 1,
      };
      
      if (needsUpdate) {
        lastPollSuccessRef.current = Date.now();
      }
      
    } catch (error) {
      console.error('❌ 轮询异常:', error);
    } finally {
      pollingActiveRef.current = false;
      
      // 🔥 确保只设置一个定时器，且间隔正确
      if (!gameEndedRef.current && !pageHiddenRef.current) {
        const nextInterval = getPollIntervalRef.current();
        if (nextInterval > 0) {
          // 清除旧定时器
          if (pollTimerRef.current) {
            clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          
          // 设置新定时器
          pollTimerRef.current = setTimeout(() => {
            pollGameStateRef.current();
          }, nextInterval);
        }
      }
  }
  }, [supabase, session.id]);

  // 🔥 新增：立即同步状态函数 - 用于网络恢复、页面恢复等场景
  const syncStateImmediately = useCallback(async () => {
    if (gameEndedRef.current) return;
    
    console.log('🔄 立即同步游戏状态...');
    
    try {
      const { data: sessionData, error } = await supabase
        .from('game_sessions')
        .select('id, current_player_id, current_turn, status, game_state')
        .eq('id', session.id)
        .single();
      
      if (error) {
        // PGRST116 表示查询结果为空（游戏会话不存在），视为游戏结束
        if (error.code === 'PGRST116' || error.message?.includes('PGRST116')) {
          console.log('🎉 立即同步检测到游戏会话不存在，视为游戏结束');
          handleGameEndedRef.current(null);
          return;
        }
        console.error('❌ 立即同步失败:', error);
        return;
      }
      
      if (!sessionData) {
        console.log('🎉 立即同步检测到游戏会话为空，视为游戏结束');
        handleGameEndedRef.current(null);
        return;
      }
      
      const s = sessionData as any;
      
      // 检查游戏是否结束
      if (s.status === 'completed') {
        console.log('🎉 同步检测到游戏结束');
        handleGameEndedRef.current(s);
        return;
      }
      
      const gs = (s.game_state ?? {}) as any;
      
      // 更新所有状态
      setStatus(s.status);
      setCurrentPlayerId(s.current_player_id);
      setCurrentTurn(s.current_turn ?? 1);
      
      const newP1Pos = Number(gs.player1_position ?? 0);
      const newP2Pos = Number(gs.player2_position ?? 0);
      setPlayer1Pos(newP1Pos);
      setPlayer2Pos(newP2Pos);
      
      const newPendingTask = gs.pending_task ?? null;
      setPendingTask(newPendingTask);
      
      // 更新 ref
      stateRef.current = {
        ...stateRef.current,
        player1Pos: newP1Pos,
        player2Pos: newP2Pos,
        pendingTask: newPendingTask,
        status: s.status,
        currentPlayerId: s.current_player_id,
        currentTurn: s.current_turn ?? 1,
      };
      
      lastRealtimeUpdateRef.current = Date.now();
      console.log('✅ 状态同步完成');
      
    } catch (error) {
      console.error('❌ 立即同步异常:', error);
    }
  }, [supabase, session.id]);

  // 🔥 重写：使用指数退避重连机制（参考 room-watcher）
  const setupRealtimeChannel = useCallback(() => {
    if (gameEndedRef.current) return;
    if (isSettingUpChannelRef.current) {
      console.log('⏸️ 跳过订阅建立：正在设置中');
      return;
    }
    
    isSettingUpChannelRef.current = true;
    isCleaningUpRef.current = true; // 🔒 标记：正在清理旧订阅
    console.log('📡 建立/重建实时订阅...');
    
    // 清理旧订阅
    if (subscriptionRef.current) {
      try {
        supabase.removeChannel(subscriptionRef.current);
      } catch (e) {
        console.warn('清理旧订阅失败:', e);
      }
      subscriptionRef.current = null;
    }
    
    // 短暂延迟后解除清理标记
    setTimeout(() => {
      isCleaningUpRef.current = false;
    }, 500);
    
    const channel = supabase
      .channel(`game:${session.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: userId },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${session.id}`
        },
        (payload) => {
          // 🔥 简化消息指纹，确保可靠性
          const s = (payload.new as any) ?? {};
          const stateHash = `${s.status}_${s.current_turn}_${JSON.stringify(s.game_state)}`;
          const fingerprint = `game_sessions.${session.id}.UPDATE.${Date.now()}_${stateHash}`;
          
          if (processedMessagesRef.current.has(fingerprint)) {
            console.log(`⏭️ 跳过已处理的状态更新`);
            return;
          }
          
          processedMessagesRef.current.set(fingerprint);
          
          if (gameEndedRef.current) return;
          
          console.log('📡 实时同步游戏状态更新');
          lastRealtimeUpdateRef.current = Date.now();
          
          if (s.status === 'completed') {
            console.log('🎉 实时订阅检测到游戏结束');
            handleGameEndedRef.current(s);
            return;
          }
          
          const gs = (s.game_state ?? {}) as any;
          
          setStatus(s.status);
          setCurrentPlayerId(s.current_player_id);
          setCurrentTurn(s.current_turn ?? 1);
          
          const newP1Pos = Number(gs.player1_position ?? 0);
          const newP2Pos = Number(gs.player2_position ?? 0);
          setPlayer1Pos(newP1Pos);
          setPlayer2Pos(newP2Pos);
          
          const newPendingTask = gs.pending_task ?? null;
          setPendingTask(newPendingTask);
          
          stateRef.current = {
            ...stateRef.current,
            player1Pos: newP1Pos,
            player2Pos: newP2Pos,
            pendingTask: newPendingTask,
            status: s.status,
            currentPlayerId: s.current_player_id,
            currentTurn: s.current_turn ?? 1,
          };
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'game_moves',
          filter: `session_id=eq.${session.id}` 
        },
        (payload) => {
          // 🔥 简化消息指纹，确保可靠性
          const mv = (payload.new as any) ?? {};
          if (typeof mv.dice_value === 'number') {
            const fingerprint = `game_moves.${mv.id}.INSERT.${mv.created_at}_${mv.dice_value}`;
            
            if (processedMessagesRef.current.has(fingerprint)) {
              console.log(`⏭️ 跳过已处理的骰子: ${mv.dice_value}`);
              return;
            }
            
            processedMessagesRef.current.set(fingerprint);
            
            if (gameEndedRef.current) return;
            
            console.log(`🎲 实时同步骰子: ${mv.dice_value}`);
            setIsRolling(true);
            setTimeout(() => {
              setLastDice(mv.dice_value);
              setIsRolling(false);
            }, 600);
            
            lastRealtimeUpdateRef.current = Date.now();
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 实时订阅状态: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ 实时订阅连接成功');
          isSubscribedRef.current = true;
          retryCountRef.current = 0;
          lastRealtimeUpdateRef.current = Date.now();
          isSettingUpChannelRef.current = false;
          isCleaningUpRef.current = false;
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          console.log(`ℹ️ 实时订阅断开: ${status}`);
          const wasSubscribed = isSubscribedRef.current;
          isSubscribedRef.current = false;
          
          // 🔧 记录断开时间（只在第一次断开时记录）
          if (wasSubscribed) {
            disconnectTimeRef.current = Date.now();
            console.log(`⏱️ 记录订阅断开时间: ${new Date(disconnectTimeRef.current).toLocaleTimeString()}`);
          }
          
          // 🚀 关键修复：如果是正在清理，不触发重连
          if (!gameEndedRef.current && !isSettingUpChannelRef.current && !isCleaningUpRef.current) {
            attemptReconnect();
          } else if (isCleaningUpRef.current) {
            console.log('⏸️ 跳过重连：正在清理旧订阅');
          }
        }
      });
    
    subscriptionRef.current = channel;
    
    setTimeout(() => {
      isSettingUpChannelRef.current = false;
    }, 2000);
  }, [supabase, session.id]);

  // 🔥 新增：指数退避重连机制
  const attemptReconnect = useCallback(() => {
    if (gameEndedRef.current) return;
    if (isSettingUpChannelRef.current) {
      console.log('⏸️ 跳过重连：正在设置通道');
      return;
    }
    if (retryCountRef.current >= maxRetries) {
      console.error(`❌ 达到最大重试次数 (${maxRetries})，停止重连，依赖轮询`);
      return;
    }

    // 清除之前的重连定时器
    if (subscriptionResubscribeRef.current) {
      clearTimeout(subscriptionResubscribeRef.current);
      subscriptionResubscribeRef.current = null;
    }

    retryCountRef.current++;
    
    // 指数退避：1秒, 2秒, 4秒, 8秒, 10秒
    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000);
    
    console.log(`🔄 尝试重新连接 (${retryCountRef.current}/${maxRetries})，${delay/1000}秒后`);
    
    subscriptionResubscribeRef.current = setTimeout(() => {
      setupRealtimeChannel();
    }, delay);
  }, [maxRetries, setupRealtimeChannel]);

  // 🔥 保持兼容性别名
  const resubscribeRealtime = setupRealtimeChannel;

  // 🔥 简化：收到实时更新时只更新健康状态，不重置轮询计时器
  const resetPollTimer = useCallback(() => {
    // 不重置轮询计时器，避免定时器叠加
  }, []);

  // 🔥 更新函数引用
  useEffect(() => {
    getPollIntervalRef.current = getPollInterval;
    pollGameStateRef.current = pollGameState;
    resetPollTimerRef.current = resetPollTimer;
    handleGameEndedRef.current = handleGameEnded;
    syncStateImmediatelyRef.current = syncStateImmediately;
    resubscribeRealtimeRef.current = resubscribeRealtime;
  }, [getPollInterval, pollGameState, resetPollTimer, handleGameEnded, syncStateImmediately, resubscribeRealtime]);

  // 🔥 新增：操作防抖函数
  const canExecuteOperation = useCallback((): boolean => {
    if (gameEndedRef.current) return false;
    if (isExecutingRef.current) {
      console.log('⏸️ 操作被阻止：上一个操作正在执行中');
      return false;
    }
    
    const now = Date.now();
    const timeSinceLastOp = now - lastOperationTimeRef.current;
    if (timeSinceLastOp < operationCooldown) {
      console.log(`⏸️ 操作被阻止：冷却中 (${operationCooldown - timeSinceLastOp}ms)`);
      return false;
    }
    
    return true;
  }, [operationCooldown]);

  // 🔥 新增：标记操作开始/结束
  const markOperationStart = useCallback((): boolean => {
    if (!canExecuteOperation()) return false;
    isExecutingRef.current = true;
    lastOperationTimeRef.current = Date.now();
    return true;
  }, [canExecuteOperation]);

  const markOperationEnd = useCallback(() => {
    isExecutingRef.current = false;
  }, []);

  // ========== 第四步：定义所有 useEffect ==========

  // 🔥 更新 ref 状态
  useEffect(() => {
    if (gameEndedRef.current) return;

    stateRef.current = {
      player1Pos,
      player2Pos,
      pendingTask,
      status,
      currentPlayerId,
      currentTurn,
      specialCells,
    };
  }, [player1Pos, player2Pos, pendingTask, status, currentPlayerId, currentTurn, specialCells]);

  // 🔥 设备检测
  useEffect(() => {
    const mobileCheck = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(mobileCheck);
  }, []);

  // 🔥 🆕 修复：安全的轮询系统 - 使用 ref 避免函数重建
  useEffect(() => {
    if (gameEndedRef.current) {
      console.log('⏹️ 游戏已结束，跳过轮询初始化');
      return;
    }
    
    if (!session?.id) return;
    
    console.log('🎯 启动智能轮询系统');
    
    // 启动轮询
    pollGameStateRef.current();
    
    return () => {
      console.log('🧹 清理轮询定时器');
      pollingActiveRef.current = false;
      
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [session?.id]);

  // 🔥 实时订阅 - 使用重连机制
  useEffect(() => {
    if (gameEndedRef.current) {
      console.log('⏹️ 游戏已结束，跳过订阅初始化');
      return;
    }
    
    if (!session?.id) return;
    
    console.log(`📡 建立实时订阅，游戏ID: ${session.id}`);
    
    setupRealtimeChannel();
    
    return () => {
      console.log('🧹 清理实时订阅');
      
      if (subscriptionResubscribeRef.current) {
        clearTimeout(subscriptionResubscribeRef.current);
        subscriptionResubscribeRef.current = null;
      }
      
      if (subscriptionRef.current) {
        try {
          supabase.removeChannel(subscriptionRef.current);
        } catch (e) {
          console.warn('清理订阅失败:', e);
        }
        subscriptionRef.current = null;
      }
      
      isSubscribedRef.current = false;
      retryCountRef.current = 0;
      isSettingUpChannelRef.current = false;
    };
  }, [supabase, session.id, setupRealtimeChannel]);

  // 🔥 新增：网络状态监听
  useEffect(() => {
    if (gameEndedRef.current) return;
    
    const handleOnline = () => {
      console.log('🌐 网络已恢复');
      isOfflineRef.current = false;
      retryCountRef.current = 0;
      
      // 🚀 顺序调整：先立即同步状态，再重连订阅
      console.log('🔄 网络恢复：立即同步状态');
      syncStateImmediatelyRef.current();
      
      // 稍微延迟一下重连订阅，给同步状态一些时间
      setTimeout(() => {
        console.log('📡 网络恢复：重连实时订阅');
        setupRealtimeChannel();
      }, 300);
    };
    
    const handleOffline = () => {
      console.log('📵 网络已断开');
      isOfflineRef.current = true;
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // 🔧 空依赖数组，只挂载一次

  // 🔥 玩家信息获取
  useEffect(() => {
    (async () => {
      try {
        const { data: room } = await supabase
          .from("rooms")
          .select("player1_nickname, player2_nickname")
          .eq("id", session.room_id)
          .maybeSingle();

        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nickname")
          .in("id", [session.player1_id, session.player2_id]);

        const p1 = profiles?.find((p: any) => p.id === session.player1_id);
        const p2 = profiles?.find((p: any) => p.id === session.player2_id);

        setP1Nickname(room?.player1_nickname ?? p1?.nickname ?? "玩家 1");
        setP2Nickname(room?.player2_nickname ?? p2?.nickname ?? "玩家 2");
      } catch (e) {
        console.error("获取玩家昵称失败:", e);
      }
    })();
  }, [supabase, session.room_id, session.player1_id, session.player2_id]);

  // 🔥 棋子移动动画
  useEffect(() => {
    if (displayP1Pos === player1Pos) return;
    const dir = player1Pos > displayP1Pos ? 1 : -1;
    const timer = setTimeout(() => {
      setDisplayP1Pos((prev) => prev + dir);
    }, 180);
    return () => clearTimeout(timer);
  }, [player1Pos, displayP1Pos]);

  useEffect(() => {
    if (displayP2Pos === player2Pos) return;
    const dir = player2Pos > displayP2Pos ? 1 : -1;
    const timer = setTimeout(() => {
      setDisplayP2Pos((prev) => prev + dir);
    }, 180);
    return () => clearTimeout(timer);
  }, [player2Pos, displayP2Pos]);

  // 🔥 页面可见性处理
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('⏸️ 页面隐藏，暂停轮询');
        pageHiddenRef.current = true;
        
        if (pollTimerRef.current) {
          clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } else {
        if (gameEndedRef.current) {
          console.log('▶️ 页面恢复，但游戏已结束');
          return;
        }
        
        console.log('▶️ 页面恢复，立即同步状态');
        pageHiddenRef.current = false;
        
        // 🚀 顺序：先同步，再重连，最后恢复轮询
        console.log('🔄 页面恢复：立即同步状态');
        syncStateImmediatelyRef.current();
        
        // 重置重试计数
        retryCountRef.current = 0;
        
        // 稍微延迟一下重连订阅
        setTimeout(() => {
          console.log('📡 页面恢复：重连实时订阅');
          setupRealtimeChannel();
        }, 300);
        
        // 恢复轮询
        setTimeout(() => {
          console.log('🔄 页面恢复：恢复轮询');
          pollGameStateRef.current();
        }, 600);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // ========== 第五步：事件处理函数 ==========

  const handleRoll = useCallback(async () => {
    if (!canRoll()) return;
    if (isButtonLoading) return;
    if (!markOperationStart()) return;

    console.log(`🎲 玩家 ${userId} 开始掷骰子`);
    setIsButtonLoading(true);
    
    try {
      // 先开始骰子动画
      setIsRolling(true);
      
      const result = await rollDice(session.id);
      
      if (result.success && result.diceValue) {
        // 骰子结果已知，立即更新（动画会在600ms后自动显示结果）
        setTimeout(() => {
          setLastDice(result.diceValue);
          setIsRolling(false);
        }, 600);
      } else {
        // 骰子失败，停止动画
        setIsRolling(false);
        console.error('掷骰子失败:', result.error);
      }
      
      // 🚀 智能同步策略
      if (isSubscribedRef.current) {
        // 订阅健康：只同步 1 次，然后完全依赖实时订阅
        console.log('⚡ 操作完成，订阅健康，立即同步 1 次');
        syncStateImmediatelyRef.current();
      } else {
        // 订阅断开：同步 3 次，保证不遗漏
        console.log('⚡ 操作完成，订阅断开，同步 3 次');
        syncStateImmediatelyRef.current();
        setTimeout(() => syncStateImmediatelyRef.current(), 5000);
        setTimeout(() => syncStateImmediatelyRef.current(), 10000);
      }
    } catch (error) {
      console.error('掷骰子失败:', error);
      setIsRolling(false);
    } finally {
      markOperationEnd();
      setIsButtonLoading(false);
    }
  }, [canRoll, userId, session.id, isButtonLoading, markOperationStart, markOperationEnd]);

  const onExecutorConfirm = useCallback(async () => {
    if (isButtonLoading) return;
    if (!markOperationStart()) return;
    
    console.log(`✅ 执行者确认完成任务`);
    setIsButtonLoading(true);
    
    try {
      await confirmTaskExecution(session.id);
      
      // 🚀 智能同步策略
      if (isSubscribedRef.current) {
        // 订阅健康：只同步 1 次，然后完全依赖实时订阅
        console.log('⚡ 操作完成，订阅健康，立即同步 1 次');
        syncStateImmediatelyRef.current();
      } else {
        // 订阅断开：同步 3 次，保证不遗漏
        console.log('⚡ 操作完成，订阅断开，同步 3 次');
        syncStateImmediatelyRef.current();
        setTimeout(() => syncStateImmediatelyRef.current(), 5000);
        setTimeout(() => syncStateImmediatelyRef.current(), 10000);
      }
    } finally {
      markOperationEnd();
      setIsButtonLoading(false);
    }
  }, [session.id, isButtonLoading, markOperationStart, markOperationEnd]);

  const onObserverVerify = useCallback(async (done: boolean) => {
    if (isButtonLoading) return;
    if (!markOperationStart()) return;
    
    console.log(`👁️ 观察者验证任务: ${done ? "已执行" : "未执行"}`);
    setIsButtonLoading(true);
    
    try {
      await verifyTask(session.id, done);
      
      // 🚀 智能同步策略
      if (isSubscribedRef.current) {
        // 订阅健康：只同步 1 次，然后完全依赖实时订阅
        console.log('⚡ 操作完成，订阅健康，立即同步 1 次');
        syncStateImmediatelyRef.current();
      } else {
        // 订阅断开：同步 3 次，保证不遗漏
        console.log('⚡ 操作完成，订阅断开，同步 3 次');
        syncStateImmediatelyRef.current();
        setTimeout(() => syncStateImmediatelyRef.current(), 5000);
        setTimeout(() => syncStateImmediatelyRef.current(), 10000);
      }
    } finally {
      markOperationEnd();
      setIsButtonLoading(false);
    }
  }, [session.id, isButtonLoading, markOperationStart, markOperationEnd]);

  // 🔥 棋盘生成（保持不变）
  const cells = Array.from({ length: boardSize }, (_, i) => i);

  function buildSpiralGrid(n: number): number[][] {
    const grid = Array.from({ length: n }, () => Array(n).fill(0));
    let top = 0, bottom = n - 1, left = 0, right = n - 1;
    let num = 1;
    while (top <= bottom && left <= right) {
      for (let c = left; c <= right; c++) grid[top][c] = num++;
      top++;
      for (let r = top; r <= bottom; r++) grid[r][right] = num++;
      right--;
      if (top <= bottom) {
        for (let c = right; c >= left; c--) grid[bottom][c] = num++;
        bottom--;
      }
      if (left <= right) {
        for (let r = bottom; r >= top; r--) grid[r][left] = num++;
        left++;
      }
    }
    return grid;
  }

  const spiralGrid = useMemo(() => buildSpiralGrid(7), []);

  const stepPos = useMemo(() => {
    const map: Record<number, { row: number; col: number }> = {};
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const s = spiralGrid[r]?.[c];
        if (typeof s === "number") {
          map[s] = { row: r, col: c };
        }
      }
    }
    return map;
  }, [spiralGrid]);

  // ========== 第六步：返回 JSX ==========
  return (
    <div className="max-w-md mx-auto h-screen flex flex-col p-2">
      {/* 原有游戏界面... */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <Link href="/lobby" className="w-10 h-10 glass rounded-xl flex items-center justify-center hover:bg-white/10 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="glass px-4 py-2 rounded-xl text-sm">
          <span className="text-gray-400">回合:</span>
          <span className="text-brand-pink font-semibold ml-1">{currentTurn}/50</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div
          className={`glass rounded-lg px-2 py-2 transition-all flex items-center justify-between ${currentPlayerId === session.player1_id ? "gradient-primary glow-pink" : ""
            }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-brand-pink/20 flex items-center justify-center">
              <Plane className="w-4 h-4 text-brand-pink" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{p1Nickname}</p>
              <p className="text-[10px] text-white/70">{currentPlayerId === session.player1_id ? "你的回合" : "等待中"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{player1Pos + 1}</span>
            </div>
          </div>
        </div>

        <div
          className={`glass rounded-lg px-2 py-2 transition-all flex items-center justify-between ${currentPlayerId === session.player2_id ? "gradient-primary glow-pink" : "opacity-70"
            }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-brand-purple/20 flex items-center justify-center">
              <Rocket className="w-4 h-4 text-brand-purple" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{p2Nickname}</p>
              <p className="text-[10px] text-white/70">{currentPlayerId === session.player2_id ? "你的回合" : "等待中"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{player2Pos + 1}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 掷骰子部分 */}
      <div className="glass rounded-2xl p-4 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="relative">
            <div
              className={`w-16 h-16 gradient-primary rounded-xl flex items-center justify-center text-4xl font-bold glow-pink transition-transform ${isRolling ? "animate-dice-roll" : ""
                } ${canRoll && !isRolling ? "animate-glow-pulse" : ""}`}
              style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
            >
              {isRolling ? (
                <div className="animate-spin text-3xl">🎲</div>
              ) : (
                <div className="text-4xl font-bold animate-pulse-once">
                  {lastDice ?? "?"}
                </div>
              )}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleRoll}
            disabled={!canRoll() || isPending || isButtonLoading}
            className={`gradient-primary px-6 py-3 rounded-xl font-semibold glow-pink text-white flex items-center gap-2 transition-transform ${canRoll() && !isPending && !isButtonLoading
                ? "hover:scale-105 active:scale-95"
                : "opacity-50 cursor-not-allowed"
              } ${isPending || isButtonLoading ? "animate-button-press" : ""}`}
          >
            <Dice6 className="w-5 h-5" />
            <span>{isPending || isButtonLoading ? "掷骰中" : "掷骰子"}</span>
          </Button>
        </div>
      </div>

      {/* 棋盘部分 */}
      <div className="glass rounded-2xl p-2 mb-4">
        <div className={`grid grid-cols-7 ${isMobile ? "gap-2" : "gap-1"}`}>
          {cells.map((i) => {
            const row = Math.floor(i / 7);
            const col = i % 7;
            const step = spiralGrid[row]?.[col] ?? i + 1;
            const isP1 = step - 1 === displayP1Pos;
            const isP2 = step - 1 === displayP2Pos;
            const isBoth = isP1 && isP2;
            const spType = specialCells[step - 1];
            const isStart = step === 1;
            const isEnd = step === boardSize;

            return (
              <div
                key={i}
                className={`relative rounded-lg flex items-center justify-center transition-all hover:scale-105 ${isEnd
                    ? "gradient-primary glow-pink"
                    : spType === "star"
                      ? "glass bg-brand-pink/20 border-brand-pink/30"
                      : spType === "trap"
                        ? "glass bg-purple-500/20 border-purple-500/30"
                        : "glass"
                  }`}
                style={{ aspectRatio: '1 / 1' }}
              >
                {step < boardSize && !(isP1 || isP2) && (() => {
                  const cur = stepPos[step];
                  const nxt = stepPos[step + 1];
                  const dx = (nxt?.col ?? col) - (cur?.col ?? col);
                  const dy = (nxt?.row ?? row) - (cur?.row ?? row);
                  const Icon = dx === 1 ? ArrowRight : dx === -1 ? ArrowLeft : dy === 1 ? ArrowDown : dy === -1 ? ArrowUp : null;
                  return Icon ? (
                    <Icon className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
                  ) : null;
                })()}
                {isStart && <div className="text-[10px] text-gray-500">起点</div>}
                {isEnd && (
                  <>
                    <Trophy className="w-5 h-5 text-white" />
                    <div className="text-[10px] text-white/80 absolute bottom-0.5">终点</div>
                  </>
                )}
                {spType === "star" && !isEnd && <Heart className="w-4 h-4 text-brand-pink" />}
                {spType === "trap" && <Zap className="w-4 h-4 text-purple-400" />}
                {(isP1 || isP2) && !isEnd && (
                  <div className={`absolute ${isMobile ? "w-10 h-10" : "w-9 h-9"} flex items-center justify-center z-10`}>
                    {isBoth ? (
                      <div className="w-full h-full gradient-primary rounded-full border-[3px] border-white shadow-lg glow-pink flex items-center justify-center animate-pulse">
                        <Plane className="w-5 h-5 text-white rotate-45" />
                      </div>
                    ) : isP1 ? (
                      <div className="w-full h-full bg-gradient-to-br from-pink-400 to-pink-600 rounded-full border-[3px] border-white shadow-lg glow-pink flex items-center justify-center">
                        <Plane className="w-5 h-5 text-white drop-shadow rotate-45" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-400 to-purple-600 rounded-full border-[3px] border-white shadow-lg glow-purple flex items-center justify-center">
                        <PlaneTakeoff className="w-5 h-5 text-white drop-shadow" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 游戏结束弹窗 */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
          <div className="glass rounded-3xl p-6 max-w-sm w-full glow-pink text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center glow-pink">
                <Trophy className="w-8 h-8" />
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2">游戏结束！</h3>
            
            <div className="glass rounded-xl p-4 mb-4">
              <p className="text-gray-300 mb-2">赢家：</p>
              <div className="text-2xl font-bold text-brand-pink mb-3">
                {finalWinnerRef.current || "未知"}
              </div>
              
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div>
                  <div className="text-gray-400">{p1Nickname || "玩家 1"}</div>
                  <div className="font-bold">位置: {displayP1Pos + 1}</div>
                </div>
                <div>
                  <div className="text-gray-400">{p2Nickname || "玩家 2"}</div>
                  <div className="font-bold">位置: {displayP2Pos + 1}</div>
                </div>
              </div>
            </div>
            
            <Button
              asChild
              className="w-full gradient-primary py-3 rounded-xl font-semibold glow-pink text-white hover:scale-105 transition-transform"
            >
              <Link href="/lobby">返回大厅</Link>
            </Button>
          </div>
        </div>
      )}

      {/* 🔥 回归原始版本：简单的任务弹窗逻辑 */}
      {pendingTask && !gameEndedRef.current && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass rounded-3xl p-6 max-w-sm w-full glow-pink">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center glow-pink">
                {pendingTask.type === "star" ? (
                  <Heart className="w-8 h-8" />
                ) : (
                  <Zap className="w-8 h-8" />
                )}
              </div>
            </div>
            <h3 className="text-xl font-bold text-center mb-2">触发任务！</h3>

            <div className="glass rounded-xl p-4 mb-6">
              <p className="text-center text-gray-300 leading-relaxed">
                {pendingTask.task?.description ?? "（题库为空，作为占位任务）请进行指定动作并由观察者判定。"}
              </p>
            </div>

            {/* 🔥 回归原始版本的任务按钮逻辑 */}
            {pendingTask.status === "pending" && pendingTask.executor_id === userId ? (
              <div className="flex space-x-3">
                <Button
                  type="button"
                  onClick={onExecutorConfirm}
                  disabled={isPending || isButtonLoading}
                  className="flex-1 gradient-primary py-3 rounded-xl font-semibold glow-pink text-white"
                >
                  {isButtonLoading ? "处理中…" : "完成任务"}
                </Button>
              </div>
            ) : pendingTask.status === "executed" && pendingTask.observer_id === userId ? (
              <div className="flex space-x-3">
                <Button
                  type="button"
                  onClick={() => onObserverVerify(true)}
                  disabled={isPending || isButtonLoading}
                  className="flex-1 bg-green-600 py-3 rounded-xl font-semibold text-white hover:bg-green-700"
                >
                  {isButtonLoading ? "处理中…" : "已执行"}
                </Button>
                <Button
                  type="button"
                  onClick={() => onObserverVerify(false)}
                  disabled={isPending || isButtonLoading}
                  className="flex-1 bg-red-600 py-3 rounded-xl font-semibold text-white hover:bg-red-700"
                >
                  {isButtonLoading ? "处理中…" : "未执行"}
                </Button>
              </div>
            ) : (
              <div className="text-center text-sm text-gray-400">
                等待 {pendingTask.status === "pending" ? "执行者确认" : "观察者判定"}…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}