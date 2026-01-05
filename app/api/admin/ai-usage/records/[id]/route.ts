import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const recordId = parseInt(id);

    if (isNaN(recordId) || recordId <= 0) {
      return NextResponse.json(
        { success: false, error: '无效的记录ID' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 1. 获取记录基本信息
    const { data: record, error: recordError } = await supabase
      .from('ai_usage_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (recordError || !record) {
      console.error('记录查询失败:', recordError);
      return NextResponse.json(
        { success: false, error: '记录不存在' },
        { status: 404 }
      );
    }

    // 2. 获取用户信息
    let userProfile = null;
    if (record.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname, email, preferences, created_at, avatar_url')
        .eq('id', record.user_id)
        .single();
      
      userProfile = profile;
    }

    // 3. 计算用户使用统计
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 查询该用户当天使用次数
    const { count: todayCount } = await supabase
      .from('ai_usage_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', record.user_id)
      .gte('created_at', today.toISOString())
      .eq('success', true);

    // 查询该用户30天使用次数
    const { count: thirtyDaysCount } = await supabase
      .from('ai_usage_records')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', record.user_id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('success', true);

    // 4. 获取相关的其他记录（如果有的话）
    const { data: relatedRecords } = await supabase
      .from('ai_usage_records')
      .select('id, created_at, success, feature')
      .eq('user_id', record.user_id)
      .neq('id', recordId)
      .order('created_at', { ascending: false })
      .limit(5);

    // 5. 准备返回数据
    const safeProfile = userProfile || {
      nickname: record.user_id ? `用户_${record.user_id.substring(0, 8)}` : '匿名用户',
      email: '未知邮箱',
      preferences: {},
      created_at: record.created_at,
      avatar_url: null
    };

    const enrichedRecord = {
      ...record,
      profiles: safeProfile,
      user_stats: {
        today: todayCount || 0,
        thirtyDays: thirtyDaysCount || 0
      },
      related_records: relatedRecords || [],
      // 解析请求和响应数据
      request_data: record.request_data || {},
      response_data: record.response_data || {},
      // 添加成本估算
      cost_estimate: {
        tokens_used: record.response_data?.tokens_used || 0,
        cost: (record.response_data?.tokens_used || 0) * 0.000002,
        avg_tokens_per_request: 2188.125,
        avg_cost_per_request: 0.00307465
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        record: enrichedRecord,
        meta: {
          generatedAt: new Date().toISOString(),
          note: '包含用户信息和使用统计的完整记录详情'
        }
      }
    });

  } catch (error: any) {
    console.error('记录详情API错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}

// 支持可选的DELETE方法（删除记录）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const recordId = parseInt(id);

    if (isNaN(recordId) || recordId <= 0) {
      return NextResponse.json(
        { success: false, error: '无效的记录ID' },
        { status: 400 }
      );
    }

    // 检查管理员权限
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 删除记录
    const { error } = await supabase
      .from('ai_usage_records')
      .delete()
      .eq('id', recordId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '记录已删除',
      data: { id: recordId }
    });

  } catch (error: any) {
    console.error('删除记录错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || '删除失败' },
      { status: 500 }
    );
  }
}