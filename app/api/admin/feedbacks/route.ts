// /app/api/admin/feedbacks/route.ts - 简化版本
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/auth';

// 使用Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 管理员获取反馈列表API被调用');
    
    // 1. 简单验证管理员（基于邮箱）
    // 从Authorization头获取token并验证邮箱
    const authHeader = request.headers.get('authorization');
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      
      if (user?.email) {
        const admin = await isAdminEmail(user.email);
        if (!admin) {
          return NextResponse.json(
            { error: '非管理员账号' },
            { status: 403 }
          );
        }
      }
    }
    
    // 2. 获取查询参数
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // 3. 构建查询
    let query = supabaseAdmin
      .from('feedbacks')
      .select('*', { count: 'exact' })
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);
    
    // 应用筛选条件
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%,user_nickname.ilike.%${search}%`);
    }
    
    const { data: feedbacks, error, count } = await query;
    
    if (error) {
      console.error('❌ 获取反馈失败:', error);
      return NextResponse.json(
        { success: false, error: '获取反馈失败' },
        { status: 500 }
      );
    }
    
    // 4. 计算统计数据
    const { data: allFeedbacks } = await supabaseAdmin
      .from('feedbacks')
      .select('status, category');
    
    const stats = {
      byStatus: {
        pending: allFeedbacks?.filter(f => f.status === 'pending').length || 0,
        replied: allFeedbacks?.filter(f => f.status === 'replied').length || 0,
        resolved: allFeedbacks?.filter(f => f.status === 'resolved').length || 0,
        archived: allFeedbacks?.filter(f => f.status === 'archived').length || 0
      },
      byCategory: allFeedbacks?.reduce((acc: Record<string, number>, feedback) => {
        acc[feedback.category] = (acc[feedback.category] || 0) + 1;
        return acc;
      }, {}) || {},
      total: count || 0
    };
    
    console.log(`✅ 成功获取反馈，数量: ${feedbacks?.length || 0}`);
    
    return NextResponse.json({
      success: true,
      data: feedbacks || [],
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
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}