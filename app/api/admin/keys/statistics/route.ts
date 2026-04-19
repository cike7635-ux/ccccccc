// /app/api/admin/keys/statistics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

export async function GET(request: NextRequest) {
  try {
    console.log('📊 获取密钥统计信息')

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      )
    }

    const supabaseAdmin = createAdminClient()

    // 获取当前时间
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // 1. 获取基础统计
    const { data: keys, error: keysError } = await supabaseAdmin
      .from('access_keys')
      .select('is_active, used_at, user_id, key_expires_at, created_at, original_duration_hours, account_valid_for_days')

    if (keysError) {
      throw new Error('查询密钥失败: ' + keysError.message)
    }

    // 2. 获取今日新增密钥
    const { data: todayKeys, error: todayError } = await supabaseAdmin
      .from('access_keys')
      .select('id')
      .gte('created_at', today.toISOString())
      .lt('created_at', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString())

    // 3. 获取昨日新增密钥
    const { data: yesterdayKeys, error: yesterdayError } = await supabaseAdmin
      .from('access_keys')
      .select('id')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())

    // 4. 获取使用统计
    const { data: usageStats, error: usageError } = await supabaseAdmin
      .from('key_usage_history')
      .select('used_at, user_id, access_key_id')

    // 计算统计数据
    const totalKeys = keys?.length || 0
    const activeKeys = keys?.filter(k => k.is_active && (!k.key_expires_at || new Date(k.key_expires_at) > now)).length || 0
    const usedKeys = keys?.filter(k => k.used_at !== null || k.user_id !== null).length || 0
    const unusedKeys = keys?.filter(k => k.used_at === null && k.user_id === null && k.is_active).length || 0
    const expiredKeys = keys?.filter(k => k.key_expires_at && new Date(k.key_expires_at) < now).length || 0
    const inactiveKeys = keys?.filter(k => !k.is_active).length || 0

    // 计算今日过期和即将过期
    const todayExpiring = keys?.filter(k => {
      if (!k.key_expires_at) return false
      const expiry = new Date(k.key_expires_at)
      return expiry.toDateString() === today.toDateString()
    }).length || 0

    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const nearExpiring = keys?.filter(k => {
      if (!k.key_expires_at) return false
      const expiry = new Date(k.key_expires_at)
      return expiry > now && expiry <= sevenDaysLater
    }).length || 0

    // 计算时长分布
    const durationDistribution: Record<string, number> = {
      '1小时': 0,
      '2小时': 0,
      '4小时': 0,
      '12小时': 0,
      '1天': 0,
      '7天': 0,
      '30天': 0,
      '90天': 0,
      '180天': 0,
      '365天': 0,
      '其他': 0
    }

    keys?.forEach(key => {
      const hours = key.original_duration_hours || (key.account_valid_for_days * 24)
      
      if (hours === 1) durationDistribution['1小时']++
      else if (hours === 2) durationDistribution['2小时']++
      else if (hours === 4) durationDistribution['4小时']++
      else if (hours === 12) durationDistribution['12小时']++
      else if (hours === 24) durationDistribution['1天']++
      else if (hours === 24 * 7) durationDistribution['7天']++
      else if (hours === 24 * 30) durationDistribution['30天']++
      else if (hours === 24 * 90) durationDistribution['90天']++
      else if (hours === 24 * 180) durationDistribution['180天']++
      else if (hours === 24 * 365) durationDistribution['365天']++
      else durationDistribution['其他']++
    })

    // 计算使用统计
    const totalUses = usageStats?.length || 0
    const uniqueUsers = new Set(usageStats?.map(u => u.user_id) || []).size
    const usageRate = totalKeys > 0 ? (usedKeys / totalKeys * 100).toFixed(1) : '0'

    // 计算增长统计
    const todayNew = todayKeys?.length || 0
    const yesterdayNew = yesterdayKeys?.length || 0
    const dailyGrowth = yesterdayNew > 0 
      ? (((todayNew - yesterdayNew) / yesterdayNew) * 100).toFixed(1)
      : '0'

    const response = {
      success: true,
      data: {
        overview: {
          total_keys: totalKeys,
          active_keys: activeKeys,
          used_keys: usedKeys,
          unused_keys: unusedKeys,
          expired_keys: expiredKeys,
          disabled_keys: inactiveKeys,
          today_expiring: todayExpiring,
          near_expiring: nearExpiring
        },
        growth: {
          today: todayNew,
          yesterday: yesterdayNew,
          daily_growth: dailyGrowth,
          week: keys?.filter(k => new Date(k.created_at) >= sevenDaysAgo).length || 0,
          month: keys?.filter(k => new Date(k.created_at) >= thirtyDaysAgo).length || 0
        },
        usage: {
          total_uses: totalUses,
          unique_users: uniqueUsers,
          usage_rate: usageRate,
          avg_uses_per_key: totalKeys > 0 ? (totalUses / totalKeys).toFixed(2) : '0'
        },
        distribution: {
          duration: durationDistribution
        },
        trends: {
          daily_usage: {
            today: usageStats?.filter(u => new Date(u.used_at) >= today).length || 0,
            yesterday: usageStats?.filter(u => new Date(u.used_at) >= yesterday && new Date(u.used_at) < today).length || 0
          }
        }
      },
      timestamp: now.toISOString()
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('💥 获取统计信息失败:', error)
    return NextResponse.json(
      { success: false, error: error.message || '获取统计失败' },
      { status: 500 }
    )
  }
}