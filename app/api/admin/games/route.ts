import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const user_id = request.nextUrl.searchParams.get('user_id');
    
    if (!user_id) {
      return NextResponse.json(
        { success: false, error: '缺少 user_id 参数' },
        { status: 400 }
      );
    }

    // 验证UUID格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      return NextResponse.json(
        { success: false, error: '无效的 user_id 格式' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 查询该用户参与的游戏
    const { data: games, error: gamesError } = await supabase
      .from('game_history')
      .select('*')
      .or('player1_id.eq.' + user_id + ',player2_id.eq.' + user_id)
      .order('ended_at', { ascending: false });

    if (gamesError) {
      console.error('获取游戏记录失败:', gamesError);
      return NextResponse.json(
        { success: false, error: '获取游戏记录失败' },
        { status: 500 }
      );
    }

    if (!games || games.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 收集相关ID
    const playerIds = new Set<string>();
    const roomIds = new Set<string>();
    const themeIds = new Set<string>();

    games.forEach((game: any) => {
      if (game.player1_id) playerIds.add(game.player1_id);
      if (game.player2_id) playerIds.add(game.player2_id);
      if (game.winner_id) playerIds.add(game.winner_id);
      if (game.room_id) roomIds.add(game.room_id);
    });

    // 获取房间信息
    let roomsMap: Record<string, any> = {};
    if (roomIds.size > 0) {
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id, player1_theme_id, player2_theme_id')
        .in('id', Array.from(roomIds));

      rooms?.forEach(room => {
        roomsMap[room.id] = room;
        if (room.player1_theme_id) themeIds.add(room.player1_theme_id);
        if (room.player2_theme_id) themeIds.add(room.player2_theme_id);
      });
    }

    // 获取用户信息
    let profilesMap: Record<string, { nickname: string; email: string }> = {};
    if (playerIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname, email')
        .in('id', Array.from(playerIds));

      profiles?.forEach(p => {
        profilesMap[p.id] = { nickname: p.nickname || '未知', email: p.email || '未知' };
      });
    }

    // 获取主题信息
    let themesMap: Record<string, { title: string }> = {};
    if (themeIds.size > 0) {
      const { data: themes } = await supabase
        .from('themes')
        .select('id, title')
        .in('id', Array.from(themeIds));

      themes?.forEach(t => {
        themesMap[t.id] = { title: t.title || '未知主题' };
      });
    }

    // 丰富游戏数据
    const enrichedGames = games.map((game: any) => {
      const room = roomsMap[game.room_id] || {};
      return {
        ...game,
        player1: profilesMap[game.player1_id] || null,
        player2: profilesMap[game.player2_id] || null,
        winner: game.winner_id ? profilesMap[game.winner_id] || null : null,
        player1_theme: room.player1_theme_id ? themesMap[room.player1_theme_id] || null : null,
        player2_theme: room.player2_theme_id ? themesMap[room.player2_theme_id] || null : null,
        task_results: (game.task_results || []) as any[]
      };
    });

    return NextResponse.json({ success: true, data: enrichedGames });

  } catch (error) {
    console.error('API 错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
