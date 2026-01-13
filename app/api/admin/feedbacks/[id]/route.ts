// /app/api/admin/feedbacks/[id]/route.ts - 修复版本
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 使用Service Role Key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// 🔥 简化验证：不再使用严格的Zod验证
const validateRequestBody = (body: any) => {
  const errors: string[] = [];
  
  // 验证admin_reply（如果有的话）
  if (body.admin_reply !== undefined && body.admin_reply !== null) {
    if (typeof body.admin_reply !== 'string') {
      errors.push('admin_reply必须是字符串');
    } else if (body.admin_reply.trim().length === 0) {
      errors.push('回复内容不能为空');
    } else if (body.admin_reply.length > 2000) {
      errors.push('回复内容最多2000字');
    }
  }
  
  // 验证status
  if (body.status && !['pending', 'replied', 'resolved', 'archived'].includes(body.status)) {
    errors.push('状态值无效');
  }
  
  // 验证布尔值
  if (body.is_public !== undefined && typeof body.is_public !== 'boolean') {
    errors.push('is_public必须是布尔值');
  }
  
  if (body.is_featured !== undefined && typeof body.is_featured !== 'boolean') {
    errors.push('is_featured必须是布尔值');
  }
  
  return errors;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🎯 管理员更新反馈API被调用');
    
    const feedbackId = params.id;
    console.log(`📋 操作反馈ID: ${feedbackId}`);
    
    // 1. 检查反馈是否存在
    const { data: existingFeedback, error: fetchError } = await supabaseAdmin
      .from('feedbacks')
      .select('*')
      .eq('id', feedbackId)
      .single();

    if (fetchError || !existingFeedback) {
      console.log('❌ 反馈不存在:', feedbackId);
      return NextResponse.json(
        { success: false, error: '反馈不存在' },
        { status: 404 }
      );
    }

    console.log('📄 找到反馈:', existingFeedback.title);
    
    // 2. 解析请求体
    let body;
    try {
      body = await request.json();
      console.log('📦 请求体:', JSON.stringify(body, null, 2));
    } catch (error) {
      console.log('❌ 解析JSON失败:', error);
      return NextResponse.json(
        { success: false, error: '请求体格式错误' },
        { status: 400 }
      );
    }
    
    // 3. 验证请求体
    const validationErrors = validateRequestBody(body);
    if (validationErrors.length > 0) {
      console.log('❌ 验证失败:', validationErrors);
      return NextResponse.json(
        { success: false, error: validationErrors.join(', ') },
        { status: 400 }
      );
    }
    
    // 4. 准备更新数据
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // 复制允许更新的字段
    if (body.admin_reply !== undefined) {
      updateData.admin_reply = body.admin_reply.trim();
      updateData.replied_at = new Date().toISOString();
      updateData.status = body.status || 'replied';
    }
    
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    
    if (body.is_public !== undefined) {
      updateData.is_public = body.is_public;
      
      // 如果设为公开，自动设为已解决
      if (body.is_public && !body.status) {
        updateData.status = 'resolved';
      }
    }
    
    if (body.is_featured !== undefined) {
      updateData.is_featured = body.is_featured;
    }
    
    console.log('🔄 更新数据:', JSON.stringify(updateData, null, 2));
    
    // 5. 更新反馈
    const { data: updatedFeedback, error: updateError } = await supabaseAdmin
      .from('feedbacks')
      .update(updateData)
      .eq('id', feedbackId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ 更新反馈失败:', updateError);
      return NextResponse.json(
        { success: false, error: '更新反馈失败' },
        { status: 500 }
      );
    }

    console.log('✅ 反馈更新成功:', updatedFeedback.id);
    
    // 6. 记录操作日志
    console.log('📋 管理员操作日志:', {
      feedbackId,
      action: 'update',
      changes: updateData,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: '操作成功',
      data: updatedFeedback
    });

  } catch (error: any) {
    console.error('❌ 更新反馈异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🎯 管理员删除/归档反馈API被调用');
    
    const feedbackId = params.id;
    console.log(`📋 操作反馈ID: ${feedbackId}`);
    
    // 检查反馈是否存在
    const { data: existingFeedback } = await supabaseAdmin
      .from('feedbacks')
      .select('id')
      .eq('id', feedbackId)
      .single();

    if (!existingFeedback) {
      console.log('❌ 反馈不存在:', feedbackId);
      return NextResponse.json(
        { success: false, error: '反馈不存在' },
        { status: 404 }
      );
    }

    // 软删除：将状态设为archived
    const { error: deleteError } = await supabaseAdmin
      .from('feedbacks')
      .update({
        status: 'archived',
        is_public: false,
        is_featured: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', feedbackId);

    if (deleteError) {
      console.error('❌ 归档反馈失败:', deleteError);
      return NextResponse.json(
        { success: false, error: '归档反馈失败' },
        { status: 500 }
      );
    }

    console.log('✅ 反馈归档成功:', feedbackId);
    
    // 记录操作日志
    console.log('📋 管理员操作日志:', {
      feedbackId,
      action: 'archive',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: '反馈已归档'
    });

  } catch (error: any) {
    console.error('❌ 归档反馈异常:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}