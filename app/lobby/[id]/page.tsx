// app\lobby\[id]\page.tsx
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { getRoomById, listAvailableThemes, setMyTheme, startGame } from "../actions";
import { createClient } from "@/lib/supabase/server";
import CopyButton from "@/components/copy-button";
import RoomWatcher from "@/components/room-watcher";
import { ArrowLeft, Users, Copy, ChevronDown } from "lucide-react";

type Params = { params: Promise<{ id: string }> };

export default async function LobbyRoomPage({ params }: Params) {
  const { id } = await params;
  const [{ data: room }, { data: themes }] = await Promise.all([
    getRoomById(id),
    listAvailableThemes(),
  ]);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  if (!room) {
    return (
      <div className="max-w-md mx-auto min-h-svh flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-6 text-center w-full">
          <h2 className="text-xl font-bold mb-4">房间不存在</h2>
          <p className="text-gray-400 mb-6">无法找到该房间或无权限访问</p>
          <Button asChild className="gradient-primary text-white">
            <Link href="/lobby">返回大厅</Link>
          </Button>
        </div>
      </div>
    );
  }

  const iAmPlayer1 = userId && userId === room.player1_id;
  const iAmPlayer2 = userId && userId === room.player2_id;
  const myRole = iAmPlayer1 ? "player1" : iAmPlayer2 ? "player2" : null;

  const bothReady = !!(room.player1_theme_id && room.player2_theme_id);

  return (
    <div className="max-w-md mx-auto min-h-svh flex flex-col p-6 pb-24">
      <RoomWatcher roomId={room.id} status={room.status} />

      <div className="flex items-center justify-between mb-6 pt-4">
        <Link href="/lobby" className="w-10 h-10 glass rounded-xl flex items-center justify-center hover:bg-white/10 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-xl font-bold">房间详情</h2>
        <div className="w-10" />
      </div>

      <div className="space-y-6">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold">房间信息</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">房间码</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-brand-pink font-bold">{room.room_code}</span>
                <CopyButton value={room.room_code} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">状态</span>
              <span className="font-medium">{room.status}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="glass rounded-xl p-3 bg-brand-pink/10">
              <div className="text-xs text-gray-400 mb-1">玩家 1</div>
              <div className="text-sm font-medium truncate">{room.player1_nickname || room.player1_id || "待加入"}</div>
              <div className="text-xs text-gray-500 mt-1">{room.player1_theme_id ? "✅ 已选择" : "⚫ 未选择"}</div>
            </div>
            <div className="glass rounded-xl p-3 bg-brand-purple/10">
              <div className="text-xs text-gray-400 mb-1">玩家 2</div>
              <div className="text-sm font-medium truncate">{room.player2_nickname || room.player2_id || "待加入"}</div>
              <div className="text-xs text-gray-500 mt-1">{room.player2_theme_id ? "✅ 已选择" : "⚫ 未选择"}</div>
            </div>
          </div>

          <form action={startGame} className="mt-6">
            <input type="hidden" name="room_id" value={room.id} />
            <Button
              type="submit"
              disabled={!bothReady}
              className={`w-full py-4 rounded-2xl font-semibold ${
                bothReady
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-green-600/40 text-white cursor-not-allowed"
              }`}
            >
              开始游戏
            </Button>
          </form>
        </div>

        

        {myRole ? (
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4">我的主题选择</h3>
            <form action={setMyTheme} className="space-y-4">
              <input type="hidden" name="room_id" value={room.id} />
              <div>
                <Label className="block text-sm text-gray-300 mb-2">选择主题</Label>
                <div className="glass rounded-xl p-3 flex items-center space-x-2 relative">
                  <select
                    id="theme_id"
                    name="theme_id"
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm cursor-pointer appearance-none"
                    defaultValue={myRole === "player1" ? room.player1_theme_id ?? "" : room.player2_theme_id ?? ""}
                    required
                  >
                    <option value="" className="bg-gray-800">请选择</option>
                    {themes.map((t) => (
                      <option key={t.id} value={t.id} className="bg-gray-800">
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary py-3 rounded-xl font-semibold text-white">
                保存我的主题
              </Button>
            </form>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-gray-400">你不是房间参与者</p>
            <p className="text-sm text-gray-500 mt-1">仅房间参与者可以设置主题与开始游戏。</p>
          </div>
        )}
      </div>
    </div>
  );
}