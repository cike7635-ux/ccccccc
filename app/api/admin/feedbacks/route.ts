// /app/api/admin/feedbacks/route.ts - 优化后的精确版本
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// 简化的管理员验证（实际应该更严格）
async function isAdminEmail(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    return adminEmails.includes(email.trim());
  } catch (error) {
    console.error('检查管理员邮箱失败:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 管理员获取反馈列表API被调用');
    
    // 1. 管理员验证（简化版）
    const authHeader = request.headers.get('authorization');
    let isAdmin = false;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user?.email) {
          isAdmin = await isAdminEmail(user.email);
        }
      } catch (e) {
        console.log('⚠️ Token验证失败');
      }
    }
    
    // 检查Cookie（中间件已设置）
    if (!isAdmin) {
      const cookieHeader = request.headers.get('cookie') || '';
      if (cookieHeader.includes('admin_key_verified=true')) {
        isAdmin = true;
      }
    }
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: '非管理员账号' },
        { status: 403 }
      );
    }
    
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