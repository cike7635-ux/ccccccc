// /app/api/admin/data/route.ts - 完整优化版本
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
          keysByUserIdResult,
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

          // 🔥 优化1：通过user_id查询用户使用过的密钥
          supabaseAdmin
            .from('access_keys')
            .select('*')
            .eq('user_id', detailId)
            .order('created_at', { ascending: false }),

          // 🔥 优化2：通过access_key_id查询当前使用的密钥
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
            .limit(10),

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

        // 🔥 优化3：合并密钥记录，去重
        const allKeys = new Map<number, any>()
        
        // 来自user_id查询的密钥
        if (keysByUserIdResult.status === 'fulfilled' && keysByUserIdResult.value.data) {
          keysByUserIdResult.value.data.forEach(key => {
            allKeys.set(key.id, key)
          })
        }
        
        // 当前使用的密钥
        if (currentKeyResult.status === 'fulfilled' && currentKeyResult.value.data) {
          const currentKey = currentKeyResult.value.data
          if (currentKey && !allKeys.has(currentKey.id)) {
            allKeys.set(currentKey.id, currentKey)
          }
        }
        
        const accessKeys = Array.from(allKeys.values())

        // AI记录
        const aiUsageRecords = 
          aiUsageResult.status === 'fulfilled' && aiUsageResult.value.data 
            ? aiUsageResult.value.data 
            : []

        // 游戏记录
        const gameHistory = 
          gameHistoriesResult.status === 'fulfilled' && gameHistoriesResult.value.data
            ? gameHistoriesResult.value.data
            : []

        console.log('✅ 用户详情查询成功:', {
          用户: profileData.email,
          密钥记录数: accessKeys.length,
          AI记录数: aiUsageRecords.length,
          游戏记录数: gameHistory.length
        })

        // 🔥 优化4：返回统一的驼峰命名格式
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
            
            // 关联字段（驼峰）
            accessKeys: accessKeys.map(key => ({
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
            
            aiUsageRecords: aiUsageRecords.map(record => ({
              id: record.id,
              userId: record.user_id,
              feature: record.feature,
              createdAt: record.created_at,
              requestData: record.request_data,
              responseData: record.response_data,
              success: record.success
            })),
            
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