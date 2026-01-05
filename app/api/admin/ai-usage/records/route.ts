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

    // 📊 **关键修复：分别获取总数和记录数据**
    
    // 1. 先获取总数（使用简单的COUNT查询）
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

    // 2. 获取分页记录数据
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

    // 3. 🔥 **关键修复：手动获取用户信息**
    const enrichedRecords = await Promise.all(
      records?.map(async (record) => {
        // 获取用户信息
        const { data: userData } = await supabase
          .from('profiles')
          .select('nickname, email, preferences, created_at')
          .eq('id', record.user_id)
          .single();

        // 计算当天使用次数
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase
          .from('ai_usage_records')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', record.user_id)
          .gte('created_at', today.toISOString())
          .eq('success', true);

        // 计算30天使用次数
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        const { count: thirtyDaysCount } = await supabase
          .from('ai_usage_records')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', record.user_id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .eq('success', true);

        // 🔥 **安全处理：创建默认用户信息**
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
          total: count || enrichedRecords.length, // 如果count有问题，使用记录数作为fallback
          totalPages: Math.ceil((count || enrichedRecords.length) / limit)
        }
      },
      meta: {
        note: count === 0 ? '⚠️ COUNT查询可能有问题，使用记录数作为总数' : null
      }
    });

  } catch (error: any) {
    console.error('记录API错误:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '服务器错误',
        // 返回空数据让前端至少能显示
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