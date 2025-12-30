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
        // 查询用户基本信息
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', detailId)
          .single()

        if (profileError || !profileData) {
          console.error('❌ 用户不存在:', detailId)
          return NextResponse.json(
            { success: false, error: '用户不存在' },
            { status: 404 }
          )
        }

        // 🔧 修复：使用明确的外键约束名称进行关联查询，并返回 used_count 字段
        const { data: keyUsageHistory, error: keyUsageHistoryError, count: keyUsageHistoryCount } = await supabaseAdmin
          .from('key_usage_history')
          .select(`
            id,
            user_id,
            access_key_id,
            used_at,
            usage_type,
            previous_key_id,
            next_key_id,
            operation_by,
            notes,
            created_at,
            updated_at,
            access_keys!key_usage_history_access_key_id_fkey (
              id,
              key_code,
              is_active,
              used_count,  -- 🔧 添加这个字段
              key_expires_at,
              created_at
            )
          `, { count: 'exact' })
          .eq('user_id', detailId)
          .order('used_at', { ascending: false })
          .limit(20)

        console.log('🗝️ 密钥使用历史查询结果:', { 
          记录数量: keyUsageHistory?.length || 0,
          总记录数: keyUsageHistoryCount || 0,
          错误: keyUsageHistoryError?.message 
        })

        // 🔧 修复：如果关联查询失败，使用回退方案（分别查询）
        let processedKeyUsageHistory = []
        let finalKeyHistoryCount = keyUsageHistoryCount || 0

        if (keyUsageHistoryError) {
          console.log('⚠️ 关联查询失败，使用分别查询方案...')
          
          // 分别查询：先查密钥历史，再查关联的密钥
          const { data: rawKeyUsageHistory, count: rawCount } = await supabaseAdmin
            .from('key_usage_history')
            .select('*', { count: 'exact' })
            .eq('user_id', detailId)
            .order('used_at', { ascending: false })
            .limit(20)
          
          finalKeyHistoryCount = rawCount || 0
          
          if (rawKeyUsageHistory && rawKeyUsageHistory.length > 0) {
            // 收集所有access_key_id
            const accessKeyIds = rawKeyUsageHistory
              .map(record => record.access_key_id)
              .filter(Boolean)
            
            // 查询关联的密钥信息（包含 used_count）
            let keyMap = new Map()
            if (accessKeyIds.length > 0) {
              const { data: accessKeysData } = await supabaseAdmin
                .from('access_keys')
                .select('*')
                .in('id', accessKeyIds)
              
              if (accessKeysData) {
                accessKeysData.forEach(key => {
                  keyMap.set(key.id, key)
                })
              }
            }
            
            // 手动关联数据
            processedKeyUsageHistory = rawKeyUsageHistory.map(record => ({
              ...record,
              access_key: record.access_key_id ? keyMap.get(record.access_key_id) : null
            }))
            
            console.log(`✅ 分别查询成功: ${processedKeyUsageHistory.length} 条记录`)
          }
        } else {
          // 关联查询成功，处理返回的数据
          processedKeyUsageHistory = (keyUsageHistory || []).map(record => {
            // Supabase关联查询返回的access_keys是一个数组
            let accessKeyData = {}
            
            if (Array.isArray(record.access_keys) && record.access_keys.length > 0) {
              // 关联查询返回的是数组
              accessKeyData = record.access_keys[0] || {}
            } else if (record.access_keys && typeof record.access_keys === 'object') {
              // 直接对象格式
              accessKeyData = record.access_keys
            }
            
            return {
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
              
              // 关联的密钥信息
              access_key: accessKeyData.id ? {
                id: accessKeyData.id,
                key_code: accessKeyData.key_code || '未知',
                is_active: accessKeyData.is_active ?? true,
                used_count: accessKeyData.used_count || 1, // 🔧 返回 used_count
                key_expires_at: accessKeyData.key_expires_at,
                created_at: accessKeyData.created_at
              } : null
            }
          })
        }

        // 🔧 修复：单独查询当前使用的密钥
        let currentKey = null
        if (profileData.access_key_id) {
          const { data: keyData, error: keyError } = await supabaseAdmin
            .from('access_keys')
            .select('*')
            .eq('id', profileData.access_key_id)
            .single()

          if (!keyError && keyData) {
            currentKey = keyData
          }
        }

        // 🔧 修复：获取所有相关的密钥ID（用于previous_key和next_key）
        const keyIds = new Set<number>()
        if (processedKeyUsageHistory && processedKeyUsageHistory.length > 0) {
          processedKeyUsageHistory.forEach(record => {
            if (record.previous_key_id) keyIds.add(record.previous_key_id)
            if (record.next_key_id) keyIds.add(record.next_key_id)
          })
        }

        // 查询所有相关的密钥信息（previous_key和next_key）
        let allKeys = []
        if (keyIds.size > 0) {
          const { data: keysData, error: keysError } = await supabaseAdmin
            .from('access_keys')
            .select('*')
            .in('id', Array.from(keyIds))

          if (!keysError && keysData) {
            allKeys = keysData
          }
        }

        // 创建密钥ID到密钥对象的映射
        const keyMap = new Map<number, any>()
        allKeys.forEach(key => {
          keyMap.set(key.id, key)
        })

        // 为processedKeyUsageHistory添加previous_key和next_key
        processedKeyUsageHistory = processedKeyUsageHistory.map(record => ({
          ...record,
          previous_key: record.previous_key_id ? keyMap.get(record.previous_key_id) : null,
          next_key: record.next_key_id ? keyMap.get(record.next_key_id) : null
        }))

        // 🔧 修复：AI使用记录查询 - 保持分页但返回总数
        const { data: aiUsageRecords, error: aiUsageError, count: aiTotalCount } = await supabaseAdmin
          .from('ai_usage_records')
          .select('*', { count: 'exact' })
          .eq('user_id', detailId)
          .order('created_at', { ascending: false })
          .limit(20) // 改为20条

        console.log('🤖 AI记录查询结果:', { 
          记录数量: aiUsageRecords?.length || 0,
          总记录数: aiTotalCount || 0,
          错误: aiUsageError?.message 
        })

        // 🔧 修复：游戏历史记录查询 - 返回总数
        const { data: gameHistory, error: gameHistoryError, count: gameHistoryCount } = await supabaseAdmin
          .from('game_history')
          .select('*', { count: 'exact' })
          .or(`player1_id.eq.${detailId},player2_id.eq.${detailId}`)
          .order('started_at', { ascending: false })
          .limit(20) // 改为20条

        console.log('✅ 用户详情查询成功:', {
          用户: profileData.email,
          密钥记录数: finalKeyHistoryCount || 0,
          AI记录数: aiTotalCount || 0,
          游戏记录数: gameHistoryCount || 0,
          当前密钥: currentKey ? currentKey.key_code : '无'
        })

        // 构建响应数据
        const responseData = {
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

          // 密钥使用历史
          key_usage_history: processedKeyUsageHistory,
          key_usage_history_total: finalKeyHistoryCount || 0, // 🔧 使用修复后的总数

          // 当前使用的密钥
          current_access_key: currentKey,

          // 所有相关的密钥（previous_key和next_key）
          access_keys: allKeys,

          // AI使用记录
          ai_usage_records: aiUsageRecords || [],
          ai_usage_records_total: aiTotalCount || 0, // 🔧 添加总数

          // 游戏历史记录
          game_history: gameHistory || [],
          game_history_total: gameHistoryCount || 0 // 🔧 添加总数
        }

        return NextResponse.json({
          success: true,
          data: responseData
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

        // 收集所有需要查询的access_key_id
        const accessKeyIds = result.data
          .map((profile: any) => profile.access_key_id)
          .filter((id): id is number => id !== null && id !== undefined)

        let keyMap = new Map()
        if (accessKeyIds.length > 0) {
          // 查询所有相关的密钥
          const { data: keysData } = await supabaseAdmin
            .from('access_keys')
            .select('*')
            .in('id', accessKeyIds)

          if (keysData) {
            keysData.forEach(key => {
              keyMap.set(key.id, key)
            })
          }
        }

        // 为每个用户添加密钥信息
        const profilesWithKeys = result.data.map((profile: any) => {
          let currentAccessKey = null

          if (profile.access_key_id && keyMap.has(profile.access_key_id)) {
            currentAccessKey = keyMap.get(profile.access_key_id)
          }

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