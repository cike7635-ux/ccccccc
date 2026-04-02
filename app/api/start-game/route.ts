import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function POST(request: Request) {
  const formData = await request.formData();
  const roomId = String(formData.get("room_id") ?? "").trim();

  console.log(`🚀 [API] 开始游戏, roomId: ${roomId}`);

  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (!roomId) {
      return NextResponse.json({ error: '房间ID不能为空' }, { status: 400 });
    }

    // 获取房间信息
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, player1_id, player2_id, player1_theme_id, player2_theme_id, status")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: '房间不存在' }, { status: 404 });
    }

    console.log(`📝 [API] 房间数据:`, room);

    // 检查用户是否有权限
    if (room.player1_id !== user.id && room.player2_id !== user.id) {
      return NextResponse.json({ error: '你没有权限开始这个游戏' }, { status: 403 });
    }

    // 检查玩家2是否已加入
    if (!room.player2_id) {
      return NextResponse.json({ error: '等待玩家2加入后再开始' }, { status: 400 });
    }

    // 检查房间状态
    if (room.status === "playing") {
      return NextResponse.json({ success: true, redirectTo: '/game' });
    }

    console.log(`📝 [API] 开始创建游戏会话...`);

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
      console.error(`❌ [API] 创建游戏会话失败: ${sessionError.message}`);
      return NextResponse.json({ error: `创建游戏会话失败: ${sessionError.message}` }, { status: 500 });
    }

    console.log(`✅ [API] 游戏会话创建成功`);

    // 更新房间状态
    const { error: updateError } = await supabase
      .from("rooms")
      .update({ status: "playing" })
      .eq("id", roomId);

    if (updateError) {
      console.error(`❌ [API] 开始游戏失败: ${updateError.message}`);
      return NextResponse.json({ error: `开始游戏失败: ${updateError.message}` }, { status: 500 });
    }

    console.log(`✅ [API] 开始游戏成功，返回 success`);
    return NextResponse.json({ success: true, redirectTo: '/game' });

  } catch (error: any) {
    console.error(`❌ [API] 开始游戏异常:`, error);
    return NextResponse.json({ error: error?.message || '未知错误' }, { status: 500 });
  }
}
