import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // 1. 验证管理员权限
    const adminCookie = request.cookies.get('admin_key_verified')?.value;
    if (!adminCookie) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const offset = (page - 1) * limit;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID参数' },
        { status: 400 }
      );
    }

    // 3. 创建Supabase客户端
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 4. 查询AI记录总数
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      console.error('查询AI记录总数失败:', countError);
      return NextResponse.json(
        { success: false, error: '查询失败' },
        { status: 500 }
      );
    }

    // 5. 分页查询AI记录
    const { data: aiRecords, error: recordsError } = await supabaseAdmin
      .from('ai_usage_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (recordsError) {
      console.error('查询AI记录失败:', recordsError);
      return NextResponse.json(
        { success: false, error: '查询失败' },
        { status: 500 }
      );
    }

    // 6. 返回分页数据
    return NextResponse.json({
      success: true,
      data: aiRecords || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasMore: (totalCount || 0) > offset + limit
      }
    });

  } catch (error: any) {
    console.error('AI记录分页API错误:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}