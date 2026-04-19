// /app/api/admin/feedbacks/[id]/route.ts - 删除功能版本
import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth';

// PATCH - 更新反馈
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const feedbackId = params.id;
    console.log(`🎯 更新反馈 #${feedbackId}`);
    
    // 验证管理员权限
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const supabaseAdmin = createAdminClient()
    const body = await request.json();
    console.log('🔍 更新请求体:', body);
    
    // 验证必填字段
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: '请求体格式错误' },
        { status: 400 }
      );
    }
    
    // 构建更新数据
    const updateData: any = {};
    
    // 可以更新的字段
    const allowedFields = [
      'admin_reply', 'status', 'is_public', 'is_featured',
      'category', 'rating', 'replied_by', 'replied_at'
    ];
    
    // 只更新允许的字段
    allowedFields.forEach(field => {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    });
    
    // 如果设置admin_reply，自动更新状态和时间
    if (body.admin_reply !== undefined) {
      updateData.status = 'replied';
      updateData.replied_at = new Date().toISOString();
    }
    
    // 如果设置is_public为true，自动更新状态为resolved
    if (body.is_public === true) {
      updateData.status = 'resolved';
    }
    
    // 添加更新时间戳
    updateData.updated_at = new Date().toISOString();
    
    console.log('🔍 最终更新数据:', updateData);
    
    // 执行更新
    const { data, error } = await supabaseAdmin
      .from('feedbacks')
      .update(updateData)
      .eq('id', feedbackId)
      .select()
      .single();
    
    if (error) {
      console.error('❌ 更新失败:', error);
      return NextResponse.json(
        { success: false, error: `更新失败: ${error.message}` },
        { status: 500 }
      );
    }
    
    console.log('✅ 更新成功:', data);
    
    return NextResponse.json({
      success: true,
      data,
      message: '反馈已更新'
    });
    
  } catch (error: any) {
    console.error('❌ 更新异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// DELETE - 删除反馈
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const feedbackId = params.id;
    console.log(`🗑️ 删除反馈 #${feedbackId}`);

    // 验证管理员权限
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const supabaseAdmin = createAdminClient()

    // 先获取反馈信息（用于日志）
    const { data: feedback, error: fetchError } = await supabaseAdmin
      .from('feedbacks')
      .select('title, user_email')
      .eq('id', feedbackId)
      .single();
    
    if (fetchError) {
      console.error('❌ 获取反馈信息失败:', fetchError);
    }
    
    console.log(`🔍 准备删除反馈: ${feedback?.title || '未知'} (${feedback?.user_email || '未知用户'})`);
    
    // 执行删除
    const { error } = await supabaseAdmin
      .from('feedbacks')
      .delete()
      .eq('id', feedbackId);
    
    if (error) {
      console.error('❌ 删除失败:', error);
      return NextResponse.json(
        { success: false, error: `删除失败: ${error.message}` },
        { status: 500 }
      );
    }
    
    console.log('✅ 删除成功');
    
    return NextResponse.json({
      success: true,
      message: '反馈已删除'
    });
    
  } catch (error: any) {
    console.error('❌ 删除异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}