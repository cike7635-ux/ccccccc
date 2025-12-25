// /app/api/admin/keys/list/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔑 获取密钥列表...')
    
    // 验证管理员权限
    const authMethods = {
      cookie: request.cookies.get('admin_key_verified')?.value,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent')
    }

    const isAuthenticated = authMethods.cookie || 
      (authMethods.referer?.includes('/admin/') && authMethods.userAgent)

    if (!isAuthenticated) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 })
    }

    // 验证环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ success: false, error: '环境变量未配置' }, { status: 500 })
    }

    // 创建Supabase管理员客户端
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // 使用嵌套查询（现在数据库有外键了，应该可以工作）
    const { data: keys, error } = await supabaseAdmin
      .from('access_keys')
      .select(`
        *,
        profiles:user_id (
          email,
          nickname
        ),
        key_usage_history (
          id,
          user_id,
          used_at
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('❌ 查询失败:', error)
      
      // 如果嵌套查询失败，回退到分步查询
      console.log('⚠️ 尝试回退到分步查询...')
      return await getKeysWithFallback(supabaseAdmin)
    }

    console.log(`✅ 查询成功，找到 ${keys?.length || 0} 条密钥记录`)
    
    // 处理数据，计算使用次数
    const processedKeys = keys?.map(key => {
      // 统计使用次数
      const usageCount = Array.isArray(key.key_usage_history) ? key.key_usage_history.length : 0
      
      return {
        // 基础信息
        id: key.id,
        key_code: key.key_code,
        description: key.description,
        
        // 时间信息
        account_valid_for_days: key.account_valid_for_days,
        original_duration_hours: key.original_duration_hours,
        key_expires_at: key.key_expires_at,
        created_at: key.created_at,
        updated_at: key.updated_at,
        
        // 状态信息
        is_active: key.is_active,
        used_at: key.used_at,
        user_id: key.user_id,
        
        // 使用限制
        max_uses: key.max_uses,
        used_count: usageCount, // 使用key_usage_history统计
        
        // 用户信息
        user: key.profiles ? {
          email: key.profiles.email,
          nickname: key.profiles.nickname
        } : null
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
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

// 备用方案：分步查询
async function getKeysWithFallback(supabaseAdmin: any) {
  try {
    console.log('🔄 使用分步查询回退方案...')
    
    // 第一步：获取所有密钥
    const { data: keys, error: keysError } = await supabaseAdmin
      .from('access_keys')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (keysError) {
      throw keysError
    }

    if (!keys || keys.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        timestamp: new Date().toISOString()
      })
    }

    // 第二步：获取关联的用户信息
    const userIds = keys
      .map(key => key.user_id)
      .filter((id): id is string => id !== null)
      .filter((id, index, array) => array.indexOf(id) === index)

    let usersMap = new Map()
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('profiles')
        .select('id, email, nickname')
        .in('id', userIds)

      if (users) {
        users.forEach(user => {
          usersMap.set(user.id, {
            email: user.email,
            nickname: user.nickname
          })
        })
      }
    }

    // 第三步：统计使用次数
    const keyIds = keys.map(key => key.id)
    let usageCountMap = new Map()
    
    if (keyIds.length > 0) {
      const { data: usageRecords } = await supabaseAdmin
        .from('key_usage_history')
        .select('access_key_id')
        .in('access_key_id', keyIds)

      if (usageRecords) {
        usageRecords.forEach(record => {
          const keyId = record.access_key_id
          usageCountMap.set(keyId, (usageCountMap.get(keyId) || 0) + 1)
        })
      }
    }

    // 第四步：处理数据
    const processedKeys = keys.map(key => {
      const userInfo = key.user_id ? usersMap.get(key.user_id) : null
      const usageCount = usageCountMap.get(key.id) || 0

      return {
        id: key.id,
        key_code: key.key_code,
        description: key.description,
        account_valid_for_days: key.account_valid_for_days,
        original_duration_hours: key.original_duration_hours,
        key_expires_at: key.key_expires_at,
        created_at: key.created_at,
        updated_at: key.updated_at,
        is_active: key.is_active,
        used_at: key.used_at,
        user_id: key.user_id,
        max_uses: key.max_uses,
        used_count: usageCount,
        user: userInfo
      }
    })

    console.log(`✅ 回退方案成功，处理了 ${processedKeys.length} 条密钥`)

    return NextResponse.json({
      success: true,
      data: processedKeys,
      count: processedKeys.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (fallbackError: any) {
    console.error('❌ 回退方案也失败了:', fallbackError)
    return NextResponse.json(
      { success: false, error: '查询失败: ' + fallbackError.message },
      { status: 500 }
    )
  }
}