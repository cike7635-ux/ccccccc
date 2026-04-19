import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAdminSession } from '@/lib/server/admin-auth'

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const keyId = parseInt(context.params.id)
    
    if (!keyId || isNaN(keyId)) {
      return NextResponse.json({ 
        success: false, 
        error: '无效的密钥ID' 
      }, { status: 400 })
    }

    console.log(`🔍 调试API: 获取密钥详情 ID: ${keyId}`)
    
    // 验证管理员权限
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // 1. 获取密钥基本信息（不关联查询）
    const { data: basicKeyData, error: basicError } = await supabaseAdmin
      .from('access_keys')
      .select('*')
      .eq('id', keyId)
      .single()

    if (basicError) {
      return NextResponse.json({
        success: false,
        error: '获取密钥基本信息失败',
        details: basicError.message
      }, { status: 500 })
    }

    console.log('✅ 基础数据查询成功:', {
      id: basicKeyData.id,
      key_code: basicKeyData.key_code,
      user_id: basicKeyData.user_id,
      used_at: basicKeyData.used_at
    })

    // 2. 尝试关联查询（模拟主API的查询）
    const { data: keyWithProfile, error: profileError } = await supabaseAdmin
      .from('access_keys')
      .select(`
        *,
        profiles:user_id (
          email,
          nickname
        )
      `)
      .eq('id', keyId)
      .single()

    console.log('🔗 关联查询结果:', {
      success: !profileError,
      profiles: keyWithProfile?.profiles,
      error: profileError?.message
    })

    // 3. 获取使用历史
    const { data: usageHistory, error: historyError } = await supabaseAdmin
      .from('key_usage_history')
      .select(`
        *,
        profiles:user_id (
          email,
          nickname
        )
      `)
      .eq('access_key_id', keyId)
      .order('used_at', { ascending: false })
      .limit(10)

    console.log('📜 使用历史查询结果:', {
      count: usageHistory?.length || 0,
      error: historyError?.message
    })

    // 4. 检查数据结构
    const isUsed = !!(basicKeyData.used_at || basicKeyData.user_id)
    const hasProfile = !!keyWithProfile?.profiles

    return NextResponse.json({
      success: true,
      data: {
        // 分析结果
        analysis: {
          is_used: isUsed,
          has_profile: hasProfile,
          user_id_exists: !!basicKeyData.user_id,
          used_at_exists: !!basicKeyData.used_at,
          profile_fields: hasProfile ? Object.keys(keyWithProfile.profiles) : []
        },
        // 原始数据
        basic_key_data: basicKeyData,
        key_with_profile: keyWithProfile,
        usage_history_sample: usageHistory?.slice(0, 3) || [],
        // 主API返回的结构
        main_api_structure: {
          key_info: keyWithProfile || basicKeyData,
          usage_history: usageHistory || [],
          statistics: {
            total_uses: usageHistory?.length || 0,
            unique_users: new Set(usageHistory?.map(u => u.user_id) || []).size,
            first_use: usageHistory && usageHistory.length > 0 ? usageHistory[usageHistory.length - 1].used_at : null,
            last_use: usageHistory && usageHistory.length > 0 ? usageHistory[0].used_at : null
          }
        }
      },
      warnings: {
        profile_error: profileError?.message,
        history_error: historyError?.message,
        missing_fields: hasProfile ? [] : ['profiles字段可能为空']
      }
    })

  } catch (error: any) {
    console.error('❌ 调试API异常:', error)
    return NextResponse.json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : '服务器错误',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}