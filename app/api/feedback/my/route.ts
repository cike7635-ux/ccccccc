// /app/api/feedback/my/route.ts - 获取用户反馈列表
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    console.log('🎯 获取用户反馈API被调用');
    
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
    
    // 2. 验证用户
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('❌ 用户验证失败:', authError?.message);
      return NextResponse.json(
        { success: false, error: '用户验证失败' },
        { status: 401 }
      );
    }

    console.log('✅ 用户已认证:', user.email);
    
    // 3. 获取用户的反馈
    const { data: feedbacks, error: fetchError } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ 获取反馈失败:', fetchError);
      return NextResponse.json(
        { success: false, error: '获取反馈失败' },
        { status: 500 }
      );
    }

    // 4. 计算统计信息
    const stats = {
      pending: feedbacks?.filter(f => f.status === 'pending').length || 0,
      replied: feedbacks?.filter(f => f.status === 'replied').length || 0,
      resolved: feedbacks?.filter(f => f.status === 'resolved').length || 0
    };

    console.log(`✅ 成功获取用户反馈，数量: ${feedbacks?.length || 0}`);

    return NextResponse.json({
      success: true,
      data: feedbacks || [],
      stats,
      message: '获取反馈成功'
    });

  } catch (error: any) {
    console.error('❌ 获取用户反馈异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}