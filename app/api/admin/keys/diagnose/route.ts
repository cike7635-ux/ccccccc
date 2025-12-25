// /app/api/admin/keys/diagnose/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 密钥诊断请求')
    
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

    // 获取前10条密钥进行诊断
    const { data: keys, error } = await supabaseAdmin
      .from('access_keys')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      throw new Error('查询失败: ' + error.message)
    }

    // 分析数据
    const analysis = keys?.map(key => {
      const now = new Date()
      const isExpired = key.key_expires_at ? new Date(key.key_expires_at) < now : false
      const isUsed = !!key.used_at || !!key.user_id
      
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
        id: key.id,
        key_code: key.key_code,
        account_valid_for_days: key.account_valid_for_days,
        original_duration_hours: key.original_duration_hours,
        duration_display: durationDisplay,
        is_active: key.is_active,
        used_at: key.used_at,
        user_id: key.user_id,
        key_expires_at: key.key_expires_at,
        is_expired: isExpired,
        is_used: isUsed,
        status: !key.is_active ? '已禁用' : isExpired ? '已过期' : isUsed ? '已使用' : '未使用',
        created_at: key.created_at
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        summary: {
          total_keys: keys?.length || 0,
          active_keys: keys?.filter(k => k.is_active).length || 0,
          used_keys: keys?.filter(k => k.used_at || k.user_id).length || 0,
          expired_keys: keys?.filter(k => k.key_expires_at && new Date(k.key_expires_at) < new Date()).length || 0,
          keys_with_original_hours: keys?.filter(k => k.original_duration_hours).length || 0
        }
      },
      message: '诊断完成'
    })

  } catch (error: any) {
    console.error('💥 诊断异常:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
