// /app/api/ai/usage-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSystemConfig } from '@/lib/config/system-config';

export async function GET(request: NextRequest) {
  try {
    // 1. 创建Supabase客户端
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { 
        cookies: { 
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              console.error('设置cookie失败:', error);
            }
          }
        }
      }
    );
    
    // 2. 检查用户登录状态
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }
    
    // 3. 获取系统动态配置 - 🔥 修复：正确调用get方法
    const systemConfig = getSystemConfig();
    
    // 🔥 关键修复：使用正确的get方法获取配置值
    const defaultDailyLimit = await systemConfig.get<number>('ai_default_daily_limit', 1);
    const defaultCycleLimit = await systemConfig.get<number>('ai_default_cycle_limit', 100);
    
    console.log('📊 系统动态配置（修复版）:', {
      defaultDailyLimit,
      defaultCycleLimit,
      // 调试：获取所有配置查看
      allConfigs: await systemConfig.getAllConfigs()
    });
    
    // 4. 获取用户自定义限制
    const { data: userData } = await supabase
      .from('profiles')
      .select('custom_daily_limit, custom_cycle_limit')
      .eq('id', user.id)
      .single();

    // 使用动态配置的默认值
    const DAILY_LIMIT = userData?.custom_daily_limit !== null && userData?.custom_daily_limit !== undefined 
      ? userData.custom_daily_limit 
      : defaultDailyLimit;
    
    const CYCLE_LIMIT = userData?.custom_cycle_limit !== null && userData?.custom_cycle_limit !== undefined 
      ? userData.custom_cycle_limit 
      : defaultCycleLimit;
    
    const validatedDailyLimit = Math.max(1, Math.min(DAILY_LIMIT, 1000));
    const validatedCycleLimit = Math.max(10, Math.min(CYCLE_LIMIT, 10000));

    console.log('📊 最终用户限制计算:', {
      用户ID: user.id,
      用户邮箱: user.email,
      用户自定义每日: userData?.custom_daily_limit,
      用户自定义周期: userData?.custom_cycle_limit,
      系统默认每日: defaultDailyLimit,
      系统默认周期: defaultCycleLimit,
      最终每日限制: validatedDailyLimit,
      最终周期限制: validatedCycleLimit
    });
    
    // 关键修复：使用滚动窗口，与 /api/generate-tasks 一致
    const now = new Date();
    
    // 24小时滚动窗口（从现在往前推24小时）
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // 30天滚动窗口（从现在往前推30天）
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // 计算周期结束时间（30天后）
    const cycleEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // 计算剩余天数（更精确）
    const daysRemaining = Math.ceil((cycleEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // 5. 查询24小时滚动窗口使用次数
    const { count: dailyCount, error: dailyError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('success', true)
      .eq('feature', 'generate_tasks')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .lt('created_at', now.toISOString());

    if (dailyError) {
      console.error('查询每日使用次数失败:', dailyError);
      return NextResponse.json(
        { error: '获取使用统计失败' },
        { status: 500 }
      );
    }

    // 6. 查询30天滚动窗口使用次数
    const { count: cycleCount, error: cycleError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('success', true)
      .eq('feature', 'generate_tasks')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .lt('created_at', now.toISOString());

    if (cycleError) {
      console.error('查询周期使用次数失败:', cycleError);
      return NextResponse.json(
        { error: '获取使用统计失败' },
        { status: 500 }
      );
    }

    const dailyUsed = dailyCount || 0;
    const cycleUsed = cycleCount || 0;

    console.log('📊 /api/ai/usage-stats 查询结果：');
    console.log('  用户ID:', user.id);
    console.log('  24小时使用次数:', dailyUsed);
    console.log('  30天使用次数:', cycleUsed);
    console.log('  最终每日限制:', validatedDailyLimit);
    console.log('  最终周期限制:', validatedCycleLimit);
    console.log('  每日剩余次数:', Math.max(0, validatedDailyLimit - dailyUsed));
    console.log('  周期剩余次数:', Math.max(0, validatedCycleLimit - cycleUsed));

    // 7. 返回使用统计
    return NextResponse.json({
      daily: {
        used: dailyUsed,
        remaining: Math.max(0, validatedDailyLimit - dailyUsed),
        limit: validatedDailyLimit
      },
      cycle: {
        used: cycleUsed,
        remaining: Math.max(0, validatedCycleLimit - cycleUsed),
        limit: validatedCycleLimit
      },
      cycleInfo: {
        startDate: thirtyDaysAgo.toISOString(),
        endDate: cycleEndDate.toISOString(),
        daysRemaining: daysRemaining
      },
      // 🔥 新增：返回使用的默认值信息，便于调试
      configInfo: {
        usedDefaultDaily: userData?.custom_daily_limit === null || userData?.custom_daily_limit === undefined,
        usedDefaultCycle: userData?.custom_cycle_limit === null || userData?.custom_cycle_limit === undefined,
        systemDefaultDaily: defaultDailyLimit,
        systemDefaultCycle: defaultCycleLimit,
        userCustomDaily: userData?.custom_daily_limit,
        userCustomCycle: userData?.custom_cycle_limit
      }
    });

  } catch (error: any) {
    console.error('获取AI使用统计失败:', error);
    return NextResponse.json(
      { 
        error: error.message || '获取使用统计失败',
        // 新增：错误时返回降级值，避免前端完全崩溃
        fallbackData: {
          daily: {
            used: 0,
            remaining: 1,
            limit: 1  // 🔥 修改：使用新的默认值
          },
          cycle: {
            used: 0,
            remaining: 100,
            limit: 100  // 🔥 修改：使用新的默认值
          },
          cycleInfo: {
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            daysRemaining: 30
          },
          configInfo: {
            usedDefaultDaily: true,
            usedDefaultCycle: true,
            systemDefaultDaily: 1,
            systemDefaultCycle: 100,
            userCustomDaily: null,
            userCustomCycle: null,
            error: true
          }
        }
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';