// /app/api/admin/users/batch/route.ts
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

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
          email: supabaseAdmin.raw(`
            CASE 
              WHEN email LIKE 'deleted_%' THEN email
              ELSE CONCAT('deleted_', EXTRACT(EPOCH FROM NOW()), '_', email)
            END
          `),
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
      // 批量启用/禁用（示例逻辑，根据你的实际需求调整）
      const { error, count } = await supabaseAdmin
        .from('profiles')
        .update({
          updated_at: new Date().toISOString(),
          account_expires_at: action === 'disable' 
            ? new Date().toISOString() // 立即过期
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30天后过期
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
        user_id: '00000000-0000-0000-0000-000000000000', // 系统操作
        access_key_id: null,
        operation_by: null, // 管理员操作，具体ID可以从请求中获取
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