import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const supabaseAdmin = createAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    let query = supabaseAdmin
      .from('themes')
      .select('*', { count: 'exact' })
      .eq('is_official', true);

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    query = query
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
      page,
      limit
    });

  } catch (error: any) {
    console.error('[admin/official-themes/list] 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const supabaseAdmin = createAdminClient();
    const body = await request.json();
    const { title, description, type, priority, tasks, id } = body;

    if (!title) {
      return NextResponse.json({ error: '标题不能为空' }, { status: 400 });
    }

    // 开始事务
    const { data: theme, error: themeError } = await supabaseAdmin
      .from('themes')
      .upsert({
        id: id || undefined,
        title,
        description: description || '',
        type: type || 'normal',
        priority: priority || 0,
        is_official: true,
        task_count: tasks?.length || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (themeError || !theme) {
      return NextResponse.json({ error: themeError?.message || '创建主题失败' }, { status: 500 });
    }

    // 处理任务
    if (tasks && Array.isArray(tasks)) {
      // 删除原有任务
      await supabaseAdmin
        .from('tasks')
        .delete()
        .eq('theme_id', theme.id);

      // 插入新任务
      if (tasks.length > 0) {
        const taskData = tasks.map((task: any, index: number) => ({
          theme_id: theme.id,
          description: task.description || task,
          order_index: index,
          created_at: new Date().toISOString()
        }));

        await supabaseAdmin
          .from('tasks')
          .insert(taskData);
      }

      // 更新任务数量
      await supabaseAdmin
        .from('themes')
        .update({ task_count: tasks.length })
        .eq('id', theme.id);
    }

    return NextResponse.json({ success: true, data: theme });

  } catch (error: any) {
    console.error('[admin/official-themes/create] 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}