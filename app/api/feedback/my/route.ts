import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 基础验证
    if (!body.title || body.title.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: '标题至少2个字符' },
        { status: 400 }
      );
    }
    
    if (!body.content || body.content.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: '内容至少10个字符' },
        { status: 400 }
      );
    }

    // 获取用户信息（如果有）
    const userEmail = body.userEmail || '匿名用户';
    const userId = body.userId || null;

    // 检查用户是否已有待处理的反馈
    if (userId) {
      const { data: pendingFeedbacks } = await supabase
        .from('feedbacks')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (pendingFeedbacks && pendingFeedbacks.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: '您有待处理的反馈，请等待管理员回复后再提交新的反馈'
          },
          { status: 400 }
        );
      }
    }

    // 创建新反馈
    const newFeedback = {
      user_id: userId,
      user_email: userEmail,
      user_nickname: body.nickname || (userId ? '登录用户' : '匿名用户'),
      title: body.title.trim(),
      content: body.content.trim(),
      category: body.category || 'general',
      rating: body.rating || null,
      status: 'pending',
      is_public: false,
      is_featured: false
    };

    const { data, error } = await supabase
      .from('feedbacks')
      .insert(newFeedback)
      .select()
      .single();

    if (error) {
      console.error('❌ 创建反馈失败:', error);
      return NextResponse.json(
        { success: false, error: '提交反馈失败' },
        { status: 500 }
      );
    }

    console.log(`✅ 新反馈提交: ${newFeedback.title}`);

    return NextResponse.json({
      success: true,
      data,
      message: '反馈提交成功！我们会在3个工作日内回复您'
    });

  } catch (error: any) {
    console.error('❌ 提交反馈异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: '反馈API已就绪',
    endpoints: {
      POST: '提交新反馈',
      '/my': '获取我的反馈（需要认证）',
      '/public': '获取公开反馈'
    }
  });
}