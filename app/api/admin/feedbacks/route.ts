// /app/api/admin/feedbacks/route.ts - 优化后的精确版本
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth';

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 管理员获取反馈列表API被调用');

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const supabaseAdmin = createAdminClient()

    // 2. 获取查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    console.log('🔍 查询参数:', { status, search, sortBy, sortOrder, limit, offset });
    
    // 3. 构建查询
    let query = supabaseAdmin
      .from('feedbacks')
      .select('*', { count: 'exact' });
    
    // 🔥 关键修复：状态筛选
    if (status && status !== 'all') {
      console.log('✅ 应用状态筛选:', status);
      query = query.eq('status', status);
    }
    
    // 🔥 关键修复：搜索功能
    if (search && search.trim()) {
      const searchTerm = search.trim();
      console.log('✅ 应用搜索:', searchTerm);
      
      // 使用pg_trgm支持的模糊搜索（GIN索引会加速此查询）
      query = query.or(
        `title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%,user_nickname.ilike.%${searchTerm}%,user_email.ilike.%${searchTerm}%`
      );
    }
    
    // 应用排序
    query = query.order(sortBy, { 
      ascending: sortOrder === 'asc',
      nullsFirst: false
    });
    
    // 应用分页
    query = query.range(offset, offset + limit - 1);
    
    const { data: feedbacks, error, count } = await query;
    
    if (error) {
      console.error('❌ 查询失败:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: `查询失败: ${error.message}`,
          details: error
        },
        { status: 500 }
      );
    }
    
    // 4. 计算统计数据
    const { data: allFeedbacks } = await supabaseAdmin
      .from('feedbacks')
      .select('status');
    
    const stats = {
      byStatus: {
        pending: allFeedbacks?.filter(f => f.status === 'pending').length || 0,
        replied: allFeedbacks?.filter(f => f.status === 'replied').length || 0,
        resolved: allFeedbacks?.filter(f => f.status === 'resolved').length || 0,
        archived: allFeedbacks?.filter(f => f.status === 'archived').length || 0
      },
      total: count || 0
    };
    
    // 🔥 确保昵称为空时有默认值
    const formattedFeedbacks = feedbacks?.map(feedback => ({
      ...feedback,
      user_nickname: feedback.user_nickname || 
                     feedback.user_email?.split('@')[0] || 
                     '用户'
    })) || [];
    
    console.log(`✅ 查询成功: ${formattedFeedbacks.length} 条记录`);
    
    return NextResponse.json({
      success: true,
      data: formattedFeedbacks,
      stats,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      debug: {
        appliedFilters: { status, search, sortBy, sortOrder },
        recordCount: formattedFeedbacks.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('❌ API异常:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '服务器内部错误',
        details: error.message 
      },
      { status: 500 }
    );
  }
}