// /app/api/admin/feedbacks/[id]/route.ts - 删除功能版本
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// 简化的管理员验证
async function isAdminEmail(email: string): Promise<boolean> {
  if (!email) return false;
  try {
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    return adminEmails.includes(email.trim());
  } catch (error) {
    console.error('检查管理员邮箱失败:', error);
    return false;
  }
}

// 验证管理员权限
async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  try {
    // 检查Cookie
    const cookieHeader = request.headers.get('cookie') || '';
    if (cookieHeader.includes('admin_key_verified=true')) {
      return true;
    }
    
    // 检查Authorization头
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user?.email) {
        return await isAdminEmail(user.email);
      }
    }
    
    return false;
  } catch (error) {
    console.error('管理员验证失败:', error);
    return false;
  }
}

// PATCH - 更新反馈
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const feedbackId = params.id;
    console.log(`🎯 更新反馈 #${feedbackId}`);
    
    // 验证管理员权限
    const isAdmin = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: '非管理员账号' },
        { status: 403 }
      );
    }
    
    // 解析请求体
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
    const isAdmin = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: '非管理员账号' },
        { status: 403 }
      );
    }
    
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