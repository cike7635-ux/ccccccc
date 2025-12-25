// /app/api/admin/keys/export/route.ts - 修复版
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// 导出选项类型
interface ExportOptions {
  export_type: 'current_page' | 'filtered' | 'selected'
  filters?: any
  selected_ids?: number[]
  page?: number
  limit?: number
}

// 手动生成CSV，避免依赖问题
function generateCSV(headers: string[], data: any[][]): string {
  // 添加BOM支持中文
  let csvContent = '\uFEFF'
  
  // 添加表头
  csvContent += headers.map(header => `"${header}"`).join(',') + '\n'
  
  // 添加数据行
  data.forEach(row => {
    csvContent += row.map(cell => {
      // 转义双引号并包裹字段
      if (cell === null || cell === undefined) {
        return '""'
      }
      const stringCell = String(cell)
      // 转义双引号
      const escapedCell = stringCell.replace(/"/g, '""')
      return `"${escapedCell}"`
    }).join(',') + '\n'
  })
  
  return csvContent
}

export async function POST(request: NextRequest) {
  try {
    console.log('📤 接收到导出请求')
    
    // 1. 验证管理员权限
    const authMethods = {
      cookie: request.cookies.get('admin_key_verified')?.value,
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent')
    }

    const isAuthenticated = authMethods.cookie || 
      (authMethods.referer?.includes('/admin/') && authMethods.userAgent)

    if (!isAuthenticated) {
      return NextResponse.json({ 
        success: false, 
        error: '未授权访问' 
      }, { status: 401 })
    }

    // 2. 验证环境变量
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: '环境变量未配置' 
      }, { status: 500 })
    }

    // 3. 解析请求数据
    let options: ExportOptions
    try {
      options = await request.json()
      console.log('📦 导出选项:', {
        type: options.export_type,
        filters: options.filters ? '有筛选条件' : '无筛选条件',
        selected_count: options.selected_ids?.length || 0
      })
    } catch (error) {
      return NextResponse.json({ 
        success: false, 
        error: '请求格式错误' 
      }, { status: 400 })
    }

    // 4. 创建Supabase管理员客户端
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )

    // 5. 根据导出类型构建查询
    let query = supabaseAdmin
      .from('access_keys')
      .select(`
        *,
        profiles:user_id (
          id,
          email,
          nickname
        )
      `)

    // 5.1 按筛选条件导出
    if (options.export_type === 'filtered' && options.filters) {
      const filters = options.filters
      
      // 应用筛选条件（与列表API相同的逻辑）
      if (filters.status) {
        const statuses = filters.status.split(',')
        if (statuses.includes('disabled')) {
          query = query.eq('is_active', false)
        }
      }

      if (filters.user_email) {
        const { data: users } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .ilike('email', `%${filters.user_email}%`)
        
        if (users && users.length > 0) {
          const userIds = users.map(u => u.id)
          query = query.in('user_id', userIds)
        }
      }

      if (filters.key_code) {
        query = query.ilike('key_code', `${filters.key_code}%`)
      }

      if (filters.created_at_start) {
        query = query.gte('created_at', `${filters.created_at_start}T00:00:00Z`)
      }
      if (filters.created_at_end) {
        query = query.lte('created_at', `${filters.created_at_end}T23:59:59Z`)
      }

      if (filters.duration_min !== undefined) {
        query = query.gte('account_valid_for_days', filters.duration_min)
      }
      if (filters.duration_max !== undefined) {
        query = query.lte('account_valid_for_days', filters.duration_max)
      }

      if (filters.is_active !== undefined) {
        query = query.eq('is_active', filters.is_active)
      }

      // 应用排序
      query = query.order('created_at', { ascending: false })
    }
    // 5.2 导出选中项
    else if (options.export_type === 'selected' && options.selected_ids && options.selected_ids.length > 0) {
      query = query.in('id', options.selected_ids)
    }
    // 5.3 导出当前页
    else if (options.export_type === 'current_page' && options.page && options.limit) {
      const start = (options.page - 1) * options.limit
      const end = start + options.limit - 1
      query = query.order('created_at', { ascending: false }).range(start, end)
    }
    // 5.4 默认导出所有（限制1000条防止内存溢出）
    else {
      query = query.order('created_at', { ascending: false }).limit(1000)
    }

    // 6. 执行查询
    const { data: keys, error } = await query

    if (error) {
      console.error('❌ 查询导出数据失败:', error)
      throw new Error('查询数据失败: ' + error.message)
    }

    console.log(`📊 查询到 ${keys?.length || 0} 条密钥数据用于导出`)

    // 7. 获取使用统计信息
    const keyIds = keys?.map(k => k.id) || []
    let usageStats: Record<number, number> = {}

    if (keyIds.length > 0) {
      const { data: stats } = await supabaseAdmin
        .from('key_usage_history')
        .select('access_key_id')
        .in('access_key_id', keyIds)

      // 计算每个密钥的使用次数
      usageStats = (stats || []).reduce((acc, record) => {
        const keyId = record.access_key_id
        acc[keyId] = (acc[keyId] || 0) + 1
        return acc
      }, {} as Record<number, number>)
    }

    // 8. 准备CSV数据
    const csvData = keys?.map(key => {
      const stats = usageStats[key.id] || 0
      const now = new Date()
      const isExpired = key.key_expires_at && new Date(key.key_expires_at) < now
      
      // 计算状态
      let status = '未使用'
      if (!key.is_active) {
        status = '已禁用'
      } else if (isExpired) {
        status = '已过期'
      } else if (stats > 0 || key.used_at) {
        status = `已使用(${stats}次)`
      }

      // 计算有效期显示
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

      return [
        // 基础信息
        key.key_code || '无',
        key.description || '无',
        durationDisplay,
        key.duration_unit || 'days',
        
        // 状态信息
        status,
        key.is_active ? '是' : '否',
        
        // 使用信息
        stats.toString(),
        key.max_uses === null ? '无限次' : key.max_uses.toString(),
        key.used_count || '0',
        
        // 用户信息
        key.profiles?.email || '无',
        key.profiles?.nickname || '无',
        
        // 时间信息
        key.created_at ? new Date(key.created_at).toLocaleString('zh-CN') : '无',
        key.updated_at ? new Date(key.updated_at).toLocaleString('zh-CN') : '无',
        key.used_at ? new Date(key.used_at).toLocaleString('zh-CN') : '无',
        key.key_expires_at ? new Date(key.key_expires_at).toLocaleString('zh-CN') : '无',
        
        // 其他信息
        key.original_duration_hours || '无',
        key.id.toString()
      ]
    }) || []

    // 9. CSV表头
    const csvHeaders = [
      '密钥代码', '描述', '有效期', '时长单位',
      '状态', '是否激活', 
      '使用次数', '最大使用次数', '已用次数',
      '当前用户邮箱', '当前用户昵称',
      '创建时间', '更新时间', '使用时间', '过期时间',
      '原始小时数', '密钥ID'
    ]

    // 10. 使用手动生成CSV函数
    const csvContent = generateCSV(csvHeaders, csvData)

    // 11. 生成文件名
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const filename = `love-ludo-keys_${timestamp}_${keys?.length || 0}条.csv`

    console.log(`✅ CSV导出完成，共 ${keys?.length || 0} 条记录`)

    // 12. 返回CSV文件
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Export-Count': (keys?.length || 0).toString()
      }
    })

  } catch (error: any) {
    console.error('💥 导出异常:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '导出失败'
    }, { status: 500 })
  }
}