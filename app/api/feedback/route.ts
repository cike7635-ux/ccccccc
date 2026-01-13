// /app/api/feedback/route.ts - 确保使用匿名密钥验证
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 使用匿名密钥验证token
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // 必须是匿名密钥
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 反馈提交API被调用');
    
    // 1. 从请求头获取Authorization token
    const authHeader = request.headers.get('authorization');
    console.log('📨 Authorization头:', authHeader ? '存在' : '不存在');
    
    if (!authHeader) {
      console.log('❌ 没有Authorization头');
      return NextResponse.json(
        { success: false, error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔑 Token长度:', token.length);
    
    // 2. 验证用户（使用匿名密钥）
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      console.log('❌ 用户验证失败:', authError.message);
      return NextResponse.json(
        { success: false, error: '用户验证失败，请重新登录' },
        { status: 401 }
      );
    }
    
    if (!user) {
      console.log('❌ 用户不存在');
      return NextResponse.json(
        { success: false, error: '用户验证失败，请重新登录' },
        { status: 401 }
      );
    }

    console.log('✅ 用户已认证:', user.email);
    
    // 3. 解析请求体
    const body = await request.json();
    console.log('📦 请求数据:', { 
      title: body.title?.substring(0, 50),
      contentLength: body.content?.length,
      category: body.category,
      rating: body.rating 
    });
    
    const { title, content, category = 'general', rating } = body;
    
    // 4. 基础验证
    if (!title || title.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: '标题至少2个字符' },
        { status: 400 }
      );
    }
    
    if (!content || content.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: '内容至少10个字符' },
        { status: 400 }
      );
    }

    // 5. 检查用户是否已有待处理的反馈
    const { data: pendingFeedbacks } = await supabase
      .from('feedbacks')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending');

    if (pendingFeedbacks && pendingFeedbacks.length > 0) {
      console.log('⚠️ 用户有待处理反馈:', pendingFeedbacks[0].id);
      return NextResponse.json(
        { 
          success: false, 
          error: '您有待处理的反馈，请等待管理员回复后再提交新的反馈'
        },
        { status: 400 }
      );
    }

    // 6. 创建新反馈
    const newFeedback = {
      user_id: user.id,
      user_email: user.email,
      user_nickname: user.email?.split('@')[0],
      title: title.trim(),
      content: content.trim(),
      category: category || 'general',
      rating: rating || null,
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

    console.log(`✅ 新反馈提交成功，ID: ${data.id}`);

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