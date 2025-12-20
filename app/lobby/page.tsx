// /app/lobby/page.tsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { listAvailableThemes, createRoom, joinRoom } from "./actions";
import { Users, LogIn, Layers, ChevronDown, Hash, Github } from "lucide-react";
import PreferencesModal from "@/components/profile/preferences-modal";
import Link from "next/link";

export default async function LobbyPage({ searchParams }: { searchParams?: { error?: string } }) {
  // 1. 创建Supabase客户端
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  
  // 2. 检查用户登录状态
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }
  
  // 3. 获取会话信息（用于验证会话是否最新）
  const { data: { session: currentSession } } = await supabase.auth.getSession();
  if (!currentSession) {
    await supabase.auth.signOut();
    redirect('/login?error=no_session');
  }
  
  // 4. 获取用户资料（包括会话信息和有效期）
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_expires_at, last_login_at, last_login_session')
    .eq('id', user.id)
    .single();
  
  if (!profile) {
    redirect('/login?error=profile_not_found');
  }
  
  // 5. 检查会员有效期
  const isExpired = !profile?.account_expires_at || new Date(profile.account_expires_at) < new Date();
  if (isExpired) {
    redirect('/account-expired');
  }
  
  // ============ 【严格的多设备登录验证】 ============
  // 核心逻辑：如果数据库中的最后登录时间晚于当前会话的创建时间
  // 说明用户在其他设备上重新登录了，当前会话已失效
  
  const lastLoginTime = profile.last_login_at ? new Date(profile.last_login_at) : null;
  const sessionCreatedTime = new Date(currentSession.created_at * 1000); // JWT时间是秒，需要转毫秒
  
  if (lastLoginTime && lastLoginTime > sessionCreatedTime) {
    console.log(`[严格模式] 检测到新登录，强制退出用户: ${user.email}`);
    console.log(`  - 当前会话创建时间: ${sessionCreatedTime.toISOString()}`);
    console.log(`  - 最后登录时间: ${lastLoginTime.toISOString()}`);
    
    // 强制退出当前会话
    await supabase.auth.signOut();
    
    // 重定向到登录页，携带错误信息
    redirect('/login?error=session_expired&message=您的账号已在其他设备登录，请重新登录');
  }
  
  // 6. 可选的：记录当前登录到日志（用于调试）
  console.log(`[登录验证] 用户 ${user.email} 会话验证通过`);
  console.log(`  - 会话创建时间: ${sessionCreatedTime.toISOString()}`);
  console.log(`  - 最后登录时间: ${lastLoginTime ? lastLoginTime.toISOString() : '无记录'}`);
  console.log(`  - 会话标识: ${profile.last_login_session || '无标识'}`);
  // ============ 会话验证结束 ============
  
  // 7. 原有的业务逻辑
  const { data: themes } = await listAvailableThemes();
  const errorMessage = searchParams?.error ?? "";
  
  return (
    <>
      {/* 首次进入首页时的偏好设置弹窗（仅登录用户，且偏好未完善时提示） */}
      <PreferencesModal />
      <div className="max-w-md mx-auto min-h-svh flex flex-col p-6 pb-24">
        {/* 顶部提示小字 */}
        <p className="text-xs text-white/60 text-center mb-2">
          将网站添加到主屏幕可以获得近似app的体验哦~
        </p>
        
        {/* 会员状态提示（可选） */}
        <div className="mb-4 p-3 glass rounded-xl">
          <p className="text-sm text-green-400 text-center">
            会员有效期至：{profile?.account_expires_at ? 
              new Date(profile.account_expires_at).toLocaleDateString('zh-CN') : 
              '未设置'}
          </p>
        </div>
        
        <div className="flex items-center justify-between mb-6 pt-4">
          <div>
            <h2 className="text-2xl font-bold">首页</h2>
            <p className="text-sm text-gray-400 mt-1">找到你的对手，开始游戏</p>
          </div>
          <Link
            href="https://github.com/woniu9524/love-ludo"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 bg-white rounded-xl flex items-center justify-center hover:bg-white/90 transition-all"
            aria-label="GitHub 仓库"
          >
            <Github className="w-5 h-5 text-black" />
          </Link>
        </div>

        <div className="space-y-6">
          {errorMessage && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 backdrop-blur p-4 text-sm text-red-300">
              {errorMessage}
            </div>
          )}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold">创建房间</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">创建一个新的游戏房间，邀请你的另一半加入</p>

            <form action={createRoom} className="space-y-4">
              <div>
                <Label className="block text-sm text-gray-300 mb-2">选择主题</Label>
                <div className="glass rounded-xl p-3 flex items-center space-x-2 relative">
                  <Layers className="w-5 h-5 text-gray-400" />
                  <select
                    id="player1_theme_id"
                    name="player1_theme_id"
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm cursor-pointer appearance-none"
                    required
                  >
                    <option value="" className="bg-gray-800">请选择游戏主题</option>
                    {themes.map((t) => (
                      <option key={t.id} value={t.id} className="bg-gray-800">
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary py-3.5 rounded-xl font-semibold glow-pink transition-all hover:scale-105 active:scale-95 text-white"
              >
                创建房间
              </Button>
            </form>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 gradient-secondary rounded-lg flex items-center justify-center">
                <LogIn className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold">加入房间</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">输入房间码加入已有的游戏</p>

            <form action={joinRoom} className="space-y-4">
              <div>
                <Label className="block text-sm text-gray-300 mb-2">选择主题</Label>
                <div className="glass rounded-xl p-3 flex items-center space-x-2 relative">
                  <Layers className="w-5 h-5 text-gray-400" />
                  <select
                    id="player2_theme_id"
                    name="player2_theme_id"
                    className="flex-1 bg-transparent border-none outline-none text-white text-sm cursor-pointer appearance-none"
                    required
                  >
                    <option value="" className="bg-gray-800">请选择游戏主题</option>
                    {themes.map((t) => (
                      <option key={t.id} value={t.id} className="bg-gray-800">
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div>
                <Label className="block text-sm text-gray-300 mb-2">房间码</Label>
                <div className="glass rounded-xl p-3 flex items-center space-x-2">
                  <Hash className="w-5 h-5 text-gray-400" />
                  <Input
                    id="room_code"
                    name="room_code"
                    type="text"
                    placeholder="请输入6位房间码"
                    maxLength={6}
                    required
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full glass py-3.5 rounded-xl font-semibold hover:bg-white/10 transition-all active:scale-95"
              >
                加入房间
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
