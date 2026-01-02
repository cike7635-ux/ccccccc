// /app/api/ai/usage-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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
    
    // 3. 获取用户自定义限制
    const { data: userData } = await supabase
      .from('profiles')
      .select('custom_daily_limit, custom_cycle_limit')
      .eq('id', user.id)
      .single();

    const DAILY_LIMIT = userData?.custom_daily_limit ?? 10;
    const CYCLE_LIMIT = userData?.custom_cycle_limit ?? 120;
    
    const validatedDailyLimit = Math.max(1, Math.min(DAILY_LIMIT, 1000));
    const validatedCycleLimit = Math.max(10, Math.min(CYCLE_LIMIT, 10000));

    // 🚨 关键修复：使用滚动窗口，与 /api/generate-tasks 一致
    const now = new Date();
    
    // 24小时滚动窗口（从现在往前推24小时）
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // 30天滚动窗口（从现在往前推30天）
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // 计算周期结束时间（30天后）
    const cycleEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // 计算剩余天数（更精确）
    const daysRemaining = Math.ceil((cycleEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // 4. 查询24小时滚动窗口使用次数
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

    // 5. 查询30天滚动窗口使用次数
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

    // 🚨 添加调试日志
    console.log('📊 /api/ai/usage-stats 查询结果：');
    console.log('  用户ID:', user.id);
    console.log('  当前时间:', now.toISOString());
    console.log('  24小时前:', twentyFourHoursAgo.toISOString());
    console.log('  30天前:', thirtyDaysAgo.toISOString());
    console.log('  24小时使用次数:', dailyUsed);
    console.log('  30天使用次数:', cycleUsed);
    console.log('  每日限制:', validatedDailyLimit);
    console.log('  周期限制:', validatedCycleLimit);

    // 6. 返回使用统计
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
      }
    });

  } catch (error: any) {
    console.error('获取AI使用统计失败:', error);
    return NextResponse.json(
      { error: error.message || '获取使用统计失败' },
      { status: 500 }
    );
  }
}