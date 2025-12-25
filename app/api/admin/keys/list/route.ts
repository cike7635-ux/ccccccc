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

    // 获取所有密钥（包含使用历史）
    const { data: keys, error } = await supabaseAdmin
      .from('access_keys')
      .select(`
        *,
        key_usage_history (
          id,
          user_id,
          used_at,
          usage_type,
          notes,
          profiles:user_id (
            email,
            nickname
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ 查询失败:', error)
      return NextResponse.json(
        { success: false, error: '查询失败: ' + error.message },
        { status: 500 }
      )
    }

    console.log(`✅ 查询成功，找到 ${keys?.length || 0} 条密钥记录`)
    
    // 处理数据，合并使用历史
    const processedKeys = keys?.map(key => {
      const usageHistory = Array.isArray(key.key_usage_history) && key.key_usage_history.length > 0 
        ? key.key_usage_history[0] 
        : null
      
      // 判断是否已使用
      const isUsed = !!usageHistory
      
      // 获取用户信息
      const userInfo = usageHistory?.profiles || null
      
      // 使用次数统计
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
        used_at: usageHistory?.used_at || key.used_at,
        user_id: usageHistory?.user_id || key.user_id,
        
        // 使用限制
        max_uses: key.max_uses,
        used_count: usageCount,
        
        // 用户信息
        user: userInfo ? {
          email: userInfo.email,
          nickname: userInfo.nickname
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
