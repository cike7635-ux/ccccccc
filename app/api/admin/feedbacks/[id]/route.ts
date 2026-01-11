import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAdminAuth } from '@/lib/auth';
import { z } from 'zod';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// 回复反馈的schema
const replySchema = z.object({
  admin_reply: z.string().min(1, '回复内容不能为空').max(2000, '回复内容最多2000字'),
  status: z.enum(['replied', 'resolved', 'archived']).optional(),
  is_public: z.boolean().optional(),
  is_featured: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证管理员权限
    const authError = await checkAdminAuth(request);
    if (authError) {
      return authError;
    }

    const feedbackId = params.id;
    
    // 检查反馈是否存在
    const { data: existingFeedback, error: fetchError } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('id', feedbackId)
      .single();

    if (fetchError || !existingFeedback) {
      return NextResponse.json(
        { error: '反馈不存在' },
        { status: 404 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const validatedData = replySchema.parse(body);

    // 获取当前管理员用户
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    // 更新反馈
    const updateData: any = {
      ...validatedData,
      updated_at: new Date().toISOString()
    };

    // 如果是回复，记录回复者和回复时间
    if (validatedData.admin_reply) {
      updateData.replied_by = user?.id;
      updateData.replied_at = new Date().toISOString();
      
      // 如果状态未指定，自动设为replied
      if (!validatedData.status) {
        updateData.status = 'replied';
      }
    }

    // 如果设为公开，确保状态是resolved
    if (validatedData.is_public && !validatedData.status) {
      updateData.status = 'resolved';
    }

    // 更新反馈
    const { data: updatedFeedback, error: updateError } = await supabase
      .from('feedbacks')
      .update(updateData)
      .eq('id', feedbackId)
      .select()
      .single();

    if (updateError) {
      console.error('更新反馈失败:', updateError);
      return NextResponse.json(
        { error: '更新反馈失败' },
        { status: 500 }
      );
    }

    // 记录管理员操作日志
    await logAdminAction(
      user?.id,
      'update_feedback',
      `更新反馈 #${feedbackId}`,
      { feedbackId, changes: validatedData }
    );

    return NextResponse.json({
      success: true,
      message: '反馈更新成功',
      data: updatedFeedback
    });

  } catch (error) {
    console.error('更新反馈异常:', error);
    
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证管理员权限
    const authError = await checkAdminAuth(request);
    if (authError) {
      return authError;
    }

    const feedbackId = params.id;
    
    // 检查反馈是否存在
    const { data: existingFeedback } = await supabase
      .from('feedbacks')
      .select('id')
      .eq('id', feedbackId)
      .single();

    if (!existingFeedback) {
      return NextResponse.json(
        { error: '反馈不存在' },
        { status: 404 }
      );
    }

    // 获取当前管理员用户
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    // 软删除：将状态设为archived
    const { error: deleteError } = await supabase
      .from('feedbacks')
      .update({
        status: 'archived',
        is_public: false,
        is_featured: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', feedbackId);

    if (deleteError) {
      console.error('删除反馈失败:', deleteError);
      return NextResponse.json(
        { error: '删除反馈失败' },
        { status: 500 }
      );
    }

    // 记录管理员操作日志
    await logAdminAction(
      user?.id,
      'archive_feedback',
      `归档反馈 #${feedbackId}`,
      { feedbackId }
    );

    return NextResponse.json({
      success: true,
      message: '反馈已归档'
    });

  } catch (error) {
    console.error('删除反馈异常:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

// 记录管理员操作日志函数
async function logAdminAction(
  adminId: string | undefined,
  action: string,
  description: string,
  metadata: any
) {
  try {
    // 可以记录到专门的admin_logs表，这里简化处理
    console.log('👨‍💼 管理员操作:', {
      adminId,
      action,
      description,
      metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('记录管理员操作失败:', error);
  }
}