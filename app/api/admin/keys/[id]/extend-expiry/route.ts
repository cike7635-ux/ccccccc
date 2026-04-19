import { NextRequest, NextResponse } from 'next/server';
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const keyId = params.id;
    const body = await request.json();
    const { days, hours, reason } = body;

    if ((!days && !hours) || (days && hours)) {
      return NextResponse.json(
        { success: false, error: '请指定延长的天数或小时数' },
        { status: 400 }
      );
    }

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const supabaseAdmin = createAdminClient();

    // 获取当前密钥信息
    const { data: key, error: keyError } = await supabaseAdmin
      .from('access_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (keyError) {
      throw new Error(`密钥不存在: ${keyError.message}`);
    }

    // 计算新的过期时间
    const now = new Date();
    const currentExpiry = key.key_expires_at ? new Date(key.key_expires_at) : now;
    
    let newExpiry = new Date(currentExpiry);
    if (days) {
      newExpiry.setDate(newExpiry.getDate() + days);
    } else if (hours) {
      newExpiry.setHours(newExpiry.getHours() + hours);
    }

    // 更新过期时间
    const { data, error } = await supabaseAdmin
      .from('access_keys')
      .update({
        key_expires_at: newExpiry.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', keyId)
      .select()
      .single();

    if (error) {
      throw new Error(`延长有效期失败: ${error.message}`);
    }

    // 记录操作日志
    await supabaseAdmin
      .from('admin_operation_logs')
      .insert({
        action: 'extend_expiry',
        key_code: key.key_code,
        details: JSON.stringify({
          previous_expiry: key.key_expires_at,
          new_expiry: newExpiry.toISOString(),
          extended_by: days ? `${days}天` : `${hours}小时`,
          reason: reason || ''
        }),
        created_at: now.toISOString(),
        created_by: 'admin'
      });

    return NextResponse.json({
      success: true,
      data,
      message: `密钥有效期已延长${days ? `${days}天` : `${hours}小时`}`
    });

  } catch (error: any) {
    console.error('延长密钥有效期失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '延长失败' },
      { status: 500 }
    );
  }
}