import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // 1. 验证管理员权限
    const adminKeyVerified = request.cookies.get('admin_key_verified')
    const referer = request.headers.get('referer')
    const isFromAdminPage = referer?.includes('/admin/')
    
    const isAuthenticated = adminKeyVerified || isFromAdminPage
    
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    // 2. 解析请求体
    const { userIds, action = 'disable', reason = '' } = await request.json()
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '请选择要操作的用户' },
        { status: 400 }
      )
    }

    // 3. 创建Supabase客户端（使用Service Role Key）
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    )

    let result
    let actionDescription = ''

    if (action === 'disable') {
      // 批量禁用用户：将account_expires_at设置为过去的时间
      result = await supabaseAdmin
        .from('profiles')
        .update({ 
          account_expires_at: new Date('2000-01-01').toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', userIds)

      actionDescription = '禁用'
    } else if (action === 'enable') {
      // 批量启用用户：将account_expires_at设置为未来时间
      result = await supabaseAdmin
        .from('profiles')
        .update({ 
          account_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', userIds)

      actionDescription = '启用'
    } else if (action === 'delete') {
      // 批量软删除：在数据库中标记为删除
      result = await supabaseAdmin
        .from('profiles')
        .update({ 
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', userIds)

      actionDescription = '删除'
    } else {
      return NextResponse.json(
        { success: false, error: '不支持的操作类型' },
        { status: 400 }
      )
    }

    if (result.error) {
      console.error('批量操作失败:', result.error)
      return NextResponse.json(
        { success: false, error: '数据库操作失败: ' + result.error.message },
        { status: 500 }
      )
    }

    // 4. 记录操作日志
    console.log(`[ADMIN ACTION] ${actionDescription}了 ${userIds.length} 个用户:`, {
      userIds,
      reason,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      data: {
        action,
        affectedCount: result.count || userIds.length,
        message: `成功${actionDescription}了 ${userIds.length} 个用户`
      }
    })

  } catch (error: any) {
    console.error('批量操作异常:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '服务器内部错误',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
