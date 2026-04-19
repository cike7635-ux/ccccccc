// /app/api/admin/ai-keys/list/route.ts
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
    const boostType = searchParams.get('boostType');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;

    // 🔥 修复：使用直接的SELECT查询，确保返回所有需要的字段
    let query = supabase
      .from('ai_boost_keys')
      .select(`
        *,
        creator:profiles!ai_boost_keys_created_by_fkey (
          email,
          nickname,
          avatar_url
        ),
        user:profiles!ai_boost_keys_used_by_user_id_fkey (
          email,
          nickname,
          avatar_url
        )
      `, { count: 'exact' })
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

    // 获取总数和分页数据
    const { data: keys, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('查询密钥列表错误:', error);
      throw error;
    }

    // 🔥 修复：添加详细的调试日志
    console.log(`[AI密钥API] 查询到 ${keys?.length || 0} 条记录`);
    if (keys && keys.length > 0) {
      console.log('[AI密钥API] 第一条记录的结构:', {
        id: keys[0].id,
        key_code: keys[0].key_code,
        user_exists: !!keys[0].user,
        user_data: keys[0].user,
        used_by_user_id: keys[0].used_by_user_id
      });
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

      // 🔥 修复：确保user对象不为空，即使关联查询返回null
      const userInfo = key.user || (key.used_by_user_id ? {
        email: '未知邮箱',
        nickname: `用户_${key.used_by_user_id.substring(0, 8)}`,
        avatar_url: null
      } : null);

      return {
        ...key,
        status,
        is_expired: key.expires_at ? new Date(key.expires_at) < now : false,
        user: userInfo, // 确保user字段始终存在（即使为null）
        creator: key.creator || null
      };
    }) || [];

    // 统计信息（单独查询以提高性能）
    const { data: statsData, error: statsError } = await supabase
      .from('ai_boost_keys')
      .select('boost_type, increment_amount, used_count, is_active')
      .eq('is_active', true);

    if (statsError) {
      console.error('获取统计信息错误:', statsError);
    }

    const stats = statsData || [];
    const totalGenerated = stats.length;
    const totalUsed = stats.filter(k => k.used_count > 0).length;
    const totalIncrement = stats.reduce((sum, k) => sum + k.increment_amount, 0);
    const totalUsedIncrement = stats.reduce((sum, k) => sum + (k.increment_amount * k.used_count), 0);

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