// /app/api/admin/test-data/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // 仅检查Service Role Key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: '服务未配置' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const searchParams = request.nextUrl.searchParams
    const table = searchParams.get('table') || 'profiles'
    const limit = parseInt(searchParams.get('limit') || '5')

    let data
    let count

    switch (table) {
      case 'profiles':
        const { data: profilesData, error: profilesError, count: profilesCount } = await supabaseAdmin
          .from('profiles')
          .select('id, email, nickname, created_at', { count: 'exact' })
          .limit(limit)
          .order('created_at', { ascending: false })

        if (profilesError) throw profilesError
        data = profilesData
        count = profilesCount
        break

      case 'access_keys':
        const { data: keysData, error: keysError, count: keysCount } = await supabaseAdmin
          .from('access_keys')
          .select('id, key_code, used_at, created_at', { count: 'exact' })
          .limit(limit)
          .order('created_at', { ascending: false })

        if (keysError) throw keysError
        data = keysData
        count = keysCount
        break

      default:
        return NextResponse.json(
          { success: false, error: `不支持的表: ${table}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: count || 0,
      message: '测试API - 仅用于验证数据库连接'
    })

  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}