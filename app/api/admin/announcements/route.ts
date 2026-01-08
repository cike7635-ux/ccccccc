import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 创建Supabase管理员客户端
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    // 构建查询
    let query = supabaseAdmin
      .from('announcements')
      .select(`
        *,
        creator:profiles!announcements_created_by_fkey (
          id,
          email,
          nickname,
          avatar_url
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // 应用状态筛选
    if (status === 'active') {
      const now = new Date().toISOString();
      query = query
        .eq('is_active', true)
        .lte('show_from', now)
        .or(`show_until.is.null,show_until.gte.${now}`);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    } else if (status === 'expired') {
      const now = new Date().toISOString();
      query = query
        .eq('is_active', true)
        .lt('show_until', now);
    } else if (status === 'scheduled') {
      const now = new Date().toISOString();
      query = query
        .eq('is_active', true)
        .gt('show_from', now);
    }

    // 执行查询
    const { data: announcements, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        announcements: announcements || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });

  } catch (error: any) {
    console.error('获取公告列表失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取公告失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证必填字段
    if (!body.title || !body.content) {
      return NextResponse.json(
        { success: false, error: '标题和内容不能为空' },
        { status: 400 }
      );
    }

    // 创建公告
    const { data: announcement, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        title: body.title,
        content: body.content,
        type: body.type || 'info',
        is_active: body.is_active !== undefined ? body.is_active : false,
        priority: body.priority || 0,
        show_from: body.show_from || new Date().toISOString(),
        show_until: body.show_until || null,
        created_by: body.created_by || null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '公告创建成功',
      data: announcement
    });

  } catch (error: any) {
    console.error('创建公告失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '创建公告失败' },
      { status: 500 }
    );
  }
}