import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// 获取密钥列表（增强版，支持多用户显示）
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 开始获取密钥列表（增强版）')
    
    // 验证管理员权限
    const authMethods = {
      cookie: request.cookies.get('admin_key_verified')?.value,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent')
    }

    const isAuthenticated = authMethods.cookie || 
      (authMethods.referer?.includes('/admin/') && authMethods.userAgent)

    if (!isAuthenticated) {
      console.log('❌ 未授权访问')
      return NextResponse.json({ 
        success: false, 
        error: '未授权访问，请先登录管理后台' 
      }, { status: 401 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { 
        auth: { persistSession: false },
        db: { schema: 'public' }
      }
    )

    // 1. 获取所有密钥的基础信息
    console.log('📦 查询access_keys表...')
    const { data: keys, error: keysError } = await supabaseAdmin
      .from('access_keys')
      .select(`
        id,
        key_code,
        description,
        is_active,
        used_count,
        max_uses,
        key_expires_at,
        account_valid_for_days,
        user_id,
        used_at,
        created_at,
        updated_at,
        original_duration_hours,
        duration_unit
      `)
      .order('created_at', { ascending: false })

    if (keysError) {
      console.error('❌ 查询密钥失败:', keysError)
      throw new Error(`查询密钥失败: ${keysError.message}`)
    }

    if (!keys || keys.length === 0) {
      console.log('ℹ️ 未找到密钥数据')
      return NextResponse.json({
        success: true,
        data: [],
        message: '数据库中暂无密钥'
      })
    }

    console.log(`✅ 获取到 ${keys.length} 条密钥数据`)

    // 2. 批量获取所有密钥的使用记录（优化性能）
    const keyIds = keys.map(key => key.id)
    console.log(`📊 查询 ${keyIds.length} 个密钥的使用记录...`)

    // 查询所有使用记录，按密钥ID和更新时间分组
    const { data: allUsageHistory, error: usageError } = await supabaseAdmin
      .from('key_usage_history')
      .select(`
        id,
        user_id,
        access_key_id,
        used_at,
        usage_type,
        profiles:user_id (
          email,
          nickname
        )
      `)
      .in('access_key_id', keyIds)
      .order('used_at', { ascending: false })

    if (usageError) {
      console.error('❌ 查询使用记录失败:', usageError)
      // 不抛出错误，继续处理，但记录警告
      console.warn('⚠️ 无法获取使用记录，将继续处理基础数据')
    }

    // 3. 处理数据：为每个密钥添加使用者信息
    console.log('🔄 处理密钥数据...')
    const processedKeys = await Promise.all(
      keys.map(async (key) => {
        try {
          // 过滤出当前密钥的使用记录
          const keyUsageHistory = allUsageHistory?.filter(
            record => record.access_key_id === key.id
          ) || []

          // 去重：同一个用户可能多次使用同一个密钥
          const uniqueUserMap = new Map()
          keyUsageHistory.forEach(record => {
            if (record.user_id && record.profiles) {
              uniqueUserMap.set(record.user_id, {
                email: record.profiles.email || `用户ID: ${record.user_id}`,
                nickname: record.profiles.nickname,
                user_id: record.user_id,
                last_used: record.used_at
              })
            }
          })

          const uniqueUsers = Array.from(uniqueUserMap.values())
          
          // 获取最近的两个用户（按最后使用时间排序）
          const recentUsers = uniqueUsers
            .sort((a, b) => new Date(b.last_used).getTime() - new Date(a.last_used).getTime())
            .slice(0, 2)
            .map(user => ({
              email: user.email,
              nickname: user.nickname,
              user_id: user.user_id
            }))

          // 获取当前使用者信息（如果存在）
          let currentUser = null
          if (key.user_id) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('email, nickname')
              .eq('id', key.user_id)
              .single()
            
            if (profile) {
              currentUser = {
                email: profile.email,
                nickname: profile.nickname
              }
            }
          }

          // 计算密钥状态
          const now = new Date()
          let keyStatus = 'unknown'
          
          if (!key.is_active) {
            keyStatus = 'disabled'
          } else if (key.key_expires_at && new Date(key.key_expires_at) < now) {
            keyStatus = 'expired'
          } else if (key.used_at || key.user_id) {
            keyStatus = 'used'
          } else {
            keyStatus = 'unused'
          }

          // 计算剩余时间
          let remainingTime = { text: '未知', color: 'text-gray-400', isExpired: false }
          if (key.key_expires_at) {
            const expiry = new Date(key.key_expires_at)
            const diffMs = expiry.getTime() - now.getTime()
            
            if (diffMs <= 0) {
              remainingTime = { text: '已过期', color: 'text-red-400', isExpired: true }
            } else {
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
              if (diffDays > 30) {
                const months = Math.floor(diffDays / 30)
                remainingTime = { text: `${months}个月后过期`, color: 'text-green-400', isExpired: false }
              } else if (diffDays > 7) {
                remainingTime = { text: `${diffDays}天后过期`, color: 'text-blue-400', isExpired: false }
              } else if (diffDays > 1) {
                remainingTime = { text: `${diffDays}天后过期`, color: 'text-amber-400', isExpired: false }
              } else {
                const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
                remainingTime = { text: `${diffHours}小时后过期`, color: 'text-red-400', isExpired: false }
              }
            }
          }

          // 计算时长显示
          let durationDisplay = '永不过期'
          if (key.original_duration_hours) {
            const hours = parseFloat(key.original_duration_hours.toString())
            if (hours < 24) {
              durationDisplay = `${hours}小时`
            } else if (hours < 24 * 30) {
              const days = Math.round(hours / 24)
              durationDisplay = `${days}天`
            } else {
              const months = Math.round(hours / (24 * 30))
              durationDisplay = `${months}个月`
            }
          } else if (key.account_valid_for_days) {
            if (key.account_valid_for_days < 30) {
              durationDisplay = `${key.account_valid_for_days}天`
            } else {
              const months = Math.round(key.account_valid_for_days / 30)
              durationDisplay = `${months}个月`
            }
          }

          // 返回处理后的密钥数据
          return {
            ...key,
            // 基础字段
            key_status: keyStatus,
            remaining_time: remainingTime,
            duration_display: durationDisplay,
            created_at_formatted: key.created_at ? new Date(key.created_at).toLocaleString('zh-CN') : '',
            
            // 使用者信息
            profiles: currentUser, // 当前使用者（单个对象，保持兼容）
            recent_users: recentUsers, // 最近的两个使用者（数组）
            total_users: uniqueUsers.length, // 总使用者数量
            
            // 统计信息
            usage_count: keyUsageHistory.length,
            last_used_at: keyUsageHistory.length > 0 ? keyUsageHistory[0].used_at : null,
            first_used_at: keyUsageHistory.length > 0 ? keyUsageHistory[keyUsageHistory.length - 1].used_at : null
          }
        } catch (error) {
          console.error(`❌ 处理密钥 ${key.id} 时出错:`, error)
          // 返回基础数据（没有使用者信息）
          return {
            ...key,
            key_status: 'unknown',
            remaining_time: { text: '未知', color: 'text-gray-400', isExpired: false },
            duration_display: '未知',
            profiles: null,
            recent_users: [],
            total_users: 0,
            usage_count: 0
          }
        }
      })
    )

    console.log(`✅ 成功处理 ${processedKeys.length} 个密钥`)

    // 4. 应用筛选和排序（如果需要的话）
    // 这里可以根据请求参数进行筛选和排序，但为了简化，返回所有数据
    // 前端可以进行筛选和排序

    return NextResponse.json({
      success: true,
      data: processedKeys,
      meta: {
        total: processedKeys.length,
        timestamp: new Date().toISOString(),
        has_usage_data: !!allUsageHistory
      }
    })

  } catch (error: any) {
    console.error('❌ 获取密钥列表失败:', error)
    
    // 尝试返回基本数据（不包含使用者信息）
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )
      
      const { data: basicKeys } = await supabaseAdmin
        .from('access_keys')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      
      return NextResponse.json({
        success: true,
        data: basicKeys?.map(key => ({
          ...key,
          recent_users: [],
          total_users: 0
        })) || [],
        meta: {
          total: basicKeys?.length || 0,
          timestamp: new Date().toISOString(),
          has_usage_data: false,
          error: '获取使用记录失败，只返回基础数据'
        },
        warning: '无法获取完整的使用者信息，只显示基础数据'
      })
    } catch (fallbackError) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message || '获取密钥数据失败',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        { status: 500 }
      )
    }
  }
}