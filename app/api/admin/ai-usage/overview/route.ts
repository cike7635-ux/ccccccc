import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAICostConfig } from '@/lib/config/system-config';

export async function GET(request: NextRequest) {
  try {
    // 创建Supabase客户端
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. 今天使用统计
    const { count: todayUsage } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
      .eq('success', true);

    // 2. 30天使用统计
    const { count: thirtyDaysUsage } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('success', true);

    // 3. 总使用统计
    const { count: totalUsage } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('success', true);

    // 4. 用户统计
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { data: aiUsers } = await supabase
      .from('ai_usage_records')
      .select('user_id')
      .not('user_id', 'is', null);
    const aiUsersCount = new Set(aiUsers?.map(item => item.user_id)).size;

    // 5. 活跃用户（最近7天）
    const { data: activeUsersData } = await supabase
      .from('ai_usage_records')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString());
    const activeUsersCount = new Set(activeUsersData?.map(item => item.user_id)).size;

    // 6. 偏好统计
    const { data: preferenceData } = await supabase
      .from('profiles')
      .select('preferences')
      .not('preferences', 'is', null);

    let maleCount = 0, femaleCount = 0, nonBinaryCount = 0;
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

    // 7. 成本估算 - 🔥 修改：从系统配置获取成本参数
    const { perToken: costPerToken, perRequest: costPerRequest } = await getAICostConfig();
    
    const calculateEstimate = (usageCount: number) => ({
      tokens: Math.round(usageCount * 2188.125),
      cost: parseFloat((usageCount * costPerRequest).toFixed(6))
    });

    const todayEstimate = calculateEstimate(todayUsage || 0);
    const thirtyDaysEstimate = calculateEstimate(thirtyDaysUsage || 0);
    const totalEstimate = calculateEstimate(totalUsage || 0);

    return NextResponse.json({
      success: true,
      data: {
        usageStats: {
          today: {
            count: todayUsage || 0,
            tokens: todayEstimate.tokens,
            cost: todayEstimate.cost
          },
          thirtyDays: {
            count: thirtyDaysUsage || 0,
            tokens: thirtyDaysEstimate.tokens,
            cost: thirtyDaysEstimate.cost
          },
          total: {
            count: totalUsage || 0,
            tokens: totalEstimate.tokens,
            cost: totalEstimate.cost
          }
        },
        userStats: {
          totalProfiles: totalUsers || 0,
          aiUsersCount: aiUsersCount || 0,
          activeUsers: activeUsersCount || 0,
          activeRate: totalUsers ? Math.round((activeUsersCount / totalUsers) * 100) : 0
        },
        preferenceStats: {
          genderDistribution: {
            male: maleCount,
            female: femaleCount,
            nonBinary: nonBinaryCount,
            total: preferenceData?.length || 0
          },
          preferenceRanking
        },
        // 🔥 新增：返回当前使用的成本参数
        costParams: {
          costPerToken,
          costPerRequest
        }
      },
      meta: {
        generatedAt: now.toISOString(),
        note: '成本为基于账单数据的估算值'
      }
    });

  } catch (error: any) {
    console.error('概览API错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}