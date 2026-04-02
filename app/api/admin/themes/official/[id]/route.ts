import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const supabaseAdmin = createAdminClient();
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('themes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || '主题不存在' }, { status: 404 });
    }

    // 获取关联的任务
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('theme_id', id)
      .order('order_index', { ascending: true });

    return NextResponse.json({
      success: true,
      data: { ...data, tasks: tasks || [] }
    });

  } catch (error: any) {
    console.error('[admin/official-themes/[id]] 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const supabaseAdmin = createAdminClient();
    const { id } = await params;
    const body = await request.json();
    const { title, description, type, priority, is_public } = body;

    const updateData: any = {
        title,
        description,
        type,
        priority,
        updated_at: new Date().toISOString()
      };
      
      if (is_public !== undefined) {
        updateData.is_public = is_public;
      }

    const { data, error } = await supabaseAdmin
      .from('themes')
      .update(updateData)
      .eq('id', id)
      .eq('is_official', true)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('[admin/official-themes/[id]] 更新错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const supabaseAdmin = createAdminClient();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (taskId) {
      // 删除指定任务
      const { error } = await supabaseAdmin
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // 更新主题的任务数量
      const { count } = await supabaseAdmin
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('theme_id', id);

      await supabaseAdmin
        .from('themes')
        .update({ task_count: count || 0 })
        .eq('id', id);

      return NextResponse.json({ success: true });
    } else {
      // 删除主题及其所有任务
      await supabaseAdmin
        .from('tasks')
        .delete()
        .eq('theme_id', id);

      const { error } = await supabaseAdmin
        .from('themes')
        .delete()
        .eq('id', id)
        .eq('is_official', true);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

  } catch (error: any) {
    console.error('[admin/official-themes/[id]] 删除错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}