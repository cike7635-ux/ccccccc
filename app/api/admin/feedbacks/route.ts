// app\api\admin\feedbacks\route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAuth } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // 使用service role key进行管理员操作
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const authError = await checkAdminAuth(request);
    if (authError) {
      return authError;
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // 构建查询
    let query = supabase
      .from('feedbacks')
      .select(`
        *,
        user:profiles!feedbacks_user_id_fkey (
          email,
          nickname,
          avatar_url,
          created_at
        )
      `, { count: 'exact' })
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    // 应用筛选条件
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%,user_nickname.ilike.%${search}%`);
    }

    const { data: feedbacks, error, count } = await query;

    if (error) {
      console.error('管理员获取反馈失败:', error);
      return NextResponse.json(
        { error: '获取反馈数据失败' },
        { status: 500 }
      );
    }

    // 获取统计信息
    const { data: stats } = await supabase
      .from('feedbacks')
      .select('status, category', { count: 'exact', head: true })
      .group('status, category');

    const statsByStatus = {
      pending: 0,
      replied: 0,
      resolved: 0,
      archived: 0
    };

    const statsByCategory: Record<string, number> = {};

    stats?.forEach(stat => {
      statsByStatus[stat.status as keyof typeof statsByStatus] += stat.count;
      
      if (stat.category) {
        statsByCategory[stat.category] = (statsByCategory[stat.category] || 0) + stat.count;
      }
    });

    return NextResponse.json({
      success: true,
      data: feedbacks || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      },
      stats: {
        byStatus: statsByStatus,
        byCategory: statsByCategory,
        total: count || 0
      },
      filters: {
        statuses: ['pending', 'replied', 'resolved', 'archived'],
        categories: Object.keys(statsByCategory)
      }
    });

  } catch (error) {
    console.error('管理员获取反馈异常:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}