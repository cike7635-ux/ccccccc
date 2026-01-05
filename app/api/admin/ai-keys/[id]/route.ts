import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 获取单个密钥详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const keyId = parseInt(id);

    if (isNaN(keyId) || keyId <= 0) {
      return NextResponse.json(
        { success: false, error: '无效的密钥ID' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: key, error } = await supabase
      .from('ai_boost_keys')
      .select(`
        *,
        creator:created_by (nickname, email, avatar_url),
        user:used_by_user_id (nickname, email, avatar_url)
      `)
      .eq('id', keyId)
      .single();

    if (error || !key) {
      console.error('查询密钥详情错误:', error);
      return NextResponse.json(
        { success: false, error: '密钥不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { key }
    });

  } catch (error: any) {
    console.error('获取密钥详情错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}

// 更新密钥
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const keyId = parseInt(id);
    
    if (isNaN(keyId) || keyId <= 0) {
      return NextResponse.json(
        { success: false, error: '无效的密钥ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { is_active, description, max_uses, price } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const updates: any = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (description !== undefined) updates.description = description;
    if (max_uses !== undefined) updates.max_uses = max_uses;
    if (price !== undefined) updates.price = price;
    
    updates.updated_at = new Date().toISOString();

    const { data: updatedKey, error } = await supabase
      .from('ai_boost_keys')
      .update(updates)
      .eq('id', keyId)
      .select()
      .single();

    if (error) {
      console.error('更新密钥错误:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: { key: updatedKey },
      message: '密钥已更新'
    });

  } catch (error: any) {
    console.error('更新密钥错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}

// 删除密钥
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const keyId = parseInt(id);

    if (isNaN(keyId) || keyId <= 0) {
      return NextResponse.json(
        { success: false, error: '无效的密钥ID' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // 先检查密钥是否已使用
    const { data: key } = await supabase
      .from('ai_boost_keys')
      .select('used_count')
      .eq('id', keyId)
      .single();

    if (key?.used_count > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '该密钥已被使用，无法删除。建议禁用该密钥。'
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('ai_boost_keys')
      .delete()
      .eq('id', keyId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '密钥已删除',
      data: { id: keyId }
    });

  } catch (error: any) {
    console.error('删除密钥错误:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器错误' },
      { status: 500 }
    );
  }
}