import { NextRequest, NextResponse } from 'next/server';

// 创建Supabase管理员客户端
function createAdminClient() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )
}

// 验证管理员权限
function validateAdmin(request: NextRequest): boolean {
  const adminKeyVerified = request.cookies.get('admin_key_verified')?.value
  const referer = request.headers.get('referer') || ''
  const userAgent = request.headers.get('user-agent') || ''

  if (adminKeyVerified === 'true') {
    return true
  }

  if (referer.includes('/admin/') && userAgent) {
    return true
  }

  return false
}

// 获取用户主题的任务
export async function GET(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: '未授权访问' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const themeId = searchParams.get('themeId')

    if (!themeId) {
      return NextResponse.json({ error: '缺少 themeId 参数' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .eq('theme_id', themeId)
      .order('order_index', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error: any) {
    console.error('[admin/themes/user-tasks] 获取任务错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}

// 删除用户任务
export async function DELETE(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: '未授权访问' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('id')

    if (!taskId) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
    }

    // 先获取任务所属的主题ID
    const { data: task, error: getTaskError } = await supabaseAdmin
      .from('tasks')
      .select('theme_id')
      .eq('id', taskId)
      .single();

    if (getTaskError || !task) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    // 删除任务
    const { error: deleteError } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // 更新主题的任务数
    const { count: taskCount } = await supabaseAdmin
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('theme_id', task.theme_id);

    await supabaseAdmin
      .from('themes')
      .update({
        task_count: taskCount || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', task.theme_id);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[admin/themes/user-tasks] 删除任务错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}