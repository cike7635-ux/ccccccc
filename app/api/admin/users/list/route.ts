// /app/api/admin/users/list/route.ts - 排除已删除用户版本
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const supabaseAdmin = createAdminClient()
    
    // 获取查询参数
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const filter = searchParams.get('filter') || 'all'
    const sortField = searchParams.get('sortField') || 'created_at'
    const sortDirection = searchParams.get('sortDirection') || 'desc'
    
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
    
    // 筛选条件
    const now = new Date().toISOString()
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
      case 'expired':
        query = query.lt('account_expires_at', now)
        break
      // 'all' 不添加筛选
    }
    
    // 排序字段映射
    const sortMapping: Record<string, string> = {
      'createdAt': 'created_at',
      'lastLogin': 'last_login_at',
      'accountExpires': 'account_expires_at',
      'email': 'email',
      'nickname': 'nickname',
      'id': 'id'
    }
    
    const dbSortField = sortMapping[sortField] || sortField
    query = query.order(dbSortField, { ascending: sortDirection === 'asc' })
    
    // 分页
    const start = (page - 1) * limit
    const end = start + limit - 1
    query = query.range(start, end)
    
    // 执行查询
    const { data: users, error, count } = await query
    
    if (error) {
      console.error('查询用户列表失败:', error)
      return NextResponse.json(
        { success: false, error: '查询失败' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: users || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
    
  } catch (error) {
    console.error('获取用户列表异常:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}