import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 获取AI密钥列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const boostType = searchParams.get('boostType');
    const status = searchParams.get('status'); // 'all', 'active', 'used', 'expired'
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 构建查询
    let query = supabase
      .from('ai_boost_keys')
      .select(`
        *,
        creator:created_by (nickname, email),
        user:used_by_user_id (nickname, email)
      `)
      .order(sortBy, { ascending: sortOrder === 'asc' });

    // 应用筛选条件
    if (boostType && boostType !== 'all') {
      query = query.eq('boost_type', boostType);
    }

    if (status && status !== 'all') {
      const now = new Date().toISOString();
      
      if (status === 'active') {
        query = query.eq('is_active', true);
        query = query.eq('used_count', 0);
        query = query.or(`expires_at.is.null,expires_at.gt.${now}`);
      } else if (status === 'used') {
        query = query.gt('used_count', 0);
      } else if (status === 'expired') {
        query = query.lt('expires_at', now);
      } else if (status === 'inactive') {
        query = query.eq('is_active', false);
      }
    }

    if (search) {
      query = query.or(`key_code.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // 获取总数
    const { count, error: countError } = await query
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('计数查询错误:', countError);
    }

    // 获取分页数据
    const { data: keys, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('查询密钥列表错误:', error);
      throw error;
    }

    // 增强数据，计算状态
    const enhancedKeys = keys?.map(key => {
      const now = new Date();
      let status = 'active';
      
      if (!key.is_active) {
        status = 'inactive';
      } else if (key.used_count > 0) {
        status = 'used';
      } else if (key.expires_at && new Date(key.expires_at) < now) {
        status = 'expired';
      }

      return {
        ...key,
        status,
        is_expired: key.expires_at ? new Date(key.expires_at) < now : false
      };
    }) || [];

    // 统计信息
    const { data: stats } = await supabase
      .from('ai_boost_keys')
      .select('boost_type, increment_amount, used_count')
      .eq('is_active', true);

    const totalGenerated = stats?.length || 0;
    const totalUsed = stats?.filter(k => k.used_count > 0).length || 0;
    const totalIncrement = stats?.reduce((sum, k) => sum + k.increment_amount, 0) || 0;
    const totalUsedIncrement = stats?.reduce((sum, k) => sum + (k.increment_amount * k.used_count), 0) || 0;

    return NextResponse.json({
      success: true,
      data: {
        keys: enhancedKeys,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        stats: {
          totalGenerated,
          totalUsed,
          totalIncrement,
          totalUsedIncrement,
          usageRate: totalGenerated > 0 ? Math.round((totalUsed / totalGenerated) * 100) : 0
        }
      }
    });

  } catch (error: any) {
    console.error('获取AI密钥列表错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}