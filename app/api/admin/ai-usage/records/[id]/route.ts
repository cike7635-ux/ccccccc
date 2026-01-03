// /app/api/admin/ai-usage/records/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 获取记录详情
    const { data: record, error } = await supabase
      .from('ai_usage_records')
      .select(`
        *,
        profiles:user_id (
          nickname,
          email,
          preferences,
          avatar_url,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // 获取该用户的统计数据
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const { count: todayCount } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', record.user_id)
      .gte('created_at', today.toISOString())
      .eq('success', true);

    const { count: thirtyDaysCount } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', record.user_id)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .eq('success', true);

    // 获取该用户的其他信息
    const { data: userKeys } = await supabase
      .from('access_keys')
      .select('*')
      .eq('user_id', record.user_id)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      data: {
        record,
        user_stats: {
          today: todayCount || 0,
          thirtyDays: thirtyDaysCount || 0
        },
        user_keys: userKeys || []
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