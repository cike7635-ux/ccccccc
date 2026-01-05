import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId');
    const success = searchParams.get('success');
    
    const offset = (page - 1) * limit;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 构建查询
    let query = supabase
      .from('ai_usage_records')
      .select(`
        *,
        profiles:user_id (
          nickname,
          email,
          preferences,
          created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (success) {
      query = query.eq('success', success === 'true');
    }

    // 获取总数
    const { count } = await query
      .select('*', { count: 'exact', head: true });

    // 获取分页数据
    const { data: records, error } = await query
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // 🔥 关键修复：为null的profiles设置默认值
    const safeRecords = records?.map(record => {
      // 创建安全的profiles对象
      const safeProfile = record.profiles || {
        nickname: '已删除用户',
        email: '未知邮箱',
        preferences: {},
        created_at: record.created_at
      };
      
      return {
        ...record,
        profiles: safeProfile,
        // 初始化user_stats，将在后面计算
        user_stats: {
          today: 0,
          thirtyDays: 0
        }
      };
    }) || [];

    // 计算每个用户的当天和30天使用次数
    const enrichedRecords = await Promise.all(
      safeRecords.map(async (record) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        // 查询该用户当天使用次数
        const { count: todayCount } = await supabase
          .from('ai_usage_records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', record.user_id)
          .gte('created_at', today.toISOString())
          .eq('success', true);

        // 查询该用户30天使用次数
        const { count: thirtyDaysCount } = await supabase
          .from('ai_usage_records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', record.user_id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .eq('success', true);

        return {
          ...record,
          user_stats: {
            today: todayCount || 0,
            thirtyDays: thirtyDaysCount || 0
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        records: enrichedRecords,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });

  } catch (error: any) {
    console.error('记录API错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}