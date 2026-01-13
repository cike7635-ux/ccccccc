// /app/api/feedback/route.ts - 完整修复版本
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// 创建Supabase客户端（使用Service Role Key！）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // 🔥 关键：使用Service Role Key
  { auth: { persistSession: false } }
);

// 验证schema
const feedbackSchema = z.object({
  title: z.string()
    .min(2, '标题至少2个字符')
    .max(100, '标题最多100个字符'),
  content: z.string()
    .min(10, '内容至少10个字符')
    .max(1000, '内容最多1000个字符'),
  category: z.enum(['general', 'bug', 'suggestion', 'question', 'feature_request']).default('general'),
  rating: z.number().min(1).max(5).optional(),
});

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 反馈提交API被调用');
    
    // 验证用户登录状态
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('❌ 没有Authorization头');
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔑 Token长度:', token.length);
    
    // 🔥 关键修复：使用Service Role Key验证用户
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('❌ 用户验证失败:', authError?.message);
      return NextResponse.json(
        { error: '用户验证失败，请重新登录' },
        { status: 401 }
      );
    }

    console.log('✅ 用户已认证:', user.email);
    
    // 解析请求体
    const body = await request.json();
    const validatedData = feedbackSchema.parse(body);

    // 检查用户是否已有待处理的反馈
    const { data: existingFeedback, error: checkError } = await supabase
      .from('feedbacks')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single();

    if (existingFeedback) {
      console.log('⚠️ 用户有待处理反馈:', existingFeedback.id);
      return NextResponse.json(
        { 
          error: '您已有一条待处理的反馈，请等待管理员回复后再提交新的反馈',
          existingId: existingFeedback.id 
        },
        { status: 400 }
      );
    }

    // 获取用户资料
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, nickname')
      .eq('id', user.id)
      .single();

    // 创建反馈
    const { data: feedback, error: insertError } = await supabase
      .from('feedbacks')
      .insert({
        user_id: user.id,
        user_email: profile?.email || user.email,
        user_nickname: profile?.nickname || user.email?.split('@')[0],
        title: validatedData.title,
        content: validatedData.content,
        category: validatedData.category,
        rating: validatedData.rating,
        status: 'pending',
        is_public: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ 创建反馈失败:', insertError);
      return NextResponse.json(
        { error: '提交反馈失败，请稍后重试' },
        { status: 500 }
      );
    }

    console.log('✅ 反馈创建成功，ID:', feedback.id);
    
    // 发送通知（可选）
    await sendFeedbackNotification(feedback, user);

    return NextResponse.json({
      success: true,
      message: '反馈提交成功！我们会在3个工作日内回复您',
      data: feedback,
      reminder: '在管理员回复前，您无法提交新的反馈'
    });

  } catch (error) {
    console.error('❌ 提交反馈异常:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '数据验证失败', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 发送通知函数（可选实现）
async function sendFeedbackNotification(feedback: any, user: any) {
  try {
    console.log('📩 新反馈通知:', {
      feedbackId: feedback.id,
      userId: user.id,
      userEmail: user.email,
      title: feedback.title,
      category: feedback.category,
      time: new Date().toISOString()
    });
  } catch (error) {
    console.error('发送通知失败:', error);
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: '反馈API已就绪',
    endpoints: {
      POST: '提交新反馈（需要认证）',
      '/my': '获取我的反馈（需要认证）',
      '/public': '获取公开反馈'
    }
  });
}