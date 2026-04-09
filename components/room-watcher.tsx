// components/room-watcher.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { revalidateRoom } from "@/app/lobby/revalidate-actions";
import { logger } from "@/lib/utils/logger";

export default function RoomWatcher({ roomId, status }: { roomId: string; status?: string }) {
  const router = useRouter();
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "reconnecting">("connected");
  const channelRef = useRef<any>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 10;
  
  // 🔥 标记是否正在跳转到游戏页
  const isJumpingToGameRef = useRef(false);
  // 🔥 检测是否为移动设备
  const isMobileRef = useRef(false);

  // 防抖刷新函数 - 3秒内最多刷新一次
  const debouncedRefresh = async () => {
    const now = Date.now();
    if (now - lastRefreshTime > 3000) {
      logger.log(`🔄 RoomWatcher 触发刷新，房间: ${roomId}`);
      setLastRefreshTime(now);
      
      // 🔥 先清除 Server Component 缓存
      await revalidateRoom(roomId);
      
      // 🔥 然后刷新客户端
      router.refresh();
    } else {
      logger.log(`⏸️ RoomWatcher 防抖中，跳过刷新，房间: ${roomId}`);
    }
  };

  // 🔥 修复：跳转到游戏页（添加延迟清理）
  const jumpToGame = () => {
    logger.log(`🎮 RoomWatcher 检测到游戏开始，跳转到游戏页，房间: ${roomId}`);
    
    // 标记正在跳转到游戏页
    isJumpingToGameRef.current = true;
    
    // 清除可能存在的刷新超时
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    // 🔥 延迟清理：5秒后清理订阅
    if (channelRef.current) {
      logger.log(`⏳ 设置5秒延迟清理，房间: ${roomId}`);
      cleanupTimeoutRef.current = setTimeout(() => {
        logger.log(`🧹 延迟清理房间监听，房间: ${roomId}`);
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isJumpingToGameRef.current = false;
      }, 5000); // 5秒延迟，给游戏页面足够时间建立订阅
    }
    
    // 跳转到游戏页面
    router.push("/game");
  };

  // 🔥 定期检查房间状态
  useEffect(() => {
    const checkRoomStatus = async () => {
      try {
        const supabase = createClient();
        const { data: room, error } = await supabase
          .from("rooms")
          .select("status")
          .eq("id", roomId)
          .single();

        if (!error && room && room.status === "playing") {
          logger.log(`🎯 定期检查发现房间状态为playing，跳转到游戏页面`);
          jumpToGame();
        }
      } catch (error) {
        logger.error(`❌ 定期检查房间状态失败:`, error);
      }
    };

    // 每3秒检查一次房间状态
    const intervalId = setInterval(checkRoomStatus, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [roomId, router]);

  // 🔥 设置订阅，带重试机制
  const setupChannel = async (supabase: any) => {
    try {
      // 🔥 网络恢复时，跳过等待认证会话，直接尝试建立订阅
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        logger.log(`🔄 RoomWatcher 无认证会话，快速尝试建立订阅`);
      }

      logger.log(`🎧 建立房间监听，房间ID: ${roomId}`);
      
      // 创建房间状态监听通道
      channelRef.current = supabase
        .channel(`room_${roomId}`)
        .on(
          "postgres_changes",
          { 
            event: "UPDATE",
            schema: "public", 
            table: "rooms", 
            filter: `id=eq.${roomId}` 
          },
          (payload) => {
            logger.log(`📡 RoomWatcher 接收到房间更新，房间: ${roomId}`);
            
            const newStatus = (payload.new as any)?.status;
            const oldStatus = (payload.old as any)?.status;
            
            // 状态变化处理
            if (newStatus !== oldStatus) {
              logger.log(`🔄 房间状态变化: ${oldStatus} -> ${newStatus}`);
              
              if (newStatus === "playing") {
                jumpToGame();
                return;
              }
            }
            
            // 任何其他房间更新，都刷新页面（包括玩家加入、主题选择等）
            logger.log(`🔄 检测到房间变化，准备刷新`);
            
            if (refreshTimeoutRef.current) {
              clearTimeout(refreshTimeoutRef.current);
            }
            
            refreshTimeoutRef.current = setTimeout(() => {
              if (channelRef.current) {
                debouncedRefresh();
              }
            }, 500);
          }
        )
        .subscribe((status) => {
          logger.log(`📡 RoomWatcher 订阅状态: ${status}, 房间: ${roomId}`);
          setIsSubscribed(status === "SUBSCRIBED");

          if (status === "SUBSCRIBED") {
            logger.log(`✅ 房间监听已建立，房间: ${roomId}`);
            setConnectionStatus("connected");
            retryCountRef.current = 0; // 重置重试计数

            // 🔥 订阅恢复后，主动刷新房间状态（加速同步）
            logger.log(`🔄 订阅恢复，主动刷新房间状态`);
            debouncedRefresh();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            logger.error(`❌ 房间监听错误，房间: ${roomId}`);
            setConnectionStatus("disconnected");

            // 🔥 使用快速重连模式（无指数退避）
            logger.log(`� 检测到连接断开，快速重连`);
            attemptReconnect(supabase, false);
          }
        });

    } catch (error) {
      logger.error(`❌ RoomWatcher 初始化失败，房间: ${roomId}:`, error);
      setConnectionStatus("disconnected");
    }
  };

  // 🔥 重连机制
  // 🔥 优化：添加参数决定是否使用指数退避
  const attemptReconnect = (supabase: any, useBackoff: boolean = true) => {
    if (retryCountRef.current >= maxRetries) {
      logger.error(`❌ 达到最大重试次数 (${maxRetries})，停止重连`);
      setConnectionStatus("disconnected");
      return;
    }

    retryCountRef.current++;
    setConnectionStatus("reconnecting");

    logger.log(`🔄 尝试重新连接 (${retryCountRef.current}/${maxRetries})，房间: ${roomId}`);

    // 清理旧的订阅
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // 🔥 网络恢复时使用固定小延迟（0.5秒），避免长时间等待
    const delay = useBackoff
      ? Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000) // 指数退避
      : 0; // 🔥 快速重连：0秒延迟（由调用方控制延迟）

    logger.log(`⏳ ${delay/1000}秒后重连，房间: ${roomId}`);

    reconnectTimeoutRef.current = setTimeout(() => {
      setupChannel(supabase);
    }, delay);
  };

  useEffect(() => {
    // 检测是否为移动设备
    isMobileRef.current = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    logger.log(`📱 设备类型: ${isMobileRef.current ? '移动端' : '电脑端'}`);

    // 如果已经是playing状态，直接跳转
    if (status === "playing") {
      logger.log(`🎯 房间 ${roomId} 状态为playing，直接跳转`);
      router.push("/game");
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    setupChannel(supabase);

    return () => {
      logger.log(`🧹 RoomWatcher 组件卸载清理，房间: ${roomId}`);
      cancelled = true;
      
      // 清理所有定时器
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
        cleanupTimeoutRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // 🔥 关键修复：只在没有跳转到游戏页时才立即清理
      if (channelRef.current && !isJumpingToGameRef.current) {
        logger.log(`🧹 立即清理房间监听，房间: ${roomId}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      } else if (channelRef.current && isJumpingToGameRef.current) {
        logger.log(`⏸️ 保留订阅（已跳转到游戏），延迟清理中，房间: ${roomId}`);
      }
    };
  }, [roomId, status, router]);

  // 🔥 添加移动端页面可见性变化处理
  useEffect(() => {
    if (!isMobileRef.current) return; // 只在移动端处理

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // 页面重新可见
        logger.log(`📱 移动端页面重新可见，房间: ${roomId}`);
        
        // 检查订阅状态
        if (!isSubscribed && channelRef.current === null) {
          logger.log(`📱 移动端检测到订阅断开，尝试重新连接`);
          setConnectionStatus("reconnecting");
          
          // 延迟重新连接，等待页面完全加载
          setTimeout(() => {
            const supabase = createClient();
            attemptReconnect(supabase);
          }, 1000);
        } else if (isSubscribed) {
          logger.log(`📱 移动端订阅正常，连接状态: ${connectionStatus}`);
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [roomId, isSubscribed, connectionStatus]);

  // 🔥 添加网络状态监听
  useEffect(() => {
    const handleOnline = async () => {
      logger.log(`🌐 网络恢复，尝试重新连接`);

      // 🔥 网络恢复时，重置重试计数，使用快速重连
      retryCountRef.current = 0;

      // 🔥 网络恢复后，等待500ms后再尝试重连
      setTimeout(async () => {
        if (channelRef.current === null || !isSubscribed) {
          setConnectionStatus("reconnecting");
          const supabase = createClient();

          // 🔥 先检查认证状态
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData?.session) {
            logger.log(`🔄 网络恢复后认证已过期，尝试刷新会话`);
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              logger.error(`❌ 刷新会话失败:`, refreshError);
              // 认证失败，不重连，等待页面处理
              return;
            }
          }

          // 🔥 使用快速重连模式（无指数退避）
          attemptReconnect(supabase, false);
        }
      }, 500); // 🔥 500ms后快速重连
    };

    const handleOffline = () => {
      logger.log(`🌐 网络断开`);
      setConnectionStatus("disconnected");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isSubscribed]);

  return null;
}