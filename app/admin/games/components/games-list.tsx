'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Trophy,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';

// 先导出 GameRecord 类型
export interface GameRecord {
  id: string;
  session_id?: string;
  room_id?: string;
  player1_id?: string;
  player2_id?: string;
  winner_id?: string | null;
  started_at?: string;
  ended_at?: string | null;
  task_results?: Array<{
    executor_id?: string;
    observer_id?: string;
    task_text?: string | null;
    completed?: boolean;
    timestamp?: string;
  }>;
  is_abandoned?: boolean;
  is_in_progress?: boolean;
  player1?: { nickname: string; email: string } | null;
  player2?: { nickname: string; email: string } | null;
  winner?: { nickname: string; email: string } | null;
  player1_theme?: { title: string } | null;
  player2_theme?: { title: string } | null;
}

interface GamesListProps {
  games: GameRecord[];
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(startStr: string, endStr: string | null) {
  if (!endStr) return '未完成';
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${minutes}分${seconds}秒`;
}

export default function GamesList({ games, totalPages, currentPage, onPageChange, loading }: GamesListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [goToPage, setGoToPage] = useState('');

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToPage = () => {
    const page = parseInt(goToPage);
    if (page) {
      handlePageChange(page);
      setGoToPage('');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="text-gray-400">加载中...</div>
        </div>
      </div>
    );
  }

  if (!games || games.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="text-gray-400">暂无游戏记录</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">游戏记录</h1>
        <p className="text-gray-400">查看所有游戏对局的详细记录</p>
      </div>

      <div className="space-y-4">
        {games.map((game) => (
          <div
            key={game.id}
            className="border border-gray-700 rounded-xl overflow-hidden bg-gray-800/30"
          >
            <div
              className="p-4 cursor-pointer hover:bg-gray-700/50 transition-colors"
              onClick={() => toggleExpand(game.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-white font-medium">
                        {game.player1?.nickname || '玩家1'} vs {game.player2?.nickname || '玩家2'}
                      </h3>
                      {game.is_in_progress ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                          正在进行
                        </span>
                      ) : game.is_abandoned ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                          中途退出
                        </span>
                      ) : game.winner ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          {game.winner.nickname} 胜
                        </span>
                      ) : null}
                    </div>
                    
                  </div>

                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(game.started_at!)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>{formatDuration(game.started_at!, game.ended_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>2 位玩家</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-green-400">
                      <Trophy className="w-4 h-4" />
                      <span>
                        {`${game.task_results?.length || 0} 个任务`}
                      </span>
                    </div>
                  </div>

                  {/* 主题显示 */}
                  {(game.player1_theme || game.player2_theme) && (
                    <div className="mt-2 text-xs text-gray-400">
                      主题: {game.player1_theme?.title || '无'} / {game.player2_theme?.title || '无'}
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(game.id);
                  }}
                  className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {expandedId === game.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
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
                    {game.task_results.map((task, index) => {
                      // 未完成游戏的任务可能没有 observer_id，处理一下
                      const executorNickname = task.executor_id === game.player1_id 
                        ? game.player1?.nickname 
                        : game.player2?.nickname;
                      const observerNickname = task.observer_id 
                        ? (task.observer_id === game.player1_id ? game.player1?.nickname : game.player2?.nickname)
                        : null;
                      
                      return (
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
                                {executorNickname}
                              </span>
                              <span className="text-gray-500 text-xs">执行任务</span>
                              {task.timestamp && (
                                <span className="text-gray-400 text-xs ml-auto">
                                  {formatDate(task.timestamp)}
                                </span>
                              )}
                            </div>
                            <p className="text-gray-300 text-sm">
                              {task.task_text || '未知任务'}
                            </p>
                            {observerNickname && (
                              <div className="mt-2 text-xs text-gray-400">
                                观察者: {observerNickname}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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

      {!loading && games && games.length > 0 && (
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
