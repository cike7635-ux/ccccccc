import { createAdminClient } from '@/lib/supabase/admin';
import GamesListClient from './components/games-list-client';
import type { GameRecord } from './components/games-list';

const ITEMS_PER_PAGE = 20;

async function getGames(page: number) {
  const supabase = createAdminClient();

  // 先分别查询两个表的总数（用于计算总数）
  const [{ count: historyCount }, { count: activeCount }] = await Promise.all([
    supabase.from('game_history').select('*', { count: 'exact', head: true }),
    supabase.from('game_sessions').select('*', { count: 'exact', head: true })
  ]);

  // 合并后的总数
  const totalCount = (historyCount || 0) + (activeCount || 0);
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // 分页查询：直接查询两表的前20条（简化分页逻辑）
  const [{ data: history }, { data: activeSessions }] = await Promise.all([
    supabase
      .from('game_history')
      .select('*')
      .order('ended_at', { ascending: false })
      .limit(ITEMS_PER_PAGE),
    supabase
      .from('game_sessions')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(ITEMS_PER_PAGE)
  ]);

  // 合并后的所有记录
  const allRecords = [
    ...(history || []),
    ...(activeSessions || [])
  ].sort((a, b) => {
    const timeA = a.ended_at ? new Date(a.ended_at).getTime() : new Date(a.started_at).getTime();
    const timeB = b.ended_at ? new Date(b.ended_at).getTime() : new Date(b.started_at).getTime();
    return timeB - timeA;
  });

  // 收集房间信息
  const roomIds = new Set<string>();
  allRecords.forEach((record: any) => {
    if (record.room_id) roomIds.add(record.room_id);
  });

  let roomsMap: Record<string, any> = {};
  if (roomIds.size > 0) {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, player1_theme_id, player2_theme_id')
      .in('id', Array.from(roomIds));
    rooms?.forEach(room => { roomsMap[room.id] = room; });
  }

  // 收集需要查询的玩家ID、主题ID、以及需要查任务的session_id
  const playerIds = new Set<string>();
  const themeIds = new Set<string>();
  const sessionIdsToQueryTasks = new Set<string>();

  allRecords.forEach((record: any) => {
    if (record.player1_id) playerIds.add(record.player1_id);
    if (record.player2_id) playerIds.add(record.player2_id);
    if (record.winner_id) playerIds.add(record.winner_id);
    
    // 获取主题ID（对于game_history中的游戏，需要从roomsMap获取）
    const room = roomsMap[record.room_id] || {};
    const p1ThemeId = record.player1_theme_id || room.player1_theme_id;
    const p2ThemeId = record.player2_theme_id || room.player2_theme_id;
    if (p1ThemeId) themeIds.add(p1ThemeId);
    if (p2ThemeId) themeIds.add(p2ThemeId);
    
    // 确保游戏对象有主题ID（用于后续enrich）
    if (!record.player1_theme_id && p1ThemeId) record.player1_theme_id = p1ThemeId;
    if (!record.player2_theme_id && p2ThemeId) record.player2_theme_id = p2ThemeId;
    
    // 对于 game_sessions，需要查询 game_moves
    if ((record.is_abandoned || record.is_in_progress || record.status === 'playing') && record.id) {
      sessionIdsToQueryTasks.add(record.id);
    }
  });

  // 查询未完成游戏的任务记录
  let tasksMap: Record<string, any[]> = {};
  if (sessionIdsToQueryTasks.size > 0) {
    const { data: moves } = await supabase
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

  // 查询玩家信息
  let profilesMap: Record<string, any> = {};
  if (playerIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname, email')
      .in('id', Array.from(playerIds));
    profiles?.forEach(p => { profilesMap[p.id] = { nickname: p.nickname, email: p.email }; });
  }

  // 查询主题信息
  let themesMap: Record<string, any> = {};
  if (themeIds.size > 0) {
    const { data: themes } = await supabase
      .from('themes')
      .select('id, title')
      .in('id', Array.from(themeIds));
    themes?.forEach(t => { themesMap[t.id] = { title: t.title }; });
  }

  // 补充游戏信息（包括任务！）
  const enrichedGames = allRecords.map((record: any) => {
    // 注意：game_moves 中的 session_id 关联的是 game_sessions.id
    const tasks = (record.is_abandoned || record.is_in_progress || record.status === 'playing') 
      ? (tasksMap[record.id] || []) 
      : (record.task_results || []);
    return {
      ...record,
      player1: profilesMap[record.player1_id] || null,
      player2: profilesMap[record.player2_id] || null,
      winner: record.winner_id ? profilesMap[record.winner_id] || null : null,
      player1_theme: record.player1_theme_id ? themesMap[record.player1_theme_id] || null : null,
      player2_theme: record.player2_theme_id ? themesMap[record.player2_theme_id] || null : null,
      task_results: tasks as any[]
    };
  });

  return { games: enrichedGames, totalCount, totalPages };
}

export default async function GamesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const { games, totalCount, totalPages } = await getGames(page);
  
  return <GamesListClient initialGames={games} initialTotalPages={totalPages} page={page} />;
}
