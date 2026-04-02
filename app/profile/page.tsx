// /app/profile/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getUserData } from "@/lib/server/auth";
import PreferencesSection from "@/components/profile/preferences-section";
import CopyAccountButton from "@/components/profile/copy-account-button";
import NicknameEditor from "@/components/profile/nickname-editor";
import { LogoutButton } from "@/components/logout-button";
import { 
  CalendarDays, 
  Key, 
  AlertCircle, 
  CheckCircle2,
  MessageSquare,
  History,
  HelpCircle,
  Settings,
  Gift,
  Smartphone
} from "lucide-react";
import Link from "next/link";

// 调整动态渲染策略，允许缓存
// force-dynamic 会强制每次重新渲染，改为 auto 允许缓存
export const dynamic = 'auto';

// 🔥 骨架屏组件
function ProfileSkeleton() {
  return (
    <div className="max-w-md mx-auto min-h-svh flex flex-col pb-24">
      <div className="px-6 pt-8 pb-6">
        {/* 标题骨架 */}
        <div className="h-12 bg-gray-700/50 rounded-xl mb-6 animate-pulse"></div>
        
        {/* 个人信息卡片骨架 */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="h-8 bg-gray-600/50 rounded-lg flex-1 mr-3 animate-pulse"></div>
            <div className="w-20 h-8 bg-gray-600/50 rounded-lg animate-pulse"></div>
          </div>
          <div className="h-4 bg-gray-600/50 rounded mb-2 animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-600/50 rounded animate-pulse w-1/2"></div>
          
          {/* 账户信息骨架 */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-600/50 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-600/50 rounded animate-pulse w-20"></div>
            </div>
            <div className="text-right">
              <div className="h-4 bg-gray-600/50 rounded animate-pulse w-16"></div>
              <div className="h-3 bg-gray-600/50 rounded animate-pulse w-24 mt-1"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 菜单项骨架 */}
      <div className="px-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-full flex items-center justify-between p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-600/50 rounded-2xl animate-pulse"></div>
              <div>
                <div className="h-5 bg-gray-600/50 rounded animate-pulse w-24 mb-1"></div>
                <div className="h-3 bg-gray-600/50 rounded animate-pulse w-16"></div>
              </div>
            </div>
            <div className="w-5 h-5 bg-gray-600/50 rounded animate-pulse"></div>
          </div>
        ))}
        
        {/* 退出按钮骨架 */}
        <div className="w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5">
          <div className="h-10 bg-gray-600/50 rounded-xl animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

// 从Cookie获取设备ID（与getUserData中的逻辑一致）
async function getDeviceId(): Promise<string> {
  const cookieStore = await cookies();
  const deviceIdCookie = cookieStore.get('love_ludo_device_id');
  return deviceIdCookie?.value || 'unknown';
}

// 格式化日期显示
function formatDateForDisplay(dateString: string | null): string {
  if (!dateString) return '--';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return '日期格式无效';
  }
}

// 计算剩余天数
function calculateRemainingDays(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  
  try {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

// 获取账户状态
function getAccountStatus(expiryDate: string | null): {
  status: 'active' | 'expired' | 'no_record';
  text: string;
  icon: React.ReactNode;
} {
  if (!expiryDate) {
    return {
      status: 'no_record',
      text: '未设置有效期',
      icon: <CalendarDays className="w-4 h-4 text-gray-400" />
    };
  }
  
  const remainingDays = calculateRemainingDays(expiryDate);
  
  if (remainingDays === null) {
    return {
      status: 'no_record',
      text: '日期格式无效',
      icon: <AlertCircle className="w-4 h-4 text-gray-400" />
    };
  }
  
  if (remainingDays > 0) {
    return {
      status: 'active',
      text: `${remainingDays} 天后到期`,
      icon: <CheckCircle2 className="w-4 h-4 text-green-400" />
    };
  } else {
    return {
      status: 'expired',
      text: '已过期',
      icon: <AlertCircle className="w-4 h-4 text-red-400" />
    };
  }
}

// 🔥 优化菜单项组件
function MenuItem({ 
  href, 
  icon: Icon, 
  title, 
  subtitle,
  gradient 
}: {
  href: string;
  icon: React.ComponentType<any>;
  title: string;
  subtitle?: string;
  gradient: string;
}) {
  return (
    <Link
      href={href}
      className="w-full flex items-center justify-between p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-200 active:scale-[0.98]"
    >
      <div className="flex items-center space-x-4">
        <div className={`w-12 h-12 ${gradient} rounded-2xl flex items-center justify-center shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="font-semibold text-white">{title}</div>
          {subtitle && <div className="text-xs text-white/50">{subtitle}</div>}
        </div>
      </div>
      <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// 🔥 分离异步内容组件
async function ProfileContent() {
  // 🔥 性能监控：记录开始时间
  const startTime = Date.now();
  
  try {
    // 🔥 核心优化：使用统一的getUserData函数（带5分钟缓存）
    const { user, profile, cacheHit } = await getUserData(false);
    
    // 🔥 性能监控：记录数据获取时间
    const dataFetchTime = Date.now() - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Profile页面性能数据:`);
      console.log(`  数据获取耗时: ${dataFetchTime}ms`);
      console.log(`  缓存命中: ${cacheHit}`);
      console.log(`  用户ID: ${user.id}`);
      console.log(`  用户邮箱: ${user.email}`);
    }
    
    // 获取设备ID（用于显示）
    const deviceId = await getDeviceId();
    const deviceIdShort = deviceId.length > 15 
      ? deviceId.substring(0, 15) + '...' 
      : deviceId;
    
    // 计算账户状态
    const accountExpiresAt = profile?.account_expires_at;
    const accountStatus = getAccountStatus(accountExpiresAt);
    const remainingDays = calculateRemainingDays(accountExpiresAt);
    
    // 从preferences中提取初始值
    const preferences = profile?.preferences || {};
    const initialGender = preferences?.gender || null;
    const initialKinks = Array.isArray(preferences?.kinks) ? preferences.kinks : [];

    return (
      <div className="max-w-md mx-auto min-h-svh flex flex-col pb-24">
        {/* 顶部标题区域 */}
        <div className="px-6 pt-8 pb-6">
          <h2 className="text-3xl font-bold text-white mb-6">我的</h2>

          {/* 个人信息卡片 */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 mr-3">
                <NicknameEditor initialNickname={profile?.nickname || null} />
              </div>
              <CopyAccountButton 
                email={user.email || null} 
                userId={user.id || null} 
              />
            </div>
            
            {user.email && (
              <div className="text-xs text-white/40 font-mono truncate mb-2">
                {user.email}
              </div>
            )}

            {/* 账户有效期信息区域 */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-2">
              <div className="flex items-center space-x-2">
                {accountStatus.icon}
                <div>
                  <span className="text-sm text-white/60">账户有效期</span>
                  {/* 开发环境显示性能数据 */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-500 mt-1">
                      数据源: {cacheHit ? '缓存' : '数据库'}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-sm font-medium ${
                  accountStatus.status === 'active' ? 'text-green-400' :
                  accountStatus.status === 'expired' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {accountStatus.text}
                </div>
                
                {accountExpiresAt ? (
                  <div className="text-xs text-white/40 mt-1">
                    至 {formatDateForDisplay(accountExpiresAt)}
                  </div>
                ) : (
                  <div className="text-xs text-white/40 mt-1">
                    未设置
                  </div>
                )}
                
                {/* 设备信息 */}
                <div className="text-xs text-white/40 mt-1 flex items-center justify-end gap-1">
                  <Smartphone className="w-3 h-3" />
                  {deviceIdShort}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 菜单与功能区域 */}
        <div className="px-6 space-y-3">
          {/* 游戏记录 */}
          <MenuItem
            href="/profile/history"
            icon={History}
            title="游戏记录"
            gradient="bg-gradient-to-br from-purple-500 to-pink-500"
          />

          {/* 账户续费入口 */}
          <MenuItem
            href="/renew"
            icon={Key}
            title="账户续费"
            subtitle="延长您的游戏时间"
            gradient="bg-gradient-to-br from-orange-500 to-amber-500"
          />

          {/* 偏好设置折叠区 */}
          <PreferencesSection 
            initialGender={initialGender} 
            initialKinks={initialKinks} 
          />

          {/* 我要反馈 */}
          <MenuItem
            href="/feedback"
            icon={MessageSquare}
            title="我要反馈"
            subtitle="问题建议，一键反馈"
            gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
          />

          {/* 帮助中心 */}
          <MenuItem
            href="/help"
            icon={HelpCircle}
            title="帮助中心"
            subtitle="常见问题"
            gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
          />

          {/* 退出登录 */}
          <div className="w-full rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 flex items-center justify-center">
            <LogoutButton />
          </div>
        </div>

        {/* 页面底部提示 */}
        <div className="mt-8 px-6 text-center">
          <p className="text-xs text-gray-500">
            遇到问题？请使用"我要反馈"功能或联系客服邮箱
          </p>
          <p className="text-xs text-gray-400 mt-1">
           cike7653@gmail.com
          </p>
          
          {/* 性能数据（仅开发环境） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 text-xs text-gray-600">
              页面总加载: {Date.now() - startTime}ms | 缓存: {cacheHit ? '命中 ✅' : '未命中 🔄'}
            </div>
          )}
        </div>
      </div>
    );
    
  } catch (error) {
    // 🔥 错误处理：检查是否是 NEXT_REDIRECT 错误
    console.error('❌ Profile页面加载失败:', error);
    
    // 🔥 检查是否是 NEXT_REDIRECT 错误
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = (error as any).digest;
      if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
        // 🔥 如果是重定向错误，重新抛出让Next.js处理
        throw error;
      }
    }
    
    // 如果getUserData没有重定向，说明是其他错误
    return (
      <div className="max-w-md mx-auto min-h-svh flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-white font-medium mb-2">页面加载失败</h3>
          <p className="text-gray-400 text-sm mb-4">个人资料页面暂时无法访问</p>
          <a 
            href="/lobby" 
            className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
          >
            返回首页
          </a>
        </div>
      </div>
    );
  }
}

// 🔥 主页面组件使用Suspense包装
export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}