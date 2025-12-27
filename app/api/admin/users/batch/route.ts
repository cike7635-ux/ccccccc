// /app/api/admin/users/batch/route.ts - 简化修复版
import { NextRequest, NextResponse } from 'next/server'

// 简化：直接创建 Supabase 客户端
function createAdminClient() {
  const { createClient } = require('@supabase/supabase-js')
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 环境变量')
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量')
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userIds, action, reason } = body
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '请选择要操作的用户' },
        { status: 400 }
      )
    }
    
    const supabaseAdmin = createAdminClient()
    let affectedCount = 0
    
    if (action === 'delete') {
      // 批量软删除
      const { error, count } = await supabaseAdmin
        .from('profiles')
        .update({
          email: `deleted_${Date.now()}_${userIds.length}_users@example.com`,
          nickname: '已删除用户',
          avatar_url: null,
          full_name: null,
          bio: null,
          last_login_session: null,
          access_key_id: null,
          account_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .in('id', userIds)
        .not('email', 'like', 'deleted_%')
      
      if (error) {
        throw error
      }
      
      affectedCount = count || 0
      
    } else if (action === 'disable' || action === 'enable') {
      // 批量启用/禁用
      const newExpiry = action === 'disable' 
        ? new Date().toISOString() // 立即过期
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30天后
      
      const { error, count } = await supabaseAdmin
        .from('profiles')
        .update({
          account_expires_at: newExpiry,
          updated_at: new Date().toISOString()
        })
        .in('id', userIds)
      
      if (error) {
        throw error
      }
      
      affectedCount = count || 0
    }
    
    // 记录操作日志
    await supabaseAdmin
      .from('key_usage_history')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        access_key_id: null,
        operation_by: null,
        usage_type: 'admin_batch',
        notes: `批量${action} ${affectedCount} 个用户，原因: ${reason}`
      })
    
    return NextResponse.json({
      success: true,
      data: {
        affectedCount,
        action,
        userIds
      }
    })
    
  } catch (error) {
    console.error('批量操作失败:', error)
    return NextResponse.json(
      { success: false, error: '批量操作失败' },
      { status: 500 }
    )
  }
}