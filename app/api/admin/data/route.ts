// /app/api/admin/data/route.ts - 完整优化版本（支持密钥历史记录）
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// 环境变量类型检查
interface EnvConfig {
  NEXT_PUBLIC_SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔐 API请求开始:', {
      url: request.url,
      timestamp: new Date().toISOString(),
      hasCookie: !!request.cookies.get('admin_key_verified')
    })

    // 1. 多重身份验证
    const authMethods = {
      cookie: request.cookies.get('admin_key_verified'),
      referer: request.headers.get('referer'),
      userAgent: request.headers.get('user-agent')
    }

    const isAuthenticated = 
      authMethods.cookie || 
      (authMethods.referer?.includes('/admin/') && authMethods.userAgent)

    if (!isAuthenticated) {
      console.warn('❌ 未经授权的API访问:', {
        hasCookie: !!authMethods.cookie,
        referer: authMethods.referer,
        userAgent: authMethods.userAgent?.substring(0, 50)
      })
      
      return NextResponse.json(
        { 
          success: false, 
          error: '未授权访问',
          code: 'UNAUTHORIZED_ACCESS'
        },
        { status: 401 }
      )
    }

    // 2. 环境变量验证
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ] as const

    const missingEnvVars = requiredEnvVars.filter(
      env => !process.env[env]
    )

    if (missingEnvVars.length > 0) {
      console.error('❌ 缺少环境变量:', missingEnvVars)
      return NextResponse.json(
        { 
          success: false, 
          error: '服务器配置不完整',
          missing: missingEnvVars 
        },
        { status: 500 }
      )
    }

    // 3. 创建Supabase管理员客户端
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: { headers: { 'x-application-name': 'love-ludo-admin-api' } }
      }
    )

    // 4. 解析查询参数
    const { searchParams } = new URL(request.url)
    const table = searchParams.get('table')
    const detailId = searchParams.get('detailId')
    const search = searchParams.get('search')
    const filter = searchParams.get('filter')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const offset = (page - 1) * limit

    console.log('📊 API查询参数:', {
      table,
      detailId,
      search,
      filter,
      page,
      limit,
      offset
    })

    // 5. 处理用户详情查询（重点优化）
    if (table === 'profiles' && detailId) {
      console.log(`🔍 查询用户详情: ${detailId}`)
      
      try {
        // 🔥 并行查询所有相关数据，提高性能
        const [
          profileResult,
          keyUsageHistoryResult,
          currentKeyResult,
          aiUsageResult,
          gameHistoriesResult
        ] = await Promise.allSettled([
          // 用户基本信息
          supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', detailId)
            .single(),

          // 🔥 新：查询密钥使用历史（包含密钥详情和操作者信息）
          supabaseAdmin
            .from('key_usage_history')
            .select(`
              *,
              access_key:access_keys (
                id,
                key_code,
                is_active,
                used_count,
                max_uses,
                key_expires_at,
                account_valid_for_days,
                user_id,
                used_at,
                created_at,
                updated_at
              ),
              operator:profiles!key_usage_history_operation_by_fkey (
                id,
                email,
                nickname
              )
            `)
            .eq('user_id', detailId)
            .order('used_at', { ascending: false })
            .limit(20),

          // 🔥 查询当前使用的密钥
          supabaseAdmin
            .from('profiles')
            .select('access_key_id')
            .eq('id', detailId)
            .single()
            .then(async (profile) => {
              if (profile.data?.access_key_id) {
                return supabaseAdmin
                  .from('access_keys')
                  .select('*')
                  .eq('id', profile.data.access_key_id)
                  .single()
              }
              return { data: null, error: null }
            }),

          // 🔥 AI使用记录（优化查询）
          supabaseAdmin
            .from('ai_usage_records')
            .select('*')
            .eq('user_id', detailId)
            .order('created_at', { ascending: false })
            .limit(20),

          // 游戏历史记录
          supabaseAdmin
            .from('game_history')
            .select('*')
            .or(`player1_id.eq.${detailId},player2_id.eq.${detailId}`)
            .order('started_at', { ascending: false })
            .limit(10)
        ])

        // 处理查询结果
        const profileData = 
          profileResult.status === 'fulfilled' && profileResult.value.data 
            ? profileResult.value.data 
            : null

        if (!profileData) {
          console.error('❌ 用户不存在:', detailId)
          return NextResponse.json(
            { success: false, error: '用户不存在' },
            { status: 404 }
          )
        }

        // 🔥 处理密钥使用历史
        const keyUsageHistory = 
          keyUsageHistoryResult.status === 'fulfilled' && keyUsageHistoryResult.value.data 
            ? keyUsageHistoryResult.value.data 
            : []

        console.log('🗝️ 密钥使用历史查询结果:', {
          记录数量: keyUsageHistory.length,
          第一条记录: keyUsageHistory[0] || '无'
        })

        // 🔥 从使用历史中提取所有唯一密钥（用于兼容性）
        const uniqueKeysMap = new Map<number, any>()
        if (keyUsageHistory.length > 0) {
          keyUsageHistory.forEach(record => {
            if (record.access_key && !uniqueKeysMap.has(record.access_key.id)) {
              uniqueKeysMap.set(record.access_key.id, record.access_key)
            }
          })
        }

        // 🔥 当前使用的密钥
        let currentKey = null
        if (currentKeyResult.status === 'fulfilled' && currentKeyResult.value.data) {
          currentKey = currentKeyResult.value.data
          // 如果当前密钥不在历史记录中，也添加到uniqueKeysMap
          if (currentKey && !uniqueKeysMap.has(currentKey.id)) {
            uniqueKeysMap.set(currentKey.id, currentKey)
          }
        }

        const allKeys = Array.from(uniqueKeysMap.values())

        // 🔥 AI记录（确保有数据）
        const aiUsageRecords = 
          aiUsageResult.status === 'fulfilled' && aiUsageResult.value.data 
            ? aiUsageResult.value.data 
            : []

        console.log('🤖 AI记录查询结果:', {
          记录数量: aiUsageRecords.length,
          查询状态: aiUsageResult.status,
          第一条记录: aiUsageRecords[0] || '无'
        })

        // 如果AI记录查询异常，尝试直接查询
        if (aiUsageRecords.length === 0) {
          console.log('🔄 尝试直接查询AI记录...')
          const { data: directAiRecords, error: directAiError } = await supabaseAdmin
            .from('ai_usage_records')
            .select('*')
            .eq('user_id', detailId)
            .order('created_at', { ascending: false })
            .limit(10)
          
          if (!directAiError && directAiRecords && directAiRecords.length > 0) {
            console.log('✅ 直接查询成功，获取到AI记录:', directAiRecords.length)
            aiUsageRecords.push(...directAiRecords)
          }
        }

        // 游戏记录
        const gameHistory = 
          gameHistoriesResult.status === 'fulfilled' && gameHistoriesResult.value.data
            ? gameHistoriesResult.value.data
            : []

        console.log('✅ 用户详情查询成功:', {
          用户: profileData.email,
          密钥使用历史记录数: keyUsageHistory.length,
          唯一密钥数: allKeys.length,
          AI记录数: aiUsageRecords.length,
          游戏记录数: gameHistory.length,
          当前密钥: currentKey ? currentKey.key_code : '无'
        })

        // 🔥 构建返回数据（统一驼峰命名）
        return NextResponse.json({
          success: true,
          data: {
            // 基本字段（驼峰）
            id: profileData.id,
            email: profileData.email,
            nickname: profileData.nickname,
            fullName: profileData.full_name,
            avatarUrl: profileData.avatar_url,
            bio: profileData.bio,
            preferences: profileData.preferences,
            accountExpiresAt: profileData.account_expires_at,
            lastLoginAt: profileData.last_login_at,
            lastLoginSession: profileData.last_login_session,
            accessKeyId: profileData.access_key_id,
            createdAt: profileData.created_at,
            updatedAt: profileData.updated_at,
            
            // 🔥 新增：密钥使用历史
            keyUsageHistory: keyUsageHistory.map(record => ({
              id: record.id,
              userId: record.user_id,
              accessKeyId: record.access_key_id,
              usedAt: record.used_at,
              usageType: record.usage_type || 'activate',
              previousKeyId: record.previous_key_id,
              nextKeyId: record.next_key_id,
              operationBy: record.operation_by,
              notes: record.notes,
              createdAt: record.created_at,
              updatedAt: record.updated_at,
              
              // 关联的密钥详情
              accessKey: record.access_key ? {
                id: record.access_key.id,
                keyCode: record.access_key.key_code,
                isActive: record.access_key.is_active,
                usedCount: record.access_key.used_count,
                maxUses: record.access_key.max_uses,
                keyExpiresAt: record.access_key.key_expires_at,
                accountValidForDays: record.access_key.account_valid_for_days,
                userId: record.access_key.user_id,
                usedAt: record.access_key.used_at,
                createdAt: record.access_key.created_at,
                updatedAt: record.access_key.updated_at
              } : null,
              
              // 操作者信息
              operator: record.operator ? {
                id: record.operator.id,
                email: record.operator.email,
                nickname: record.operator.nickname
              } : null
            })),
            
            // 🔥 当前使用的密钥（如果有）
            currentAccessKey: currentKey ? {
              id: currentKey.id,
              keyCode: currentKey.key_code,
              isActive: currentKey.is_active,
              usedCount: currentKey.used_count,
              maxUses: currentKey.max_uses,
              keyExpiresAt: currentKey.key_expires_at,
              accountValidForDays: currentKey.account_valid_for_days,
              userId: currentKey.user_id,
              usedAt: currentKey.used_at,
              createdAt: currentKey.created_at,
              updatedAt: currentKey.updated_at
            } : null,
            
            // 🔥 兼容性：所有密钥（从使用历史中提取）
            accessKeys: allKeys.map(key => ({
              id: key.id,
              keyCode: key.key_code,
              isActive: key.is_active,
              usedCount: key.used_count,
              maxUses: key.max_uses,
              keyExpiresAt: key.key_expires_at,
              accountValidForDays: key.account_valid_for_days,
              userId: key.user_id,
              usedAt: key.used_at,
              createdAt: key.created_at,
              updatedAt: key.updated_at
            })),
            
            // 🔥 AI使用记录（确保有数据）
            aiUsageRecords: aiUsageRecords.map(record => ({
              id: record.id,
              userId: record.user_id,
              feature: record.feature,
              createdAt: record.created_at,
              requestData: record.request_data,
              responseData: record.response_data,
              success: record.success
            })),
            
            // 游戏历史记录
            gameHistory: gameHistory.map(game => ({
              id: game.id,
              roomId: game.room_id,
              sessionId: game.session_id,
              player1Id: game.player1_id,
              player2Id: game.player2_id,
              winnerId: game.winner_id,
              startedAt: game.started_at,
              endedAt: game.ended_at,
              taskResults: game.task_results || []
            }))
          }
        })

      } catch (error: any) {
        console.error('❌ 用户详情查询异常:', error)
        return NextResponse.json(
          { 
            success: false, 
            error: '获取用户详情失败',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          },
          { status: 500 }
        )
      }
    }

    // 6. 处理profiles列表查询
    if (table === 'profiles' && !detailId) {
      console.log('📋 查询用户列表...')
      
      try {
        // 构建基础查询
        let query = supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact' })

        // 应用搜索条件
        if (search && search.trim()) {
          const searchTerm = `%${search.trim()}%`
          query = query.or(
            `email.ilike.${searchTerm},nickname.ilike.${searchTerm}`
          )
        }

        // 应用筛选条件
        const now = new Date().toISOString()
        if (filter) {
          switch (filter) {
            case 'premium':
              query = query.gt('account_expires_at', now)
              break
            case 'free':
              query = query.or(
                `account_expires_at.lte.${now},account_expires_at.is.null`
              )
              break
            case 'active24h':
              const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
              query = query.gt('last_login_at', yesterday)
              break
            case 'expired':
              query = query.lt('account_expires_at', now)
              break
          }
        }

        // 执行分页查询
        const { data: profiles, error: listError, count } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (listError) {
          console.error('❌ 用户列表查询失败:', listError)
          throw listError
        }

        console.log(`✅ 用户列表查询成功: ${profiles?.length || 0} 条记录`)

        return NextResponse.json({
          success: true,
          data: profiles || [],
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
            hasNextPage: (count || 0) > offset + limit
          }
        })

      } catch (error: any) {
        console.error('❌ 用户列表查询异常:', error)
        return NextResponse.json(
          { 
            success: false, 
            error: '获取用户列表失败',
            data: [], // 返回空数组确保前端不崩溃
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
          },
          { status: 500 }
        )
      }
    }

    // 7. 处理其他表查询（如需）
    return NextResponse.json(
      { success: false, error: `不支持的表名: ${table}` },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('💥 API全局错误:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3),
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
        code: 'INTERNAL_SERVER_ERROR'
      },
      { status: 500 }
    )
  }
}

// 支持其他HTTP方法
export async function POST() {
  return NextResponse.json(
    { success: false, error: '暂不支持POST方法' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { success: false, error: '暂不支持PUT方法' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { success: false, error: '暂不支持DELETE方法' },
    { status: 405 }
  )
}
