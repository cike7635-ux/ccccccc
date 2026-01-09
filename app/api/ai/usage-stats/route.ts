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
    
    // 3. 获取系统动态配置
    const systemConfig = getSystemConfig();
    const defaultDailyLimit = await systemConfig.get<number>('ai_default_daily_limit', 1);
    const defaultCycleLimit = await systemConfig.get<number>('ai_default_cycle_limit', 100);
    
    // 4. 获取用户自定义限制
    const { data: userData } = await supabase
      .from('profiles')
      .select('custom_daily_limit, custom_cycle_limit')
      .eq('id', user.id)
      .single();

    // 🔥 关键修复：查询临时加成
    const now = new Date().toISOString();
    const { data: tempBoosts } = await supabase
      .from('temporary_ai_boosts')
      .select('boost_type, increment_amount')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lte('valid_from', now)
      .gte('valid_to', now);

    // 计算临时加成
    let dailyTempBoost = 0;
    let cycleTempBoost = 0;
    if (tempBoosts) {
      tempBoosts.forEach(boost => {
        if (boost.boost_type === 'daily') {
          dailyTempBoost += boost.increment_amount;
        } else if (boost.boost_type === 'cycle') {
          cycleTempBoost += boost.increment_amount;
        }
      });
    }

    console.log('📊 临时加成统计:', {
      用户ID: user.id,
      每日临时加成: dailyTempBoost,
      周期临时加成: cycleTempBoost,
      临时加成记录数: tempBoosts?.length || 0,
      有效临时加成: tempBoosts
    });
    
    // 🔥 修复：计算总限制（永久限制 + 临时加成）
    const DAILY_LIMIT = (userData?.custom_daily_limit !== null && userData?.custom_daily_limit !== undefined 
      ? userData.custom_daily_limit 
      : defaultDailyLimit) + dailyTempBoost;
    
    const CYCLE_LIMIT = (userData?.custom_cycle_limit !== null && userData?.custom_cycle_limit !== undefined 
      ? userData.custom_cycle_limit 
      : defaultCycleLimit) + cycleTempBoost;
    
    const validatedDailyLimit = Math.max(1, Math.min(DAILY_LIMIT, 1000));
    const validatedCycleLimit = Math.max(10, Math.min(CYCLE_LIMIT, 10000));

    console.log('📊 最终用户限制计算:', {
      用户邮箱: user.email,
      系统默认每日: defaultDailyLimit,
      系统默认周期: defaultCycleLimit,
      用户自定义每日: userData?.custom_daily_limit,
      用户自定义周期: userData?.custom_cycle_limit,
      每日临时加成: dailyTempBoost,
      周期临时加成: cycleTempBoost,
      最终每日限制: validatedDailyLimit,
      最终周期限制: validatedCycleLimit
    });
    
    // 5. 查询24小时滚动窗口使用次数
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const { count: dailyCount, error: dailyError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('success', true)
      .eq('feature', 'generate_tasks')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .lt('created_at', new Date().toISOString());

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
      .lt('created_at', new Date().toISOString());

    if (cycleError) {
      console.error('查询周期使用次数失败:', cycleError);
      return NextResponse.json(
        { error: '获取使用统计失败' },
        { status: 500 }
      );
    }

    const dailyUsed = dailyCount || 0;
    const cycleUsed = cycleCount || 0;

    console.log('📊 使用统计结果：');
    console.log('  每日限制:', validatedDailyLimit);
    console.log('  每日已用:', dailyUsed);
    console.log('  每日剩余:', Math.max(0, validatedDailyLimit - dailyUsed));
    console.log('  周期限制:', validatedCycleLimit);
    console.log('  周期已用:', cycleUsed);
    console.log('  周期剩余:', Math.max(0, validatedCycleLimit - cycleUsed));

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
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        daysRemaining: 30
      },
      // 🔥 新增：返回临时加成信息
      tempBoosts: {
        daily: dailyTempBoost,
        cycle: cycleTempBoost,
        records: tempBoosts || []
      },
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
        fallbackData: {
          daily: {
            used: 0,
            remaining: 1,
            limit: 1
          },
          cycle: {
            used: 0,
            remaining: 100,
            limit: 100
          },
          cycleInfo: {
            startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            daysRemaining: 30
          }
        }
      },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';