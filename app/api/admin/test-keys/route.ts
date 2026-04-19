// /app/api/admin/test-keys/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

export async function GET(request: NextRequest) {
  try {
    console.log('🔑 测试密钥API调用...')

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      )
    }

    const supabaseAdmin = createAdminClient()

    console.log('📊 查询access_keys表...')
    
    // 方法1：直接查询access_keys表
    const { data: keysData, error: keysError } = await supabaseAdmin
      .from('access_keys')
      .select('*')
      .order('created_at', { ascending: false })

    if (keysError) {
      console.error('❌ 查询失败:', keysError)
      return NextResponse.json(
        { 
          success: false, 
          error: '查询失败', 
          details: keysError.message 
        },
        { status: 500 }
      )
    }

    console.log(`✅ 查询成功，找到 ${keysData?.length || 0} 条记录`)
    
    // 方法2：尝试关联查询用户信息
    let enrichedData = []
    if (keysData && keysData.length > 0) {
      for (const key of keysData) {
        let userInfo = null
        
        if (key.user_id) {
          const { data: userData, error: userError } = await supabaseAdmin
            .from('profiles')
            .select('email, nickname')
            .eq('id', key.user_id)
            .single()
            
          if (!userError && userData) {
            userInfo = userData
          }
        }
        
        enrichedData.push({
          ...key,
          user: userInfo,
          // 确保字段存在
          max_uses: key.max_uses || 1,
          used_count: key.used_count || 0
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: enrichedData,
      count: enrichedData.length,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('💥 测试密钥API异常:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '服务器内部错误',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
