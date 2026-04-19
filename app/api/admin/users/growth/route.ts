import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

export async function GET(request: NextRequest) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      console.warn('🚫 未授权访问增长数据API')
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7d'
    
    let days = 7
    if (range === '30d') days = 30
    if (range === '90d') days = 90

    const supabaseAdmin = createAdminClient()

    // 🔥 修复：计算开始日期
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)  // 今天的最后时刻
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days + 1)  // ✅ 保留+1，获取包括今天在内的days天
    startDate.setHours(0, 0, 0, 0)  // 那一天的开始时刻

    console.log('📊 增长数据查询范围:', {
      range: range,
      days: days,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString()
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
      dataLength: result.length,
      totalGrowth: cumulative,
      lastDayData: result[result.length - 1]
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