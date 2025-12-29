import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
      console.warn('❌ 未经授权的API访问:', authMethods)
      return NextResponse.json(
        { success: false, error: '未授权访问', code: 'UNAUTHORIZED_ACCESS' },
        { status: 401 }
      )
    }

    // 2. 环境变量验证
    const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    const missingEnvVars = requiredEnvVars.filter(env => !process.env[env])

    if (missingEnvVars.length > 0) {
      console.error('❌ 缺少环境变量:', missingEnvVars)
      return NextResponse.json(
        { success: false, error: '服务器配置不完整', missing: missingEnvVars },
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

    console.log('📊 API查询参数:', { table, detailId, search, filter, page, limit, offset })

    // 5. 处理用户详情查询
    if (table === 'profiles' && detailId) {
      console.log(`🔍 查询用户详情: ${detailId}`)

      try {
        // 🔧 修复：并行查询所有相关数据（修复密钥查询关联）
        const [profileResult, keyUsageHistoryResult, currentKeyResult, aiUsageResult, gameHistoriesResult] =
          await Promise.allSettled([
            // 用户基本信息
            supabaseAdmin
              .from('profiles')
              .select('*')
              .eq('id', detailId)
              .single(),

            // 🔥 关键修复：密钥使用历史查询 - 使用正确的关联关系
            supabaseAdmin
              .from('key_usage_history')
              .select(`
                *,
                access_key:access_keys!key_usage_history_access_key_id_fkey (
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

            // 查询当前使用的密钥
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

            // AI使用记录
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
        const profileData = profileResult.status === 'fulfilled' && profileResult.value.data
          ? profileResult.value.data
          : null

        if (!profileData) {
          console.error('❌ 用户不存在:', detailId)
          return NextResponse.json(
            { success: false, error: '用户不存在' },
            { status: 404 }
          )
        }

        // 处理密钥使用历史
        const keyUsageHistory = keyUsageHistoryResult.status === 'fulfilled' && keyUsageHistoryResult.value.data
          ? keyUsageHistoryResult.value.data
          : []

        console.log('🗝️ 密钥使用历史查询结果:', { 记录数量: keyUsageHistory.length })

        // 从使用历史中提取所有唯一密钥
        const uniqueKeysMap = new Map<number, any>()
        if (keyUsageHistory.length > 0) {
          keyUsageHistory.forEach(record => {
            if (record.access_key && !uniqueKeysMap.has(record.access_key.id)) {
              uniqueKeysMap.set(record.access_key.id, record.access_key)
            }
          })
        }

        // 当前使用的密钥
        let currentKey = null
        if (currentKeyResult.status === 'fulfilled' && currentKeyResult.value.data) {
          currentKey = currentKeyResult.value.data
          if (currentKey && !uniqueKeysMap.has(currentKey.id)) {
            uniqueKeysMap.set(currentKey.id, currentKey)
          }
        }

        const allKeys = Array.from(uniqueKeysMap.values())

        // AI记录
        let aiUsageRecords = aiUsageResult.status === 'fulfilled' && aiUsageResult.value.data
          ? aiUsageResult.value.data
          : []

        console.log('🤖 AI记录查询结果:', { 记录数量: aiUsageRecords.length })

        // 如果AI记录查询异常，尝试直接查询
        if (aiUsageRecords.length === 0) {
          console.log('🔄 尝试直接查询AI记录...')
          const { data: directAiRecords } = await supabaseAdmin
            .from('ai_usage_records')
            .select('*')
            .eq('user_id', detailId)
            .order('created_at', { ascending: false })
            .limit(10)

          if (directAiRecords && directAiRecords.length > 0) {
            console.log('✅ 直接查询成功，获取到AI记录:', directAiRecords.length)
            aiUsageRecords = directAiRecords
          }
        }

        // 游戏记录
        const gameHistory = gameHistoriesResult.status === 'fulfilled' && gameHistoriesResult.value.data
          ? gameHistoriesResult.value.data
          : []

        console.log('✅ 用户详情查询成功:', {
          用户: profileData.email,
          唯一密钥数: allKeys.length,
          AI记录数: aiUsageRecords.length,
          游戏记录数: gameHistory.length,
          当前密钥: currentKey ? currentKey.key_code : '无'
        })

        // 统一使用下划线命名
        return NextResponse.json({
          success: true,
          data: {
            // 基本字段（下划线命名）
            id: profileData.id,
            email: profileData.email,
            nickname: profileData.nickname,
            full_name: profileData.full_name,
            avatar_url: profileData.avatar_url,
            bio: profileData.bio,
            preferences: profileData.preferences,
            account_expires_at: profileData.account_expires_at,
            last_login_at: profileData.last_login_at,
            last_login_session: profileData.last_login_session,
            access_key_id: profileData.access_key_id,
            created_at: profileData.created_at,
            updated_at: profileData.updated_at,

            // 密钥使用历史（下划线命名）
            key_usage_history: keyUsageHistory.map(record => ({
              id: record.id,
              user_id: record.user_id,
              access_key_id: record.access_key_id,
              used_at: record.used_at,
              usage_type: record.usage_type || 'activate',
              previous_key_id: record.previous_key_id,
              next_key_id: record.next_key_id,
              operation_by: record.operation_by,
              notes: record.notes,
              created_at: record.created_at,
              updated_at: record.updated_at,

              access_key: record.access_key ? {
                id: record.access_key.id,
                key_code: record.access_key.key_code,
                is_active: record.access_key.is_active,
                used_count: record.access_key.used_count,
                max_uses: record.access_key.max_uses,
                key_expires_at: record.access_key.key_expires_at,
                account_valid_for_days: record.access_key.account_valid_for_days,
                user_id: record.access_key.user_id,
                used_at: record.access_key.used_at,
                created_at: record.access_key.created_at,
                updated_at: record.access_key.updated_at
              } : null,

              operator: record.operator ? {
                id: record.operator.id,
                email: record.operator.email,
                nickname: record.operator.nickname
              } : null
            })),

            // 当前使用的密钥（下划线命名）
            current_access_key: currentKey ? {
              id: currentKey.id,
              key_code: currentKey.key_code,
              is_active: currentKey.is_active,
              used_count: currentKey.used_count,
              max_uses: currentKey.max_uses,
              key_expires_at: currentKey.key_expires_at,
              account_valid_for_days: currentKey.account_valid_for_days,
              user_id: currentKey.user_id,
              used_at: currentKey.used_at,
              created_at: currentKey.created_at,
              updated_at: currentKey.updated_at
            } : null,

            // 所有密钥（下划线命名）
            access_keys: allKeys.map(key => ({
              id: key.id,
              key_code: key.key_code,
              is_active: key.is_active,
              used_count: key.used_count,
              max_uses: key.max_uses,
              key_expires_at: key.key_expires_at,
              account_valid_for_days: key.account_valid_for_days,
              user_id: key.user_id,
              used_at: key.used_at,
              created_at: key.created_at,
              updated_at: key.updated_at
            })),

            // AI使用记录（下划线命名）
            ai_usage_records: aiUsageRecords.map(record => ({
              id: record.id,
              user_id: record.user_id,
              feature: record.feature,
              created_at: record.created_at,
              request_data: record.request_data,
              response_data: record.response_data,
              success: record.success
            })),

            // 游戏历史记录（下划线命名）
            game_history: gameHistory.map(game => ({
              id: game.id,
              room_id: game.room_id,
              session_id: game.session_id,
              player1_id: game.player1_id,
              player2_id: game.player2_id,
              winner_id: game.winner_id,
              started_at: game.started_at,
              ended_at: game.ended_at,
              task_results: game.task_results || []
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
          query = query.or(`email.ilike.${searchTerm},nickname.ilike.${searchTerm}`)
        }

        // 应用筛选条件
        const now = new Date().toISOString()
        if (filter) {
          switch (filter) {
            case 'premium':
              query = query.gt('account_expires_at', now)
              break
            case 'free':
              query = query.or(`account_expires_at.lte.${now},account_expires_at.is.null`)
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

        // 应用分页
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const start = (page - 1) * limit
        const end = start + limit - 1
        query = query.range(start, end)

        // 默认按创建时间排序
        query = query.order('created_at', { ascending: false })

        console.log(`📊 执行查询: page=${page}, limit=${limit}, filter=${filter}, search=${search}`)

        // 执行查询
        const result = await query

        if (result.error) {
          console.error('❌ 查询用户列表失败:', result.error)
          return NextResponse.json({
            success: false,
            error: '数据库查询失败: ' + result.error.message
          }, { status: 500 })
        }

        console.log(`✅ 查询成功: ${result.data?.length || 0} 条记录，总数: ${result.count}`)

        // 如果没有用户数据，直接返回
        if (!result.data || result.data.length === 0) {
          return NextResponse.json({
            success: true,
            data: [],
            pagination: {
              total: result.count || 0,
              page,
              limit,
              totalPages: Math.ceil((result.count || 0) / limit)
            }
          })
        }

        // 收集所有用户ID
        const userIds = result.data.map((profile: any) => profile.id)

        console.log(`🔑 为 ${userIds.length} 个用户查询密钥信息...`)

        // 通过profiles.access_key_id关联查询密钥
        const accessKeyIds = result.data
          .map((profile: any) => profile.access_key_id)
          .filter((id): id is number => id !== null && id !== undefined)

        let accessKeysData = []
        let accessKeysError = null

        if (accessKeyIds.length > 0) {
          // 方法1：直接通过access_key_id查询密钥表
          const { data: keysById, error: error1 } = await supabaseAdmin
            .from('access_keys')
            .select('*')
            .in('id', accessKeyIds)

          if (!error1 && keysById) {
            accessKeysData = keysById
            console.log(`✅ 通过access_key_id查询到 ${accessKeysData.length} 条密钥记录`)
          } else {
            console.warn('通过access_key_id查询密钥失败，尝试备用方案:', error1)

            // 方法2（备用）：通过key_usage_history表关联查询
            const { data: keyUsageData, error: error2 } = await supabaseAdmin
              .from('key_usage_history')
              .select(`
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
                )
              `)
              .in('user_id', userIds)
              .order('used_at', { ascending: false })

            if (!error2 && keyUsageData) {
              // 从key_usage_history中提取唯一的密钥
              const uniqueKeys = new Map()
              keyUsageData.forEach(record => {
                if (record.access_key && !uniqueKeys.has(record.access_key.id)) {
                  uniqueKeys.set(record.access_key.id, record.access_key)
                }
              })
              accessKeysData = Array.from(uniqueKeys.values())
              console.log(`✅ 通过key_usage_history查询到 ${accessKeysData.length} 条密钥记录`)
            } else {
              accessKeysError = error2
            }
          }
        }

        if (accessKeysError) {
          console.error('❌ 查询用户密钥失败:', accessKeysError)
          // 即使密钥查询失败，也返回用户数据（只是没有密钥信息）
          return NextResponse.json({
            success: true,
            data: result.data,
            pagination: {
              total: result.count || 0,
              page,
              limit,
              totalPages: Math.ceil((result.count || 0) / limit)
            }
          })
        }

        console.log(`✅ 获取到 ${accessKeysData?.length || 0} 条密钥记录`)

        // 建立 access_key_id 到密钥对象的映射
        const keyMap = new Map()
        if (accessKeysData && accessKeysData.length > 0) {
          accessKeysData.forEach((key: any) => {
            keyMap.set(key.id, key)
          })
        }

        // 为每个用户添加密钥信息
        const profilesWithKeys = result.data.map((profile: any) => {
          let currentAccessKey = null

          if (profile.access_key_id && keyMap.has(profile.access_key_id)) {
            currentAccessKey = keyMap.get(profile.access_key_id)
          }

          console.log(`用户 ${profile.email} 的密钥查找:`, {
            access_key_id: profile.access_key_id,
            是否找到: !!currentAccessKey,
            密钥代码: currentAccessKey?.key_code,
            密钥ID: currentAccessKey?.id
          })

          return {
            ...profile,
            access_keys: currentAccessKey ? [currentAccessKey] : [],
            current_access_key: currentAccessKey || null
          }
        })

        console.log(`✅ 返回 ${profilesWithKeys.length} 个用户数据，包含密钥信息`)

        return NextResponse.json({
          success: true,
          data: profilesWithKeys,
          pagination: {
            total: result.count || 0,
            page,
            limit,
            totalPages: Math.ceil((result.count || 0) / limit)
          }
        })

      } catch (error: any) {
        console.error('❌ 查询用户列表异常:', error)
        return NextResponse.json({
          success: false,
          error: '服务器内部错误: ' + error.message
        }, { status: 500 })
      }
    }

    // 7. 处理其他表查询
    return NextResponse.json(
      { success: false, error: `不支持的表名: ${table}` },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('💥 API全局错误:', error)
    return NextResponse.json(
      { success: false, error: '服务器内部错误', code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    )
  }
}

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