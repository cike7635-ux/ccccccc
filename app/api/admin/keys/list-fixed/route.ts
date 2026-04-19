import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

type KeyStatus = 'unused' | 'used' | 'expired' | 'disabled'

export async function GET(request: NextRequest) {
  try {
    console.log('🔑 获取密钥列表（修复版）...')

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      )
    }

    const supabaseAdmin = createAdminClient()

    // 1. 查询所有密钥（简单查询，无关联）
    const { data: keys, error } = await supabaseAdmin
      .from('access_keys')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ 查询密钥失败:', error)
      return NextResponse.json({
        success: false,
        error: `查询失败: ${error.message}`
      }, { status: 500 })
    }

    console.log(`📊 查询到 ${keys?.length || 0} 条密钥`)

    // 2. 获取用户信息
    const userIds = keys
      ?.map(k => k.user_id)
      .filter((id): id is string => id !== null && id !== undefined) || []

    let users: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('profiles')
        .select('id, email, nickname')
        .in('id', userIds)
      
      if (usersData) {
        usersData.forEach(user => {
          users[user.id] = user
        })
        console.log(`👥 查询到 ${usersData.length} 个用户`)
      }
    }

    // 3. 处理数据
    const now = new Date()
    const processedKeys = keys?.map(key => {
      // 获取用户信息
      const currentUser = key.user_id && users[key.user_id] ? {
        email: users[key.user_id].email,
        nickname: users[key.user_id].nickname
      } : null

      // 计算状态（简化版）
      let status: KeyStatus = 'unused'
      if (!key.is_active) {
        status = 'disabled'
      } else if (key.key_expires_at && new Date(key.key_expires_at) < now) {
        status = 'expired'
      } else if (key.used_at) {
        status = 'used'
      }

      return {
        id: key.id,
        key_code: key.key_code,
        description: key.description,
        is_active: key.is_active,
        used_count: key.used_count || 0,
        max_uses: key.max_uses,
        key_expires_at: key.key_expires_at,
        account_valid_for_days: key.account_valid_for_days,
        original_duration_hours: key.original_duration_hours,
        duration_unit: key.duration_unit,
        user_id: key.user_id,
        used_at: key.used_at,
        created_at: key.created_at,
        updated_at: key.updated_at,
        status: status,
        usage_count: key.used_count || 0,
        last_used_at: key.used_at,
        current_user: currentUser
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: processedKeys,
      count: processedKeys.length,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('💥 获取密钥列表异常:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
}