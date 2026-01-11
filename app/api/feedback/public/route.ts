import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const category = searchParams.get('category');
    const featured = searchParams.get('featured') === 'true';

    // 构建查询：只获取公开的反馈
    let query = supabase
      .from('feedbacks')
      .select(`
        id,
        title,
        content,
        category,
        rating,
        is_public,
        is_featured,
        admin_reply,
        replied_at,
        user_nickname,
        created_at
      `)
      .eq('is_public', true)
      .eq('status', 'resolved') // 只显示已解决的公开反馈
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 应用筛选条件
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (featured) {
      query = query.eq('is_featured', true);
    }

    const { data: feedbacks, error, count } = await query;

    if (error) {
      console.error('获取公开反馈失败:', error);
      return NextResponse.json(
        { error: '获取公开反馈失败' },
        { status: 500 }
      );
    }

    // 获取分类统计（用于前端筛选）
    const { data: categories } = await supabase
      .from('feedbacks')
      .select('category')
      .eq('is_public', true)
      .eq('status', 'resolved')
      .group('category');

    const categoryStats = categories?.reduce((acc: any, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: feedbacks || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      },
      filters: {
        categories: categoryStats || {},
        totalPublic: count || 0
      }
    });

  } catch (error) {
    console.error('获取公开反馈异常:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}