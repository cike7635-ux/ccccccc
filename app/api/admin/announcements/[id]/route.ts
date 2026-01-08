import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 创建Supabase管理员客户端
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    const { data: announcement, error } = await supabaseAdmin
      .from('announcements')
      .select(`
        *,
        creator:profiles!announcements_created_by_fkey (
          id,
          email,
          nickname,
          avatar_url
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: '公告不存在' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: announcement
    });

  } catch (error: any) {
    console.error('获取公告详情失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取公告失败' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();

    // 检查公告是否存在
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('announcements')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { success: false, error: '公告不存在' },
        { status: 404 }
      );
    }

    // 更新公告
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.show_from !== undefined) updateData.show_from = body.show_from;
    if (body.show_until !== undefined) updateData.show_until = body.show_until;

    const { data: announcement, error } = await supabaseAdmin
      .from('announcements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '公告更新成功',
      data: announcement
    });

  } catch (error: any) {
    console.error('更新公告失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '更新公告失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    // 检查公告是否存在
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('announcements')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { success: false, error: '公告不存在' },
        { status: 404 }
      );
    }

    // 删除公告
    const { error } = await supabaseAdmin
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '公告删除成功'
    });

  } catch (error: any) {
    console.error('删除公告失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '删除公告失败' },
      { status: 500 }
    );
  }
}