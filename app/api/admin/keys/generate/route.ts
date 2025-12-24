// /app/api/admin/keys/generate/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('🔑 密钥生成API请求开始')

    // 1. 管理员验证
    const authMethods = {
      cookie: request.cookies.get('admin_key_verified'),
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent')
    }

    const isAuthenticated = authMethods.cookie || 
      (authMethods.referer?.includes('/admin/') && authMethods.userAgent)

    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: '未授权访问', code: 'UNAUTHORIZED_ACCESS' },
        { status: 401 }
      )
    }

    // 2. 环境变量验证
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: '服务器配置不完整' },
        { status: 500 }
      )
    }

    // 3. 创建Supabase客户端
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // 4. 解析请求数据
    const body = await request.json()
    const { keys, duration_days, max_uses, description } = body

    console.log('📦 密钥生成请求数据:', {
      密钥数量: keys?.length,
      有效期: duration_days,
      使用限制: max_uses,
      描述: description
    })

    // 5. 验证请求数据
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供要生成的密钥列表' },
        { status: 400 }
      )
    }

    if (!duration_days || duration_days <= 0) {
      return NextResponse.json(
        { success: false, error: '请指定有效的密钥有效期' },
        { status: 400 }
      )
    }

    // 6. 计算过期时间
    const now = new Date()
    const expiryDate = new Date(now.getTime() + duration_days * 24 * 60 * 60 * 1000)

    // 7. 准备要插入的数据
    const keysToInsert = keys.map((key_code: string) => {
      // 验证密钥格式
      if (!key_code || key_code.length < 10) {
        throw new Error(`无效的密钥格式: ${key_code}`)
      }

      return {
        key_code: key_code.trim(),
        account_valid_for_days: duration_days,
        max_uses: max_uses,
        used_count: 0,
        key_expires_at: expiryDate.toISOString(),
        is_active: true,
        description: description || null,
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }
    })

    // 8. 批量插入数据库
    const { data, error } = await supabaseAdmin
      .from('access_keys')
      .insert(keysToInsert)
      .select()

    if (error) {
      console.error('❌ 插入密钥失败:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: '数据库插入失败: ' + error.message,
          details: error
        },
        { status: 500 }
      )
    }

    console.log(`✅ 成功生成 ${data.length} 个密钥`)

    // 9. 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        generated_count: data.length,
        keys: data.map(k => k.key_code),
        expires_at: expiryDate.toISOString(),
        max_uses: max_uses,
        duration_days: duration_days
      },
      message: `成功创建了 ${data.length} 个密钥`
    })

  } catch (error: any) {
    console.error('💥 密钥生成API异常:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '服务器内部错误',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

// 其他HTTP方法处理
export async function GET() {
  return NextResponse.json(
    { success: false, error: '请使用POST方法生成密钥' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: '暂不支持PUT方法' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: '暂不支持DELETE方法' },
    { status: 405 }
  )
}