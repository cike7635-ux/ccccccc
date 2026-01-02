// /app/api/admin/ai-usage/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FilterOptions, TimeRange } from '@/app/admin/ai-usage/types';

// 验证管理员权限
async function verifyAdmin(userId: string) {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();
    
  if (!profile) return false;
  
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  return adminEmails.includes(profile.email);
}

// 计算时间范围
function calculateDateRange(timeRange: TimeRange, customStart?: string, customEnd?: string) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  switch (timeRange) {
    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'custom':
      startDate = customStart ? new Date(customStart) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = customEnd ? new Date(customEnd) : now;
      break;
    case 'all':
      startDate = new Date(0); // 所有时间
      break;
    default: // 30d
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 验证管理员权限
    const isAdmin = await verifyAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') as TimeRange || '30d';
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    // 计算时间范围
    const { startDate: start, endDate: end } = calculateDateRange(timeRange, startDate, endDate);

    // 这里会调用各个数据获取函数，为了简化，我们先返回一个骨架
    // 实际实现中，这里会并行调用所有数据获取函数
    const data = await getStatisticsData(start, end, timeRange);

    return NextResponse.json({
      ...data,
      meta: {
        timeRange,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        generatedAt: new Date().toISOString(),
        dataPoints: 0, // 实际计算
      }
    });

  } catch (error: any) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json(
      { error: error.message || '获取统计数据失败' },
      { status: 500 }
    );
  }
}

// 获取所有统计数据
async function getStatisticsData(startDate: Date, endDate: Date, timeRange: TimeRange) {
  const supabase = createClient();
  
  // 并行获取所有数据
  const [
    overview,
    trends,
    hourly,
    userProfiles,
    preferenceStats,
    genderAnalysis,
    keys,
    keyAnalytics,
    topics,
    quality,
    forecast,
    suggestions
  ] = await Promise.all([
    getOverviewStats(supabase, startDate, endDate),
    getTrendData(supabase, startDate, endDate, timeRange),
    getHourlyData(supabase, startDate, endDate),
    getUserProfiles(supabase, startDate, endDate),
    getPreferenceStats(supabase, startDate, endDate),
    getGenderAnalysis(supabase, startDate, endDate),
    getAIKeys(supabase, startDate, endDate),
    getKeyAnalytics(supabase, startDate, endDate),
    getTopicAnalysis(supabase, startDate, endDate),
    getQualityMetrics(supabase, startDate, endDate),
    getUsageForecast(supabase, startDate, endDate),
    getOptimizationSuggestions(supabase, startDate, endDate)
  ]);

  return {
    overview,
    trends,
    hourly,
    userProfiles,
    preferenceStats,
    genderAnalysis,
    keys,
    keyAnalytics,
    topics,
    quality,
    forecast,
    suggestions
  };
}

// 各个数据获取函数的实现占位符
async function getOverviewStats(supabase: any, startDate: Date, endDate: Date) {
  // 实现概览统计数据获取
  return {
    totalUsage: 0,
    totalUsers: 0,
    totalTokens: 0,
    totalCost: 0,
    avgResponseTime: 0,
    successRate: 0,
    activeUsers: 0,
    avgTokensPerRequest: 0,
    comparison: {
      day: 0,
      week: 0,
      month: 0
    }
  };
}

async function getTrendData(supabase: any, startDate: Date, endDate: Date, timeRange: TimeRange) {
  // 实现趋势数据获取
  return [];
}

async function getHourlyData(supabase: any, startDate: Date, endDate: Date) {
  // 实现小时分布数据获取
  return [];
}

async function getUserProfiles(supabase: any, startDate: Date, endDate: Date) {
  // 实现用户档案数据获取
  return [];
}

async function getPreferenceStats(supabase: any, startDate: Date, endDate: Date) {
  // 实现偏好统计数据获取
  return [];
}

async function getGenderAnalysis(supabase: any, startDate: Date, endDate: Date) {
  // 实现性别分析数据获取
  return [];
}

async function getAIKeys(supabase: any, startDate: Date, endDate: Date) {
  // 实现AI密钥数据获取
  return [];
}

async function getKeyAnalytics(supabase: any, startDate: Date, endDate: Date) {
  // 实现密钥分析数据获取
  return {
    totalKeys: 0,
    usedKeys: 0,
    activeKeys: 0,
    expiredKeys: 0,
    activationRate: 0,
    usageEfficiency: 0,
    topUsers: [],
    popularKeyTypes: []
  };
}

async function getTopicAnalysis(supabase: any, startDate: Date, endDate: Date) {
  // 实现主题分析数据获取
  return [];
}

async function getQualityMetrics(supabase: any, startDate: Date, endDate: Date) {
  // 实现质量指标数据获取
  return {
    adoptionRate: 0,
    editRate: 0,
    avgTaskLength: 0,
    complexityDistribution: {
      simple: 0,
      medium: 0,
      complex: 0
    },
    emotionDistribution: {
      dominant: 0,
      submissive: 0,
      neutral: 0,
      explicit: 0
    }
  };
}

async function getUsageForecast(supabase: any, startDate: Date, endDate: Date) {
  // 实现使用量预测数据获取
  return [];
}

async function getOptimizationSuggestions(supabase: any, startDate: Date, endDate: Date) {
  // 实现优化建议数据获取
  return [];
}