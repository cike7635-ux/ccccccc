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

export async function GET(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ error: '未授权访问' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient()

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    let query = supabaseAdmin
      .from('themes')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    const { data: themes, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 获取所有唯一的 creator_id
    const creatorIds = [...new Set((themes || []).map(t => t.creator_id).filter(Boolean))];

    // 批量获取用户信息
    let profilesMap: Record<string, any> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email, nickname')
        .in('id', creatorIds);

      if (profiles) {
        profilesMap = profiles.reduce((acc: Record<string, any>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }
    }

    // 将用户信息附加到主题数据
    const dataWithProfiles = (themes || []).map(theme => ({
      ...theme,
      profiles: theme.creator_id ? profilesMap[theme.creator_id] : null
    }));

    return NextResponse.json({
      success: true,
      data: dataWithProfiles,
      total: count || 0,
      page,
      limit
    });

  } catch (error: any) {
    console.error('[admin/themes/list] 错误:', error);
    return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
  }
}