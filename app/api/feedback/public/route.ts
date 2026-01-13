// /app/api/feedback/public/route.ts - 修复500错误版本
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 获取公开反馈列表 - 简化版本');
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // ✅ 简化查询：现在user_nickname已经是真实昵称
    const { data: feedbacks, error, count } = await supabase
      .from('feedbacks')
      .select('*', { count: 'exact' })
      .eq('is_public', true)
      .eq('status', 'resolved')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('❌ 获取公开反馈失败:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: '获取公开反馈失败',
          details: error.message
        },
        { status: 500 }
      );
    }
    
    console.log(`✅ 成功获取公开反馈: ${feedbacks?.length || 0} 条`);
    
    // ✅ 处理结果：隐藏邮箱，user_nickname已经是真实昵称
    const enhancedFeedbacks = (feedbacks || []).map(feedback => ({
      id: feedback.id,
      title: feedback.title,
      content: feedback.content,
      category: feedback.category,
      rating: feedback.rating,
      admin_reply: feedback.admin_reply,
      replied_at: feedback.replied_at,
      is_featured: feedback.is_featured,
      created_at: feedback.created_at,
      user_nickname: feedback.user_nickname || '匿名用户',
      // ⚠️ 重要：不返回user_email保护隐私
      status: feedback.status
    }));
    
    return NextResponse.json({
      success: true,
      data: enhancedFeedbacks,
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
      { 
        success: false, 
        error: '服务器内部错误',
        message: error.message
      },
      { status: 500 }
    );
  }
}