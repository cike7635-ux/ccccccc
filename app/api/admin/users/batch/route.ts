// /app/api/admin/users/batch/route.ts - 优化版，支持批量删除
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

export async function POST(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const supabaseAdmin = createAdminClient();
    const body = await request.json()
    const { userIds, action, reason } = body
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '请选择要操作的用户' },
        { status: 400 }
      )
    }
    let affectedCount = 0
    
    if (action === 'delete') {
      // 🔥 优化：批量软删除，为每个用户生成唯一的删除标记
      const timestamp = Date.now()
      
      // 先获取这些用户的邮箱，用于生成唯一的删除标记
      const { data: users, error: fetchError } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
        .not('email', 'like', 'deleted_%')
      
      if (fetchError) {
        console.error('获取用户信息失败:', fetchError)
        throw fetchError
      }
      
      // 为每个用户单独更新，确保唯一性
      for (const user of users) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            email: `deleted_${timestamp}_${user.id.substring(0, 8)}_${user.email}`,
            nickname: '已删除用户',
            avatar_url: null,
            full_name: null,
            bio: null,
            last_login_session: null,
            access_key_id: null,
            account_expires_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
        
        if (updateError) {
          console.error(`删除用户 ${user.id} 失败:`, updateError)
          continue // 跳过这个用户，继续处理下一个
        }
        
        affectedCount++
      }
      
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
    
    // 🔥 记录操作日志
    if (affectedCount > 0) {
      await supabaseAdmin
        .from('key_usage_history')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          access_key_id: null,
          operation_by: null,
          usage_type: 'admin_batch',
          notes: `批量${action} ${affectedCount} 个用户，原因: ${reason || '管理员操作'}`
        })
    }
    
    return NextResponse.json({
      success: true,
      data: {
        affectedCount,
        action,
        totalSelected: userIds.length,
        message: `成功${action}了 ${affectedCount} 个用户`
      }
    })
    
  } catch (error) {
    console.error('批量操作失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '批量操作失败',
        details: process.env.NODE_ENV === 'development' ? (error as any).message : undefined
      },
      { status: 500 }
    )
  }
}