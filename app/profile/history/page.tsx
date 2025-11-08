import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type GameHistoryRecord = {
  id: string;
  session_id: string | null;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  task_results: { description?: string; task_text?: string | null; completed: boolean }[];
};

export default async function GameHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-md mx-auto min-h-svh flex items-center justify-center px-6">
        <p className="text-gray-400">请先登录</p>
      </div>
    );
  }

  const { data: history } = await supabase
    .from("game_history")
    .select("*")
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .order("ended_at", { ascending: false })
    .limit(50);

  const records = (history ?? []) as GameHistoryRecord[];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname")
    .in("id", [...new Set(records.flatMap(r => [r.player1_id, r.player2_id, r.winner_id]).filter(Boolean) as string[])]);

  const nicknameMap = new Map((profiles ?? []).map(p => [p.id, p.nickname]));

  return (
    <div className="max-w-md mx-auto min-h-svh flex flex-col pb-24">
      <div className="gradient-primary px-6 pt-6 pb-10 rounded-b-3xl">
        <div className="flex items-center justify-between mb-6">
          <Link href="/profile" className="text-white/80 hover:text-white">
            ← 返回
          </Link>
          <h2 className="text-xl font-bold">游戏记录</h2>
          <div className="w-12" />
        </div>
      </div>

      <div className="px-6 mt-6 space-y-3">
        {records.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8 text-center">
            <p className="text-gray-400">暂无游戏记录</p>
            <Link
              href="/lobby"
              className="mt-4 inline-block text-sm text-pink-400 hover:text-pink-300"
            >
              去开始游戏 →
            </Link>
          </div>
        ) : (
          records.map((record) => {
            const isWinner = record.winner_id === user.id;
            const opponentId = record.player1_id === user.id ? record.player2_id : record.player1_id;
            const opponentNickname = opponentId ? nicknameMap.get(opponentId) ?? "匿名玩家" : "匿名玩家";
            const endedAt = record.ended_at ? new Date(record.ended_at) : null;
            const completedTasks = (record.task_results ?? []).filter(t => t.completed).length;
            const totalTasks = (record.task_results ?? []).length;

            return (
              <div
                key={record.id}
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 hover:bg-white/10 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    {isWinner ? (
                      <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 rounded text-xs font-bold">
                        胜利
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-white/10 rounded text-xs text-gray-400">
                        失败
                      </span>
                    )}
                    <span className="text-sm text-gray-400">
                      vs {opponentNickname}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {endedAt ? endedAt.toLocaleDateString("zh-CN") : "—"}
                  </span>
                </div>

                <div className="text-xs text-gray-400 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>完成任务: {completedTasks} / {totalTasks}</span>
                    {endedAt && (
                      <span className="text-gray-500">
                        {endedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  {totalTasks > 0 && (
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                        style={{ width: `${Math.round((completedTasks / totalTasks) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {totalTasks > 0 && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                      查看任务详情
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(record.task_results ?? []).map((task, idx) => (
                        <span
                          key={idx}
                          className={
                            `inline-flex items-center rounded-full px-2.5 py-1 border ` +
                            (task.completed
                              ? "bg-green-500/15 border-green-500/30 text-green-300"
                              : "bg-white/10 border-white/20 text-gray-300")
                          }
                        >
                          <span className={task.completed ? "text-green-300 mr-1" : "text-gray-300 mr-1"}>
                            {task.completed ? "✓" : "○"}
                          </span>
                          <span className="truncate max-w-[12rem]">{task.task_text}</span>
                        </span>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
