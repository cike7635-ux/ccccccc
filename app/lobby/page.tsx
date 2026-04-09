// /app/lobby/page.tsx - 添加骨架屏优化
import { getUserData } from '@/lib/server/auth';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { listAvailableThemes, createRoom } from "./actions";
import { Users, LogIn, Layers, ChevronDown, Hash, ShoppingCart, Smartphone } from "lucide-react";
import PreferencesModal from "@/components/profile/preferences-modal";
import AnnouncementModal from "@/components/announcement-modal";
import Link from "next/link";
import { Suspense, memo } from 'react';
import ThemeSelect from "./components/theme-select";
import RoomCard from "./components/room-card";
import JoinRoomForm from "./components/join-room-form";
import CreateRoomForm from "./components/create-room-form";
import RoomSkeleton from "./components/room-skeleton";
import ClientOnlyWrapper from "@/components/client-only-wrapper";

// 添加动态渲染导出
export const dynamic = 'force-dynamic';

// 提取设备ID的函数
async function extractDeviceIdFromCookie(): Promise<string> {
  const cookieStore = await cookies();
  const deviceIdCookie = cookieStore.get('love_ludo_device_id');
  return deviceIdCookie?.value || 'unknown';
}

// 🔥 骨架屏组件
// 🔥 改进骨架屏动画效果
function LobbySkeleton() {
  return (
    <div className="max-w-md mx-auto min-h-svh flex flex-col p-6 pb-24">
      {/* 顶部提示小字骨架 */}
      <div className="text-xs text-center mb-2">
        <div className="h-3 bg-white/5 rounded w-3/4 mx-auto animate-pulse"></div>
      </div>
      
      {/* 会员状态和设备信息骨架屏 */}
      <div className="mb-4 p-3 glass rounded-xl animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-white/10 rounded w-32"></div>
            <div className="h-3 bg-white/5 rounded w-24"></div>
          </div>
          <div className="text-right">
            <div className="h-3 bg-white/5 rounded w-16 mb-1"></div>
            <div className="h-3 bg-white/5 rounded w-12"></div>
          </div>
        </div>
      </div>
      
      {/* 其余骨架屏内容保持不变但优化颜色 */}
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

// 🔥 错误状态组件
function renderErrorState() {
  return (
    <div className="max-w-md mx-auto min-h-svh flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-white font-medium mb-2">页面加载失败</h3>
        <p className="text-gray-400 text-sm mb-6">请刷新页面重试</p>
        <a href="/lobby" className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors">
          重新加载
        </a>
      </div>
    </div>
  );
}

// 🔥 更新默认导出
export default async function LobbyPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  // 等待 searchParams 解析
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  return (
    <Suspense fallback={<LobbySkeleton />}>
      <LobbyContent searchParams={resolvedSearchParams} />
    </Suspense>
  );
}

// 🔥 使用统一数据层获取用户数据
// 🔥 优化数据获取逻辑
async function LobbyContent({ searchParams }: { searchParams?: { error?: string } }) {
  try {
    // 并行获取用户数据和主题数据
    const [userData, themesData] = await Promise.all([
      getUserData(true),
      listAvailableThemes()
    ]);
    
    const { user, profile, cacheHit } = userData;
    const currentDeviceId = await extractDeviceIdFromCookie();
    const deviceIdShort = currentDeviceId.length > 15 ? currentDeviceId.substring(0, 15) + '...' : currentDeviceId;
    
    console.log(`🏁 Lobby页面加载 - 用户: ${user.email}, 设备: ${currentDeviceId}, 缓存命中: ${cacheHit}`);
    console.log(`📊 预加载主题数量: ${themesData.data?.length || 0}`);
    
    const errorMessage = searchParams?.error ?? "";
    
    return renderLobbyContent(user, profile, deviceIdShort, errorMessage, cacheHit, themesData.data);
    
  } catch (error) {
    console.error('Lobby页面加载失败:', error);
    
    // 🔥 检查是否是 NEXT_REDIRECT 错误
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = (error as any).digest;
      if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
        // 🔥 如果是重定向错误，重新抛出让Next.js处理
        throw error;
      }
    }
    
    return renderErrorState();
  }
}

// 🔥 使用 React.memo 优化主题列表组件
const MemoizedThemesList = memo(ThemesList);

// 🔥 分离渲染逻辑
function renderLobbyContent(user: any, profile: any, deviceIdShort: string, errorMessage: string, cacheHit: boolean, themes?: any[]) {
  return (
    <>
      <ClientOnlyWrapper>
        <PreferencesModal />
        <AnnouncementModal />
      </ClientOnlyWrapper>
      
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
        
        {/* 其余内容保持不变 */}
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

            <CreateRoomForm initialThemes={themes} />
          </div>
  
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-8 h-8 gradient-secondary rounded-lg flex items-center justify-center">
                <LogIn className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold">加入房间</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">输入房间码加入已有的游戏</p>
  
            <JoinRoomForm initialThemes={themes} />
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

// 🔥 添加性能监控
if (typeof window !== 'undefined') {
// 客户端性能监控
  const startTime = performance.now();
  window.addEventListener('load', () => {
    const loadTime = performance.now() - startTime;
    console.log(`🏁 Lobby页面完全加载耗时: ${loadTime.toFixed(2)}ms`);
  });
}