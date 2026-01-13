// /app/api/feedback/public/route.ts - 修复版本
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 获取公开反馈列表');
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 🔥 修复：只返回公开且已解决的反馈
    const { data: feedbacks, error, count } = await supabase
      .from('feedbacks')
      .select('*', { count: 'exact' })
      .eq('is_public', true)  // 只显示公开的
      .eq('status', 'resolved')  // 只显示已解决的
      .order('is_featured', { ascending: false })  // 置顶的在前
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('❌ 获取公开反馈失败:', error);
      return NextResponse.json(
        { success: false, error: '获取公开反馈失败' },
        { status: 500 }
      );
    }
    
    // 🔥 隐私保护：隐藏用户邮箱，只显示昵称
    const safeFeedbacks = feedbacks?.map(feedback => {
      // 提取昵称：优先使用user_nickname，如果没有则使用邮箱用户名部分
      let nickname = feedback.user_nickname;
      if (!nickname && feedback.user_email) {
        // 从邮箱中提取用户名部分（@之前的部分）
        nickname = feedback.user_email.split('@')[0];
      }
      
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
        user_nickname: nickname || '用户',  // 🔥 只返回昵称
        // 不包含 user_email 字段，保护用户隐私
        status: feedback.status
      };
    }) || [];
    
    console.log(`✅ 成功获取公开反馈，数量: ${safeFeedbacks.length}`);
    
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