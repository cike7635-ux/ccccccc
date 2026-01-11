import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { listAvailableThemes, createRoom, joinRoom } from "./actions";
import { Users, LogIn, Layers, ChevronDown, Hash, ShoppingCart } from "lucide-react";
import PreferencesModal from "@/components/profile/preferences-modal";
import Link from "next/link";
import AnnouncementModal from "@/components/announcement-modal";

export default async function LobbyPage({ searchParams }: { searchParams?: { error?: string } }) {
  // 1. 创建简化的Supabase客户端
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { 
      cookies: { 
        getAll: () => cookieStore.getAll(),
      }
    }
  );
  
  // 2. 检查用户登录状态
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }
  
  // 3. 获取用户资料（检查会员有效期）
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_expires_at')
    .eq('id', user.id)
    .single();
  
  // 如果是新用户且没有profile，创建基本profile
  if (!profile) {
    console.log(`[Lobby] 新用户 ${user.email} 资料不存在，创建基本资料`);
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{ 
        id: user.id, 
        email: user.email,
        created_at: new Date().toISOString()
      }]);
    
    if (insertError) {
      console.error('[Lobby] 创建用户资料失败:', insertError);
    }
    
    console.log(`[Lobby] 新用户 ${user.email} 基本资料已创建`);
  }
  
  // 4. 检查会员有效期
  const isExpired = profile?.account_expires_at && new Date(profile.account_expires_at) < new Date();
  if (isExpired) {
    redirect('/account-expired');
  }
  
  // 5. 获取主题列表
  const { data: themes } = await listAvailableThemes();
  const errorMessage = searchParams?.error ?? "";
  
  // 6. 如果是新用户且没有主题，log提示
  if ((themes?.length || 0) === 0) {
    console.log(`[Lobby] 用户 ${user.email} 没有主题，将访问/themes时初始化`);
  }
  
  return (
    <>
      <PreferencesModal />
      <AnnouncementModal />
      
      <div className="max-w-md mx-auto min-h-svh flex flex-col p-6 pb-24">
        {/* 顶部提示小字 */}
        <p className="text-xs text-white/60 text-center mb-2">
          将网站添加到主屏幕可以获得近似app的体验哦~
        </p>
        
        {/* 会员状态提示 */}
        <div className="mb-4 p-3 glass rounded-xl">
          <p className="text-sm text-green-400 text-center">
            会员有效期至：{profile?.account_expires_at ? 
              new Date(profile.account_expires_at).toLocaleDateString('zh-CN') : 
              '新用户（请在主题库中初始化主题）'}
          </p>
        </div>
        
        <div className="flex items-center justify-between mb-6 pt-4">
          <div>
            <h2 className="text-2xl font-bold">首页</h2>
            <p className="text-sm text-gray-400 mt-1">找到你的对手，开始游戏</p>
          </div>
          
          {/* 🔥 淘宝店铺链接 - 替换原来的GitHub链接 */}
          <a
            href="https://shop.m.taobao.com/shop/shop_index.htm?shop_id=584630473"
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="w-10 h-10 bg-gradient-to-r from-orange-400 to-red-500 rounded-xl flex items-center justify-center hover:from-orange-500 hover:to-red-600 hover:shadow-lg transition-all group"
            aria-label="淘宝店铺"
            title="访问我的淘宝店铺"
          >
            <ShoppingCart className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          </a>
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
                    {themes?.map((t) => (
                      <option key={t.id} value={t.id} className="bg-gray-800">
                        {t.title}
                      </option>
                    )) || []}
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
                    {themes?.map((t) => (
                      <option key={t.id} value={t.id} className="bg-gray-800">
                        {t.title}
                      </option>
                    )) || []}
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