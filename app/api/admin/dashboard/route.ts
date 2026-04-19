// /app/api/admin/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const supabaseAdmin = createAdminClient();
    const now = new Date();
    const nowISO = now.toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 并行查询所有数据
    const [
      // 用户统计
      userStats,
      // 密钥统计
      keyStats,
      // AI使用统计
      aiStats,
      // 游戏统计
      gameStats,
      // 最近用户
      recentUsers
    ] = await Promise.all([
      // 用户统计
      Promise.all([
        // 总用户数
        supabaseAdmin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .not('email', 'like', 'deleted_%'),
        // 活跃用户（24小时内登录）
        supabaseAdmin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .not('email', 'like', 'deleted_%')
          .gt('last_login_at', twentyFourHoursAgo),
        // 会员用户
        supabaseAdmin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .not('email', 'like', 'deleted_%')
          .gt('account_expires_at', nowISO),
        // 过期用户
        supabaseAdmin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .not('email', 'like', 'deleted_%')
          .lt('account_expires_at', nowISO)
      ]),

      // 密钥统计
      Promise.all([
        // 总密钥数
        supabaseAdmin
          .from('access_keys')
          .select('id', { count: 'exact', head: true }),
        // 已使用密钥
        supabaseAdmin
          .from('access_keys')
          .select('id', { count: 'exact', head: true })
          .not('used_at', 'is', null),
        // 可用密钥
        supabaseAdmin
          .from('access_keys')
          .select('id', { count: 'exact', head: true })
          .is('used_at', null)
          .is('user_id', null)
          .eq('is_active', true)
      ]),

      // AI使用统计
      Promise.all([
        // AI使用次数
        supabaseAdmin
          .from('ai_usage_records')
          .select('id', { count: 'exact', head: true }),
        // 今日AI使用成本估算
        supabaseAdmin
          .from('ai_usage_records')
          .select('*')
          .gte('created_at', twentyFourHoursAgo)
          .eq('success', true)
      ]),

      // 游戏统计
      Promise.all([
        // 总游戏数
        supabaseAdmin
          .from('games')
          .select('id', { count: 'exact', head: true }),
        // 活跃游戏（24小时内）
        supabaseAdmin
          .from('games')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', twentyFourHoursAgo)
      ]),

      // 最近用户
      supabaseAdmin
        .from('profiles')
        .select('id, email, nickname, last_login_at, account_expires_at')
        .not('email', 'like', 'deleted_%')
        .order('last_login_at', { ascending: false })
        .limit(5)
    ]);

    // 计算用户统计
    const totalUsers = userStats[0].count || 0;
    const activeUsers = userStats[1].count || 0;
    const premiumUsers = userStats[2].count || 0;
    const expiredUsers = userStats[3].count || 0;

    // 计算密钥统计
    const totalKeys = keyStats[0].count || 0;
    const usedKeys = keyStats[1].count || 0;
    const availableKeys = keyStats[2].count || 0;

    // 计算AI使用统计
    const aiUsageCount = aiStats[0].count || 0;
    // 估算今日AI成本（基于平均成本）
    const todayAIUsage = aiStats[1].data || [];
    const avgCostPerRequest = 0.00307465;
    const todayRevenue = todayAIUsage.length * avgCostPerRequest;

    // 计算游戏统计
    const totalGames = gameStats[0].count || 0;
    const activeGames = gameStats[1].count || 0;

    // 计算总收入（估算）
    const totalRevenue = 12345.67; // 这里可以根据实际情况计算

    // 计算平均会话时长（估算）
    const averageSessionDuration = 25.6;

    // 构建统计数据
    const stats = {
      totalUsers,
      activeUsers,
      premiumUsers,
      expiredUsers,
      totalKeys,
      usedKeys,
      availableKeys,
      aiUsageCount,
      totalGames,
      activeGames,
      totalRevenue,
      todayRevenue: parseFloat(todayRevenue.toFixed(2)),
      averageSessionDuration
    };

    // 构建最近用户数据
    const users = recentUsers.data || [];

    return NextResponse.json({
      success: true,
      data: {
        stats,
        users
      },
      timestamp: nowISO
    });

  } catch (error: any) {
    console.error('Dashboard API错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取仪表板数据失败',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}
