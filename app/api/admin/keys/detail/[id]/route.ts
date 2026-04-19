// /app/api/admin/keys/detail/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const keyId = parseInt(context.params.id)
    if (!keyId || isNaN(keyId)) {
      return NextResponse.json({
        success: false,
        error: '无效的密钥ID'
      }, { status: 400 })
    }

    console.log(`🔍 获取密钥详情 ID: ${keyId}`)

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: validation.error
      }, { status: validation.status })
    }

    const supabaseAdmin = createAdminClient()

    // 4. 获取密钥基础信息
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('access_keys')
      .select(`
        *,
        profiles:user_id (
          id,
          email,
          nickname
        )
      `)
      .eq('id', keyId)
      .single()

    if (keyError) {
      console.error('❌ 查询密钥失败:', keyError)
      return NextResponse.json({
        success: false,
        error: '密钥不存在或查询失败'
      }, { status: 404 })
    }

    // 5. 获取使用历史
    const { data: usageHistory, error: historyError } = await supabaseAdmin
      .from('key_usage_history')
      .select(`
        *,
        profiles:user_id (
          id,
          email,
          nickname
        ),
        operator:operation_by (
          id,
          email,
          nickname
        )
      `)
      .eq('access_key_id', keyId)
      .order('used_at', { ascending: false })

    if (historyError) {
      console.error('❌ 查询使用历史失败:', historyError)
    }

    // 6. 获取相关用户信息（所有使用过该密钥的用户）
    const userIds = Array.from(new Set([
      keyData.user_id,
      ...(usageHistory?.map(h => h.user_id) || []),
      ...(usageHistory?.map(h => h.operation_by).filter(Boolean) || [])
    ])).filter(Boolean) as string[]

    let users: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('profiles')
        .select('id, email, nickname, created_at')
        .in('id', userIds)

      usersData?.forEach(user => {
        users[user.id] = user
      })
    }

    // 7. 处理使用历史数据
    const processedHistory = (usageHistory || []).map(history => ({
      id: history.id,
      used_at: history.used_at,
      usage_type: history.usage_type,
      notes: history.notes,
      user: history.user_id ? {
        id: history.user_id,
        email: users[history.user_id]?.email || history.profiles?.email,
        nickname: users[history.user_id]?.nickname || history.profiles?.nickname
      } : null,
      operator: history.operation_by ? {
        id: history.operation_by,
        email: users[history.operation_by]?.email || history.operator?.email,
        nickname: users[history.operation_by]?.nickname || history.operator?.nickname
      } : null,
      previous_key_id: history.previous_key_id,
      next_key_id: history.next_key_id
    }))

    // 8. 计算统计信息
    const now = new Date()
    const totalUses = processedHistory.length
    const uniqueUsers = new Set(processedHistory.map(h => h.user?.id).filter(Boolean)).size
    
    // 计算平均使用时长（如果有多次激活）
    const activationHistory = processedHistory.filter(h => h.usage_type === 'activate')
    let averageDurationHours = 0
    if (activationHistory.length > 0) {
      const totalHours = activationHistory.reduce((sum, record) => {
        const hours = keyData.original_duration_hours || keyData.account_valid_for_days * 24
        return sum + hours
      }, 0)
      averageDurationHours = totalHours / activationHistory.length
    }

    // 9. 构建响应数据
    const response = {
      key_info: {
        id: keyData.id,
        key_code: keyData.key_code,
        description: keyData.description,
        is_active: keyData.is_active,
        account_valid_for_days: keyData.account_valid_for_days,
        original_duration_hours: keyData.original_duration_hours,
        duration_unit: keyData.duration_unit,
        max_uses: keyData.max_uses,
        used_count: keyData.used_count || 0,
        key_expires_at: keyData.key_expires_at,
        created_at: keyData.created_at,
        updated_at: keyData.updated_at,
        used_at: keyData.used_at,
        user_id: keyData.user_id,
        
        // 计算状态
        status: (() => {
          if (!keyData.is_active) return 'disabled'
          if (keyData.key_expires_at && new Date(keyData.key_expires_at) < now) return 'expired'
          if (totalUses > 0 || keyData.used_at) return 'used'
          return 'unused'
        })()
      },
      
      current_usage: keyData.user_id ? {
        user: {
          id: keyData.user_id,
          email: keyData.profiles?.email,
          nickname: keyData.profiles?.nickname
        },
        used_at: keyData.used_at,
        notes: processedHistory.find(h => h.usage_type === 'activate' && h.user?.id === keyData.user_id)?.notes
      } : null,
      
      usage_history: processedHistory,
      
      statistics: {
        total_uses: totalUses,
        unique_users: uniqueUsers,
        average_duration_hours: Math.round(averageDurationHours * 100) / 100,
        first_use: processedHistory.length > 0 ? processedHistory[processedHistory.length - 1].used_at : null,
        last_use: processedHistory.length > 0 ? processedHistory[0].used_at : null,
        usage_by_type: processedHistory.reduce((acc, record) => {
          acc[record.usage_type] = (acc[record.usage_type] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      },
      
      related_keys: {
        previous_keys: processedHistory
          .filter(h => h.previous_key_id)
          .map(h => h.previous_key_id),
        next_keys: processedHistory
          .filter(h => h.next_key_id)
          .map(h => h.next_key_id)
      }
    }

    console.log(`✅ 密钥详情查询成功，包含 ${processedHistory.length} 条使用记录`)

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('💥 获取密钥详情异常:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
}