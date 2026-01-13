// /app/api/feedback/route.ts - 使用Service Role Key验证用户
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 使用Service Role Key（关键！）
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // 🔥 必须是Service Role Key
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 反馈提交API被调用');
    
    // 1. 从请求头获取Authorization token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.log('❌ 没有Authorization头');
      return NextResponse.json(
        { success: false, error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔑 Token长度:', token.length);
    
    // 2. 使用Service Role Key验证token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.log('❌ 用户验证失败:', authError?.message);
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
    const { data: pendingFeedbacks } = await supabaseAdmin
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

    // 6. 获取用户资料
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('nickname')
      .eq('id', user.id)
      .single();

    // 7. 创建新反馈
    const newFeedback = {
      user_id: user.id,
      user_email: user.email,
      user_nickname: profile?.nickname || user.email?.split('@')[0],
      title: title.trim(),
      content: content.trim(),
      category: category || 'general',
      rating: rating || null,
      status: 'pending',
      is_public: false,
      is_featured: false
    };

    const { data, error } = await supabaseAdmin
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