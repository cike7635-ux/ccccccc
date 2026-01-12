import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化Supabase客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    console.log('📊 开始获取公开反馈数据...');
    
    // 🔥 修复：移除 .group() 方法，使用正确的查询
    const { data: feedbacks, error } = await supabase
      .from('feedbacks')
      .select(`
        id,
        title,
        content,
        category,
        rating,
        status,
        admin_reply,
        replied_at,
        is_public,
        is_featured,
        created_at,
        user_nickname
      `)
      .eq('is_public', true)  // 只获取公开的反馈
      .order('is_featured', { ascending: false })  // 精选的排前面
      .order('created_at', { ascending: false })   // 最新的排前面
      .limit(20);  // 限制数量

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

    console.log(`✅ 成功获取公开反馈，数量: ${feedbacks?.length || 0}`);
    
    return NextResponse.json({
      success: true,
      data: feedbacks || [],
      count: feedbacks?.length || 0,
      timestamp: new Date().toISOString()
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