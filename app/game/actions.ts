// app\game\actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";

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

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("未登录，无法执行该操作");
  }
  return { supabase, user: data.user } as const;
}

export async function getActiveSession(): Promise<{
  session: GameSession | null;
  error?: string;
}> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("game_sessions")
    .select(
      "id, room_id, player1_id, player2_id, current_player_id, current_turn, status, game_state",
    )
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .eq("status", "playing")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { session: null, error: error.message };
  return { session: (data ?? null) as GameSession | null };
}

async function archiveCompletedSession(sessionId: string): Promise<{ success: boolean; error?: string }>{
  const { supabase } = await requireUser();
  // 获取会话与最终棋盘状态
  const { data: session, error: fetchErr } = await supabase
    .from("game_sessions")
    .select("id, room_id, player1_id, player2_id, started_at, ended_at, status, game_state")
    .eq("id", sessionId)
    .single();
  if (fetchErr) return { success: false, error: fetchErr.message };
  if (!session || session.status !== "completed") {
    return { success: false, error: "对局未完成或不存在" };
  }

  const state = (session.game_state ?? {}) as any;
  const boardSize = Number(state.board_size ?? 49);
  const p1 = Number(state.player1_position ?? 0);
  const p2 = Number(state.player2_position ?? 0);
  const winnerId = p1 === boardSize - 1 ? session.player1_id : p2 === boardSize - 1 ? session.player2_id : null;

  // 读取本局所有带任务的回合
  const { data: moves, error: movesErr } = await supabase
    .from("game_moves")
    .select("player_id, task_id, task_completed, created_at, new_position")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });
  if (movesErr) return { success: false, error: movesErr.message };

  const taskIds = (moves ?? []).map((m: any) => m.task_id).filter((id: string | null) => !!id);
  let taskMap: Record<string, string> = {};
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, description")
      .in("id", taskIds as any);
    for (const t of tasks ?? []) taskMap[t.id] = t.description;
  }

  const special: Record<number, string> = (state.special_cells ?? {}) as any;
  const results = [] as Array<{ executor_id: string; observer_id: string; task_text: string | null; completed: boolean; timestamp: string }>;
  for (const m of moves ?? []) {
    if (!m.task_id) continue;
    const cellType = special[m.new_position]; // 'star' | 'trap' | undefined
    const executorId = cellType === "trap" ? m.player_id : (m.player_id === session.player1_id ? session.player2_id : session.player1_id);
    const observerId = executorId === session.player1_id ? session.player2_id : session.player1_id;
    const taskText = taskMap[m.task_id] ?? null;
    results.push({
      executor_id: executorId,
      observer_id: observerId,
      task_text: taskText,
      completed: Boolean(m.task_completed),
      timestamp: String(m.created_at ?? new Date().toISOString()),
    });
  }

  // 写入历史
  const { error: insertErr } = await supabase
    .from("game_history")
    .insert({
      room_id: session.room_id,
      session_id: session.id,
      player1_id: session.player1_id,
      player2_id: session.player2_id,
      winner_id: winnerId,
      started_at: session.started_at,
      ended_at: session.ended_at ?? new Date().toISOString(),
      task_results: results,
    });
  if (insertErr) return { success: false, error: insertErr.message };

  // 清理临时数据：先删除 moves，再删除 session
  const { error: delMovesErr } = await supabase
    .from("game_moves")
    .delete()
    .eq("session_id", session.id);
  if (delMovesErr) return { success: false, error: delMovesErr.message };

  const { error: delSessionErr } = await supabase
    .from("game_sessions")
    .delete()
    .eq("id", session.id);
  if (delSessionErr) return { success: false, error: delSessionErr.message };

  return { success: true };
}
export async function rollDice(sessionId: string): Promise<{
  success: boolean;
  error?: string;
  diceValue?: number;
}> {
  const { supabase, user } = await requireUser();

  // 读取会话，校验轮到我
  const { data: session, error: fetchErr } = await supabase
    .from("game_sessions")
    .select(
      "id, room_id, player1_id, player2_id, current_player_id, current_turn, status, game_state",
    )
    .eq("id", sessionId)
    .single();
  if (fetchErr) return { success: false, error: fetchErr.message };
  if (!session) return { success: false, error: "会话不存在" };
  if (session.status !== "playing") return { success: false, error: "游戏未处于进行中" };
  if (session.current_player_id !== user.id) return { success: false, error: "当前不在你的回合" };

  const state = (session.game_state ?? {}) as {
    player1_position?: number;
    player2_position?: number;
    board_size?: number;
    special_cells?: Record<number, string>;
  };
  const boardSize = Number(state.board_size ?? 49);

  const isPlayer1 = session.player1_id === user.id;
  const oldPos = Number(isPlayer1 ? state.player1_position ?? 0 : state.player2_position ?? 0);

  const dice = Math.floor(Math.random() * 6) + 1;
  const tentativeNew = oldPos + dice;
  const newPos = tentativeNew >= boardSize ? boardSize - 1 : tentativeNew;

  // 落库：记录动作
  const { error: moveErr } = await supabase
    .from("game_moves")
    .insert({
      session_id: session.id,
      player_id: user.id,
      dice_value: dice,
      old_position: oldPos,
      new_position: newPos,
    });
  if (moveErr) return { success: false, error: moveErr.message };

  // 抵达终点：直接判定胜利并结束游戏，不触发任何任务
  if (newPos === boardSize - 1) {
    const patchState = {
      player1_position: isPlayer1 ? newPos : Number(state.player1_position ?? 0),
      player2_position: isPlayer1 ? Number(state.player2_position ?? 0) : newPos,
      board_size: boardSize,
      special_cells: (state as any).special_cells ?? {},
    } as any;
    const { error: winErr } = await supabase
      .from("game_sessions")
      .update({
        game_state: patchState,
        status: "completed",
        current_player_id: null,
        ended_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .eq("current_player_id", user.id);
    if (winErr) return { success: false, error: winErr.message };

    // 同步房间状态为 completed，避免后续加入
    const { error: roomErr } = await supabase
      .from("rooms")
      .update({ status: "completed" })
      .eq("id", session.room_id);
    if (roomErr) return { success: false, error: roomErr.message };
    // 归档历史并清理临时记录
    await archiveCompletedSession(session.id);
    return { success: true, diceValue: dice };
  }

  // 触发判断：特殊格或撞机
  const otherIsPlayer1 = !isPlayer1;
  const otherPos = Number(otherIsPlayer1 ? state.player1_position ?? 0 : state.player2_position ?? 0);
  const specialType = (state.special_cells ?? {})[newPos] as string | undefined;
  const isCollision = newPos === otherPos;

  // 构造更新后的棋盘位置
  const patchStateBase = {
    player1_position: isPlayer1 ? newPos : Number(state.player1_position ?? 0),
    player2_position: isPlayer1 ? Number(state.player2_position ?? 0) : newPos,
    board_size: boardSize,
    special_cells: state.special_cells ?? {},
  } as any;

  // 如果需要任务，生成 pending_task 并冻结回合推进（保持 current_player_id 不变）
  if (specialType || isCollision) {
    // 读取房间主题以抽任务
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("player1_theme_id, player2_theme_id, player1_id, player2_id")
      .eq("id", session.room_id)
      .single();
    if (roomErr) return { success: false, error: roomErr.message };

    let triggerType: "star" | "trap" | "collision" = "star";
    let executorId: string = room.player2_id!;
    let observerId: string = room.player1_id!;
    let themeIdForTask: string | null = null;

    if (isCollision) {
      triggerType = "collision";
      // 当前掷骰者是观察者，执行者为对方
      observerId = user.id;
      executorId = isPlayer1 ? room.player2_id! : room.player1_id!;
      themeIdForTask = isPlayer1 ? room.player1_theme_id : room.player2_theme_id;
    } else if (specialType === "star") {
      // 你是观察者，你从自己的题库给对方
      observerId = user.id;
      executorId = isPlayer1 ? room.player2_id! : room.player1_id!;
      themeIdForTask = isPlayer1 ? room.player1_theme_id : room.player2_theme_id;
      triggerType = "star";
    } else if (specialType === "trap") {
      // 你是执行者，对方从对方题库给你
      executorId = user.id;
      observerId = isPlayer1 ? room.player2_id! : room.player1_id!;
      themeIdForTask = isPlayer1 ? room.player2_theme_id : room.player1_theme_id;
      triggerType = "trap";
    }

    // 从对应主题抽取任务（随机）
    let pickedTask: { id: string; description: string; type?: string } | null = null;
    if (themeIdForTask) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, description, type")
        .eq("theme_id", themeIdForTask)
        .limit(50);
      if (tasks && tasks.length > 0) {
        const idx = Math.floor(Math.random() * tasks.length);
        pickedTask = tasks[idx] as any;
      }
    }

    const pendingTask = {
      type: triggerType,
      position: newPos,
      executor_id: executorId,
      observer_id: observerId,
      task: pickedTask,
      status: "pending",
      metadata: {
        dice,
        attacker_old_position: isCollision ? oldPos : undefined,
      },
    } as const;

    const { error: updateErr } = await supabase
      .from("game_sessions")
      .update({
        game_state: {
          ...patchStateBase,
          pending_task: pendingTask,
        },
        // 不推进回合，不切换当前玩家，待确认后再推进
      })
      .eq("id", session.id)
      .eq("current_player_id", user.id);
    if (updateErr) return { success: false, error: updateErr.message };

    // 更新本次 move 的任务引用（便于后续统计）；暂时不写 task_completed，等确认时更新
    if (pickedTask?.id) {
      const { data: latestMove } = await supabase
        .from("game_moves")
        .select("id")
        .eq("session_id", session.id)
        .eq("player_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestMove?.id) {
        await supabase
          .from("game_moves")
          .update({ task_id: pickedTask.id })
          .eq("id", latestMove.id);
      }
    }

    return { success: true, diceValue: dice };
  }

  // 正常情况：无任务，推进回合并切换玩家
  const nextPlayer = isPlayer1 ? session.player2_id : session.player1_id;
  const { error: updateErr } = await supabase
    .from("game_sessions")
    .update({
      game_state: patchStateBase,
      current_turn: (session.current_turn ?? 1) + 1,
      current_player_id: nextPlayer,
    })
    .eq("id", session.id)
    .eq("current_player_id", user.id);
  if (updateErr) return { success: false, error: updateErr.message };

  return { success: true, diceValue: dice };
}

export async function confirmTaskExecution(sessionId: string): Promise<{ success: boolean; error?: string }>{
  const { supabase, user } = await requireUser();
  const { data: session, error: fetchErr } = await supabase
    .from("game_sessions")
    .select("id,current_player_id,game_state,player1_id,player2_id")
    .eq("id", sessionId)
    .single();
  if (fetchErr) return { success: false, error: fetchErr.message };
  const state = (session.game_state ?? {}) as any;
  const pt = state.pending_task;
  if (!pt) return { success: false, error: "当前没有待处理任务" };
  if (pt.executor_id !== user.id) return { success: false, error: "仅执行者可确认完成" };
  if (pt.status !== "pending") return { success: false, error: "任务状态不可执行" };

  const newState = { ...state, pending_task: { ...pt, status: "executed" } };
  const { error: updateErr } = await supabase
    .from("game_sessions")
    .update({ game_state: newState })
    .eq("id", session.id);
  if (updateErr) return { success: false, error: updateErr.message };
  return { success: true };
}

export async function verifyTask(sessionId: string, confirmed: boolean): Promise<{ success: boolean; error?: string }>{
  const { supabase, user } = await requireUser();
  const { data: session, error: fetchErr } = await supabase
    .from("game_sessions")
    .select("id,current_player_id,current_turn,game_state,player1_id,player2_id")
    .eq("id", sessionId)
    .single();
  if (fetchErr) return { success: false, error: fetchErr.message };
  const state = (session.game_state ?? {}) as any;
  const pt = state.pending_task;
  if (!pt) return { success: false, error: "当前没有待处理任务" };
  if (pt.observer_id !== user.id) return { success: false, error: "仅观察者可进行确认" };
  if (pt.status !== "executed") return { success: false, error: "执行者尚未确认完成" };

  const isPlayer1 = session.player1_id === user.id || pt.executor_id === session.player1_id;
  const boardSize = Number(state.board_size ?? 49);
  let p1 = Number(state.player1_position ?? 0);
  let p2 = Number(state.player2_position ?? 0);

  if (pt.type === "collision") {
    if (confirmed) {
      // 对方完成任务：撞击者退回到回合开始前的格子
      const attackerId = pt.observer_id;
      const old = Number(pt.metadata?.attacker_old_position ?? 0);
      if (attackerId === session.player1_id) p1 = old; else p2 = old;
    } else {
      // 对方未完成任务：被撞者退回起点（索引0）
      const targetId = pt.executor_id;
      if (targetId === session.player1_id) p1 = 0; else p2 = 0;
    }
  } else {
    if (!confirmed) {
      // 未执行：执行者随机倒退 0-3 格
      const penalty = Math.floor(Math.random() * 4); // 0..3
      const targetId = pt.executor_id;
      if (targetId === session.player1_id) {
        p1 = Math.max(0, p1 - penalty);
      } else {
        p2 = Math.max(0, p2 - penalty);
      }
      pt.metadata = { ...(pt.metadata ?? {}), penalty };
    }
  }

  // 清理 pending 并推进回合到另一名玩家
  const nextPlayer = session.current_player_id === session.player1_id ? session.player2_id : session.player1_id;
  const patchState = {
    player1_position: p1,
    player2_position: p2,
    board_size: boardSize,
    special_cells: state.special_cells ?? {},
  } as any;

  const { error: updateErr } = await supabase
    .from("game_sessions")
    .update({
      game_state: { ...patchState },
      current_turn: (session.current_turn ?? 1) + 1,
      current_player_id: nextPlayer,
    })
    .eq("id", session.id);
  if (updateErr) return { success: false, error: updateErr.message };

  // 回写最新一条 move 的任务完成状态
  // 精确更新：定位本次任务对应的 move（按 task_id）
  const { data: targetMove } = await supabase
    .from("game_moves")
    .select("id")
    .eq("session_id", session.id)
    .eq("task_id", pt.task?.id ?? null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (targetMove?.id) {
    await supabase
      .from("game_moves")
      .update({ task_completed: confirmed })
      .eq("id", targetMove.id);
  }

  return { success: true };
}