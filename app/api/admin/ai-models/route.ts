import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
    }

    const supabaseAdmin = createAdminClient();
    
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
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
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
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
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
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
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
