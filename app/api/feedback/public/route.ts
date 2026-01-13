// /app/api/feedback/public/route.ts - 修改版本
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 获取公开反馈列表（关联profiles表）');
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 🔥 关键修改：关联profiles表获取真实昵称
    const { data: feedbacks, error, count } = await supabase
      .from('feedbacks')
      .select(`
        id,
        title,
        content,
        category,
        rating,
        admin_reply,
        replied_at,
        is_featured,
        created_at,
        user_nickname,  // 来自feedbacks表（邮箱用户名）
        user_id,        // 用于关联查询
        status,
        profiles!feedbacks_user_id_fkey (
          nickname      // 🔥 来自profiles表的真实昵称
        )
      `, { count: 'exact' })
      .eq('is_public', true)
      .eq('status', 'resolved')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('❌ 获取公开反馈失败:', error);
      return NextResponse.json(
        { success: false, error: '获取公开反馈失败' },
        { status: 500 }
      );
    }
    
    // 🔥 数据处理：使用profiles表的真实昵称，如果为空则使用邮箱用户名
    const safeFeedbacks = feedbacks?.map(feedback => {
      // 优先使用profiles表的真实昵称
      const profileNickname = feedback.profiles?.nickname;
      // 如果没有真实昵称，使用反馈表的邮箱用户名（去掉@后的部分）
      const feedbackUsername = feedback.user_nickname || 
                               feedback.user_email?.split('@')[0] || 
                               '用户';
      
      return {
        id: feedback.id,
        title: feedback.title,
        content: feedback.content,
        category: feedback.category,
        rating: feedback.rating,
        admin_reply: feedback.admin_reply,
        replied_at: feedback.replied_at,
        is_featured: feedback.is_featured,
        created_at: feedback.created_at,
        user_nickname: profileNickname || feedbackUsername, // 🔥 显示真实昵称
        // 确保不包含敏感信息
        user_email: undefined,
        profiles: undefined,
        user_id: undefined,
        status: feedback.status
      };
    }) || [];
    
    console.log(`✅ 获取公开反馈成功: ${safeFeedbacks.length} 条`);
    console.log('🔍 昵称处理结果:', safeFeedbacks.map(f => ({
      id: f.id,
      nickname: f.user_nickname
    })));
    
    return NextResponse.json({
      success: true,
      data: safeFeedbacks,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    });
    
  } catch (error: any) {
    console.error('❌ 获取公开反馈异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}