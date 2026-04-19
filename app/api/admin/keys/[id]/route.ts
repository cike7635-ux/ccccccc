// /app/api/admin/keys/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

// 获取密钥详情（增强版）
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const keyId = parseInt(context.params.id)
    if (!keyId || isNaN(keyId)) {
      return NextResponse.json({
        success: false,
        error: '无效的密钥ID'
      }, { status: 400 })
    }

    console.log(`🔍 获取密钥详情 ID: ${keyId} (增强版)`)

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      console.log('❌ 未授权访问')
      return NextResponse.json({
        success: false,
        error: validation.error
      }, { status: validation.status })
    }

    const supabaseAdmin = createAdminClient()

    // 1. 获取密钥详情
    console.log('📦 查询密钥基本信息...')
    const { data: keyData, error: keyError } = await supabaseAdmin
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
        duration_unit,
        profiles:user_id (
          id,
          email,
          nickname,
          avatar_url,
          last_login_at
        )
      `)
      .eq('id', keyId)
      .single()

    if (keyError) {
      console.error('❌ 查询密钥失败:', keyError)
      if (keyError.code === 'PGRST116') {
        return NextResponse.json({ 
          success: false, 
          error: '密钥不存在' 
        }, { status: 404 })
      }
      throw new Error(`查询密钥失败: ${keyError.message}`)
    }

    // 2. 获取所有使用历史记录
    console.log('📊 查询使用历史记录...')
    const { data: usageHistory, error: usageError } = await supabaseAdmin
      .from('key_usage_history')
      .select(`
        id,
        user_id,
        access_key_id,
        used_at,
        usage_type,
        notes,
        created_at,
        updated_at,
        profiles:user_id (
          id,
          email,
          nickname,
          avatar_url
        )
      `)
      .eq('access_key_id', keyId)
      .order('used_at', { ascending: false })

    if (usageError) {
      console.error('❌ 查询使用历史失败:', usageError)
      // 不抛出错误，但记录警告
      console.warn('⚠️ 无法获取使用历史记录')
    }

    // 3. 获取所有使用者（去重）
    console.log('👥 分析所有使用者...')
    const uniqueUserMap = new Map()
    const usageByType = {
      activate: 0,
      renew: 0,
      transfer: 0,
      admin_extend: 0,
      other: 0
    }

    usageHistory?.forEach(record => {
      // 统计使用类型
      const type = record.usage_type || 'other'
      if (usageByType.hasOwnProperty(type)) {
        usageByType[type as keyof typeof usageByType]++
      } else {
        usageByType.other++
      }

      // 收集用户信息
      if (record.user_id && record.profiles) {
        if (!uniqueUserMap.has(record.user_id)) {
          uniqueUserMap.set(record.user_id, {
            user_id: record.user_id,
            email: record.profiles.email || `用户ID: ${record.user_id}`,
            nickname: record.profiles.nickname,
            avatar_url: record.profiles.avatar_url,
            first_used: record.used_at,
            last_used: record.used_at,
            usage_count: 1
          })
        } else {
          const existing = uniqueUserMap.get(record.user_id)
          // 更新最后使用时间和使用次数
          if (existing) {
            existing.usage_count++
            if (new Date(record.used_at) > new Date(existing.last_used)) {
              existing.last_used = record.used_at
            }
          }
        }
      }
    })

    const allUsers = Array.from(uniqueUserMap.values())
      .sort((a, b) => new Date(b.last_used).getTime() - new Date(a.last_used).getTime())

    // 4. 计算统计信息
    console.log('📈 计算统计信息...')
    const statistics = {
      total_uses: usageHistory?.length || 0,
      unique_users: allUsers.length,
      usage_by_type: usageByType,
      first_use: usageHistory && usageHistory.length > 0 
        ? usageHistory[usageHistory.length - 1].used_at 
        : null,
      last_use: usageHistory && usageHistory.length > 0 
        ? usageHistory[0].used_at 
        : null,
      average_use_interval: null as string | null,
      usage_trend: 'stable' as 'increasing' | 'decreasing' | 'stable'
    }

    // 计算平均使用间隔（如果有多次使用）
    if (usageHistory && usageHistory.length >= 2) {
      const firstUse = new Date(usageHistory[usageHistory.length - 1].used_at).getTime()
      const lastUse = new Date(usageHistory[0].used_at).getTime()
      const totalInterval = lastUse - firstUse
      const averageIntervalMs = totalInterval / (usageHistory.length - 1)
      
      const days = Math.floor(averageIntervalMs / (1000 * 60 * 60 * 24))
      const hours = Math.floor((averageIntervalMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      
      if (days > 0) {
        statistics.average_use_interval = `${days}天${hours}小时`
      } else {
        statistics.average_use_interval = `${hours}小时`
      }

      // 判断使用趋势（最近7天的使用次数 vs 之前7天）
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      
      const recentUsage = usageHistory.filter(r => 
        new Date(r.used_at) >= weekAgo
      ).length
      
      const previousUsage = usageHistory.filter(r => 
        new Date(r.used_at) >= twoWeeksAgo && new Date(r.used_at) < weekAgo
      ).length
      
      if (recentUsage > previousUsage) {
        statistics.usage_trend = 'increasing'
      } else if (recentUsage < previousUsage) {
        statistics.usage_trend = 'decreasing'
      }
    }

    // 5. 准备返回数据
    const responseData = {
      key_info: {
        ...keyData,
        // 计算状态
        key_status: (() => {
          const now = new Date()
          if (!keyData.is_active) return 'disabled'
          if (keyData.key_expires_at && new Date(keyData.key_expires_at) < now) return 'expired'
          if (keyData.used_at || keyData.user_id) return 'used'
          return 'unused'
        })(),
        // 计算剩余时间
        remaining_time: (() => {
          const now = new Date()
          if (keyData.key_expires_at) {
            const expiry = new Date(keyData.key_expires_at)
            const diffMs = expiry.getTime() - now.getTime()
            
            if (diffMs <= 0) {
              return { text: '已过期', color: 'text-red-400', isExpired: true }
            }
            
            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
            const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
            
            if (diffDays > 30) {
              const months = Math.floor(diffDays / 30)
              return { text: `${months}个月后过期`, color: 'text-green-400', isExpired: false }
            } else if (diffDays > 7) {
              return { text: `${diffDays}天后过期`, color: 'text-blue-400', isExpired: false }
            } else if (diffDays > 1) {
              return { text: `${diffDays}天后过期`, color: 'text-amber-400', isExpired: false }
            } else {
              return { text: `${diffHours}小时后过期`, color: 'text-red-400', isExpired: false }
            }
          }
          return { text: '永不过期', color: 'text-green-400', isExpired: false }
        })(),
        // 计算时长显示
        duration_display: (() => {
          if (keyData.original_duration_hours) {
            const hours = parseFloat(keyData.original_duration_hours.toString())
            if (hours < 24) {
              return `${hours}小时`
            } else if (hours < 24 * 30) {
              const days = Math.round(hours / 24)
              return `${days}天`
            } else {
              const months = Math.round(hours / (24 * 30))
              return `${months}个月`
            }
          }
          if (keyData.account_valid_for_days) {
            if (keyData.account_valid_for_days < 30) {
              return `${keyData.account_valid_for_days}天`
            } else {
              const months = Math.round(keyData.account_valid_for_days / 30)
              return `${months}个月`
            }
          }
          return '永不过期'
        })()
      },
      usage_history: usageHistory || [],
      all_users: allUsers,
      statistics
    }

    console.log(`✅ 密钥详情获取成功: ID ${keyId}, ${allUsers.length} 个使用者`)

    return NextResponse.json({
      success: true,
      data: responseData,
      meta: {
        key_id: keyId,
        timestamp: new Date().toISOString(),
        has_usage_history: !!usageHistory,
        user_count: allUsers.length
      }
    })

  } catch (error: any) {
    console.error('❌ 获取密钥详情失败:', error)
    
    // 尝试返回基础数据
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )
      
      const { data: basicKey } = await supabaseAdmin
        .from('access_keys')
        .select('*')
        .eq('id', parseInt(context.params.id))
        .single()
      
      if (basicKey) {
        return NextResponse.json({
          success: true,
          data: {
            key_info: basicKey,
            usage_history: [],
            all_users: [],
            statistics: {
              total_uses: 0,
              unique_users: 0,
              usage_by_type: {},
              first_use: null,
              last_use: null
            }
          },
          warning: '无法获取完整的使用者信息，只返回基础数据'
        })
      }
    } catch (fallbackError) {
      // 忽略fallback错误
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '获取密钥详情失败',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// 原有的 PUT 和 PATCH 方法保持不变...

// 更新密钥（禁用/启用/删除）
export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const keyId = parseInt(context.params.id)
    if (!keyId || isNaN(keyId)) {
      return NextResponse.json({ success: false, error: '无效的密钥ID' }, { status: 400 })
    }

    console.log(`🔧 操作密钥 ID: ${keyId}`)

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      )
    }

    const supabaseAdmin = createAdminClient()

    // 解析请求数据
    let body
    try {
      body = await request.json()
      console.log('📦 操作请求:', body)
    } catch (error) {
      return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 })
    }

    const { action, reason } = body

    if (!action || !['disable', 'enable', 'delete'].includes(action)) {
      return NextResponse.json({ success: false, error: '不支持的操作类型' }, { status: 400 })
    }

    const now = new Date().toISOString()
    let result

    // 先获取当前密钥信息（用于日志）
    const { data: currentKey } = await supabaseAdmin
      .from('access_keys')
      .select('key_code, is_active')
      .eq('id', keyId)
      .single()

    if (action === 'delete') {
      // 记录删除日志
      if (currentKey) {
        await supabaseAdmin
          .from('admin_operation_logs')
          .insert({
            action: 'delete',
            key_code: currentKey.key_code,
            reason: reason || '单个删除操作',
            created_at: now,
            created_by: 'admin_single'
          })
      }

      // 删除操作
      const { data, error } = await supabaseAdmin
        .from('access_keys')
        .delete()
        .eq('id', keyId)
        .select()
        .single()

      if (error) {
        throw new Error('删除失败: ' + error.message)
      }

      result = data
      
    } else {
      // 启用/禁用操作
      const isActive = action === 'enable'
      
      // 记录状态变更日志
      if (currentKey) {
        await supabaseAdmin
          .from('admin_operation_logs')
          .insert({
            action: isActive ? 'enable' : 'disable',
            key_code: currentKey.key_code,
            previous_state: currentKey.is_active,
            new_state: isActive,
            reason: reason || '状态变更操作',
            created_at: now,
            created_by: 'admin_single'
          })
      }

      const { data, error } = await supabaseAdmin
        .from('access_keys')
        .update({ 
          is_active: isActive,
          updated_at: now
        })
        .eq('id', keyId)
        .select()
        .single()

      if (error) {
        throw new Error(`${isActive ? '启用' : '禁用'}失败: ` + error.message)
      }

      result = data
    }

    console.log(`✅ 密钥 ${action} 操作成功`)

    return NextResponse.json({
      success: true,
      data: result,
      message: `密钥已${action === 'delete' ? '删除' : action === 'enable' ? '启用' : '禁用'}`
    })

  } catch (error: any) {
    console.error('密钥操作异常:', error)
    return NextResponse.json(
      { success: false, error: error.message || '操作失败' },
      { status: 500 }
    )
  }
}

// 更新密钥信息
export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const keyId = parseInt(context.params.id)
    if (!keyId || isNaN(keyId)) {
      return NextResponse.json({ success: false, error: '无效的密钥ID' }, { status: 400 })
    }

    // 验证管理员权限...
    const body = await request.json()
    const { description, max_uses, key_expires_at } = body

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const updates: any = { updated_at: new Date().toISOString() }
    if (description !== undefined) updates.description = description
    if (max_uses !== undefined) updates.max_uses = max_uses
    if (key_expires_at !== undefined) updates.key_expires_at = key_expires_at

    const { data, error } = await supabaseAdmin
      .from('access_keys')
      .update(updates)
      .eq('id', keyId)
      .select()
      .single()

    if (error) {
      throw new Error('更新失败: ' + error.message)
    }

    return NextResponse.json({
      success: true,
      data,
      message: '密钥信息已更新'
    })

  } catch (error: any) {
    console.error('更新密钥失败:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}