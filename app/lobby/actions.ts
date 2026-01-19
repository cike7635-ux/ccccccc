// app\lobby\actions.ts - 优化版
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 🔥 添加主题列表缓存
const themesCache = new Map<string, { data: any; expiresAt: number }>();
const THEMES_CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

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

/**
 * 🔥 初始化默认主题（后台异步执行）
 */
async function initializeDefaultThemes(supabase: any, userId: string): Promise<ThemeRecord[]> {
  try {
    console.log(`🔄 开始初始化默认主题，用户: ${userId}`);
    const startTime = Date.now();
    
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.join(process.cwd(), "lib", "tasks.json");
    const content = await fs.readFile(filePath, "utf-8");
    const templates: { title: string; description?: string; tasks: string[] }[] = JSON.parse(content);

    for (const tpl of templates) {
      // 检查是否已存在同名主题
      const { data: existing } = await supabase
        .from("themes")
        .select("id")
        .eq("creator_id", userId)
        .eq("title", tpl.title)
        .maybeSingle();
      
      let themeId: string | null = existing?.id ?? null;
      
      if (!themeId) {
        console.log(`📝 创建主题: ${tpl.title}`);
        const { data: created } = await supabase
          .from("themes")
          .insert({
            title: tpl.title,
            description: tpl.description ?? null,
            creator_id: userId,
            is_public: false,
            task_count: (tpl.tasks?.length ?? 0),
          })
          .select("id")
          .single();
        themeId = created?.id ?? null;
      }
      
      if (themeId) {
        // 🔥 批量插入任务，而不是逐条插入
        const taskCount = tpl.tasks?.length ?? 0;
        if (taskCount > 0) {
          const tasksToInsert = tpl.tasks!.map((desc, index) => ({
            theme_id: themeId,
            description: desc,
            type: "default",
            order_index: index,
            is_ai_generated: false,
          }));
          
          console.log(`📦 批量插入 ${tasksToInsert.length} 个任务到主题: ${tpl.title}`);
          const { error } = await supabase
            .from("tasks")
            .insert(tasksToInsert);
          
          if (error) {
            console.error(`❌ 插入任务失败: ${error.message}`);
          }
        }
      }
    }

    // 查询初始化后的主题列表
    const { data: after } = await supabase
      .from("themes")
      .select("id,title,description,task_count,created_at,creator_id")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false });
    
    const initTime = Date.now() - startTime;
    console.log(`✅ 主题初始化完成，耗时: ${initTime}ms，用户: ${userId}，主题数: ${after?.length || 0}`);
    
    return (after ?? []) as ThemeRecord[];
  } catch (error: any) {
    console.error(`❌ 主题初始化失败，用户: ${userId}:`, error.message);
    return [];
  }
}

export async function listAvailableThemes(): Promise<{ data: ThemeRecord[]; error?: string }> {
  const { supabase, user } = await requireUser();
  
  // 🔥 缓存检查
  const cacheKey = `themes_${user.id}`;
  const cached = themesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`✅ 主题列表缓存命中，用户: ${user.id}`);
    return { data: cached.data };
  }
  
  console.log(`🔄 主题列表未缓存，查询数据库，用户: ${user.id}`);
  
  // 🔥 性能监控
  const startTime = Date.now();
  
  // 仅列出我创建的主题（不包含公开主题），避免选择他人主题导致 RLS 读不到任务
  const { data, error } = await supabase
    .from("themes")
    .select("id,title,description,task_count,created_at,creator_id")
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });
  
  const queryTime = Date.now() - startTime;
  console.log(`⏱️ 数据库查询耗时: ${queryTime}ms，用户: ${user.id}`);
  
  if (error) {
    console.error(`❌ 查询主题列表失败: ${error.message}`);
    return { data: [], error: error.message };
  }

  let list = (data ?? []) as ThemeRecord[];
  
  if (list.length === 0) {
    // 🔥 检查用户注册时间，判断是否为新用户
    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", user.id)
      .single();
    
    const isNewUser = profile && (Date.now() - new Date(profile.created_at).getTime()) < 24 * 60 * 60 * 1000; // 24小时内注册的用户
    
    if (isNewUser) {
      console.log(`🆕 新用户 ${user.id} 无主题，启动后台初始化`);
      
      // 🔥 首次访问：先返回空列表，后台异步初始化
      // 异步初始化（不阻塞当前请求）
      setTimeout(async () => {
        try {
          // 在注册API的适当位置添加
          const initializedThemes = await initializeDefaultThemes(supabaseAdmin, userId);
          console.log(`✅ 新用户主题初始化完成: ${initializedThemes.length} 个主题`);
          
          if (initializedThemes.length > 0) {
            // 初始化成功后更新缓存
            themesCache.set(cacheKey, { 
              data: initializedThemes, 
              expiresAt: Date.now() + THEMES_CACHE_TTL 
            });
            console.log(`💾 主题列表已缓存（初始化后），用户: ${user.id}, 主题数: ${initializedThemes.length}`);
          }
        } catch (error) {
          console.error('主题初始化失败:', error);
        }
      }, 0);
      
      // 返回空列表，UI会显示提示
      return { data: [] };
    } else {
      console.log(`👤 老用户 ${user.id} 无主题，不自动初始化`);
      // 对于老用户，直接返回空列表，不进行自动初始化
      return { data: [] };
    }
  }
  
  // 🔥 设置缓存
  themesCache.set(cacheKey, { data: list, expiresAt: Date.now() + THEMES_CACHE_TTL });
  console.log(`💾 主题列表已缓存，用户: ${user.id}, 主题数: ${list.length}, 总耗时: ${Date.now() - startTime}ms`);
  
  return { data: list };
}

/**
 * 🔥 清除特定用户的主题缓存
 */
export async function clearThemesCache(userId: string): Promise<void> {
  const cacheKey = `themes_${userId}`;
  themesCache.delete(cacheKey);
  console.log(`🧹 清除主题缓存，用户: ${userId}`);
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

  // 🔥 清除主题缓存，因为可能创建了新主题
  clearThemesCache(user.id);
  
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