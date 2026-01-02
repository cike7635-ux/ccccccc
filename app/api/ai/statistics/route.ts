import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// 验证管理员权限
function verifyAdminAccess(request: NextRequest): boolean {
  const cookie = request.cookies.get('admin_key_verified')
  const referer = request.headers.get('referer')
  
  return !!(cookie?.value || (referer && referer.includes('/admin/')))
}

// AI使用统计数据接口
interface AIStatistics {
  summary: {
    total_uses: number
    total_users: number
    today_uses: number
    avg_daily_uses: number
    avg_tokens_per_use: number
    avg_response_time: number
    success_rate: number
  }
  trends: {
    date: string
    uses: number
    users: number
    avg_tokens: number
  }[]
  top_users: {
    user_id: string
    email: string
    nickname: string
    uses: number
    last_used: string
    avg_tokens: number
  }[]
  top_features: {
    feature: string
    uses: number
    avg_tokens: number
    success_rate: number
  }[]
  hourly_distribution: {
    hour: number
    uses: number
  }[]
  recent_records: {
    id: number
    user_id: string
    email: string
    input_text: string
    response_text: string
    feature: string
    created_at: string
    tokens_used: number
    response_time_ms: number
    status: string
  }[]
}

// 时间范围选项
type TimeRange = '7d' | '30d' | '90d' | 'all'

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    if (!verifyAdminAccess(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const timeRange = (searchParams.get('range') || '30d') as TimeRange
    
    // 计算日期范围
    const now = new Date()
    let startDate = new Date()
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      case 'all':
        startDate = new Date(0) // 最早的时间
        break
    }

    // 创建Supabase管理员客户端
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // 1. 获取总统计数据
    const { data: summaryData, error: summaryError } = await supabaseAdmin
      .from('ai_usage_records')
      .select('*', { count: 'exact' })
    
    if (summaryError) throw summaryError

    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('ai_usage_records')
      .select('user_id')
      .neq('user_id', null)
    
    if (usersError) throw usersError

    // 今天的开始时间
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    const { data: todayData, error: todayError } = await supabaseAdmin
      .from('ai_usage_records')
      .select('*', { count: 'exact' })
      .gte('created_at', todayStart.toISOString())
    
    if (todayError) throw todayError

    // 2. 获取趋势数据（按天）
    const { data: trendsData, error: trendsError } = await supabaseAdmin
      .from('ai_usage_records')
      .select('created_at, tokens_used, user_id')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })
    
    if (trendsError) throw trendsError

    // 3. 获取Top用户
    const { data: topUsersData, error: topUsersError } = await supabaseAdmin
      .from('ai_usage_records')
      .select(`
        user_id,
        created_at,
        tokens_used,
        profiles (
          email,
          nickname
        )
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
    
    if (topUsersError) throw topUsersError

    // 4. 获取Top功能（如果feature字段存在）
    const { data: topFeaturesData, error: topFeaturesError } = await supabaseAdmin
      .from('ai_usage_records')
      .select('feature, tokens_used, status')
      .not('feature', 'is', null)
      .gte('created_at', startDate.toISOString())
    
    if (topFeaturesError) console.warn('Features data not available:', topFeaturesError.message)

    // 5. 获取小时分布
    const { data: hourlyData, error: hourlyError } = await supabaseAdmin
      .from('ai_usage_records')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
    
    if (hourlyError) throw hourlyError

    // 6. 获取最近记录
    const { data: recentRecords, error: recentError } = await supabaseAdmin
      .from('ai_usage_records')
      .select(`
        id,
        user_id,
        input_text,
        response_text,
        feature,
        created_at,
        tokens_used,
        response_time_ms,
        status,
        profiles (
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (recentError) throw recentError

    // 处理数据
    const processedData: AIStatistics = {
      summary: {
        total_uses: summaryData?.length || 0,
        total_users: new Set(usersData?.map(r => r.user_id)).size,
        today_uses: todayData?.length || 0,
        avg_daily_uses: 0, // 后面计算
        avg_tokens_per_use: 0, // 后面计算
        avg_response_time: 0, // 后面计算
        success_rate: 0, // 后面计算
      },
      trends: [],
      top_users: [],
      top_features: [],
      hourly_distribution: [],
      recent_records: recentRecords?.map(record => ({
        id: record.id,
        user_id: record.user_id,
        email: (record as any).profiles?.email || '未知用户',
        input_text: record.input_text?.substring(0, 100) + (record.input_text?.length > 100 ? '...' : ''),
        response_text: record.response_text?.substring(0, 100) + (record.response_text?.length > 100 ? '...' : ''),
        feature: record.feature || '通用',
        created_at: record.created_at,
        tokens_used: record.tokens_used || 0,
        response_time_ms: record.response_time_ms || 0,
        status: record.status || 'success'
      })) || []
    }

    // 计算趋势数据（按天分组）
    const trendsMap = new Map<string, { uses: number; users: Set<string>; tokens: number[] }>()
    
    trendsData?.forEach(record => {
      const date = new Date(record.created_at).toISOString().split('T')[0]
      const existing = trendsMap.get(date) || { uses: 0, users: new Set(), tokens: [] }
      
      existing.uses += 1
      if (record.user_id) existing.users.add(record.user_id)
      if (record.tokens_used) existing.tokens.push(record.tokens_used)
      
      trendsMap.set(date, existing)
    })

    processedData.trends = Array.from(trendsMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => ({
        date,
        uses: data.uses,
        users: data.users.size,
        avg_tokens: data.tokens.length > 0 
          ? Math.round(data.tokens.reduce((a, b) => a + b, 0) / data.tokens.length)
          : 0
      }))

    // 计算Top用户
    const userStats = new Map<string, { 
      email: string; 
      nickname: string; 
      uses: number; 
      lastUsed: Date; 
      tokens: number[] 
    }>()
    
    topUsersData?.forEach(record => {
      const userInfo = userStats.get(record.user_id) || {
        email: (record as any).profiles?.email || '未知用户',
        nickname: (record as any).profiles?.nickname || '-',
        uses: 0,
        lastUsed: new Date(0),
        tokens: []
      }
      
      userInfo.uses += 1
      const recordDate = new Date(record.created_at)
      if (recordDate > userInfo.lastUsed) {
        userInfo.lastUsed = recordDate
      }
      if (record.tokens_used) {
        userInfo.tokens.push(record.tokens_used)
      }
      
      userStats.set(record.user_id, userInfo)
    })

    processedData.top_users = Array.from(userStats.entries())
      .map(([user_id, data]) => ({
        user_id,
        email: data.email,
        nickname: data.nickname,
        uses: data.uses,
        last_used: data.lastUsed.toISOString(),
        avg_tokens: data.tokens.length > 0 
          ? Math.round(data.tokens.reduce((a, b) => a + b, 0) / data.tokens.length)
          : 0
      }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 10)

    // 计算Top功能
    if (topFeaturesData) {
      const featureStats = new Map<string, { 
        uses: number; 
        tokens: number[]; 
        successes: number 
      }>()
      
      topFeaturesData.forEach(record => {
        const feature = record.feature || '通用'
        const stats = featureStats.get(feature) || { uses: 0, tokens: [], successes: 0 }
        
        stats.uses += 1
        if (record.tokens_used) stats.tokens.push(record.tokens_used)
        if (record.status === 'success') stats.successes += 1
        
        featureStats.set(feature, stats)
      })

      processedData.top_features = Array.from(featureStats.entries())
        .map(([feature, data]) => ({
          feature,
          uses: data.uses,
          avg_tokens: data.tokens.length > 0 
            ? Math.round(data.tokens.reduce((a, b) => a + b, 0) / data.tokens.length)
            : 0,
          success_rate: data.uses > 0 ? Math.round((data.successes / data.uses) * 100) : 0
        }))
        .sort((a, b) => b.uses - a.uses)
        .slice(0, 10)
    }

    // 计算小时分布
    const hourlyMap = new Map<number, number>()
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(i, 0)
    }
    
    hourlyData?.forEach(record => {
      const hour = new Date(record.created_at).getHours()
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1)
    })

    processedData.hourly_distribution = Array.from(hourlyMap.entries())
      .map(([hour, uses]) => ({ hour, uses }))
      .sort((a, b) => a.hour - b.hour)

    // 计算平均数据
    const allRecords = summaryData || []
    const totalTokens = allRecords.reduce((sum, record) => sum + (record.tokens_used || 0), 0)
    const totalResponseTime = allRecords.reduce((sum, record) => sum + (record.response_time_ms || 0), 0)
    const successfulRecords = allRecords.filter(record => record.status === 'success').length
    
    processedData.summary.avg_tokens_per_use = allRecords.length > 0 
      ? Math.round(totalTokens / allRecords.length)
      : 0
    processedData.summary.avg_response_time = allRecords.length > 0 
      ? Math.round(totalResponseTime / allRecords.length)
      : 0
    processedData.summary.success_rate = allRecords.length > 0 
      ? Math.round((successfulRecords / allRecords.length) * 100)
      : 0
    processedData.summary.avg_daily_use = trendsData?.length > 0 
      ? Math.round(trendsData.length / (timeRange === 'all' ? 365 : parseInt(timeRange)))
      : 0

    return NextResponse.json({
      success: true,
      data: processedData,
      range: timeRange,
      generated_at: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('❌ AI统计API错误:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '获取AI统计数据失败',
      data: null
    }, { status: 500 })
  }
}