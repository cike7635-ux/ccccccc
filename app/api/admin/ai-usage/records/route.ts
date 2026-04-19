import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId');
    const success = searchParams.get('success');

    const offset = (page - 1) * limit;

    let countQuery = supabase
      .from('ai_usage_records')
      .select('id', { count: 'exact', head: true });

    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
    }

    if (success) {
      countQuery = countQuery.eq('success', success === 'true');
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('COUNT查询错误:', countError);
    }

    let recordsQuery = supabase
      .from('ai_usage_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      recordsQuery = recordsQuery.eq('user_id', userId);
    }

    if (success) {
      recordsQuery = recordsQuery.eq('success', success === 'true');
    }

    const { data: records, error } = await recordsQuery
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const enrichedRecords = await Promise.all(
      records?.map(async (record) => {
        const { data: userData } = await supabase
          .from('profiles')
          .select('nickname, email, preferences, created_at')
          .eq('id', record.user_id)
          .single();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase
          .from('ai_usage_records')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', record.user_id)
          .gte('created_at', today.toISOString())
          .eq('success', true);

        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const { count: thirtyDaysCount } = await supabase
          .from('ai_usage_records')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', record.user_id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .eq('success', true);

        const safeProfile = userData || {
          nickname: record.user_id ? `用户_${record.user_id.substring(0, 8)}` : '匿名用户',
          email: '未知邮箱',
          preferences: {},
          created_at: record.created_at
        };

        return {
          ...record,
          profiles: safeProfile,
          user_stats: {
            today: todayCount || 0,
            thirtyDays: thirtyDaysCount || 0
          }
        };
      }) || []
    );

    return NextResponse.json({
      success: true,
      data: {
        records: enrichedRecords,
        pagination: {
          page,
          limit,
          total: count || enrichedRecords.length,
          totalPages: Math.ceil((count || enrichedRecords.length) / limit)
        }
      },
      meta: {
        note: count === 0 ? 'COUNT查询可能有问题，使用记录数作为总数' : null
      }
    });

  } catch (error: any) {
    console.error('记录API错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '服务器错误',
        data: {
          records: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          }
        }
      },
      { status: 500 }
    );
  }
}
