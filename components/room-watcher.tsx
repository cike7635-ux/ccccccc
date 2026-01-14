// components\room-watcher.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RoomWatcher({ roomId, status }: { roomId: string; status?: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const setup = async () => {
      // 初始状态为 playing 则直接跳转
      if (status === "playing") {
        router.push("/game");
        return;
      }

      // 等待会话就绪，避免订阅/查询在未携带 JWT 的情况下被 RLS 拒绝
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          await new Promise<void>((resolve) => {
            const { data: auth } = supabase.auth.onAuthStateChange((_event, s) => {
              if (s) {
                auth.subscription.unsubscribe();
                resolve();
              }
            });
          });
        }
      } catch {
        // 如果获取会话失败，继续后续逻辑（中间件保证已登录）
      }

      if (cancelled) return;

      const channel = supabase
        .channel(`room_${roomId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
          (payload) => {
            const nextStatus = (payload.new as any)?.status;
            if (nextStatus === "playing") {
              router.push("/game");
            } else {
              router.refresh();
            }
          },
        )
        .subscribe((state) => {
          if (state === "SUBSCRIBED") {
            (async () => {
              try {
                const { data } = await supabase
                  .from("rooms")
                  .select("status")
                  .eq("id", roomId)
                  .maybeSingle();
                if ((data as any)?.status === "playing") {
                  router.push("/game");
                } else {
                  router.refresh();
                }
              } catch {
                // 兜底查询失败时，交给后续事件触发刷新
              }
            })();
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let cleanup: (() => void) | undefined;
    setup().then((fn) => {
      cleanup = fn;
    });

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [roomId, status, router]);

  return null;
}