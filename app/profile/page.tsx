// /app/profile/page.tsx
// 在原有代码基础上添加"我要反馈"功能
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ensureProfile } from "@/lib/profile";
import PreferencesSection from "@/components/profile/preferences-section";
import CopyAccountButton from "@/components/profile/copy-account-button";
import NicknameEditor from "@/components/profile/nickname-editor";
import { LogoutButton } from "@/components/logout-button";
import { 
  CalendarDays, 
  Key, 
  AlertCircle, 
  CheckCircle2,
  MessageSquare,  // 新增：反馈图标
  History,
  HelpCircle,
  Settings,
  Gift
} from "lucide-react";
import Link from "next/link";

export default async function ProfilePage() {
  console.log('[ProfilePage] 页面开始渲染');
  
  // 使用统一的Supabase客户端创建方式
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
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    console.log('[ProfilePage] 用户未登录，重定向');
    redirect('/login');
  }
  
  console.log('[ProfilePage] 当前认证用户:', user.id, user.email);

  let nickname: string | null = null;
  let userId: string | null = null;
  let email: string | null = null;
  let initialGender: "male" | "female" | "non_binary" | null = null;
  let initialKinks: string[] = [];
  
  // --- 账户有效期相关状态 ---
  let accountExpiresAt: string | null = null;
  let remainingDays: number | null = null;
  let accountStatus: 'active' | 'expired' | 'no_record' = 'no_record';
  let statusText = '';
  let dataSource = '未查询';

  try {
    // 确保用户资料存在
    await ensureProfile();
    console.log('[ProfilePage] ensureProfile 执行完成，开始查询 profiles 表，用户ID:', user.id);
    
    // 1. 主查询：从 profiles 表获取数据
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, nickname, preferences, access_key_id, account_expires_at, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[ProfilePage] 查询 profiles 表失败:', profileError);
    } else {
      console.log('[ProfilePage] profiles 表查询结果:', {
        找到数据: !!profile,
        用户ID: profile?.id,
        account_expires_at: profile?.account_expires_at,
        access_key_id: profile?.access_key_id,
        created_at: profile?.created_at,
      });
    }

    nickname = profile?.nickname ?? null;
    userId = user.id;
    email = user.email ?? null;
    accountExpiresAt = profile?.account_expires_at ?? null;
    dataSource = accountExpiresAt ? 'profiles 表' : 'profiles 表(空)';

    // 2. 诊断与补救：如果 profiles 表没有有效期，尝试从关联的 access_keys 表推导
    if (!accountExpiresAt && profile?.access_key_id) {
      console.log(`[ProfilePage] profiles 表中无有效期，尝试通过 access_key_id 查询密钥表:`, profile.access_key_id);
      
      const { data: keyData, error: keyError } = await supabase
        .from("access_keys")
        .select("account_valid_for_days, key_code, created_at")
        .eq("id", profile.access_key_id)
        .maybeSingle();

      if (keyError) {
        console.error('[ProfilePage] 查询关联密钥失败:', keyError);
      } else {
        console.log('[ProfilePage] 关联密钥查询结果:', keyData);
      }

      // 如果找到密钥且有有效期天数，结合 profile 的创建时间进行计算
      if (keyData?.account_valid_for_days && profile?.created_at) {
        const createdDate = new Date(profile.created_at);
        const expiryDate = new Date(createdDate);
        expiryDate.setDate(expiryDate.getDate() + keyData.account_valid_for_days);
        accountExpiresAt = expiryDate.toISOString();
        dataSource = `根据密钥推算 (密钥: ${keyData.key_code}, 天数: ${keyData.account_valid_for_days})`;
        console.log(`[ProfilePage] 根据密钥数据推算有效期:`, {
          账户创建日: profile.created_at,
          密钥有效天数: keyData.account_valid_for_days,
          推算出的过期日: accountExpiresAt,
          数据来源: dataSource
        });
      }
    }

    // 3. 计算剩余天数和状态
    console.log('[ProfilePage] 最终用于计算的有效期:', {
      accountExpiresAt,
      数据来源: dataSource
    });

    if (accountExpiresAt) {
      const expiryDate = new Date(accountExpiresAt);
      const now = new Date();
      const diffMs = expiryDate.getTime() - now.getTime();
      remainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      console.log('[ProfilePage] 有效期计算详情:', {
        过期时间: expiryDate.toISOString(),
        当前时间: now.toISOString(),
        时间差毫秒: diffMs,
        剩余天数: remainingDays
      });

      if (remainingDays > 0) {
        accountStatus = 'active';
        statusText = `${remainingDays} 天后到期`;
      } else {
        accountStatus = 'expired';
        statusText = '已过期';
      }
    } else {
      accountStatus = 'no_record';
      statusText = '未设置有效期';
      console.log('[ProfilePage] 警告: 最终 accountExpiresAt 仍为 null/undefined，无法计算天数。');
    }

    // 4. 处理其他偏好设置数据
    const pref = (profile?.preferences ?? {}) as { gender?: "male" | "female" | "non_binary"; kinks?: string[] };
    initialGender = pref?.gender ?? null;
    initialKinks = Array.isArray(pref?.kinks) ? pref!.kinks! : [];

  } catch (error) {
    console.error('[ProfilePage] 数据处理过程中发生未知错误:', error);
  }

  // 辅助函数：格式化日期显示
  const formatDateForDisplay = (dateString: string | null) => {
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
  };

  console.log('[ProfilePage] 准备渲染，最终状态:', {
    userId,
    accountStatus,
    statusText,
    accountExpiresAt: formatDateForDisplay(accountExpiresAt),
    dataSource
  });

  return (
    <>
      <div className="max-w-md mx-auto min-h-svh flex flex-col pb-24">
        {/* 顶部标题区域 */}
        <div className="px-6 pt-8 pb-6">
          <h2 className="text-3xl font-bold text-white mb-6">我的</h2>

          {/* 个人信息卡片 */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 mr-3">
                <NicknameEditor initialNickname={nickname} />
              </div>
              <CopyAccountButton email={email} userId={userId} />
            </div>
            
            {email && (
              <div className="text-xs text-white/40 font-mono truncate mb-2">
                {email}
              </div>
            )}

            {/* 账户有效期信息区域 - 诊断增强版 */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-2">
              <div className="flex items-center space-x-2">
                {accountStatus === 'active' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : accountStatus === 'expired' ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <CalendarDays className="w-4 h-4 text-gray-400" />
                )}
                <div>
                  <span className="text-sm text-white/60">账户有效期</span>
                  {/* 仅在开发环境显示数据来源 */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-500 mt-1">来源: {dataSource}</div>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-sm font-medium ${
                  accountStatus === 'active' ? 'text-green-400' :
                  accountStatus === 'expired' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {statusText}
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
                
                {/* 调试信息：显示剩余天数（开发环境） */}
                {process.env.NODE_ENV === 'development' && remainingDays !== null && (
                  <div className="text-xs text-gray-500 mt-1">
                    剩余天数: {remainingDays}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 菜单与功能区域 */}
        <div className="px-6 space-y-3">
          {/* 游戏记录 */}
          <Link
            href="/profile/history"
            className="w-full flex items-center justify-between p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                <History className="w-6 h-6 text-white" />
              </div>
              <span className="font-semibold text-white">游戏记录</span>
            </div>
            <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* 账户续费入口 */}
          <Link
            href="/renew"
            className="w-full flex items-center justify-between p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Key className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-semibold text-white">账户续费</div>
                <div className="text-xs text-white/50">延长您的游戏时间</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* 偏好设置折叠区 */}
          <PreferencesSection initialGender={initialGender} initialKinks={initialKinks} />

          {/* 🔥 新增：我要反馈 */}
          <Link
            href="/feedback"
            className="w-full flex items-center justify-between p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-semibold text-white">我要反馈</div>
                <div className="text-xs text-white/50">问题建议，一键反馈</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* AI次数兑换（如果存在）
          <Link
            href="/account/ai-boost"
            className="w-full flex items-center justify-between p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-semibold text-white">AI次数兑换</div>
                <div className="text-xs text-white/50">兑换更多AI使用次数</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link> */}

          {/* 帮助中心 */}
          <Link
            href="/help"
            className="w-full flex items-center justify-between p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                <HelpCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-semibold text-white">帮助中心</div>
                <div className="text-xs text-white/50">常见问题</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* 系统设置（可选）
          <Link
            href="/settings"
            className="w-full flex items-center justify-between p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-200 active:scale-[0.98]"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center shadow-lg">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-semibold text-white">系统设置</div>
                <div className="text-xs text-white/50">通知、隐私等</div>
              </div>
            </div>
            <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link> */}

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
        </div>
      </div>
    </>
  );
}