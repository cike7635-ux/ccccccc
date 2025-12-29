import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🤖 AI记录分页API调用:', {
      url: request.url,
      timestamp: new Date().toISOString()
    })

    // 1. 验证管理员权限
    const adminCookie = request.cookies.get('admin_key_verified')?.value
    if (!adminCookie) {
      console.warn('❌ 未授权的AI记录访问')
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    console.log('📊 AI记录查询参数:', { userId, page, limit, offset })

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少用户ID参数' },
        { status: 400 }
      )
    }

    // 3. 环境变量验证
    const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    const missingEnvVars = requiredEnvVars.filter(env => !process.env[env])

    if (missingEnvVars.length > 0) {
      console.error('❌ 缺少环境变量:', missingEnvVars)
      return NextResponse.json(
        { success: false, error: '服务器配置不完整', missing: missingEnvVars },
        { status: 500 }
      )
    }

    // 4. 创建Supabase管理员客户端
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: { headers: { 'x-application-name': 'love-ludo-admin-api' } }
      }
    )

    // 5. 查询总记录数
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (countError) {
      console.error('❌ 查询AI记录总数失败:', countError)
      return NextResponse.json(
        { success: false, error: '查询失败' },
        { status: 500 }
      )
    }

    // 6. 分页查询数据
    const { data: aiRecords, error: recordsError } = await supabaseAdmin
      .from('ai_usage_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (recordsError) {
      console.error('❌ 查询AI记录失败:', recordsError)
      return NextResponse.json(
        { success: false, error: '查询失败' },
        { status: 500 }
      )
    }

    // 7. 构建响应
    const total = totalCount || 0
    const totalPages = Math.ceil(total / limit)
    const hasMore = total > offset + limit

    const response = {
      success: true,
      data: aiRecords || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore
      }
    }

    console.log('✅ AI记录查询成功:', {
      总记录数: total,
      当前页记录数: response.data.length,
      还有更多: hasMore,
      总页数: totalPages
    })

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('💥 AI记录分页API错误:', error)
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

// 添加其他HTTP方法支持（可选）
export async function POST() {
  return NextResponse.json(
    { success: false, error: '暂不支持POST方法' },
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