// /app/api/admin/users/list/route.ts - 修复版，支持会员到期时间筛选和排序
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

// 从preferences中提取性别显示值
function extractGenderDisplay(preferences: any): string {
  if (!preferences || !preferences.gender) return '未设置'
  
  const gender = String(preferences.gender).toLowerCase()
  
  // 性别映射表
  const genderMap: Record<string, string> = {
    'male': '男', 'm': '男', '男': '男',
    'female': '女', 'f': '女', '女': '女',
    'other': '其他', 'non_binary': '非二元', '非二元': '非二元', '其他': '其他',
    '未设置': '未设置', '': '未设置', 'null': '未设置', 'undefined': '未设置'
  }
  
  return genderMap[gender] || String(preferences.gender)
}

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      console.warn('🚫 未授权访问用户列表API')
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const supabaseAdmin = createAdminClient()
    
    // 获取查询参数
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const filter = searchParams.get('filter') || 'all'
    const sortField = searchParams.get('sortField') || 'created_at'
    const sortDirection = searchParams.get('sortDirection') || 'desc'
    
    console.log('📋 用户列表API参数:', {
      page, limit, search, filter, sortField, sortDirection
    })

    // 🔧 构建基础查询 - 排除已删除用户
    let query = supabaseAdmin
      .from('profiles')
      .select(`
        *,
        current_key:access_keys!profiles_access_key_id_fkey (
          id,
          key_code,
          is_active,
          used_count,
          max_uses,
          key_expires_at,
          account_valid_for_days,
          user_id,
          used_at,
          created_at,
          updated_at
        )
      `, { count: 'exact' })
    
    // 🔧 排除已删除用户：邮箱不以 'deleted_' 开头
    query = query.not('email', 'like', 'deleted_%')
    
    // 搜索条件
    if (search) {
      query = query.or(`email.ilike.%${search}%,nickname.ilike.%${search}%`)
    }
    
    // 🔥 优化筛选条件 - 添加会员状态筛选
    const now = new Date().toISOString()
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    
    switch (filter) {
      case 'premium':
        query = query.gt('account_expires_at', now)
        break
      case 'free':
        query = query.or(`account_expires_at.is.null,account_expires_at.lt.${now}`)
        break
      case 'active24h':
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        query = query.gt('last_login_at', yesterday.toISOString())
        break
      case 'active':
        query = query.gt('last_login_at', threeMinutesAgo)
        break
      case 'expired':
        query = query.lt('account_expires_at', now)
        break
      case 'male':
        query = query.eq('preferences->>gender', 'male')
        break
      case 'female':
        query = query.eq('preferences->>gender', 'female')
        break
      // 'all' 不添加筛选
    }
    
    // 🔧 排序字段映射 - 支持会员到期时间排序
    const sortMapping: Record<string, string> = {
      'createdAt': 'created_at',
      'lastLogin': 'last_login_at',
      'accountExpires': 'account_expires_at',
      'email': 'email',
      'nickname': 'nickname',
      'id': 'id',
      'gender': 'preferences->>gender'
    }
    
    const dbSortField = sortMapping[sortField] || sortField
    
    // 执行排序查询
    if (sortField === 'gender') {
      // 对于性别排序，需要特殊处理
      console.log('🔧 性别排序请求，字段映射为:', dbSortField)
      query = query.order('created_at', { ascending: sortDirection === 'asc' })
    } else {
      query = query.order(dbSortField, { ascending: sortDirection === 'asc' })
    }
    
    // 分页
    const start = (page - 1) * limit
    const end = start + limit - 1
    query = query.range(start, end)
    
    // 执行查询
    const { data: users, error, count } = await query
    
    if (error) {
      console.error('❌ 查询用户列表失败:', error)
      return NextResponse.json(
        { success: false, error: `查询失败: ${error.message}` },
        { status: 500 }
      )
    }
    
    console.log(`✅ 查询成功: 获取到 ${users?.length || 0} 条用户数据`)
    
    // 处理数据：添加性别显示值
    const processedUsers = (users || []).map(user => {
      // 提取性别显示值
      const genderDisplay = extractGenderDisplay(user.preferences)
      
      // 计算会员状态
      const isPremium = user.account_expires_at 
        ? new Date(user.account_expires_at) > new Date()
        : false
      
      // 计算活跃状态
      const lastLoginAt = user.last_login_at
      const isActiveNow = lastLoginAt 
        ? new Date(lastLoginAt) > new Date(Date.now() - 3 * 60 * 1000)
        : false
      
      // 从current_key获取密钥信息
      let keyStatus = 'unused'
      if (user.current_key) {
        if (user.current_key.is_active === false) {
          keyStatus = 'inactive'
        } else if (user.current_key.key_expires_at) {
          const expiryDate = new Date(user.current_key.key_expires_at)
          if (expiryDate < new Date()) {
            keyStatus = 'expired'
          } else {
            keyStatus = 'active'
          }
        } else {
          keyStatus = 'active'
        }
      }
      
      // 日期格式化函数
      const formatDate = (dateString: string | null) => {
        if (!dateString) return '无记录'
        try {
          const date = new Date(dateString)
          if (isNaN(date.getTime())) return '无效日期'
          
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          
          return `${year}年${month}月${day}日 ${hours}:${minutes}`
        } catch {
          return '无效日期'
        }
      }
      
      return {
        ...user,
        gender_display: genderDisplay,
        is_premium: isPremium,
        is_active_now: isActiveNow,
        key_status: keyStatus,
        // 为了方便前端，添加格式化字段
        formatted_created_at: formatDate(user.created_at),
        formatted_last_login: formatDate(user.last_login_at),
        formatted_account_expires: formatDate(user.account_expires_at)
      }
    })
    
    // 🔧 如果按性别排序，进行内存排序
    let finalUsers = processedUsers
    if (sortField === 'gender') {
      finalUsers.sort((a, b) => {
        const genderA = a.gender_display || '未设置'
        const genderB = b.gender_display || '未设置'
        
        // 定义性别排序权重
        const genderOrder: Record<string, number> = {
          '男': 1,
          '女': 2,
          '其他': 3,
          '非二元': 4,
          '未设置': 5
        }
        
        const orderA = genderOrder[genderA] || 5
        const orderB = genderOrder[genderB] || 5
        
        if (sortDirection === 'asc') {
          return orderA - orderB
        } else {
          return orderB - orderA
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      data: finalUsers,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      sortInfo: {
        field: sortField,
        direction: sortDirection,
        dbField: dbSortField
      }
    })
    
  } catch (error: any) {
    console.error('❌ 获取用户列表异常:', error)
    return NextResponse.json(
      { success: false, error: `服务器错误: ${error.message}` },
      { status: 500 }
    )
  }
}