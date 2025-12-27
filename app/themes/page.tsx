// /app/themes/page.tsx
// 简化版 - 不包含动画
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from "next/link";
import { listMyThemes } from "./actions";
import DeleteThemeButton from '@/app/components/themes/delete-theme-button';

export default async function ThemesPage() {
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
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login');
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_expires_at, nickname')
    .eq('id', user.id)
    .single();
  
  if (!profile) {
    console.log(`[Themes] 新用户 ${user.email} 资料不存在，创建基本资料`);
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{ 
        id: user.id, 
        email: user.email,
        created_at: new Date().toISOString()
      }]);
    
    if (insertError) {
      console.error('[Themes] 创建用户资料失败:', insertError);
    }
  }
  
  const isExpired = profile?.account_expires_at && new Date(profile.account_expires_at) < new Date();
  if (isExpired) {
    redirect('/account-expired');
  }
  
  const { data: themes } = await listMyThemes();

  return (
    <>
      <div className="max-w-md mx-auto min-h-svh flex flex-col pb-24 px-4">
        {/* 头部区域 */}
        <div className="pt-8 pb-4">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">主题库</h1>
            <p className="text-sm text-gray-500">我的主题 · {themes?.length || 0}</p>
          </div>

          {/* 会员状态 */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-white/5 to-white/3 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-1">会员状态</p>
                  <p className="text-white font-medium">
                    {profile?.account_expires_at ? 
                      `有效期至 ${new Date(profile.account_expires_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}` : 
                      '体验会员中'}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-brand-pink to-brand-purple flex items-center justify-center">
                  <span className="text-xs font-bold text-white">VIP</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 创建按钮 */}
        <Link
          href="/themes/new"
          className="w-full mb-6 block group"
        >
          <div className="bg-gradient-to-r from-brand-pink to-brand-purple rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-bold text-lg mb-1">创建新主题</div>
                <div className="text-white/80 text-sm">开始设计你们的专属体验</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </div>
        </Link>

        {/* 主题列表 */}
        <div className="flex-1">
          {themes?.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-white font-medium mb-2">还没有创建主题</h3>
              <p className="text-gray-400 text-sm mb-6">创建第一个主题来开始你们的游戏</p>
              <Link
                href="/themes/new"
                className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
              >
                立即创建
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {themes?.map((t, index) => (
                <div 
                  key={t.id} 
                  className="group bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 hover:border-white/20 transition-all duration-300 hover:translate-x-1"
                >
                  <div className="flex items-start gap-3">
                    {/* 序号装饰 */}
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                        <span className="text-lg font-bold text-white">{index + 1}</span>
                      </div>
                    </div>

                    {/* 主题内容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-white truncate text-base">{t.title}</h3>
                          {t.description && (
                            <p className="text-gray-400 text-sm mt-1 line-clamp-1">{t.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/themes/${t.id}`}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                          >
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <DeleteThemeButton themeId={t.id} themeTitle={t.title} />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                        <div className="flex items-center gap-4">
                          <div className="text-xs text-gray-400">
                            {new Date(t.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-gray-400">
                            {t.task_count ?? 0} 个任务
                          </div>
                        </div>
                        <Link 
                          href={`/themes/${t.id}`}
                          className="text-xs text-brand-pink font-medium hover:text-white transition-colors flex items-center"
                        >
                          查看
                          <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部说明 */}
        {themes && themes.length > 0 && (
          <div className="mt-6">
            <div className="bg-white/5 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-brand-pink/20 to-brand-purple/20 mb-2">
                  <svg className="w-4 h-4 text-brand-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-400">点击主题卡片查看详情 · 悬停显示操作按钮</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}