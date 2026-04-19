// /app/api/admin/keys/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

function generateCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return ''
  }

  const headers = Object.keys(data[0])
  const csvRows = []

  csvRows.push(headers.map(header => `"${header}"`).join(','))

  for (const row of data) {
    const values = headers.map(header => {
      let value = row[header]

      if (value === null || value === undefined) {
        value = ''
      } else if (typeof value === 'string') {
        if (value.includes('"') || value.includes(',') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`
        }
      }

      return value
    })

    csvRows.push(values.join(','))
  }

  return csvRows.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    console.log('📤 接收到导出请求')

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      )
    }

    let body
    try {
      body = await request.json()
      console.log('📦 导出选项:', {
        format: body.format,
        selected_ids: body.selected_ids?.length || 0
      })
    } catch (error) {
      return NextResponse.json({ success: false, error: '请求格式错误' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    const {
      format = 'csv',
      selected_ids = [],
      include_columns = [],
      filters = {}
    } = body

    // 构建查询
    let query = supabaseAdmin
      .from('access_keys')
      .select(`
        *,
        profiles:user_id (
          id,
          email,
          nickname,
          account_expires_at
        )
      `)

    if (selected_ids.length > 0) {
      query = query.in('id', selected_ids)
    }

    const { data: keys, error } = await query

    if (error) {
      throw new Error('查询失败: ' + error.message)
    }

    // 转换为Plain object
    const plainKeys = keys?.map(key => ({
      id: key.id,
      key_code: key.key_code,
      description: key.description || '',
      is_active: key.is_active,
      used_count: key.used_count,
      max_uses: key.max_uses,
      account_valid_for_days: key.account_valid_for_days,
      original_duration_hours: key.original_duration_hours,
      duration_unit: key.duration_unit,
      key_expires_at: key.key_expires_at,
      created_at: key.created_at,
      updated_at: key.updated_at,
      used_at: key.used_at,
      user_id: key.user_id,
      user_email: key.profiles?.email || '',
      user_nickname: key.profiles?.nickname || '',
      user_expires_at: key.profiles?.account_expires_at || ''
    })) || []

    const csv = generateCSV(plainKeys)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="keys-${Date.now()}.csv"`
      }
    })

  } catch (error: any) {
    console.error('💥 导出失败:', error)
    return NextResponse.json(
      { success: false, error: error.message || '导出失败' },
      { status: 500 }
    )
  }
}
