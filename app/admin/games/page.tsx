import { createAdminClient } from '@/lib/supabase/admin';
import { Loader2 } from 'lucide-react';
import { Suspense } from 'react';
import GamesList from './components/games-list';

const ITEMS_PER_PAGE = 20;

async function getGames(page: number) {
  const supabase = createAdminClient();

  const from = (page - 1) * ITEMS_PER_PAGE;
  const to = from + ITEMS_PER_PAGE - 1;

  const { data, count, error } = await supabase
    .from('game_history')
    .select('*', { count: 'exact' })
    .order('ended_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  if (!data || data.length === 0) {
    return { games: [], totalCount: count || 0, totalPages: 0 };
  }

  const playerIds = new Set<string>();
  const roomIds = new Set<string>();
  const themeIds = new Set<string>();

  data.forEach((game: any) => {
    if (game.player1_id) playerIds.add(game.player1_id);
    if (game.player2_id) playerIds.add(game.player2_id);
    if (game.winner_id) playerIds.add(game.winner_id);
    if (game.room_id) roomIds.add(game.room_id);
  });

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

  const enrichedGames = data.map((game: any) => {
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

  const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0;

  return { games: enrichedGames, totalCount: count || 0, totalPages };
}

function GamesListWrapper({ games, totalCount, totalPages }: {
  games: any[];
  totalCount: number;
  totalPages: number;
}) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-brand-pink animate-spin mr-2" />
        <span className="text-gray-400">加载中...</span>
      </div>
    }>
      <GamesList 
        initialGames={games} 
        initialTotalCount={totalCount} 
        initialTotalPages={totalPages} 
      />
    </Suspense>
  );
}

export default async function GamesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = parseInt(searchParams.page || '1');
  const { games, totalCount, totalPages } = await getGames(page);

  return (
    <GamesListWrapper games={games} totalCount={totalCount} totalPages={totalPages} />
  );
}