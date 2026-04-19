import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

export async function GET(request: NextRequest) {
  try {
    console.log('🔑 [简单版] 获取密钥列表...')

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    // 验证环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: false,
        error: '环境变量未配置'
      }, { status: 500 })
    }

    const supabaseAdmin = createAdminClient()

    // 1. 查询所有密钥（简单查询，无关联）
    console.log('📊 查询access_keys表...')
    const { data: keys, error: keysError } = await supabaseAdmin
      .from('access_keys')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50) // 先限制50条，快速测试

    if (keysError) {
      console.error('❌ 查询密钥失败:', keysError)
      return NextResponse.json({
        success: false,
        error: `查询失败: ${keysError.message}`
      }, { status: 500 })
    }

    console.log(`✅ 查询到 ${keys?.length || 0} 条密钥`)

    // 2. 获取所有用户信息
    const userIds = keys
      ?.map(k => k.user_id)
      .filter((id): id is string => id !== null && id !== undefined) || []

    let users: Record<string, any> = {}
    if (userIds.length > 0) {
      console.log(`👥 查询 ${userIds.length} 个用户信息...`)
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, nickname')
        .in('id', userIds)
      
      if (usersError) {
        console.error('⚠️ 查询用户失败（继续处理）:', usersError)
      } else if (usersData) {
        usersData.forEach(user => {
          users[user.id] = user
        })
        console.log(`✅ 查询到 ${usersData.length} 个用户`)
      }
    }

    // 3. 获取使用统计
    const keyIds = keys?.map(k => k.id) || []
    let usageStats: Record<number, number> = {}
    
    if (keyIds.length > 0) {
      console.log(`📈 查询 ${keyIds.length} 个密钥的使用统计...`)
      const { data: stats, error: statsError } = await supabaseAdmin
        .from('key_usage_history')
        .select('access_key_id')
        .in('access_key_id', keyIds)
      
      if (statsError) {
        console.error('⚠️ 查询使用统计失败（继续处理）:', statsError)
      } else if (stats) {
        // 计算每个密钥的使用次数
        stats.forEach(record => {
          const keyId = record.access_key_id
          usageStats[keyId] = (usageStats[keyId] || 0) + 1
        })
        console.log(`✅ 统计到 ${stats.length} 条使用记录`)
      }
    }

    // 4. 处理数据
    const now = new Date()
    const processedKeys = keys?.map(key => {
      const statsCount = usageStats[key.id] || 0
      const isExpired = key.key_expires_at && new Date(key.key_expires_at) < now
      
      // 计算状态
      let status: 'unused' | 'used' | 'expired' | 'disabled' = 'unused'
      if (!key.is_active) {
        status = 'disabled'
      } else if (isExpired) {
        status = 'expired'
      } else if (statsCount > 0 || key.used_at) {
        status = 'used'
      }

      // 获取用户信息
      const currentUser = key.user_id && users[key.user_id] ? {
        email: users[key.user_id].email,
        nickname: users[key.user_id].nickname
      } : null

      // 计算有效期显示
      let durationDisplay = `${key.account_valid_for_days}天`
      if (key.original_duration_hours) {
        if (key.original_duration_hours < 24) {
          durationDisplay = `${key.original_duration_hours}小时`
        } else if (key.original_duration_hours === 24) {
          durationDisplay = '1天'
        } else if (key.original_duration_hours < 24 * 30) {
          durationDisplay = `${Math.round(key.original_duration_hours / 24)}天`
        } else {
          durationDisplay = `${Math.round(key.original_duration_hours / (24 * 30))}个月`
        }
      }

      return {
        // 基础信息
        id: key.id,
        key_code: key.key_code || `ID: ${key.id}`,
        description: key.description,
        
        // 状态信息
        is_active: key.is_active,
        status: status,
        
        // 使用限制
        used_count: key.used_count || 0,
        max_uses: key.max_uses,
        usage_count: statsCount,
        
        // 时间信息
        account_valid_for_days: key.account_valid_for_days,
        original_duration_hours: key.original_duration_hours,
        duration_display: durationDisplay,
        duration_unit: key.duration_unit || 'days',
        key_expires_at: key.key_expires_at,
        created_at: key.created_at,
        updated_at: key.updated_at,
        used_at: key.used_at,
        last_used_at: key.used_at, // 暂时用used_at
        
        // 关联信息
        user_id: key.user_id,
        current_user: currentUser
      }
    }) || []

    console.log(`🎉 处理完成，返回 ${processedKeys.length} 条密钥数据`)

    return NextResponse.json({
      success: true,
      data: {
        keys: processedKeys,
        pagination: {
          page: 1,
          limit: 50,
          total: processedKeys.length,
          total_pages: 1,
          has_next: false,
          has_prev: false,
          next_page: null,
          prev_page: null
        },
        filters: {
          applied: {},
          available_counts: {
            total: processedKeys.length,
            unused: processedKeys.filter(k => k.status === 'unused').length,
            used: processedKeys.filter(k => k.status === 'used').length,
            expired: processedKeys.filter(k => k.status === 'expired').length,
            disabled: processedKeys.filter(k => k.status === 'disabled').length
          }
        }
      },
      timestamp: new Date().toISOString(),
      message: '简单版本数据，用于测试'
    })

  } catch (error: any) {
    console.error('💥 获取密钥列表异常:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '服务器内部错误'
    }, { status: 500 })
  }
}