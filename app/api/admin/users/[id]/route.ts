// /app/api/admin/users/[id]/route.ts - 添加PATCH方法
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

// 验证管理员权限
function isAdminAuthenticated(request: NextRequest): boolean {
  const authMethods = {
    cookie: request.cookies.get('admin_key_verified')?.value,
    referer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent')
  }

  return !!(authMethods.cookie || 
    (authMethods.referer?.includes('/admin/') && authMethods.userAgent))
}

// 计算新的过期时间（遵循续费规则）
function calculateNewExpiry(
  currentExpiry: Date | null,
  extendHours?: number,
  extendDays?: number
): Date {
  const now = new Date()
  
  // 确定基准时间：取当前时间和当前有效期的较大值
  const baseDate = currentExpiry && currentExpiry > now ? currentExpiry : now
  
  const newExpiry = new Date(baseDate)
  
  if (extendHours) {
    newExpiry.setHours(newExpiry.getHours() + extendHours)
  } else if (extendDays) {
    newExpiry.setDate(newExpiry.getDate() + extendDays)
  }
  
  return newExpiry
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
    
    // 验证管理员权限
    if (!isAdminAuthenticated(request)) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }
    
    const supabaseAdmin = createAdminClient()
    
    // 解析请求体
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: '请求格式错误' },
        { status: 400 }
      )
    }
    
    const { 
      account_expires_at,  // 直接设置新的过期时间
      extend_hours,        // 延长小时数
      extend_days,         // 延长天数
      reason,              // 操作原因
      ...otherUpdates      // 其他字段更新
    } = body
    
    // 获取用户当前信息
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('account_expires_at, email, nickname')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }
    
    const now = new Date()
    const updates: any = {
      updated_at: now.toISOString(),
      ...otherUpdates
    }
    
    let newExpiry: Date | null = null
    let actionType = 'update'
    let actionDescription = ''
    
    // 计算新的过期时间
    if (account_expires_at) {
      // 直接设置新的过期时间
      newExpiry = new Date(account_expires_at)
      updates.account_expires_at = newExpiry.toISOString()
      actionType = 'set_expiry'
      actionDescription = `管理员手动设置会员过期时间为: ${newExpiry.toLocaleString('zh-CN')}`
    } else if (extend_hours || extend_days) {
      // 延长会员时间
      const currentExpiry = user.account_expires_at ? new Date(user.account_expires_at) : null
      newExpiry = calculateNewExpiry(currentExpiry, extend_hours, extend_days)
      updates.account_expires_at = newExpiry.toISOString()
      
      actionType = 'extend_account'
      if (extend_hours) {
        actionDescription = `管理员延长会员 ${extend_hours} 小时`
      } else {
        actionDescription = `管理员延长会员 ${extend_days} 天`
      }
    }
    
    // 更新用户信息
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    
    if (updateError) {
      console.error('更新用户失败:', updateError)
      return NextResponse.json(
        { success: false, error: '更新失败' },
        { status: 500 }
      )
    }
    
    // 记录操作日志（如果存在日志表）
    try {
      await supabaseAdmin
        .from('key_usage_history')
        .insert({
          user_id: userId,
          access_key_id: null, // 管理员操作，没有密钥
          used_at: now.toISOString(),
          usage_type: 'admin_extend',
          notes: actionDescription + (reason ? ` | 原因: ${reason}` : ''),
          created_at: now.toISOString()
        })
    } catch (logError) {
      console.warn('记录操作日志失败（可能表不存在）:', logError)
      // 忽略日志错误，不影响主要功能
    }
    
    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: actionDescription || '用户信息已更新'
    })
    
  } catch (error: any) {
    console.error('更新用户信息异常:', error)
    return NextResponse.json(
      { success: false, error: error.message || '服务器错误' },
      { status: 500 }
    )
  }
}

// 保持原有的GET和DELETE方法不变
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
    const supabaseAdmin = createAdminClient()
    
    // 🔧 优化查询，避免过多嵌套导致的性能问题
    // 先获取用户基本信息
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }
    
    // 获取当前使用的密钥信息（如果有）
    let currentKey = null
    if (user.access_key_id) {
      const { data: keyData } = await supabaseAdmin
        .from('access_keys')
        .select('*')
        .eq('id', user.access_key_id)
        .single()
      currentKey = keyData
    }
    
    // 获取密钥使用历史
    const { data: keyHistory } = await supabaseAdmin
      .from('key_usage_history')
      .select(`
        *,
        access_keys (
          key_code,
          original_duration_hours,
          duration_unit
        )
      `)
      .eq('user_id', userId)
      .order('used_at', { ascending: false })
      .limit(50) // 限制返回数量
    
    // 获取AI使用记录
    const { data: aiRecords } = await supabaseAdmin
      .from('ai_usage_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50) // 限制返回数量
    
    return NextResponse.json({
      success: true,
      data: {
        ...user,
        current_key: currentKey,
        key_history: keyHistory || [],
        ai_records: aiRecords || []
      }
    })
    
  } catch (error) {
    console.error('获取用户详情异常:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id
    const supabaseAdmin = createAdminClient()
    
    // 1. 先检查用户是否存在
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }
    
    // 2. 软删除用户（标记为已删除）
    const { error: deleteError } = await supabaseAdmin
      .from('profiles')
      .update({
        email: `deleted_${Date.now()}_${user.email}`,
        nickname: '已删除用户',
        avatar_url: null,
        full_name: null,
        bio: null,
        last_login_session: null,
        access_key_id: null,
        account_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
    
    if (deleteError) {
      console.error('删除用户失败:', deleteError)
      return NextResponse.json(
        { success: false, error: '删除用户失败' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: '用户已标记为删除',
      data: { userId }
    })
    
  } catch (error) {
    console.error('删除用户异常:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}