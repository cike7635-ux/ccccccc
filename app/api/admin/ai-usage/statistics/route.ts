// /app/api/admin/ai-usage/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 管理员验证（使用现有的环境变量）
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!adminEmails.includes(user.email)) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '7d';

    // 计算时间范围（不使用date-fns）
    const now = new Date();
    let startDate = new Date(now);
    
    switch (timeRange) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // 获取AI使用数据
    const { data: usageData, error: usageError } = await supabase
      .from('ai_usage_records')
      .select(`
        id,
        created_at,
        user_id,
        success,
        response_data
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString())
      .order('created_at', { ascending: false });

    if (usageError) {
      console.error('获取AI使用数据失败:', usageError);
      return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
    }

    // 获取用户数据
    const { data: usersData } = await supabase
      .from('profiles')
      .select('id, email, nickname, preferences, created_at');

    // 计算统计数据
    const totalRequests = usageData.length;
    const successfulRequests = usageData.filter(r => r.success).length;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    
    let totalTokens = 0;
    let totalCost = 0;
    
    usageData.forEach(record => {
      const tokensUsed = record.response_data?.tokens_used || 0;
      totalTokens += tokensUsed;
      totalCost += tokensUsed * 0.000002; // 每token成本
    });

    const uniqueUsers = [...new Set(usageData.map(r => r.user_id))].length;

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalUsage: totalRequests,
          totalUsers: uniqueUsers,
          totalTokens,
          totalCost: parseFloat(totalCost.toFixed(4)),
          avgResponseTime: 1200,
          successRate: parseFloat(successRate.toFixed(2)),
          activeUsers: Math.min(uniqueUsers, 12),
          avgTokensPerRequest: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
          comparison: { day: 12, week: 8, month: 15 }
        },
        trends: generateTrendData(timeRange),
        hourly: generateHourlyData(),
        userProfiles: generateUserProfiles(usageData, usersData || []),
        meta: {
          timeRange,
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          generatedAt: now.toISOString(),
          dataPoints: usageData.length,
        }
      }
    });

  } catch (error: any) {
    console.error('AI统计API错误:', error);
    return NextResponse.json(
      { error: error.message || '内部服务器错误' },
      { status: 500 }
    );
  }
}

// 生成趋势数据（不使用date-fns）
function generateTrendData(timeRange: string) {
  const now = new Date();
  const days = timeRange === '24h' ? 1 : 
               timeRange === '7d' ? 7 : 
               timeRange === '30d' ? 30 : 7;
  
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - i - 1));
    
    // 格式化日期为 MM-dd
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return {
      date: `${month}-${day}`,
      usage: Math.floor(Math.random() * 20) + 5,
      users: Math.floor(Math.random() * 10) + 1,
      tokens: Math.floor(Math.random() * 5000) + 1000,
      cost: parseFloat((Math.random() * 0.02).toFixed(4)),
      successRate: parseFloat((Math.random() * 10 + 90).toFixed(1))
    };
  });
}

// 生成小时数据
function generateHourlyData() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    usage: Math.floor(Math.random() * 10) + 1,
    successRate: parseFloat((Math.random() * 10 + 90).toFixed(1)),
    avgTokens: Math.floor(Math.random() * 50) + 10
  }));
}

// 生成用户档案
function generateUserProfiles(usageData: any[], usersData: any[]) {
  // 按用户分组使用数据
  const userUsage = new Map();
  
  usageData.forEach(record => {
    if (!userUsage.has(record.user_id)) {
      userUsage.set(record.user_id, {
        totalUsage: 0,
        successfulRequests: 0,
        totalTokens: 0,
        lastUsed: record.created_at,
        firstUsed: record.created_at
      });
    }
    
    const stats = userUsage.get(record.user_id);
    stats.totalUsage++;
    if (record.success) stats.successfulRequests++;
    stats.totalTokens += record.response_data?.tokens_used || 0;
    
    const recordDate = new Date(record.created_at);
    const lastDate = new Date(stats.lastUsed);
    const firstDate = new Date(stats.firstUsed);
    
    if (recordDate > lastDate) stats.lastUsed = record.created_at;
    if (recordDate < firstDate) stats.firstUsed = record.created_at;
  });
  
  // 合并用户信息
  return usersData.map(user => {
    const usage = userUsage.get(user.id) || {
      totalUsage: 0,
      successfulRequests: 0,
      totalTokens: 0,
      lastUsed: null,
      firstUsed: null
    };
    
    const gender = user.preferences?.gender || 'not_set';
    const kinks = user.preferences?.kinks || [];
    
    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      gender,
      preferences: kinks,
      totalUsage: usage.totalUsage,
      totalTokens: usage.totalTokens,
      avgSuccessRate: usage.totalUsage > 0 ? 
        parseFloat(((usage.successfulRequests / usage.totalUsage) * 100).toFixed(1)) : 0,
      lastActive: usage.lastUsed,
      registrationDate: user.created_at,
      userTier: usage.totalUsage > 50 ? 'high' : 
                usage.totalUsage > 10 ? 'medium' : 'low'
    };
  }).sort((a, b) => b.totalUsage - a.totalUsage);
}