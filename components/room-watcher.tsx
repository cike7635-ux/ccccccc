// components/room-watcher.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RoomWatcher({ roomId, status }: { roomId: string; status?: string }) {
  const router = useRouter();
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const channelRef = useRef<any>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖刷新函数 - 3秒内最多刷新一次
  const debouncedRefresh = () => {
    const now = Date.now();
    if (now - lastRefreshTime > 3000) { // 3秒防抖
      console.log(`🔄 RoomWatcher 触发刷新，房间: ${roomId}`);
      setLastRefreshTime(now);
      router.refresh();
    } else {
      console.log(`⏸️ RoomWatcher 防抖中，跳过刷新，房间: ${roomId}`);
    }
  };

  // 立即跳转到游戏页
  const jumpToGame = () => {
    console.log(`🎮 RoomWatcher 检测到游戏开始，跳转到游戏页，房间: ${roomId}`);
    router.push("/game");
  };

  useEffect(() => {
    // 如果已经是playing状态，直接跳转
    if (status === "playing") {
      console.log(`🎯 房间 ${roomId} 状态为playing，直接跳转`);
      router.push("/game");
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const setupChannel = async () => {
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

        if (cancelled) return;

        console.log(`🎧 建立房间监听，房间ID: ${roomId}`);
        
        // 创建房间状态监听通道
        channelRef.current = supabase
          .channel(`room_${roomId}`)
          .on(
            "postgres_changes",
            { 
              event: "UPDATE", // 只监听UPDATE事件
              schema: "public", 
              table: "rooms", 
              filter: `id=eq.${roomId}` 
            },
            (payload) => {
              console.log(`📡 RoomWatcher 接收到房间更新，房间: ${roomId}`, payload);
              
              const newStatus = (payload.new as any)?.status;
              const oldStatus = (payload.old as any)?.status;
              
              // 只有状态真正变化时才处理
              if (newStatus !== oldStatus) {
                console.log(`🔄 房间状态变化: ${oldStatus} -> ${newStatus}`);
                
                if (newStatus === "playing") {
                  // 游戏开始，立即跳转
                  jumpToGame();
                } else if (newStatus === "waiting") {
                  // 等待状态，使用防抖刷新
                  if (refreshTimeoutRef.current) {
                    clearTimeout(refreshTimeoutRef.current);
                  }
                  
                  refreshTimeoutRef.current = setTimeout(() => {
                    if (!cancelled) {
                      debouncedRefresh();
                    }
                  }, 500); // 延迟500ms，避免频繁刷新
                }
              }
            }
          )
          .subscribe((status) => {
            console.log(`📡 RoomWatcher 订阅状态: ${status}, 房间: ${roomId}`);
            setIsSubscribed(status === "SUBSCRIBED");
            
            if (status === "SUBSCRIBED") {
              console.log(`✅ 房间监听已建立，房间: ${roomId}`);
            } else if (status === "CHANNEL_ERROR") {
              console.error(`❌ 房间监听错误，房间: ${roomId}`);
            }
          });

      } catch (error) {
        console.error(`❌ RoomWatcher 初始化失败，房间: ${roomId}:`, error);
      }
    };

    setupChannel();

    return () => {
      console.log(`🧹 清理房间监听，房间: ${roomId}`);
      cancelled = true;
      
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, status, router]); // 依赖项尽量少

  // 监听组件显示状态，优化性能
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log(`👁️ 页面隐藏，暂停房间监听更新，房间: ${roomId}`);
      } else {
        console.log(`👁️ 页面显示，恢复房间监听，房间: ${roomId}`);
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [roomId]);

  return null;
}