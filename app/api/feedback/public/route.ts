// /app/api/feedback/public/route.ts - 精确修复版
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
    
    // 🔥 精确查询：只返回公开且已解决的反馈
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
        user_nickname  -- 🔥 只返回昵称，保护隐私
      `, { count: 'exact' })
      .eq('is_public', true)
      .eq('status', 'resolved')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('❌ 查询失败:', error);
      return NextResponse.json(
        { success: false, error: '获取公开反馈失败' },
        { status: 500 }
      );
    }
    
    // 🔥 隐私保护：确保不泄露邮箱，处理空昵称
    const safeFeedbacks = feedbacks?.map(feedback => {
      // 处理昵称：优先使用user_nickname，没有则使用通用名称
      let nickname = feedback.user_nickname;
      if (!nickname || nickname.trim() === '') {
        nickname = '用户';
      }
      
      // 移除可能的邮箱痕迹
      const cleanNickname = nickname.replace(/@.*$/, '');
      
      return {
        ...feedback,
        user_nickname: cleanNickname,
        // 确保不包含user_email字段
        user_email: undefined
      };
    }) || [];
    
    console.log(`✅ 获取公开反馈成功: ${safeFeedbacks.length} 条`);
    
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
    console.error('❌ API异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}