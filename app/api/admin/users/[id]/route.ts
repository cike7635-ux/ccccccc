// /app/api/admin/users/[id]/route.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
    const supabaseAdmin = createAdminClient()
    
    // 1. 先检查用户是否存在
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }
    
    // 2. 软删除用户（标记为已删除）
    const { error: deleteError } = await supabaseAdmin
      .from('profiles')
      .update({
        email: `deleted_${Date.now()}_${user.email}`,
        nickname: '已删除用户',
        avatar_url: null,
        full_name: null,
        bio: null,
        last_login_session: null,
        access_key_id: null,
        account_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
    
    if (deleteError) {
      console.error('删除用户失败:', deleteError)
      return NextResponse.json(
        { success: false, error: '删除用户失败' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: '用户已标记为删除',
      data: { userId }
    })
    
  } catch (error) {
    console.error('删除用户异常:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
    const supabaseAdmin = createAdminClient()
    
    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        access_keys (*),
        ai_usage_records (*),
        key_usage_history (*)
      `)
      .eq('id', userId)
      .single()
    
    if (error || !user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: user
    })
    
  } catch (error) {
    console.error('获取用户详情异常:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}