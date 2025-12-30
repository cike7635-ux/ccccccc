import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const keyId = params.id;
    const body = await request.json();
    
    const { 
      original_duration_hours, 
      account_valid_for_days, 
      key_expires_at,
      max_uses,
      description 
    } = body;

    // 验证管理员权限
    const authMethods = {
      cookie: request.cookies.get('admin_key_verified')?.value,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent')
    };

    const isAuthenticated = authMethods.cookie || 
      (authMethods.referer?.includes('/admin/') && authMethods.userAgent);

    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 构建更新数据
    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (original_duration_hours !== undefined) {
      updateData.original_duration_hours = original_duration_hours;
      // 如果是小时级别，设置duration_unit
      if (original_duration_hours < 24) {
        updateData.duration_unit = 'hours';
      } else {
        updateData.duration_unit = 'days';
      }
    }
    
    if (account_valid_for_days !== undefined) {
      updateData.account_valid_for_days = account_valid_for_days;
    }
    
    if (key_expires_at !== undefined) {
      updateData.key_expires_at = key_expires_at;
    }
    
    if (max_uses !== undefined) {
      updateData.max_uses = max_uses;
    }
    
    if (description !== undefined) {
      updateData.description = description;
    }

    // 更新密钥
    const { data, error } = await supabaseAdmin
      .from('access_keys')
      .update(updateData)
      .eq('id', keyId)
      .select()
      .single();

    if (error) {
      throw new Error(`更新失败: ${error.message}`);
    }

    // 记录操作日志
    await supabaseAdmin
      .from('admin_operation_logs')
      .insert({
        action: 'update_duration',
        key_code: data.key_code,
        details: JSON.stringify(updateData),
        created_at: new Date().toISOString(),
        created_by: 'admin'
      });

    return NextResponse.json({
      success: true,
      data,
      message: '密钥期限已更新'
    });

  } catch (error: any) {
    console.error('更新密钥期限失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '更新失败' },
      { status: 500 }
    );
  }
}