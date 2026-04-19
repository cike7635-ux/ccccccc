// /app/api/admin/keys/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

export async function POST(request: NextRequest) {
  try {
    console.log('🔑 接收到密钥生成请求')

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      console.log('❌ 未授权访问')
      return NextResponse.json(
        { success: false, error: validation.error, code: 'UNAUTHORIZED' },
        { status: validation.status }
      )
    }

    // 2. 验证环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ 环境变量缺失')
      return NextResponse.json(
        { success: false, error: '服务器配置不完整' },
        { status: 500 }
      )
    }

    // 3. 解析请求数据
    let body
    try {
      body = await request.json()
      console.log('📦 请求数据:', JSON.stringify(body, null, 2))
    } catch (error) {
      return NextResponse.json(
        { success: false, error: '请求格式错误' },
        { status: 400 }
      )
    }

    const { 
      count = 1, 
      prefix = 'XY', 
      duration, // 必填，单位：小时
      max_uses = 1, 
      description,
      activation_deadline_days = 365, // 激活截止天数（绝对日期）
      activation_deadline_type = 'relative' // relative 或 absolute
    } = body

    // 4. 验证请求数据
    if (!count || count < 1 || count > 100) {
      return NextResponse.json(
        { success: false, error: '生成数量必须在1-100之间' },
        { status: 400 }
      )
    }

    if (!prefix || prefix.length < 2 || prefix.length > 6) {
      return NextResponse.json(
        { success: false, error: '前缀必须是2-6个字符' },
        { status: 400 }
      )
    }

    if (duration === undefined || duration <= 0) {
      return NextResponse.json(
        { success: false, error: '有效期必须大于0' },
        { status: 400 }
      )
    }

    if (max_uses !== null && max_uses <= 0) {
      return NextResponse.json(
        { success: false, error: '使用次数限制必须大于0' },
        { status: 400 }
      )
    }

    if (activation_deadline_days <= 0) {
      return NextResponse.json(
        { success: false, error: '激活截止时间必须大于0天' },
        { status: 400 }
      )
    }

    // 5. 创建Supabase管理员客户端
    const supabaseAdmin = createAdminClient()

    // 6. 计算激活截止时间（绝对日期）
    const now = new Date()
    let keyExpiresAt: Date
    
    if (activation_deadline_type === 'absolute' && body.activation_deadline_date) {
      // 如果提供了具体的绝对日期
      keyExpiresAt = new Date(body.activation_deadline_date)
    } else {
      // 默认使用相对天数
      keyExpiresAt = new Date(now.getTime() + activation_deadline_days * 24 * 60 * 60 * 1000)
    }

    // 7. 🔥 关键修复：计算时长单位和原始小时数
    let durationUnit = 'hours' // 默认单位
    let originalDurationHours: number = duration // 前端直接传递小时数
    let accountValidForDays: number

    // 确定显示单位
    if (duration < 24) {
      // 小于24小时，显示小时
      durationUnit = 'hours'
      accountValidForDays = 0 // 小时级别的密钥，账户有效天数为0
    } else if (duration === 24) {
      // 正好24小时，显示1天
      durationUnit = 'days'
      accountValidForDays = 1
    } else if (duration < 24 * 30) {
      // 小于30天，显示天数
      durationUnit = 'days'
      accountValidForDays = Math.floor(duration / 24)
    } else if (duration < 24 * 365) {
      // 小于1年，显示月数
      durationUnit = 'months'
      accountValidForDays = Math.floor(duration / 24)
    } else {
      // 大于等于1年，显示年数
      durationUnit = 'years'
      accountValidForDays = Math.floor(duration / 24)
    }

    console.log('📊 时长计算:', {
      原始小时数: originalDurationHours,
      显示单位: durationUnit,
      账户有效期天数: accountValidForDays,
      激活截止时间: keyExpiresAt.toISOString()
    })

    // 8. 生成密钥
    const keysToInsert = []
    const generatedKeys = []

    for (let i = 0; i < count; i++) {
      // 生成随机部分
      const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const randomPart = Array.from({ length: 8 }, () => 
        characters.charAt(Math.floor(Math.random() * characters.length))
      ).join('')

      // 生成时长代码（基于原始小时数）
      let durationCode = ''
      if (originalDurationHours < 24) {
        // 小时级别
        durationCode = `${originalDurationHours}H`
      } else if (originalDurationHours < 24 * 30) {
        // 天数级别
        const days = Math.floor(originalDurationHours / 24)
        durationCode = `${days}D`
      } else if (originalDurationHours < 24 * 365) {
        // 月数级别
        const months = Math.round(originalDurationHours / (24 * 30))
        durationCode = `${months}M`
      } else {
        // 年数级别
        const years = Math.round(originalDurationHours / (24 * 365))
        durationCode = `${years}Y`
      }

      const keyCode = `${prefix}-${durationCode}-${randomPart}`

      keysToInsert.push({
        key_code: keyCode,
        is_active: true,
        used_count: 0,
        max_uses: max_uses,
        key_expires_at: keyExpiresAt.toISOString(), // 激活截止时间（绝对日期）
        account_valid_for_days: accountValidForDays,
        original_duration_hours: originalDurationHours, // 存储原始小时数
        duration_unit: durationUnit,
        user_id: null,
        used_at: null,
        description: description || null,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      })

      generatedKeys.push({
        key_code: keyCode,
        duration_hours: originalDurationHours,
        duration_unit: durationUnit,
        max_uses: max_uses,
        key_expires_at: keyExpiresAt.toISOString()
      })
    }

    console.log(`📝 准备插入 ${keysToInsert.length} 个密钥`)
    console.log(`   - 前缀: ${prefix}`)
    console.log(`   - 原始时长: ${originalDurationHours}小时`)
    console.log(`   - 显示单位: ${durationUnit}`)
    console.log(`   - 激活截止: ${keyExpiresAt.toLocaleDateString('zh-CN')}`)
    console.log(`   - 使用次数限制: ${max_uses === null ? '无限次' : max_uses + '次'}`)

    // 9. 批量插入数据库
    const { data, error } = await supabaseAdmin
      .from('access_keys')
      .insert(keysToInsert)
      .select()

    if (error) {
      console.error('❌ 插入密钥失败:', error)
      
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: '密钥代码已存在，请重试' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { success: false, error: '数据库插入失败: ' + error.message },
        { status: 500 }
      )
    }

    console.log(`✅ 成功生成 ${data.length} 个密钥`)

    // 10. 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        generated_count: data.length,
        keys: data.map(k => ({
          id: k.id,
          key_code: k.key_code,
          account_valid_for_days: k.account_valid_for_days,
          original_duration_hours: k.original_duration_hours,
          duration_unit: k.duration_unit,
          key_expires_at: k.key_expires_at,
          max_uses: k.max_uses,
          description: k.description
        })),
        summary: {
          prefix: prefix,
          duration_hours: originalDurationHours,
          duration_unit: durationUnit,
          activation_deadline: keyExpiresAt.toLocaleDateString('zh-CN'),
          max_uses: max_uses === null ? '无限次' : max_uses + '次'
        }
      },
      message: `成功创建了 ${data.length} 个密钥`,
      download_url: `/api/admin/keys/export/batch?ids=${data.map(k => k.id).join(',')}`
    })

  } catch (error: any) {
    console.error('💥 密钥生成API异常:', error)
    return NextResponse.json(
      { success: false, error: '服务器内部错误: ' + (error.message || '未知错误') },
      { status: 500 }
    )
  }
}

// GET方法用于测试
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: '密钥生成API已就绪',
    parameters: {
      count: '生成数量 (1-100)',
      prefix: '密钥前缀 (2-6字符)',
      duration: '使用时长 (小时数)',
      max_uses: '最大使用次数 (null为无限)',
      description: '描述 (可选)',
      activation_deadline_days: '激活截止天数 (默认365)',
      activation_deadline_type: '截止时间类型 (relative/absolute)'
    }
  })
}