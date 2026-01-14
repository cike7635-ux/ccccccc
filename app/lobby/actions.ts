// app\lobby\actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ThemeRecord = {
  id: string;
  title: string;
  description: string | null;
  task_count: number | null;
  created_at: string;
  creator_id: string;
};

type RoomRecord = {
  id: string;
  room_code: string;
  status: string;
  creator_id: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player1_nickname: string | null;
  player2_nickname: string | null;
  player1_theme_id: string | null;
  player2_theme_id: string | null;
  created_at: string;
};

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("未登录，无法执行该操作");
  }
  return { supabase, user: data.user } as const;
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去除易混淆字符
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function listAvailableThemes(): Promise<{ data: ThemeRecord[]; error?: string }> {
  const { supabase, user } = await requireUser();
  // 仅列出我创建的主题（不包含公开主题），避免选择他人主题导致 RLS 读不到任务
  const { data, error } = await supabase
    .from("themes")
    .select("id,title,description,task_count,created_at,creator_id")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };

  let list = (data ?? []) as ThemeRecord[];
  if (list.length === 0) {
    // 首次进入大厅时进行一次兜底初始化：创建昵称档案与默认题库
    try {
      const { ensureProfile } = await import("@/lib/profile");
      await ensureProfile();
    } catch {}

    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.join(process.cwd(), "lib", "tasks.json");
      const content = await fs.readFile(filePath, "utf-8");
      const templates: { title: string; description?: string; tasks: string[] }[] = JSON.parse(content);

      for (const tpl of templates) {
        const { data: existing } = await supabase
          .from("themes")
          .select("id")
          .eq("creator_id", user.id)
          .eq("title", tpl.title)
          .maybeSingle();
        let themeId: string | null = existing?.id ?? null;
        if (!themeId) {
          const { data: created } = await supabase
            .from("themes")
            .insert({
              title: tpl.title,
              description: tpl.description ?? null,
              creator_id: user.id,
              is_public: false,
              task_count: (tpl.tasks?.length ?? 0),
            })
            .select("id")
            .single();
          themeId = created?.id ?? null;
        }
        if (themeId) {
          let index = 0;
          for (const desc of (tpl.tasks ?? [])) {
            await supabase
              .from("tasks")
              .insert({
                theme_id: themeId,
                description: desc,
                type: "default",
                order_index: index++,
                is_ai_generated: false,
              });
          }
        }
      }

      const { data: after } = await supabase
        .from("themes")
        .select("id,title,description,task_count,created_at,creator_id")
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });
      list = (after ?? []) as ThemeRecord[];
    } catch {
      // 兜底初始化失败时，保持空列表并让 UI 提示
    }
  }

  return { data: list };
}

export async function getRoomById(id: string): Promise<{ data: RoomRecord | null; error?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("rooms")
    .select(
      "id,room_code,status,creator_id,player1_id,player2_id,player1_nickname,player2_nickname,player1_theme_id,player2_theme_id,created_at",
    )
    .eq("id", id)
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as RoomRecord };
}

export async function createRoom(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const player1ThemeId = String(formData.get("player1_theme_id") ?? "").trim();
  if (!player1ThemeId) throw new Error("请选择一个主题");

  // 读取昵称快照（可选）
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  const code = generateRoomCode();
  const { data: room, error } = await supabase
    .from("rooms")
    .insert({
      room_code: code,
      creator_id: user.id,
      player1_id: user.id,
      player1_nickname: profile?.nickname ?? null,
      player1_theme_id: player1ThemeId,
      status: "waiting",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/lobby");
  redirect(`/lobby/${room.id}`);
}

export async function joinRoom(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  // 忽略大小写：统一转换为大写
  const roomCode = String(formData.get("room_code") ?? "").trim().toUpperCase();
  const myThemeId = String(formData.get("player2_theme_id") ?? "").trim();
  if (!roomCode) {
    redirect(`/lobby?error=${encodeURIComponent("请输入房间码")}`);
  }
  if (!myThemeId) {
    redirect(`/lobby?error=${encodeURIComponent("请选择一个主题")}`);
  }

  // 找到等待中的房间
  const { data: room, error: fetchErr } = await supabase
    .from("rooms")
    .select("id,status,player2_id")
    .eq("room_code", roomCode)
    .eq("status", "waiting")
    .maybeSingle();
  if (fetchErr) {
    redirect(`/lobby?error=${encodeURIComponent(fetchErr.message)}`);
  }
  if (!room) {
    redirect(`/lobby?error=${encodeURIComponent("房间不存在或已开始")}`);
  }
  if ((room as any).player2_id) {
    redirect(`/lobby?error=${encodeURIComponent("房间已满员")}`);
  }

  // 昵称快照（可选）
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  // 加入并设置主题（满足 rooms_update_join_waiting 的条件）
  const { data: updated, error } = await supabase
    .from("rooms")
    .update({
      player2_id: user.id,
      player2_nickname: profile?.nickname ?? null,
      player2_theme_id: myThemeId,
    })
    .eq("id", room.id)
    .eq("status", "waiting")
    .is("player2_id", null)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/lobby/${updated.id}`);
  redirect(`/lobby/${updated.id}`);
}

export async function setMyTheme(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const roomId = String(formData.get("room_id") ?? "");
  const themeId = String(formData.get("theme_id") ?? "");
  if (!roomId) throw new Error("缺少房间 ID");
  if (!themeId) throw new Error("请选择主题");

  const { data: room, error: fetchErr } = await supabase
    .from("rooms")
    .select("player1_id,player2_id")
    .eq("id", roomId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const patch =
    user.id === room.player1_id
      ? { player1_theme_id: themeId }
      : { player2_theme_id: themeId };

  const { error } = await supabase
    .from("rooms")
    .update(patch)
    .eq("id", roomId);
  if (error) throw new Error(error.message);
  revalidatePath(`/lobby/${roomId}`);
}

export async function startGame(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const roomId = String(formData.get("room_id") ?? "");
  if (!roomId) throw new Error("缺少房间 ID");

  const { data: room, error: fetchErr } = await supabase
    .from("rooms")
    .select(
      "id,status,player1_id,player2_id,player1_theme_id,player2_theme_id",
    )
    .eq("id", roomId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  if (room.status !== "waiting") throw new Error("房间状态不可开始");
  if (!room.player1_id || !room.player2_id) throw new Error("玩家未齐");
  if (!room.player1_theme_id || !room.player2_theme_id) throw new Error("主题未齐");

  const starter = Math.random() < 0.5 ? room.player1_id : room.player2_id;

  // 初始化棋盘特殊格（0-based 索引）：

  const starIndices = [2, 4, 6, 8, 9, 11,12, 15, 22, 25, 27, 31,  36, 37, 40, 41, 43];
  const trapIndices = [3, 14, 19, 33, 42, 46, 47];
  const specialCells: Record<number, "star" | "trap"> = {};
  for (const i of starIndices) specialCells[i] = "star";
  for (const i of trapIndices) specialCells[i] = "trap";

  const { data: session, error: insertErr } = await supabase
    .from("game_sessions")
    .insert({
      room_id: room.id,
      player1_id: room.player1_id,
      player2_id: room.player2_id,
      current_player_id: starter,
      status: "playing",
      game_state: {
        player1_position: 0,
        player2_position: 0,
        board_size: 49,
        special_cells: specialCells,
      },
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);

  const { error: updateErr } = await supabase
    .from("rooms")
    .update({ status: "playing" })
    .eq("id", room.id);
  if (updateErr) throw new Error(updateErr.message);

  revalidatePath(`/game`);
  redirect(`/game`);
}