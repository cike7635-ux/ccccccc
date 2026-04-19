// /app/api/admin/test-data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const supabaseAdmin = createAdminClient()

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