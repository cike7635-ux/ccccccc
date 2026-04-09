// /app/lobby/actions.ts - 使用统一缓存 + 包含官方主题
'use server';

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserData } from "@/lib/server/auth";
import {
  getAllThemesForUser,
  incrementThemesVersion,
  getUserThemes,
  getOfficialThemes
} from "@/lib/cache/themes-cache";

// 类型定义
type ThemeRecord = {
  id: string;
  title: string;
  description: string | null;
  task_count: number | null;
  created_at: string;
  creator_id: string;
  is_official?: boolean;
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

// 复用统一缓存的函数
export { incrementThemesVersion, getUserThemes, getOfficialThemes };

async function requireUser() {
  const { user, profile } = await getUserData();
  const supabase = await createClient();
  return { supabase, user, profile } as const;
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去除易混淆字符
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * 获取可用主题列表（用户主题 + 官方主题，官方在后）
 * 使用统一缓存
 */
export async function listAvailableThemes(): Promise<{ data: ThemeRecord[]; error?: string }> {
  try {
    const { user } = await requireUser();

    // 使用统一的缓存模块
    const result = await getAllThemesForUser(user.id);

    if (result.error) {
      return { data: [], error: result.error };
    }

    // 转换数据以匹配 ThemeRecord 类型（description 从 string | undefined 转为 string | null）
    const themes: ThemeRecord[] = result.data.map(theme => ({
      ...theme,
      description: theme.description ?? null,
    }));
    return { data: themes };
  } catch (error: any) {
    console.error(`❌ Lobby主题列表获取失败: ${error.message}`);
    return { data: [], error: error.message };
  }
}

/**
 * 设置我的主题
 */
export async function setMyTheme(formData: FormData): Promise<void> {
  console.log(`🚀 开始设置我的主题`);

  const { supabase, user } = await requireUser();
  const roomId = String(formData.get("room_id") ?? "").trim();
  const myThemeId = String(formData.get("my_theme_id") ?? "").trim();

  try {
    if (!roomId) {
      redirect(`/lobby?error=${encodeURIComponent("房间ID不能为空")}`);
      return;
    }

    if (!myThemeId) {
      redirect(`/lobby?error=${encodeURIComponent("请选择一个主题")}`);
      return;
    }

    console.log(`📝 设置我的主题，用户: ${user.id}, 房间: ${roomId}, 主题: ${myThemeId}`);

    // 获取房间信息确认用户身份（包括主题字段！）
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, player1_id, player2_id, player1_theme_id, player2_theme_id, status")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      redirect(`/lobby?error=${encodeURIComponent("房间不存在")}`);
      return;
    }

    // 确定用户是 player1 还是 player2
    const isPlayer1 = room.player1_id === user.id;
    const isPlayer2 = room.player2_id === user.id;

    if (!isPlayer1 && !isPlayer2) {
      redirect(`/lobby?error=${encodeURIComponent("你不是房间参与者")}`);
      return;
    }

    // 🚀 一次性准备更新数据（同时更新主题和状态）
    const updateData: Record<string, any> = {};
    
    // 1. 更新当前用户的主题
    if (isPlayer1) {
      updateData.player1_theme_id = myThemeId;
    } else if (isPlayer2) {
      updateData.player2_theme_id = myThemeId;
    }

    // 2. 检查：两人是否都有主题了（包括当前这次设置的）
    const player1ThemeAfter = isPlayer1 ? myThemeId : room.player1_theme_id;
    const player2ThemeAfter = isPlayer2 ? myThemeId : room.player2_theme_id;
    const bothWillHaveTheme = player1ThemeAfter && player2ThemeAfter;
    
    // 3. 如果两人都有主题且当前状态是 waiting，更新为 ready
    if (bothWillHaveTheme && room.status === "waiting") {
      updateData.status = "ready";
      console.log(`✅ 两人都选好主题，状态将更新为 ready`);
    }

    // 🚀 一次性执行 UPDATE！
    const { error: updateError } = await supabase
      .from("rooms")
      .update(updateData)
      .eq("id", roomId);

    if (updateError) {
      console.error(`❌ 设置我的主题失败: ${updateError.message}`);
      redirect(`/lobby?error=${encodeURIComponent(`设置我的主题失败: ${updateError.message}`)}`);
      return;
    }

    console.log(`✅ 设置我的主题成功`);
    redirect(`/lobby/${roomId}`);
  } catch (error: any) {
    console.error(`❌ 设置我的主题异常:`, error);
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    redirect(`/lobby?error=${encodeURIComponent(`设置我的主题失败: ${error?.message || '未知错误'}`)}`);
  }
}

/**
 * 开始游戏
 */
export async function startGame(formData: FormData): Promise<void> {
  console.log(`🚀 开始游戏 - 表单数据:`, Object.fromEntries(formData.entries()));

  const { supabase, user } = await requireUser();
  const roomId = String(formData.get("room_id") ?? "").trim();
  console.log(`📝 roomId: ${roomId}, userId: ${user.id}`);

  try {
    if (!roomId) {
      console.log(`❌ roomId 为空`);
      redirect(`/lobby?error=${encodeURIComponent("房间ID不能为空")}`);
      return;
    }

    console.log(`📝 开始游戏，用户: ${user.id}, 房间: ${roomId}`);

    // 获取房间信息
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, player1_id, player2_id, player1_theme_id, player2_theme_id, status")
      .eq("id", roomId)
      .single();

    console.log(`📝 房间数据:`, room, `错误:`, roomError);

    if (roomError || !room) {
      console.error(`❌ 获取房间信息失败`);
      redirect(`/lobby?error=${encodeURIComponent("房间不存在")}`);
      return;
    }

    // 检查用户是否有权限开始游戏（必须是房主或玩家2）
    if (room.player1_id !== user.id && room.player2_id !== user.id) {
      console.log(`❌ 用户无权限: player1=${room.player1_id}, player2=${room.player2_id}, user=${user.id}`);
      redirect(`/lobby?error=${encodeURIComponent("你没有权限开始这个游戏")}`);
      return;
    }

    // 检查玩家2是否已加入
    if (!room.player2_id) {
      console.log(`❌ 玩家2未加入`);
      redirect(`/lobby?error=${encodeURIComponent("等待玩家2加入后再开始")}`);
      return;
    }

    // 检查房间状态
    if (room.status === "playing") {
      console.log(`🔄 房间状态已是playing，跳转到游戏页面`);
      redirect(`/game`);
      return;
    }

    console.log(`📝 开始创建游戏会话...`);

    // 生成默认特殊格子
    const stars = [2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46];
    const traps = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 47];
    const specialCells: Record<number, string> = {};
    for (const i of stars) specialCells[i] = "star";
    for (const i of traps) specialCells[i] = "trap";

    // 创建游戏会话
    const { error: sessionError } = await supabase
      .from("game_sessions")
      .insert({
        room_id: roomId,
        player1_id: room.player1_id,
        player2_id: room.player2_id,
        current_player_id: room.player1_id,
        current_turn: 1,
        status: "playing",
        game_state: {
          player1_position: 0,
          player2_position: 0,
          board_size: 49,
          special_cells: specialCells
        }
      });

    if (sessionError) {
      console.error(`❌ 创建游戏会话失败: ${sessionError.message}`);
      redirect(`/lobby?error=${encodeURIComponent(`创建游戏会话失败: ${sessionError.message}`)}`);
      return;
    }
    console.log(`✅ 游戏会话创建成功`);

    // 更新房间状态为游戏中
    const { error: updateError } = await supabase
      .from("rooms")
      .update({ status: "playing" })
      .eq("id", roomId);

    if (updateError) {
      console.error(`❌ 开始游戏失败: ${updateError.message}`);
      redirect(`/lobby?error=${encodeURIComponent(`开始游戏失败: ${updateError.message}`)}`);
      return;
    }

    console.log(`✅ 开始游戏成功`);
    redirect(`/game`);
  } catch (error: any) {
    console.error(`❌ 开始游戏异常:`, error);
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    redirect(`/lobby?error=${encodeURIComponent(`开始游戏失败: ${error?.message || '未知错误'}`)}`);
  }
}

/**
 * 清除特定用户的主题缓存
 */
export async function clearThemesCache(userId: string): Promise<void> {
  try {
    await incrementThemesVersion(userId);
    console.log(`🧹 清除Lobby主题缓存，用户: ${userId}`);
  } catch (error: any) {
    console.error(`❌ 清除Lobby主题缓存失败，用户: ${userId}:`, error);
  }
}

/**
 * 获取房间
 */
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

/**
 * 创建房间
 */
export async function createRoom(formData: FormData): Promise<void> {
  const startTime = Date.now();
  console.log(`🚀 开始创建房间流程`);
  console.log(`📋 表单数据:`, Object.fromEntries(formData.entries()));

  const { supabase, user } = await requireUser();
  console.log(`✅ 用户验证通过: ${user.id}`);

  const player1ThemeId = String(formData.get("player1_theme_id") ?? "").trim();
  console.log(`🎯 提取的主题ID: "${player1ThemeId}", 长度: ${player1ThemeId.length}`);

  try {
    if (!player1ThemeId) {
      console.error(`❌ 主题ID为空，无法创建房间`);
      redirect(`/lobby?error=${encodeURIComponent("请选择一个主题")}`);
      return;
    }

    console.log(`📝 创建房间，用户: ${user.id}, 主题: ${player1ThemeId}`);

    // 从 profiles 表获取用户昵称
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .maybeSingle();

    const nickname = profile?.nickname || user.user_metadata?.full_name || user.user_metadata?.nickname || user.email?.split('@')[0] || null;
    console.log(`👤 用户昵称: ${nickname}`);

    // 生成房间码并创建房间
    const roomCode = generateRoomCode();
    console.log(`🎰 生成房间码: ${roomCode}`);

    const { data: room, error: insertError } = await supabase
      .from("rooms")
      .insert({
        room_code: roomCode,
        creator_id: user.id,
        player1_id: user.id,
        player1_nickname: nickname,
        player1_theme_id: player1ThemeId,
        status: "waiting",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(`❌ 创建房间失败: ${insertError.message}`);
      redirect(`/lobby?error=${encodeURIComponent(`创建房间失败: ${insertError.message}`)}`);
      return;
    }

    console.log(`✅ 房间创建成功: ${room.id}, 耗时: ${Date.now() - startTime}ms`);

    // 延迟清除缓存
    setTimeout(() => {
      incrementThemesVersion(user.id);
    }, 1000);

    redirect(`/lobby/${room.id}`);
  } catch (error: any) {
    console.error(`❌ 创建房间异常:`, error);
    // 如果是 redirect 错误，直接重新抛出
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    // 其他错误重定向到 lobby 页面
    redirect(`/lobby?error=${encodeURIComponent(`创建房间失败: ${error?.message || '未知错误'}`)}`);
  }
}

/**
 * 加入房间
 */
export async function joinRoom(formData: FormData): Promise<void> {
  const startTime = Date.now();
  console.log(`🚀 开始加入房间流程`);
  console.log(`📋 表单数据:`, Object.fromEntries(formData.entries()));

  const { supabase, user } = await requireUser();
  console.log(`✅ 用户验证通过: ${user.id}`);

  const roomCode = String(formData.get("room_code") ?? "").trim().toUpperCase();
  const myThemeId = String(formData.get("player2_theme_id") ?? "").trim();

  console.log(`🔍 提取的参数: 房间码="${roomCode}", 主题="${myThemeId}"`);

  try {

    if (!roomCode) {
      console.error(`❌ 房间码为空`);
      redirect(`/lobby?error=${encodeURIComponent("请输入房间码")}`);
      return;
    }
    if (!myThemeId) {
      console.error(`❌ 主题ID为空`);
      redirect(`/lobby?error=${encodeURIComponent("请选择一个主题")}`);
      return;
    }

    console.log(`🔍 加入房间，用户: ${user.id}, 房间码: ${roomCode}, 主题: ${myThemeId}`);

    // 先检查房间是否存在（包括主题字段！）
    console.log(`🔍 查询房间，条件: room_code=${roomCode}, status=waiting`);
    const { data: roomCheck, error: roomCheckError } = await supabase
      .from("rooms")
      .select("id,status,player2_id,creator_id,player1_id,player1_theme_id")
      .eq("room_code", roomCode)
      .maybeSingle();

    if (roomCheckError) {
      console.error(`❌ 查询房间失败: ${roomCheckError.message}`);
      redirect(`/lobby?error=${encodeURIComponent(roomCheckError.message)}`);
      return;
    }

    console.log(`🔍 房间查询结果:`, roomCheck);

    if (!roomCheck) {
      // 房间不存在，尝试查询任何状态的房间以便调试
      const { data: anyRoom } = await supabase
        .from("rooms")
        .select("id,status,player2_id,creator_id,player1_id")
        .eq("room_code", roomCode)
        .maybeSingle();

      if (anyRoom) {
        console.log(`❌ 房间存在但状态不是waiting: ${anyRoom.status}`);
        redirect(`/lobby?error=${encodeURIComponent(`房间状态为: ${anyRoom.status}，无法加入`)}`);
      } else {
        console.log(`❌ 房间不存在: ${roomCode}`);
        redirect(`/lobby?error=${encodeURIComponent("房间不存在或已开始")}`);
      }
      return;
    }

    if (roomCheck.status !== "waiting") {
      console.log(`❌ 房间状态不是waiting: ${roomCheck.status}`);
      redirect(`/lobby?error=${encodeURIComponent(`房间状态为: ${roomCheck.status}，无法加入`)}`);
      return;
    }

    if (roomCheck.player2_id) {
      console.log(`❌ 房间已满员: ${roomCheck.id}`);
      redirect(`/lobby?error=${encodeURIComponent("房间已满员")}`);
      return;
    }

    // 获取用户昵称 - 从 profiles 表获取
    const { data: profile } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .maybeSingle();

    const nickname = profile?.nickname || user.user_metadata?.full_name || user.user_metadata?.nickname || user.email?.split('@')[0] || null;

    console.log(`📝 加入房间: ${roomCheck.id}, 用户: ${user.id}`);

    // 准备更新数据
    const updateData: Record<string, any> = {
      player2_id: user.id,
      player2_nickname: nickname,
      player2_theme_id: myThemeId,
    };
    
    // 检查是否两人都选好主题了（player1 应该已经有主题了）
    if (roomCheck.player1_id && roomCheck.player1_theme_id) {
      updateData.status = "ready";
      console.log(`✅ 两人都加入并选好主题，状态更新为 ready`);
    }

    // 更新房间
    const { data: updated, error: updateError } = await supabase
      .from("rooms")
      .update(updateData)
      .eq("id", roomCheck.id)
      .select("id")
      .single();

    if (updateError) {
      console.error(`❌ 加入房间失败: ${updateError.message}`);
      redirect(`/lobby?error=${encodeURIComponent(updateError.message)}`);
      return;
    }

    console.log(`✅ 加入房间成功: ${roomCheck.id}, 等待房主开始游戏`);

    // 延迟清除缓存
    setTimeout(() => {
      incrementThemesVersion(user.id);
    }, 1000);

    redirect(`/lobby/${roomCheck.id}`);

  } catch (error: any) {
    console.error(`❌ 加入房间异常:`, error);
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    redirect(`/lobby?error=${encodeURIComponent(`加入房间失败: ${error?.message || '未知错误'}`)}`);
  }
}
