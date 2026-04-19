import { createAdminClient } from '@/lib/supabase/admin';
import { validateAdminSession } from '@/lib/server/admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

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

    // 查询已完成的游戏和进行中的游戏
    const [{ data: history }, { data: activeSessions }] = await Promise.all([
      supabase
        .from('game_history')
        .select('*')
        .or('player1_id.eq.' + user_id + ',player2_id.eq.' + user_id)
        .order('ended_at', { ascending: false }),
      supabase
        .from('game_sessions')
        .select('*')
        .or('player1_id.eq.' + user_id + ',player2_id.eq.' + user_id)
        .order('started_at', { ascending: false })
    ]);

    // 收集房间信息
    const roomIds = new Set<string>();
    (history || []).forEach((game: any) => {
      if (game.room_id) roomIds.add(game.room_id);
    });
    (activeSessions || []).forEach((session: any) => {
      if (session.room_id) roomIds.add(session.room_id);
    });

    let roomsMap: Record<string, any> = {};
    if (roomIds.size > 0) {
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id, player1_theme_id, player2_theme_id')
        .in('id', Array.from(roomIds));
      rooms?.forEach(room => { roomsMap[room.id] = room; });
    }

    // 将 game_sessions 转换为类似 game_history 的格式
    const convertedSessions: any[] = (activeSessions || []).map((session: any) => {
      const room = roomsMap[session.room_id] || {};
      const now = new Date();
      const startedAt = new Date(session.started_at);
      const hoursSinceStarted = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
      
      // 判断：超过24小时的算「中途退出」，否则算「正在进行」
      const isAbandoned = hoursSinceStarted > 24;
      
      return {
        id: session.id,
        session_id: session.id,
        room_id: session.room_id,
        player1_id: session.player1_id,
        player2_id: session.player2_id,
        winner_id: null,
        started_at: session.started_at,
        ended_at: session.ended_at,
        task_results: [],
        is_abandoned: isAbandoned,
        is_in_progress: !isAbandoned,
        player1_theme_id: room.player1_theme_id,
        player2_theme_id: room.player2_theme_id
      };
    });

    // 合并已完成的和进行中的游戏记录
    const allRecords = [
      ...(history || []),
      ...convertedSessions
    ].sort((a, b) => {
      const timeA = a.ended_at ? new Date(a.ended_at).getTime() : new Date(a.started_at).getTime();
      const timeB = b.ended_at ? new Date(b.ended_at).getTime() : new Date(b.started_at).getTime();
      return timeB - timeA;
    });

    if (allRecords.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 收集需要查询的玩家ID、主题ID、以及需要查任务的session_id
    const playerIds = new Set<string>();
    const themeIds = new Set<string>();
    const sessionIdsToQueryTasks = new Set<string>();

    allRecords.forEach((game: any) => {
      if (game.player1_id) playerIds.add(game.player1_id);
      if (game.player2_id) playerIds.add(game.player2_id);
      if (game.winner_id) playerIds.add(game.winner_id);
      const room = roomsMap[game.room_id] || {};
      const player1ThemeId = game.player1_theme_id || room.player1_theme_id;
      const player2ThemeId = game.player2_theme_id || room.player2_theme_id;
      if (player1ThemeId) themeIds.add(player1ThemeId);
      if (player2ThemeId) themeIds.add(player2ThemeId);
      if ((game.is_abandoned || game.is_in_progress) && game.id) {
        sessionIdsToQueryTasks.add(game.id);
      }
    });

    // 查询未完成游戏的任务记录
    let tasksMap: Record<string, any[]> = {};
    if (sessionIdsToQueryTasks.size > 0) {
      const { data: moves, error } = await supabase
        .from('game_moves')
        .select('session_id, player_id, task_id, task_completed, created_at')
        .in('session_id', Array.from(sessionIdsToQueryTasks))
        .order('created_at', { ascending: true });

      if (moves && moves.length > 0) {
        const taskIds = new Set(moves.filter((m: any) => m.task_id).map((m: any) => m.task_id));
        let taskDetailsMap: Record<string, any> = {};
        
        if (taskIds.size > 0) {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('id, description')
            .in('id', Array.from(taskIds));
          tasks?.forEach((t: any) => { taskDetailsMap[t.id] = t; });
        }

        moves.forEach((m: any) => {
          if (!tasksMap[m.session_id]) {
            tasksMap[m.session_id] = [];
          }
          if (m.task_id) {
            const task = taskDetailsMap[m.task_id];
            tasksMap[m.session_id].push({
              executor_id: m.player_id,
              observer_id: null,
              task_text: task?.description || null,
              completed: m.task_completed || false,
              timestamp: m.created_at
            });
          }
        });
      }
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
    const enrichedGames = allRecords.map((game: any) => {
      const room = roomsMap[game.room_id] || {};
      const tasks = (game.is_abandoned || game.is_in_progress) ? (tasksMap[game.id] || []) : (game.task_results || []);
      const player1ThemeId = game.player1_theme_id || room.player1_theme_id;
      const player2ThemeId = game.player2_theme_id || room.player2_theme_id;
      return {
        ...game,
        player1: profilesMap[game.player1_id] || null,
        player2: profilesMap[game.player2_id] || null,
        winner: game.winner_id ? profilesMap[game.winner_id] || null : null,
        player1_theme: player1ThemeId ? themesMap[player1ThemeId] || null : null,
        player2_theme: player2ThemeId ? themesMap[player2ThemeId] || null : null,
        task_results: tasks as any[]
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
