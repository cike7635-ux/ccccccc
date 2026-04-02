'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ChevronDown, 
  ChevronUp, 
  Trophy, 
  Calendar, 
  Clock, 
  Palette, 
  CheckCircle2, 
  XCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Gamepad2
} from 'lucide-react';

const ITEMS_PER_PAGE = 20;

interface TaskResult {
  executor_id: string;
  observer_id: string;
  task_text: string | null;
  completed: boolean;
  timestamp: string;
}

interface GameRecord {
  id: string;
  room_id: string;
  session_id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  started_at: string;
  ended_at: string;
  task_results: TaskResult[];
  player1: { nickname: string; email: string } | null;
  player2: { nickname: string; email: string } | null;
  winner: { nickname: string; email: string } | null;
  player1_theme: { title: string } | null;
  player2_theme: { title: string } | null;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(startStr: string, endStr: string) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${minutes}分${seconds}秒`;
}

interface GamesListProps {
  initialGames: GameRecord[];
  initialTotalCount: number;
  initialTotalPages: number;
}

export default function GamesList({ initialGames, initialTotalCount, initialTotalPages }: GamesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1');
  
  const [games, setGames] = useState<GameRecord[]>(initialGames);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [goToPage, setGoToPage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setGames(initialGames);
    setTotalCount(initialTotalCount);
    setTotalPages(initialTotalPages);
  }, [initialGames, initialTotalCount, initialTotalPages]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleGoToPage = () => {
    const page = parseInt(goToPage);
    if (page >= 1 && page <= totalPages) {
      router.push(`/admin/games?page=${page}`);
      setGoToPage('');
    }
  };

  const handlePageChange = (page: number) => {
    router.push(`/admin/games?page=${page}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">游戏记录</h1>
        <p className="text-gray-400">查看所有游戏对局的详细记录</p>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 items-center">
        <div className="flex items-center gap-2 ml-auto">
          <div className="text-sm text-gray-400">
            共 <span className="text-white font-medium">{totalCount}</span> 条记录
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand-pink animate-spin mr-2" />
          <span className="text-gray-400">加载中...</span>
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gamepad2 className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">暂无游戏记录</h3>
          <p className="text-gray-400">还没有玩家进行过游戏</p>
        </div>
      ) : (
        <div className="space-y-4">
          {games.map((game) => (
            <div
              key={game.id}
              className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-gray-800/80 transition-colors"
                onClick={() => toggleExpand(game.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-brand-pink to-brand-rose rounded-lg flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-white font-medium">
                          {game.player1?.nickname || '玩家1'} vs {game.player2?.nickname || '玩家2'}
                        </h3>
                        {game.winner && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            {game.winner.nickname} 胜
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(game.started_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(game.started_at, game.ended_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Palette className="w-4 h-4" />
                          {game.player1_theme?.title || '未知'} / {game.player2_theme?.title || '未知'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm text-gray-400">
                        <span className="text-white">{game.task_results?.length || 0}</span> 个任务
                      </div>
                    </div>
                    <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                      {expandedId === game.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-700">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">玩家1</div>
                    <div className="text-white text-sm">{game.player1?.nickname || '-'}</div>
                    <div className="text-gray-400 text-xs">{game.player1?.email || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">玩家2</div>
                    <div className="text-white text-sm">{game.player2?.nickname || '-'}</div>
                    <div className="text-gray-400 text-xs">{game.player2?.email || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">房间ID</div>
                    <div className="text-white text-sm font-mono">{game.room_id?.substring(0, 8)}...</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">游戏ID</div>
                    <div className="text-white text-sm font-mono">{game.id?.substring(0, 8)}...</div>
                  </div>
                </div>
              </div>

              {expandedId === game.id && (
                <div className="border-t border-gray-700 p-4 bg-gray-800/30">
                  <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    任务执行记录
                  </h4>
                  
                  {!game.task_results || game.task_results.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      本场游戏没有任务记录
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {game.task_results.map((task, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            task.completed 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {task.completed ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white text-sm">
                                {task.executor_id === game.player1_id 
                                  ? game.player1?.nickname 
                                  : game.player2?.nickname}
                              </span>
                              <span className="text-gray-500 text-xs">执行任务</span>
                              <span className="text-gray-400 text-xs ml-auto">
                                {formatDate(task.timestamp)}
                              </span>
                            </div>
                            <p className="text-gray-300 text-sm">
                              {task.task_text || '未知任务'}
                            </p>
                            <div className="mt-2 text-xs text-gray-400">
                              观察者: {task.observer_id === game.player1_id 
                                ? game.player1?.nickname 
                                : game.player2?.nickname}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">任务统计</span>
                      <div className="flex items-center gap-4">
                        <span className="text-green-400">
                          ✓ {game.task_results?.filter(t => t.completed).length || 0} 完成
                        </span>
                        <span className="text-red-400">
                          ✗ {game.task_results?.filter(t => !t.completed).length || 0} 未完成
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && games.length > 0 && (
        <div className="mt-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="text-gray-400 text-sm">
              第 <span className="text-white font-medium">{currentPage}</span> 页 / 共 <span className="text-white font-medium">{totalPages}</span> 页
            </span>
            
            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">跳转到</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={goToPage}
                onChange={(e) => setGoToPage(e.target.value)}
                min={1}
                max={totalPages}
                placeholder="页码"
                className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <button
                onClick={handleGoToPage}
                disabled={!goToPage || parseInt(goToPage) < 1 || parseInt(goToPage) > totalPages}
                className="px-4 py-2 bg-brand-pink text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                跳转
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}