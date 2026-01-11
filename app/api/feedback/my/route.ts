import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    // 验证用户登录状态
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '用户验证失败' },
        { status: 401 }
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // pending/replied/resolved

    // 构建查询
    let query = supabase
      .from('feedbacks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: feedbacks, error, count } = await query;

    if (error) {
      console.error('获取反馈失败:', error);
      return NextResponse.json(
        { error: '获取反馈失败' },
        { status: 500 }
      );
    }

    // 获取反馈统计
    const { data: stats } = await supabase
      .from('feedbacks')
      .select('status', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .group('status');

    const statsMap = {
      pending: 0,
      replied: 0,
      resolved: 0,
      archived: 0
    };

    stats?.forEach(stat => {
      statsMap[stat.status as keyof typeof statsMap] = stat.count;
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
      stats: statsMap,
      reminder: feedbacks?.some(f => f.status === 'pending') 
        ? '您有待处理的反馈，请等待管理员回复后再提交新的反馈'
        : null
    });

  } catch (error) {
    console.error('获取用户反馈异常:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}