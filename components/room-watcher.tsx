// components/room-watcher.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const maxRetries = 5;
  
  // 🔥 标记是否正在跳转到游戏页
  const isJumpingToGameRef = useRef(false);
  // 🔥 检测是否为移动设备
  const isMobileRef = useRef(false);

  // 防抖刷新函数 - 3秒内最多刷新一次
  const debouncedRefresh = () => {
    const now = Date.now();
    if (now - lastRefreshTime > 3000) {
      console.log(`🔄 RoomWatcher 触发刷新，房间: ${roomId}`);
      setLastRefreshTime(now);
      router.refresh();
    } else {
      console.log(`⏸️ RoomWatcher 防抖中，跳过刷新，房间: ${roomId}`);
    }
  };

  // 🔥 修复：跳转到游戏页（添加延迟清理）
  const jumpToGame = () => {
    console.log(`🎮 RoomWatcher 检测到游戏开始，跳转到游戏页，房间: ${roomId}`);
    
    // 标记正在跳转到游戏页
    isJumpingToGameRef.current = true;
    
    // 清除可能存在的刷新超时
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    // 🔥 延迟清理：5秒后清理订阅
    if (channelRef.current) {
      console.log(`⏳ 设置5秒延迟清理，房间: ${roomId}`);
      cleanupTimeoutRef.current = setTimeout(() => {
        console.log(`🧹 延迟清理房间监听，房间: ${roomId}`);
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isJumpingToGameRef.current = false;
      }, 5000); // 5秒延迟，给游戏页面足够时间建立订阅
    }
    
    // 跳转到游戏页面
    router.push("/game");
  };

  // 🔥 设置订阅，带重试机制
  const setupChannel = async (supabase: any) => {
    try {
      // 等待认证会话就绪
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        await new Promise<void>((resolve, reject) => {
          const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
              authListener.subscription.unsubscribe();
              resolve();
            }
          });
          
          // 5秒超时
          setTimeout(() => {
            authListener.subscription.unsubscribe();
            resolve();
          }, 5000);
        });
      }

      console.log(`🎧 建立房间监听，房间ID: ${roomId}`);
      
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
            console.log(`📡 RoomWatcher 接收到房间更新，房间: ${roomId}`);
            
            const newStatus = (payload.new as any)?.status;
            const oldStatus = (payload.old as any)?.status;
            const newPlayer1Theme = (payload.new as any)?.player1_theme_id;
            const oldPlayer1Theme = (payload.old as any)?.player1_theme_id;
            const newPlayer2Theme = (payload.new as any)?.player2_theme_id;
            const oldPlayer2Theme = (payload.old as any)?.player2_theme_id;
            
            // 状态变化处理
            if (newStatus !== oldStatus) {
              console.log(`🔄 房间状态变化: ${oldStatus} -> ${newStatus}`);
              
              if (newStatus === "playing") {
                jumpToGame();
              } else if (newStatus === "waiting") {
                if (refreshTimeoutRef.current) {
                  clearTimeout(refreshTimeoutRef.current);
                }
                
                refreshTimeoutRef.current = setTimeout(() => {
                  if (channelRef.current) {
                    debouncedRefresh();
                  }
                }, 500);
              }
            } 
            // 主题选择变化处理
            else if (newPlayer1Theme !== oldPlayer1Theme || newPlayer2Theme !== oldPlayer2Theme) {
              console.log(`🔄 房间主题变化: 玩家1: ${oldPlayer1Theme} -> ${newPlayer1Theme}, 玩家2: ${oldPlayer2Theme} -> ${newPlayer2Theme}`);
              
              if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
              }
              
              refreshTimeoutRef.current = setTimeout(() => {
                if (channelRef.current) {
                  debouncedRefresh();
                }
              }, 500);
            }
          }
        )
        .subscribe((status) => {
          console.log(`📡 RoomWatcher 订阅状态: ${status}, 房间: ${roomId}`);
          setIsSubscribed(status === "SUBSCRIBED");
          
          if (status === "SUBSCRIBED") {
            console.log(`✅ 房间监听已建立，房间: ${roomId}`);
            setConnectionStatus("connected");
            retryCountRef.current = 0; // 重置重试计数
          } else if (status === "CHANNEL_ERROR") {
            console.error(`❌ 房间监听错误，房间: ${roomId}`);
            setConnectionStatus("disconnected");
            
            // 🔥 移动端使用更积极的重连策略
            if (isMobileRef.current) {
              console.log(`📱 移动端检测到连接断开，立即重连`);
              attemptReconnect(supabase);
            } else {
              // 电脑端延迟重连
              setTimeout(() => {
                attemptReconnect(supabase);
              }, 3000);
            }
          }
        });

    } catch (error) {
      console.error(`❌ RoomWatcher 初始化失败，房间: ${roomId}:`, error);
      setConnectionStatus("disconnected");
    }
  };

  // 🔥 重连机制
  const attemptReconnect = (supabase: any) => {
    if (retryCountRef.current >= maxRetries) {
      console.error(`❌ 达到最大重试次数 (${maxRetries})，停止重连`);
      setConnectionStatus("disconnected");
      return;
    }

    retryCountRef.current++;
    setConnectionStatus("reconnecting");
    
    console.log(`🔄 尝试重新连接 (${retryCountRef.current}/${maxRetries})，房间: ${roomId}`);
    
    // 清理旧的订阅
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // 指数退避重连
    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000); // 最大10秒
    console.log(`⏳ ${delay/1000}秒后重连，房间: ${roomId}`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      setupChannel(supabase);
    }, delay);
  };

  useEffect(() => {
    // 检测是否为移动设备
    isMobileRef.current = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    console.log(`📱 设备类型: ${isMobileRef.current ? '移动端' : '电脑端'}`);

    // 如果已经是playing状态，直接跳转
    if (status === "playing") {
      console.log(`🎯 房间 ${roomId} 状态为playing，直接跳转`);
      router.push("/game");
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    setupChannel(supabase);

    return () => {
      console.log(`🧹 RoomWatcher 组件卸载清理，房间: ${roomId}`);
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
        console.log(`🧹 立即清理房间监听，房间: ${roomId}`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      } else if (channelRef.current && isJumpingToGameRef.current) {
        console.log(`⏸️ 保留订阅（已跳转到游戏），延迟清理中，房间: ${roomId}`);
      }
    };
  }, [roomId, status, router]);

  // 🔥 添加移动端页面可见性变化处理
  useEffect(() => {
    if (!isMobileRef.current) return; // 只在移动端处理

    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // 页面重新可见
        console.log(`📱 移动端页面重新可见，房间: ${roomId}`);
        
        // 检查订阅状态
        if (!isSubscribed && channelRef.current === null) {
          console.log(`📱 移动端检测到订阅断开，尝试重新连接`);
          setConnectionStatus("reconnecting");
          
          // 延迟重新连接，等待页面完全加载
          setTimeout(() => {
            const supabase = createClient();
            attemptReconnect(supabase);
          }, 1000);
        } else if (isSubscribed) {
          console.log(`📱 移动端订阅正常，连接状态: ${connectionStatus}`);
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
    const handleOnline = () => {
      console.log(`🌐 网络恢复，尝试重新连接`);
      if (channelRef.current === null || !isSubscribed) {
        setConnectionStatus("reconnecting");
        const supabase = createClient();
        attemptReconnect(supabase);
      }
    };
    
    const handleOffline = () => {
      console.log(`🌐 网络断开`);
      setConnectionStatus("disconnected");
    };
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isSubscribed]);

  // 🔥 连接状态显示
  const renderConnectionStatus = () => {
    if (process.env.NODE_ENV === 'development' || connectionStatus !== "connected") {
      const statusColors = {
        connected: "bg-green-500",
        disconnected: "bg-red-500",
        reconnecting: "bg-yellow-500"
      };
      
      const statusText = {
        connected: "✅ 连接正常",
        disconnected: "❌ 连接断开",
        reconnecting: "🔄 重连中..."
      };
      
      return (
        <div className="fixed bottom-2 left-2 z-50">
          <div className={`px-2 py-1 rounded text-xs ${statusColors[connectionStatus]} text-white`}>
            {statusText[connectionStatus]}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {renderConnectionStatus()}
      {null}
    </>
  );
}