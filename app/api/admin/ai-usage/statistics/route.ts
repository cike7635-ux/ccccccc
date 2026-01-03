// /app/api/admin/ai-usage/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 时间范围类型
type TimeRange = '24h' | '7d' | '30d' | '90d' | 'custom';

// 获取时间范围
function getDateRange(range: TimeRange): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = now;
  let startDate = new Date();

  switch (range) {
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
}

// 基于账单数据的估算计算
function calculateBillBasedEstimate(usageCount: number) {
  const avgTokensPerRequest = 2188.125; // 基于2026-01-02账单：8次 = 17,505 tokens
  const avgCostPerRequest = 0.00307465; // 基于2026-01-02账单：8次 = 0.0245972元
  
  return {
    estimatedTokens: Math.round(usageCount * avgTokensPerRequest),
    estimatedCost: parseFloat((usageCount * avgCostPerRequest).toFixed(6)),
  };
}

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!adminEmails.includes(user.email)) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') as TimeRange || '30d';
    const { startDate, endDate } = getDateRange(range);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. 获取AI使用概览数据
    const { data: usageData, error: usageError } = await supabase
      .from('ai_usage_records')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (usageError) throw usageError;

    // 2. 获取用户总数
    const { count: totalUsers, error: usersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (usersError) throw usersError;

    // 3. 获取活跃用户数（最近7天有AI使用的用户）
    const { count: activeUsers, error: activeError } = await supabase
      .from('ai_usage_records')
      .select('user_id', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())
      .groupBy('user_id');

    if (activeError) throw activeError;

    // 4. 计算24小时和30天窗口使用次数
    const { count: twentyFourHoursUsage, error: dailyError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .eq('success', true);

    if (dailyError) throw dailyError;

    const { count: thirtyDaysUsage, error: thirtyDaysError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('success', true);

    if (thirtyDaysError) throw thirtyDaysError;

    // 5. 获取用户偏好统计
    const { data: preferenceData, error: preferenceError } = await supabase
      .from('profiles')
      .select('preferences')
      .not('preferences', 'is', null);

    if (preferenceError) throw preferenceError;

    // 6. 计算统计数据
    const totalRequests = usageData?.length || 0;
    const successfulRequests = usageData?.filter(r => r.success).length || 0;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    
    // 使用账单数据估算总tokens和成本
    const totalEstimate = calculateBillBasedEstimate(totalRequests);
    const dailyEstimate = calculateBillBasedEstimate(twentyFourHoursUsage || 0);
    const cycleEstimate = calculateBillBasedEstimate(thirtyDaysUsage || 0);

    // 7. 分析用户偏好
    let maleCount = 0;
    let femaleCount = 0;
    let nonBinaryCount = 0;
    const preferenceMap = new Map<string, number>();

    preferenceData?.forEach(profile => {
      const gender = profile.preferences?.gender;
      if (gender === 'male') maleCount++;
      else if (gender === 'female') femaleCount++;
      else if (gender === 'non_binary') nonBinaryCount++;

      const kinks = profile.preferences?.kinks || [];
      kinks.forEach((kink: string) => {
        preferenceMap.set(kink, (preferenceMap.get(kink) || 0) + 1);
      });
    });

    const preferenceRanking = Array.from(preferenceMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 8. 获取趋势数据（尝试使用函数，如果失败则手动计算）
    let trendData = [];
    try {
      const { data: functionData, error: functionError } = await supabase
        .rpc('get_ai_usage_with_bill_estimate', {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        });

      if (!functionError && functionData) {
        trendData = functionData;
      } else {
        // 函数调用失败，手动计算
        const { data: rawTrendData } = await supabase
          .from('ai_usage_records')
          .select('created_at, success')
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (rawTrendData) {
          const groupedByDate: Record<string, { date: string; usage_count: number; success_count: number }> = {};
          
          rawTrendData.forEach(record => {
            const date = new Date(record.created_at).toISOString().split('T')[0];
            if (!groupedByDate[date]) {
              groupedByDate[date] = {
                date,
                usage_count: 0,
                success_count: 0,
              };
            }
            
            groupedByDate[date].usage_count++;
            if (record.success) groupedByDate[date].success_count++;
          });
          
          trendData = Object.values(groupedByDate).map(item => {
            const estimate = calculateBillBasedEstimate(item.usage_count);
            return {
              date: item.date,
              usage_count: item.usage_count,
              success_rate: item.usage_count > 0 
                ? parseFloat(((item.success_count / item.usage_count) * 100).toFixed(2)) 
                : 0,
              estimated_tokens: estimate.estimatedTokens,
              estimated_cost: estimate.estimatedCost,
              cost_source: 'manual_estimate' as const,
            };
          });
        }
      }
    } catch (error) {
      console.warn('趋势数据获取失败，使用空数据:', error);
      trendData = [];
    }

    return NextResponse.json({
      success: true,
      data: {
        // 概览数据
        overview: {
          totalRequests,
          totalUsers: totalUsers || 0,
          activeUsers: activeUsers || 0,
          totalTokens: totalEstimate.estimatedTokens,
          totalCost: totalEstimate.estimatedCost,
          successRate: parseFloat(successRate.toFixed(2)),
          avgCostPerRequest: totalRequests > 0 
            ? parseFloat((totalEstimate.estimatedCost / totalRequests).toFixed(6)) 
            : 0,
        },
        
        // 时间窗口数据
        timeWindows: {
          daily: {
            usage: twentyFourHoursUsage || 0,
            tokens: dailyEstimate.estimatedTokens,
            cost: dailyEstimate.estimatedCost,
            limit: 10,
            remaining: Math.max(0, 10 - (twentyFourHoursUsage || 0))
          },
          cycle: {
            usage: thirtyDaysUsage || 0,
            tokens: cycleEstimate.estimatedTokens,
            cost: cycleEstimate.estimatedCost,
            limit: 120,
            remaining: Math.max(0, 120 - (thirtyDaysUsage || 0))
          }
        },
        
        // 用户分析
        userAnalysis: {
          genderDistribution: {
            male: maleCount,
            female: femaleCount,
            nonBinary: nonBinaryCount,
            total: preferenceData?.length || 0
          },
          preferenceRanking,
          activeUserRate: totalUsers > 0 
            ? parseFloat(((activeUsers || 0) / totalUsers * 100).toFixed(2))
            : 0
        },
        
        // 趋势数据（已包含估算值）
        trends: trendData.map(trend => ({
          date: trend.date,
          usage_count: trend.usage_count,
          total_tokens: trend.estimated_tokens,
          total_cost: trend.estimated_cost,
          avg_tokens_per_use: trend.usage_count > 0 
            ? parseFloat((trend.estimated_tokens / trend.usage_count).toFixed(2)) 
            : 0,
          success_rate: trend.success_rate,
        })),
        
        // 数据验证
        rawData: {
          usageRecordsCount: usageData?.length || 0,
          userProfilesCount: preferenceData?.length || 0,
          timeRange: { startDate, endDate },
          verified: {
            twentyFourHoursUsage: twentyFourHoursUsage || 0,
            thirtyDaysUsage: thirtyDaysUsage || 0,
            consistencyCheck: thirtyDaysUsage === 19
          },
          estimationNote: '成本为基于账单数据的估算值，实际成本请参考AI服务商账单'
        }
      },
      meta: {
        generatedAt: now.toISOString(),
        timeRange: range,
        duration: `${startDate.toLocaleDateString('zh-CN')} - ${endDate.toLocaleDateString('zh-CN')}`
      }
    });

  } catch (error: any) {
    console.error('AI统计API错误:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || '内部服务器错误',
        details: error.details || null
      },
      { status: 500 }
    );
  }
}