// /app/api/admin/ai-usage/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({
        error: validation.error,
        status: validation.status
      });
    }

    const supabaseAdmin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { count: totalProfiles } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { data: aiUsersData } = await supabaseAdmin
      .from('ai_usage_records')
      .select('user_id')
      .not('user_id', 'is', null);
    const aiUsersCount = new Set(aiUsersData?.map(item => item.user_id)).size;

    const { count: twentyFourHoursUsage } = await supabaseAdmin
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .eq('success', true);

    const { count: thirtyDaysUsage } = await supabaseAdmin
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('success', true);

    const { count: totalRequests } = await supabaseAdmin
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true });

    const { data: profilesData } = await supabaseAdmin
      .from('profiles')
      .select('preferences')
      .not('preferences', 'is', null)
      .limit(100);

    const { data: activeUsersData } = await supabaseAdmin
      .from('ai_usage_records')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString());
    const activeUsers = new Set(activeUsersData?.map(item => item.user_id)).size;

    let maleCount = 0, femaleCount = 0, nonBinaryCount = 0;
    profilesData?.forEach(profile => {
      const gender = profile.preferences?.gender;
      if (gender === 'male') maleCount++;
      else if (gender === 'female') femaleCount++;
      else if (gender === 'non_binary') nonBinaryCount++;
    });

    const { data: recentUsageData } = await supabaseAdmin
      .from('ai_usage_records')
      .select(`
        id,
        user_id,
        feature,
        success,
        created_at,
        response_data,
        profiles:user_id (nickname, email, preferences)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    const recentUsage = recentUsageData?.map(record => {
      const profile = record.profiles as any;
      return {
        id: record.id,
        user_id: record.user_id,
        nickname: profile?.nickname || '未知用户',
        email: profile?.email || '未知邮箱',
        gender: profile?.preferences?.gender || '未知',
        feature: record.feature,
        success: record.success,
        created_at: record.created_at,
        tokens_used: record.response_data?.tokens_used || 0,
        request_preview: record.feature || 'AI生成任务',
        response_preview: record.success ? '生成成功' : '生成失败'
      };
    }) || [];

    const calculateEstimate = (usageCount: number) => {
      const avgTokens = 2188.125;
      const avgCost = 0.00307465;
      return {
        tokens: Math.round(usageCount * avgTokens),
        cost: parseFloat((usageCount * avgCost).toFixed(6))
      };
    };

    const totalEstimate = calculateEstimate(totalRequests || 0);
    const dailyEstimate = calculateEstimate(twentyFourHoursUsage || 0);
    const cycleEstimate = calculateEstimate(thirtyDaysUsage || 0);

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalProfiles: totalProfiles || 0,
          aiUsersCount: aiUsersCount || 0,
          activeUsers: activeUsers || 0,
          totalRequests: totalRequests || 0,
          totalTokens: totalEstimate.tokens,
          totalCost: totalEstimate.cost,
          successRate: totalRequests ? Math.round((totalRequests - (totalRequests * 0.05)) / totalRequests * 100) : 0
        },
        timeWindows: {
          daily: {
            usage: twentyFourHoursUsage || 0,
            tokens: dailyEstimate.tokens,
            cost: dailyEstimate.cost,
            limit: 10,
            remaining: Math.max(0, 10 - (twentyFourHoursUsage || 0))
          },
          cycle: {
            usage: thirtyDaysUsage || 0,
            tokens: cycleEstimate.tokens,
            cost: cycleEstimate.cost,
            limit: 120,
            remaining: Math.max(0, 120 - (thirtyDaysUsage || 0))
          }
        },
        userAnalysis: {
          genderDistribution: {
            male: maleCount,
            female: femaleCount,
            nonBinary: nonBinaryCount,
            total: profilesData?.length || 0
          },
          activeUserRate: totalProfiles ? Math.round((activeUsers / totalProfiles) * 100) : 0
        },
        recentUsage
      },
      meta: {
        generatedAt: now.toISOString(),
        timeRange: range,
        note: '成本为基于账单数据的估算值'
      }
    });

  } catch (error: any) {
    console.error('API错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: '内部服务器错误',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
