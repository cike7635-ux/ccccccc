// /app/api/admin/feedbacks/route.ts - 完整修复版本
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 管理员认证函数（简化版）
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

// 使用Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 管理员获取反馈列表API被调用');
    
    // 1. 简单管理员验证（基于cookie或header）
    // 这里我们使用简单的邮箱验证，实际项目中应该使用更安全的认证方式
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
        console.log('⚠️ Token验证失败，尝试Cookie验证');
      }
    }
    
    // 2. 如果没有token，检查Cookie
    if (!isAdmin) {
      const cookieHeader = request.headers.get('cookie') || '';
      if (cookieHeader.includes('admin_key_verified=true')) {
        isAdmin = true;
      }
    }
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: '非管理员账号' },
        { status: 403 }
      );
    }
    
    // 3. 获取查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    console.log('🔍 API查询参数:', {
      status, category, search, sortBy, sortOrder, limit, offset
    });
    
    // 4. 构建基础查询
    let query = supabaseAdmin
      .from('feedbacks')
      .select('*', { count: 'exact' });
    
    // 🔥 修复1：状态筛选（支持all、pending、replied、resolved、archived）
    if (status && status !== 'all') {
      console.log('🔍 应用状态筛选:', status);
      query = query.eq('status', status);
    }
    
    // 🔥 修复2：分类筛选（由于当前没有分类数据，暂时注释）
    // if (category && category !== 'all') {
    //   console.log('🔍 应用分类筛选:', category);
    //   query = query.eq('category', category);
    // }
    
    // 🔥 修复3：搜索功能（搜索标题、内容、用户昵称、用户邮箱）
    if (search && search.trim()) {
      console.log('🔍 应用搜索:', search);
      const searchTerm = `%${search.trim()}%`;
      // 使用or操作符搜索多个字段
      query = query.or(
        `title.ilike.${searchTerm},content.ilike.${searchTerm},user_nickname.ilike.${searchTerm},user_email.ilike.${searchTerm}`
      );
    }
    
    // 🔥 修复4：排序
    console.log('🔍 应用排序:', sortBy, sortOrder);
    query = query.order(sortBy, { 
      ascending: sortOrder === 'asc'
    });
    
    // 应用分页
    query = query.range(offset, offset + limit - 1);
    
    const { data: feedbacks, error, count } = await query;
    
    if (error) {
      console.error('❌ 获取反馈失败:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: `获取反馈失败: ${error.message}`,
          details: error
        },
        { status: 500 }
      );
    }
    
    // 5. 计算统计数据
    // 先获取所有反馈用于统计
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
    
    // 🔥 修复5：确保用户昵称不为空
    const formattedFeedbacks = feedbacks?.map(feedback => ({
      ...feedback,
      user_nickname: feedback.user_nickname || feedback.user_email?.split('@')[0] || '用户'
    })) || [];
    
    console.log(`✅ 成功获取反馈，数量: ${formattedFeedbacks.length}`);
    
    return NextResponse.json({
      success: true,
      data: formattedFeedbacks,
      stats,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    });
    
  } catch (error: any) {
    console.error('❌ 管理员获取反馈异常:', error);
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