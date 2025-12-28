// app/api/admin/users/growth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const adminKeyVerified = request.cookies.get('admin_key_verified')
    if (!adminKeyVerified) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7d'
    
    let days = 7
    if (range === '30d') days = 30
    if (range === '90d') days = 90

    // 创建Supabase客户端
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    )

    // 🔥 修复：计算开始日期
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)  // 今天的最后时刻
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)  // ✅ 保留+1，获取包括今天在内的days天
    startDate.setHours(0, 0, 0, 0)  // 那一天的开始时刻

    console.log('📊 增长数据查询范围:', {
      范围: range,
      天数: days,
      开始时间: startDate.toISOString(),
      结束时间: endDate.toISOString()
    })

    // 查询每日新增用户
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    console.log('📊 查询到用户记录数量:', data?.length || 0)

    // 处理数据
    const dailyData: Record<string, number> = {}
    
    // 初始化所有日期的数据为0
    const dateArray: string[] = []
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      dateArray.push(dateStr)
      dailyData[dateStr] = 0
    }

    console.log('📊 初始化日期范围:', dateArray)

    // 统计每日新增
    data?.forEach(profile => {
      if (profile.created_at) {
        const dateStr = profile.created_at.split('T')[0]
        if (dailyData[dateStr] !== undefined) {
          dailyData[dateStr]++
        } else {
          // 如果日期不在范围内，可能用户有未来日期的记录（不应该发生）
          console.warn('⚠️ 发现范围外的日期:', dateStr)
        }
      }
    })

    console.log('📊 每日统计数据:', dailyData)

    // 转换为前端需要的格式
    let cumulative = 0
    const result = dateArray.map((dateStr) => {
      const count = dailyData[dateStr] || 0
      cumulative += count
      
      // 格式化为中文短日期，如"12月24日"
      const date = new Date(dateStr)
      const formattedDate = date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      })
      
      return {
        date: formattedDate,
        count,
        cumulative
      }
    })

    console.log('📊 返回给前端的数据:', {
      数据条数: result.length,
      总增长数: cumulative,
      最后一天数据: result[result.length - 1]
    })

    return NextResponse.json({
      success: true,
      data: result,
      totalGrowth: cumulative
    })

  } catch (error: any) {
    console.error('❌ 获取增长数据失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取数据失败',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
