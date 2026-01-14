// components\game-view.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { rollDice, confirmTaskExecution, verifyTask } from "@/app/game/actions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Settings, MapPin, Heart, Zap, Trophy, Dice6, MessageSquareHeart, Plane, PlaneTakeoff, Rocket } from "lucide-react";

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

export default function GameView({ session, userId }: { session: GameSession; userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();

  const [status, setStatus] = useState<string>(session.status);
  const [currentPlayerId, setCurrentPlayerId] = useState(session.current_player_id ?? null);
  const [currentTurn, setCurrentTurn] = useState(session.current_turn ?? 1);
  const [player1Pos, setPlayer1Pos] = useState<number>(Number(session.game_state?.player1_position ?? 0));
  const [player2Pos, setPlayer2Pos] = useState<number>(Number(session.game_state?.player2_position ?? 0));
  // 用于动画显示的当前位置（逐步逼近真实位置）
  const [displayP1Pos, setDisplayP1Pos] = useState<number>(Number(session.game_state?.player1_position ?? 0));
  const [displayP2Pos, setDisplayP2Pos] = useState<number>(Number(session.game_state?.player2_position ?? 0));
  const [boardSize] = useState<number>(Number(session.game_state?.board_size ?? 49));
  const [specialCells, setSpecialCells] = useState<Record<number, string>>(() => {
    const sc = session.game_state?.special_cells ?? {};
    if (Object.keys(sc).length === 0) {
      // 默认放置 12 个幸运星与 12 个陷阱（避免起点与终点，且不重叠）
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

  const canRoll = currentPlayerId === userId && status === "playing" && !pendingTask;

  useEffect(() => {
    const channel = supabase
      .channel(`game_${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const s = (payload.new as any) ?? {};
          setStatus(s.status ?? "playing");
          const gs = (s.game_state ?? {}) as { player1_position?: number; player2_position?: number; board_size?: number };
          setCurrentPlayerId(s.current_player_id ?? null);
          setCurrentTurn(Number(s.current_turn ?? 1));
          setPlayer1Pos(Number(gs.player1_position ?? 0));
          setPlayer2Pos(Number(gs.player2_position ?? 0));
          const nextSpecial = (s.game_state?.special_cells ?? {}) as Record<number, string>;
          if (nextSpecial && Object.keys(nextSpecial).length > 0) {
            setSpecialCells(nextSpecial);
          }
          setPendingTask((s.game_state?.pending_task ?? null) as any);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_moves", filter: `session_id=eq.${session.id}` },
        (payload) => {
          const mv = (payload.new as any) ?? {};
          if (typeof mv.dice_value === "number") {
            setIsRolling(true);
            setTimeout(() => {
              setLastDice(mv.dice_value);
              setIsRolling(false);
            }, 600);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, session.id]);

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
        // Ignore errors
      }
    })();
  }, [supabase, session.room_id, session.player1_id, session.player2_id]);

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

  // 建立步数到网格坐标的映射，用于计算方向箭头
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

  // 棋子移动动画：逐步将显示位置逼近真实位置
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

  function handleRoll() {
    if (!canRoll) return;
    startTransition(async () => {
      await rollDice(session.id);
    });
  }
  async function onExecutorConfirm() {
    startTransition(async () => {
      await confirmTaskExecution(session.id);
    });
  }
  async function onObserverVerify(done: boolean) {
    startTransition(async () => {
      await verifyTask(session.id, done);
    });
  }

  return (
    <div className="max-w-md mx-auto h-screen flex flex-col p-2">
      <div className="flex items-center justify-between mb-4">
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
          className={`glass rounded-lg px-2 py-2 transition-all flex items-center justify-between ${
            currentPlayerId === session.player1_id ? "gradient-primary glow-pink" : ""
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
          className={`glass rounded-lg px-2 py-2 transition-all flex items-center justify-between ${
            currentPlayerId === session.player2_id ? "gradient-primary glow-pink" : "opacity-70"
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

      {/* 掷骰卡片：包含骰子显示与按钮 */}
      <div className="glass rounded-2xl p-4 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div
            className={`w-16 h-16 gradient-primary rounded-xl flex items-center justify-center text-3xl font-bold glow-pink transition-transform ${
              isRolling ? "animate-dice-roll" : ""
            } ${canRoll ? "animate-glow-pulse" : ""}`}
            style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
          >
            {isRolling ? "🎲" : (lastDice ?? "?")}
          </div>
          <Button
            onClick={handleRoll}
            disabled={!canRoll || isPending}
            className={`gradient-primary px-6 py-3 rounded-xl font-semibold glow-pink text-white flex items-center gap-2 transition-transform ${
              canRoll && !isPending ? "hover:scale-105 active:scale-95" : "opacity-50 cursor-not-allowed"
            } ${isPending ? "animate-button-press" : ""} ${canRoll && !isPending ? "" : ""}`}
          >
            <Dice6 className="w-5 h-5" />
            <span>{isPending ? "掷骰中" : "掷骰子"}</span>
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl p-2 mb-4">
        <div className="grid grid-cols-7 gap-1">
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
                className={`relative rounded-lg flex items-center justify-center transition-all hover:scale-105 ${
                  isEnd
                    ? "gradient-primary glow-pink"
                    : spType === "star"
                    ? "glass bg-brand-pink/20 border-brand-pink/30"
                    : spType === "trap"
                    ? "glass bg-purple-500/20 border-purple-500/30"
                    : "glass"
                }`}
                style={{ aspectRatio: '1 / 1' }}
              >
                {/* 方向箭头（指向下一格，居中显示；若有棋子则不显示） */}
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
                  <div className="absolute w-9 h-9 flex items-center justify-center z-10">
                    {isBoth ? (
                      <div className="w-9 h-9 gradient-primary rounded-full border-[3px] border-white shadow-lg glow-pink flex items-center justify-center animate-pulse">
                        <Plane className="w-5 h-5 text-white rotate-45" />
                      </div>
                    ) : isP1 ? (
                      <div className="w-9 h-9 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full border-[3px] border-white shadow-lg glow-pink flex items-center justify-center">
                        <Plane className="w-5 h-5 text-white drop-shadow rotate-45" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full border-[3px] border-white shadow-lg glow-purple flex items-center justify-center">
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

      

      {status === "completed" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass rounded-3xl p-6 max-w-sm w-full glow-pink text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center glow-pink">
                <Trophy className="w-8 h-8" />
              </div>
            </div>
            <h3 className="text-xl font-bold mb-2">游戏结束！</h3>
            <p className="text-gray-300 mb-4">
              赢家：
              {player1Pos === boardSize - 1 ? (p1Nickname || "玩家 1") : player2Pos === boardSize - 1 ? (p2Nickname || "玩家 2") : "—"}
            </p>
            <Button
              asChild
              className="w-full gradient-primary py-3 rounded-xl font-semibold glow-pink text-white"
            >
              <Link href="/lobby">返回大厅</Link>
            </Button>
          </div>
        </div>
      )}

      {pendingTask && (
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
            {pendingTask.status === "pending" && pendingTask.executor_id === userId ? (
              <div className="flex space-x-3">
                <Button
                  onClick={onExecutorConfirm}
                  disabled={isPending}
                  className="flex-1 gradient-primary py-3 rounded-xl font-semibold glow-pink text-white"
                >
                  完成任务
                </Button>
              </div>
            ) : pendingTask.status === "executed" && pendingTask.observer_id === userId ? (
              <div className="flex space-x-3">
                <Button
                  onClick={() => onObserverVerify(true)}
                  disabled={isPending}
                  className="flex-1 bg-green-600 py-3 rounded-xl font-semibold text-white hover:bg-green-700"
                >
                  已执行
                </Button>
                <Button
                  onClick={() => onObserverVerify(false)}
                  disabled={isPending}
                  className="flex-1 bg-red-600 py-3 rounded-xl font-semibold text-white hover:bg-red-700"
                >
                  未执行
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
