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
    console.log('🎯 获取公开反馈列表');
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // 🔥 简化查询：先不关联profiles表，避免语法错误
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
        user_nickname,
        user_email,
        status
      `, { count: 'exact' })
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
          details: error.message,
          hint: error.hint
        },
        { status: 500 }
      );
    }
    
    console.log('🔍 获取到的反馈数量:', feedbacks?.length || 0);
    
    // 🔥 手动关联查询profiles表获取昵称
    const enhancedFeedbacks = await Promise.all(
      (feedbacks || []).map(async (feedback) => {
        try {
          // 查询profiles表获取真实昵称
          const { data: profile } = await supabase
            .from('profiles')
            .select('nickname')
            .eq('id', feedback.user_id)
            .single();
          
          // 优先使用profiles表的真实昵称
          const nickname = profile?.nickname || 
                          feedback.user_nickname || 
                          feedback.user_email?.split('@')[0] || 
                          '用户';
          
          return {
            ...feedback,
            user_nickname: nickname, // 🔥 显示真实昵称
            user_email: undefined // 隐藏邮箱保护隐私
          };
        } catch (profileError) {
          console.error('查询profile失败:', profileError);
          // 如果查询失败，使用反馈表的昵称
          return {
            ...feedback,
            user_nickname: feedback.user_nickname || 
                          feedback.user_email?.split('@')[0] || 
                          '用户',
            user_email: undefined
          };
        }
      })
    );
    
    console.log(`✅ 成功处理公开反馈，数量: ${enhancedFeedbacks.length}`);
    
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
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}