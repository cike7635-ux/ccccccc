import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('[管理员检查API] 请求')
    
    // 检查管理员cookie
    const adminCookie = request.cookies.get('admin_key_verified')?.value
    
    if (!adminCookie) {
      return NextResponse.json(
        { 
          authenticated: false, 
          message: '未登录或会话已过期',
          redirect: '/admin/login'
        },
        { status: 401 }
      )
    }

    // 验证cookie有效性
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com']
    const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || 'Cike@7638'
    
    const isValidCookie = 
      adminCookie === adminKey || 
      adminEmails.some(email => adminCookie.includes(email))

    if (!isValidCookie) {
      // 清除无效cookie
      const response = NextResponse.json(
        { 
          authenticated: false, 
          message: '无效的管理员会话',
          redirect: '/admin/login'
        },
        { status: 401 }
      )
      
      response.cookies.delete('admin_key_verified')
      return response
    }

    return NextResponse.json({
      authenticated: true,
      timestamp: new Date().toISOString(),
      message: '已登录',
      adminEmail: adminEmails[0] // 返回第一个管理员邮箱
    })

  } catch (error) {
    console.error('管理员检查API错误:', error)
    return NextResponse.json(
      { 
        authenticated: false, 
        message: '服务器错误',
        redirect: '/admin/login'
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'