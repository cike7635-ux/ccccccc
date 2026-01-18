// /app/lobby/page.tsx - 添加骨架屏优化
import { getUserData } from '@/lib/server/auth';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { listAvailableThemes, createRoom, joinRoom } from "./actions";
import { Users, LogIn, Layers, ChevronDown, Hash, ShoppingCart, Smartphone } from "lucide-react";
import PreferencesModal from "@/components/profile/preferences-modal";
import Link from "next/link";
import AnnouncementModal from "@/components/announcement-modal";
import { Suspense } from 'react';

// 添加动态渲染导出
export const dynamic = 'force-dynamic';

// 提取设备ID的函数
function extractDeviceIdFromCookie(): string {
  const cookieStore = cookies();
  const deviceIdCookie = cookieStore.get('love_ludo_device_id');
  return deviceIdCookie?.value || 'unknown';
}

// 🔥 骨架屏组件
function LobbySkeleton() {
  return (
    <div className="max-w-md mx-auto min-h-svh flex flex-col p-6 pb-24">
      {/* 顶部提示小字 */}
      <p className="text-xs text-white/60 text-center mb-2">
        将网站添加到主屏幕可以获得近似app的体验哦~
      </p>
      
      {/* 会员状态和设备信息骨架屏 */}
      <div className="mb-4 p-3 glass rounded-xl animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-gray-700 rounded w-32"></div>
            <div className="h-3 bg-gray-800 rounded w-24"></div>
          </div>
          <div className="text-right">
            <div className="h-3 bg-gray-800 rounded w-16 mb-1"></div>
            <div className="h-3 bg-gray-800 rounded w-12"></div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between mb-6 pt-4">
        <div className="space-y-1">
          <div className="h-7 bg-gray-700 rounded w-16"></div>
          <div className="h-3 bg-gray-800 rounded w-24"></div>
        </div>
        <div className="w-10 h-10 bg-gray-700 rounded-xl animate-pulse"></div>
      </div>

      <div className="space-y-6">
        {/* 创建房间骨架屏 */}
        <div className="glass rounded-2xl p-6 animate-pulse">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-8 h-8 bg-gray-700 rounded-lg"></div>
            <div className="h-6 bg-gray-700 rounded w-32"></div>
          </div>
          <div className="h-3 bg-gray-800 rounded w-3/4 mb-4"></div>
          
          <div className="space-y-4">
            <div>
              <div className="h-4 bg-gray-800 rounded w-16 mb-2"></div>
              <div className="glass rounded-xl p-3 h-12 bg-gray-700"></div>
            </div>
            <div className="h-12 bg-gray-700 rounded-xl"></div>
          </div>
        </div>

        {/* 加入房间骨架屏 */}
        <div className="glass rounded-2xl p-6 animate-pulse">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-8 h-8 bg-gray-700 rounded-lg"></div>
            <div className="h-6 bg-gray-700 rounded w-32"></div>
          </div>
          <div className="h-3 bg-gray-800 rounded w-2/3 mb-4"></div>
          
          <div className="space-y-4">
            <div>
              <div className="h-4 bg-gray-800 rounded w-16 mb-2"></div>
              <div className="glass rounded-xl p-3 h-12 bg-gray-700"></div>
            </div>
            <div>
              <div className="h-4 bg-gray-800 rounded w-16 mb-2"></div>
              <div className="glass rounded-xl p-3 h-12 bg-gray-700"></div>
            </div>
            <div className="h-12 bg-gray-700 rounded-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 🔥 主题列表加载组件
async function ThemesList() {
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
  
  // 获取主题列表
  const { data: themes } = await listAvailableThemes();
  
  if (!themes || themes.length === 0) {
    return (
      <>
        <option value="" className="bg-gray-800">请选择游戏主题</option>
        <option value="" className="bg-gray-800" disabled>
          ⏳ 正在为您初始化主题库，请稍候刷新...
        </option>
      </>
    );
  }
  
  return (
    <>
      <option value="" className="bg-gray-800">请选择游戏主题</option>
      {themes.map((t) => (
        <option key={t.id} value={t.id} className="bg-gray-800">
          {t.title} ({t.task_count || 0}个任务)
        </option>
      ))}
    </>
  );
}

export default async function LobbyPage({ searchParams }: { searchParams?: { error?: string } }) {
  // 🔥 使用统一数据层获取用户数据
  const { user, profile, cacheHit } = await getUserData(true);
  
  // 获取当前设备ID
  const currentDeviceId = extractDeviceIdFromCookie();
  const deviceIdShort = currentDeviceId.length > 15 ? currentDeviceId.substring(0, 15) + '...' : currentDeviceId;
  
  console.log(`🏁 Lobby页面加载 - 用户: ${user.email}, 设备: ${currentDeviceId}, 缓存命中: ${cacheHit}`);
  
  const errorMessage = searchParams?.error ?? "";
  
  return (
    <>
      <PreferencesModal />
      <AnnouncementModal />
      
      <div className="max-w-md mx-auto min-h-svh flex flex-col p-6 pb-24">
        {/* 顶部提示小字 */}
        <p className="text-xs text-white/60 text-center mb-2">
          将网站添加到主屏幕可以获得近似app的体验哦~
        </p>
        
        {/* 会员状态和设备信息 */}
        <div className="mb-4 p-3 glass rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-400">
                会员有效期至：{profile?.account_expires_at ? 
                  new Date(profile.account_expires_at).toLocaleDateString('zh-CN') : 
                  '新用户'}
              </p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                设备ID: {deviceIdShort}
              </p>
            </div>
            
            {/* 缓存状态提示（开发环境） */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-right">
                <p className="text-xs text-gray-400">
                  数据源: {cacheHit ? '缓存' : '数据库'}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-6 pt-4">
          <div>
            <h2 className="text-2xl font-bold">首页</h2>
            <p className="text-sm text-gray-400 mt-1">找到你的对手，开始游戏</p>
          </div>
          
          {/* 淘宝店铺链接 */}
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
                    <Suspense fallback={
                      <option value="" className="bg-gray-800" disabled>
                        加载主题中...
                      </option>
                    }>
                      <ThemesList />
                    </Suspense>
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
                    <Suspense fallback={
                      <option value="" className="bg-gray-800" disabled>
                        加载主题中...
                      </option>
                    }>
                      <ThemesList />
                    </Suspense>
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

// 🔥 包装组件，提供整体骨架屏
export function LobbyPageWithSuspense({ searchParams }: { searchParams?: { error?: string } }) {
  return (
    <Suspense fallback={<LobbySkeleton />}>
      <LobbyPage searchParams={searchParams} />
    </Suspense>
  );
}