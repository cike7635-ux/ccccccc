import { NextRequest, NextResponse } from 'next/server'

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

function validateAdmin(request: NextRequest): boolean {
  const adminKeyVerified = request.cookies.get('admin_key_verified')?.value
  const referer = request.headers.get('referer') || ''
  const userAgent = request.headers.get('user-agent') || ''
  
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
    if (!validateAdmin(request)) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()
    
    const { data, error } = await supabaseAdmin
      .from('ai_models')
      .select('*')
      .order('priority', { ascending: true })

    if (error) {
      console.error('获取 AI 模型列表失败:', error)
      return NextResponse.json(
        { success: false, error: '获取 AI 模型列表失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })

  } catch (error: any) {
    console.error('获取 AI 模型列表异常:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 })
    }

    const body = await request.json()
    const { name, display_name, provider, api_url, priority, is_active, max_tokens, temperature } = body

    if (!name || !display_name || !provider || !api_url) {
      return NextResponse.json(
        { success: false, error: '缺少必要字段' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()
    
    const { data, error } = await supabaseAdmin
      .from('ai_models')
      .insert({
        name,
        display_name,
        provider,
        api_url,
        priority: priority || 0,
        is_active: is_active !== undefined ? is_active : true,
        max_tokens: max_tokens || 6000,
        temperature: temperature || 0.9
      })
      .select()
      .single()

    if (error) {
      console.error('创建 AI 模型失败:', error)
      return NextResponse.json(
        { success: false, error: '创建 AI 模型失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error: any) {
    console.error('创建 AI 模型异常:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少模型 ID' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()
    
    const { data, error } = await supabaseAdmin
      .from('ai_models')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('更新 AI 模型失败:', error)
      return NextResponse.json(
        { success: false, error: '更新 AI 模型失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error: any) {
    console.error('更新 AI 模型异常:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!validateAdmin(request)) {
      return NextResponse.json({ success: false, error: '未授权访问' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少模型 ID' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()
    
    const { error } = await supabaseAdmin
      .from('ai_models')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('删除 AI 模型失败:', error)
      return NextResponse.json(
        { success: false, error: '删除 AI 模型失败' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '删除成功'
    })

  } catch (error: any) {
    console.error('删除 AI 模型异常:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
