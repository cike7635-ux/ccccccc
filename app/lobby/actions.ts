// app/lobby/actions.ts - 修复版本化缓存
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 🔥 改为版本化缓存（与 themes/actions.ts 一致）
const themesCache = new Map<string, { 
  data: any; 
  version: number;  // 添加版本号
  expiresAt: number; 
}>();
const THEMES_CACHE_TTL = 2 * 60 * 1000; // 2分钟缓存（缩短时间）

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

// 🔥 获取用户主题缓存版本号（与 themes/actions.ts 完全一致）
async function getUserThemesVersion(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    
    // 查询用户缓存版本
    const { data, error } = await supabase
      .from('cache_versions')
      .select('themes_version')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      // 用户无缓存版本，创建默认值
      const { error: insertError } = await supabase
        .from('cache_versions')
        .insert({ 
          user_id: userId, 
          themes_version: 1,
          updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.warn('[getUserThemesVersion] 创建缓存版本失败，使用默认值1');
      }
      return 1;
    }
    
    return data.themes_version || 1;
  } catch (error) {
    console.error('[getUserThemesVersion] 获取缓存版本失败:', error);
    return 1;
  }
}

// 🔥 递增用户主题缓存版本号（与 themes/actions.ts 完全一致）
async function incrementThemesVersion(userId: string): Promise<void> {
  try {
    const supabase = await createClient();
    
    // 尝试调用数据库函数（更高效）
    const { error } = await supabase.rpc('increment_themes_version', { 
      p_user_id: userId 
    });
    
    if (error) {
      console.warn('[incrementThemesVersion] RPC调用失败，使用降级方案:', error);
      
      // 降级方案：先获取当前版本，然后+1
      const { data } = await supabase
        .from('cache_versions')
        .select('themes_version')
        .eq('user_id', userId)
        .single();
      
      const currentVersion = data?.themes_version || 1;
      
      const { error: updateError } = await supabase
        .from('cache_versions')
        .upsert({ 
          user_id: userId,
          themes_version: currentVersion + 1,
          updated_at: new Date().toISOString()
        });
      
      if (updateError) {
        console.error('[incrementThemesVersion] 更新缓存版本失败:', updateError);
        throw updateError;
      }
    }
    
    console.log(`✅ 用户 ${userId} 主题缓存版本已递增`);
    
    // 清除内存缓存
    const cacheKey = `lobby_themes_${userId}`;
    themesCache.delete(cacheKey);
    
  } catch (error) {
    console.error('[incrementThemesVersion] 递增缓存版本失败:', error);
    throw error;
  }
}

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

// 🔥 优化的主题列表函数（使用版本化缓存）
export async function listAvailableThemes(): Promise<{ data: ThemeRecord[]; error?: string }> {
  const { supabase, user } = await requireUser();
  
  const userId = user.id;
  
  // 🔥 获取当前缓存版本号（关键！）
  const currentVersion = await getUserThemesVersion(userId);
  const cacheKey = `lobby_themes_${userId}_v${currentVersion}`;
  
  // 🔥 检查缓存（版本匹配且未过期）
  const cached = themesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() && cached.version === currentVersion) {
    console.log(`✅ Lobby主题列表缓存命中，用户: ${user.id}, 版本: ${currentVersion}`);
    return { data: cached.data };
  }
  
  console.log(`🔄 Lobby主题列表未缓存，查询数据库，用户: ${user.id}, 版本: ${currentVersion}`);
  
  const startTime = Date.now();
  
  // 查询用户创建的主题
  const { data, error } = await supabase
    .from('themes')
    .select('id, title, description, task_count, created_at, creator_id')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false });
  
  const queryTime = Date.now() - startTime;
  console.log(`⏱️ Lobby主题列表查询耗时: ${queryTime}ms，用户: ${user.id}`);
  
  if (error) {
    console.error(`❌ Lobby主题列表查询失败: ${error.message}`);
    return { data: [], error: error.message };
  }

  let list = (data ?? []) as ThemeRecord[];
  
  if (list.length === 0) {
    console.log(`👤 用户 ${user.id} 无主题，显示空列表`);
  }
  
  // 🔥 设置缓存（带版本号）
  themesCache.set(cacheKey, { 
    data: list, 
    version: currentVersion,
    expiresAt: Date.now() + THEMES_CACHE_TTL 
  });
  
  console.log(`💾 Lobby主题列表已缓存，用户: ${user.id}, 主题数: ${list.length}, 版本: ${currentVersion}`);
  
  return { data: list };
}

// 🔥 清除特定用户的主题缓存（递增版本号）
async function clearThemesCache(userId: string): Promise<void> {
  try {
    // 🔥 递增缓存版本号（关键！）
    await incrementThemesVersion(userId);
    
    // 清除内存缓存
    const cacheKey = `lobby_themes_${userId}`;
    themesCache.delete(cacheKey);
    
    console.log(`🧹 清除Lobby主题缓存，用户: ${userId}`);
  } catch (error) {
    console.error(`❌ 清除Lobby主题缓存失败，用户: ${userId}:`, error);
  }
}

// 🔥 优化的获取房间函数
export async function getRoomById(id: string): Promise<{ data: RoomRecord | null; error?: string }> {
  const { supabase } = await requireUser();
  
  const { data, error } = await supabase
    .from("rooms")
    .select(
      "id,room_code,status,creator_id,player1_id,player2_id,player1_nickname,player2_nickname,player1_theme_id,player2_theme_id,created_at",
    )
    .eq("id", id)
    .single();
  
  if (error) {
    console.error(`❌ 获取房间失败 ${id}: ${error.message}`);
    return { data: null, error: error.message };
  }
  
  return { data: data as RoomRecord };
}

// 🔥 优化的创建房间函数
export async function createRoom(formData: FormData): Promise<void> {
  const startTime = Date.now();
  console.log(`🚀 开始创建房间流程`);
  
  try {
    const { supabase, user } = await requireUser();
    const player1ThemeId = String(formData.get("player1_theme_id") ?? "").trim();
    
    if (!player1ThemeId) {
      throw new Error("请选择一个主题");
    }

    console.log(`📝 创建房间，用户: ${user.id}, 主题: ${player1ThemeId}`);
    
    // 查询用户昵称（优化：只查询必要字段）
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .single();

    // 生成房间码并创建房间
    const code = generateRoomCode();
    console.log(`🎰 生成房间码: ${code}`);
    
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
    
    if (error) {
      console.error(`❌ 创建房间失败: ${error.message}`);
      throw new Error(`创建房间失败: ${error.message}`);
    }

    console.log(`✅ 房间创建成功: ${room.id}, 耗时: ${Date.now() - startTime}ms`);
    
    // 🔥 延迟清除缓存，不影响当前操作
    setTimeout(() => {
      clearThemesCache(user.id);
    }, 1000);
    
    // 🔥 只重定向，不刷新页面
    redirect(`/lobby/${room.id}`);
    
  } catch (error: any) {
    console.error(`❌ 创建房间异常: ${error.message}`);
    throw error;
  }
}

// 🔥 优化的加入房间函数（合并查询）
export async function joinRoom(formData: FormData): Promise<void> {
  const startTime = Date.now();
  console.log(`🚀 开始加入房间流程`);
  
  try {
    const { supabase, user } = await requireUser();
    
    // 获取表单数据
    const roomCode = String(formData.get("room_code") ?? "").trim().toUpperCase();
    const myThemeId = String(formData.get("player2_theme_id") ?? "").trim();
    
    if (!roomCode) {
      redirect(`/lobby?error=${encodeURIComponent("请输入房间码")}`);
    }
    if (!myThemeId) {
      redirect(`/lobby?error=${encodeURIComponent("请选择一个主题")}`);
    }

    console.log(`🔍 加入房间，用户: ${user.id}, 房间码: ${roomCode}, 主题: ${myThemeId}`);
    
    // 🔥 优化的查询：并行获取房间和用户信息
    const [roomQuery, profileQuery] = await Promise.all([
      supabase
        .from("rooms")
        .select("id,status,player2_id,creator_id,player1_id")
        .eq("room_code", roomCode)
        .eq("status", "waiting")
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("nickname")
        .eq("id", user.id)
        .maybeSingle()
    ]);
    
    const { data: room, error: fetchErr } = roomQuery;
    const { data: profile } = profileQuery;
    
    if (fetchErr) {
      console.error(`❌ 查询房间失败: ${fetchErr.message}`);
      redirect(`/lobby?error=${encodeURIComponent(fetchErr.message)}`);
    }
    
    if (!room) {
      console.log(`❌ 房间不存在或已开始: ${roomCode}`);
      redirect(`/lobby?error=${encodeURIComponent("房间不存在或已开始")}`);
    }
    
    if ((room as any).player2_id) {
      console.log(`❌ 房间已满员: ${room.id}`);
      redirect(`/lobby?error=${encodeURIComponent("房间已满员")}`);
    }

    console.log(`📝 加入房间: ${room.id}, 用户: ${user.id}`);
    
    // 🔥 优化的更新：使用单个更新操作
    const { data: updated, error } = await supabase
      .from("rooms")
      .update({
        player2_id: user.id,
        player2_nickname: profile?.nickname ?? null,
        player2_theme_id: myThemeId,
        // updated_at: new Date().toISOString(),
      })
      .eq("id", room.id)
      .eq("status", "waiting")
      .is("player2_id", null)
      .select("id")
      .single();
    
    if (error) {
      console.error(`❌ 加入房间失败: ${error.message}`);
      throw new Error(`加入房间失败: ${error.message}`);
    }

    console.log(`✅ 加入房间成功: ${updated.id}, 耗时: ${Date.now() - startTime}ms`);
    
    // 🔥 延迟清除缓存
    setTimeout(() => {
      clearThemesCache(user.id);
    }, 1000);
    
    // 🔥 直接重定向，不刷新页面
    redirect(`/lobby/${updated.id}`);
    
  } catch (error: any) {
    console.error(`❌ 加入房间异常: ${error.message}`);
    throw error;
  }
}

// 🔥 优化的设置主题函数
export async function setMyTheme(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const roomId = String(formData.get("room_id") ?? "");
  const themeId = String(formData.get("theme_id") ?? "");
  
  if (!roomId) throw new Error("缺少房间 ID");
  if (!themeId) throw new Error("请选择主题");

  console.log(`🎯 设置主题，用户: ${user.id}, 房间: ${roomId}, 主题: ${themeId}`);
  
  // 快速检查房间和用户关系
  const { data: room, error: fetchErr } = await supabase
    .from("rooms")
    .select("player1_id,player2_id")
    .eq("id", roomId)
    .single();
  
  if (fetchErr) throw new Error(fetchErr.message);

  // 确定是玩家1还是玩家2
  const patch = user.id === room.player1_id
    ? { player1_theme_id: themeId }
    : user.id === room.player2_id
    ? { player2_theme_id: themeId }
    : null;

  if (!patch) {
    throw new Error("你不是房间参与者");
  }

  const { error } = await supabase
    .from("rooms")
    .update(patch)
    .eq("id", roomId);
  
  if (error) throw new Error(error.message);
  
  console.log(`✅ 主题设置成功，用户: ${user.id}, 房间: ${roomId}`);
}

// 🔥 优化的开始游戏函数
export async function startGame(formData: FormData): Promise<void> {
  const startTime = Date.now();
  console.log(`🚀 开始开始游戏流程`);
  
  const { supabase } = await requireUser();
  const roomId = String(formData.get("room_id") ?? "");
  
  if (!roomId) throw new Error("缺少房间 ID");

  console.log(`🎮 开始游戏，房间: ${roomId}`);
  
  // 查询房间信息
  const { data: room, error: fetchErr } = await supabase
    .from("rooms")
    .select(
      "id,status,player1_id,player2_id,player1_theme_id,player2_theme_id",
    )
    .eq("id", roomId)
    .single();
  
  if (fetchErr) throw new Error(fetchErr.message);

  // 验证房间状态
  if (room.status !== "waiting") {
    throw new Error("房间状态不可开始");
  }
  
  if (!room.player1_id || !room.player2_id) {
    throw new Error("玩家未齐");
  }
  
  if (!room.player1_theme_id || !room.player2_theme_id) {
    throw new Error("主题未齐");
  }

  // 随机选择起始玩家
  const starter = Math.random() < 0.5 ? room.player1_id : room.player2_id;
  console.log(`🎲 起始玩家: ${starter}`);

  // 初始化棋盘特殊格
  const starIndices = [2, 4, 6, 8, 9, 11, 12, 15, 22, 25, 27, 31, 36, 37, 40, 41, 43];
  const trapIndices = [3, 14, 19, 33, 42, 46, 47];
  const specialCells: Record<number, "star" | "trap"> = {};
  
  for (const i of starIndices) specialCells[i] = "star";
  for (const i of trapIndices) specialCells[i] = "trap";

  // 🔥 并行操作：创建游戏会话和更新房间状态
  const [sessionResult, updateResult] = await Promise.all([
    supabase
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
      .single(),
    supabase
      .from("rooms")
      .update({ status: "playing" })
      .eq("id", room.id)
  ]);

  if (sessionResult.error) throw new Error(sessionResult.error.message);
  if (updateResult.error) throw new Error(updateResult.error.message);

  console.log(`✅ 游戏开始成功，会话: ${sessionResult.data.id}, 耗时: ${Date.now() - startTime}ms`);
  
  // 🔥 直接重定向到游戏页面
  redirect(`/game`);
}