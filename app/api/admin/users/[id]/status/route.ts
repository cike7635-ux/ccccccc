import { NextRequest, NextResponse } from 'next/server'
import { validateAdminSession, createAdminClient } from '@/lib/server/admin-auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔄 处理用户状态更新请求')

    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      console.warn('❌ 未授权访问')
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      )
    }

    const supabaseAdmin = createAdminClient()

    // 2. 解析请求体
    const { isActive } = await request.json()
    const userId = params.id
    
    console.log(`📝 请求参数:`, { userId, isActive })

    // 3. 验证参数
    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { success: false, error: '参数错误：isActive必须为布尔值' },
        { status: 400 }
      )
    }

    // 4. 创建Supabase客户端
    // 5. 检查用户是否存在
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, account_expires_at')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('❌ 用户不存在:', userError)
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    console.log('👤 找到用户:', user.email)

    // 6. 更新用户状态（通过修改会员到期时间）
    let newExpiryDate: Date
    
    if (isActive) {
      // 启用：设置为30天后
      newExpiryDate = new Date()
      newExpiryDate.setDate(newExpiryDate.getDate() + 30)
      console.log('🔓 启用用户，设置到期时间为30天后')
    } else {
      // 禁用：设置为过去（2000年）
      newExpiryDate = new Date('2000-01-01')
      console.log('🔒 禁用用户，设置到期时间为2000-01-01')
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        account_expires_at: newExpiryDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, email, account_expires_at')
      .single()

    if (updateError) {
      console.error('❌ 更新失败:', updateError)
      return NextResponse.json(
        { success: false, error: '更新失败: ' + updateError.message },
        { status: 500 }
      )
    }

    console.log('✅ 更新成功:', {
      id: updatedUser.id,
      email: updatedUser.email,
      new_expiry: updatedUser.account_expires_at
    })

    return NextResponse.json({
      success: true,
      data: {
        userId: updatedUser.id,
        email: updatedUser.email,
        account_expires_at: updatedUser.account_expires_at,
        isActive: isActive,
        message: `用户已${isActive ? '启用' : '禁用'}`
      }
    })

  } catch (error: any) {
    console.error('❌ 服务器错误:', error)
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

// 可选：添加GET方法查看用户状态
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const validation = await validateAdminSession(request);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: validation.status }
      )
    }

    const supabaseAdmin = createAdminClient()

    const { data: user, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, account_expires_at')
      .eq('id', params.id)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    // 判断是否禁用：如果到期时间在过去，则认为被禁用
    const isDisabled = user.account_expires_at && new Date(user.account_expires_at) < new Date()
    
    return NextResponse.json({
      success: true,
      data: {
        ...user,
        isActive: !isDisabled,
        status: isDisabled ? 'disabled' : 'active'
      }
    })

  } catch (error) {
    console.error('查询状态失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}