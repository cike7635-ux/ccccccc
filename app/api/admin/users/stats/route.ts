import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 创建管理员客户端
function createAdminClient() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { 
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )
  return supabaseAdmin
}

// 验证管理员权限
function validateAdmin(request: NextRequest): boolean {
  const adminKeyVerified = request.cookies.get('admin_key_verified')?.value
  const referer = request.headers.get('referer') || ''
  const userAgent = request.headers.get('user-agent') || ''
  
  // 双重验证：Cookie 或 Referer + User-Agent
  if (adminKeyVerified === 'true') {
    return true
  }
  
  if (referer.includes('/admin/') && userAgent) {
    return true
  }
  
  return false
}

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    if (!validateAdmin(request)) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    const supabaseAdmin = createAdminClient()
    
    // 计算时间点
    const now = new Date().toISOString()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    console.log('📊 统计API开始计算...', {
      currentTime: now, // ✅ 修复：改为有效的标识符
      twentyFourHoursAgo: twentyFourHoursAgo, // ✅ 修复：改为有效的标识符
      threeMinutesAgo: threeMinutesAgo // ✅ 修复：改为有效的标识符
    })

    // 🔧 并行执行所有统计查询，提升性能
    const [
      totalQuery,
      premiumQuery,
      active24hQuery,
      activeNowQuery,
      genderQuery,
      deletedQuery,
      newThisWeekQuery
    ] = await Promise.all([
      // 1. 获取总用户数（排除已删除用户）
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('email', 'like', 'deleted_%'),
      
      // 2. 获取会员用户数（有未过期的 account_expires_at）
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('email', 'like', 'deleted_%')
        .gt('account_expires_at', now),
      
      // 3. 获取24小时内活跃用户数
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('email', 'like', 'deleted_%')
        .gt('last_login_at', twentyFourHoursAgo),
      
      // 4. 获取当前活跃用户数（3分钟内登录）
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('email', 'like', 'deleted_%')
        .gt('last_login_at', threeMinutesAgo),
      
      // 5. 获取所有用户的性别信息（排除已删除用户）
      supabaseAdmin
        .from('profiles')
        .select('preferences')
        .not('email', 'like', 'deleted_%'),
      
      // 6. 获取已删除用户数
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .like('email', 'deleted_%'),
      
      // 7. 获取本周新增用户
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('email', 'like', 'deleted_%')
        .gt('created_at', oneWeekAgo)
    ])

    // 检查错误
    const errors = [
      totalQuery.error,
      premiumQuery.error,
      active24hQuery.error,
      activeNowQuery.error,
      genderQuery.error,
      deletedQuery.error,
      newThisWeekQuery.error
    ].filter(error => error)

    if (errors.length > 0) {
      console.error('统计查询错误:', errors)
      throw new Error('数据库查询失败')
    }

    // 计算性别统计
    let maleCount = 0
    let femaleCount = 0
    let otherGender = 0
    let unknownCount = 0
    
    if (genderQuery.data) {
      genderQuery.data.forEach(profile => {
        if (!profile.preferences) {
          unknownCount++
          return
        }
        
        const gender = profile.preferences.gender
        if (!gender || gender === '' || gender === null || gender === undefined) {
          unknownCount++
        } else if (
          gender === 'male' || 
          gender === 'M' || 
          gender === '男' ||
          gender.toString().toLowerCase() === 'male' ||
          gender.toString() === '男'
        ) {
          maleCount++
        } else if (
          gender === 'female' || 
          gender === 'F' || 
          gender === '女' ||
          gender.toString().toLowerCase() === 'female' ||
          gender.toString() === '女'
        ) {
          femaleCount++
        } else if (
          gender === 'other' || 
          gender === 'non_binary' || 
          gender === '其他' || 
          gender === '非二元' ||
          gender.toString().toLowerCase().includes('other') ||
          gender.toString().includes('非二元')
        ) {
          otherGender++
        } else {
          unknownCount++
        }
      })
    }

    // 编译统计数据
    const stats = {
      total: totalQuery.count || 0,
      premium: premiumQuery.count || 0,
      active24h: active24hQuery.count || 0,
      male: maleCount,
      female: femaleCount,
      otherGender: otherGender,
      unknown: unknownCount,
      activeNow: activeNowQuery.count || 0,
      deleted: deletedQuery.count || 0,
      newThisWeek: newThisWeekQuery.count || 0
    }

    console.log('📊 统计API计算完成:', stats)

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ 统计API错误:', error)
    
    // 返回错误但包含基本数据，避免前端完全崩溃
    const fallbackStats = {
      total: 0,
      premium: 0,
      active24h: 0,
      male: 0,
      female: 0,
      otherGender: 0,
      unknown: 0,
      activeNow: 0,
      deleted: 0,
      newThisWeek: 0
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: '获取统计数据失败',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        data: fallbackStats // 提供降级数据
      },
      { status: 500 }
    )
  }
}