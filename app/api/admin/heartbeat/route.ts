import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('[管理员心跳API] 请求')
    
    // 获取请求ID用于日志追踪
    const requestId = Math.random().toString(36).substring(7)
    
    // 检查管理员cookie
    const adminCookie = request.cookies.get('admin_key_verified')?.value
    
    if (!adminCookie) {
      console.log(`[管理员心跳API:${requestId}] ❌ 管理员未登录`)
      
      return NextResponse.json(
        { 
          loggedIn: false, 
          isAdmin: false,
          message: '请登录管理员账户',
          redirect: '/admin/login'
        },
        { status: 401 }
      )
    }

    // 验证cookie值（检查是否有效）
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com']
    const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || 'Cike@7638'
    
    // 简单的cookie验证逻辑：cookie值可以是adminKey或adminEmail
    const isValidCookie = 
      adminCookie === adminKey || 
      adminEmails.some(email => adminCookie.includes(email))
    
    if (!isValidCookie) {
      console.log(`[管理员心跳API:${requestId}] ❌ 无效的管理员cookie`)
      
      // 清除无效cookie
      const response = NextResponse.json(
        { 
          loggedIn: false, 
          isAdmin: false,
          message: '无效的管理员会话',
          redirect: '/admin/login'
        },
        { status: 401 }
      )
      
      response.cookies.delete('admin_key_verified')
      return response
    }

    console.log(`[管理员心跳API:${requestId}] ✅ 管理员心跳正常`)
    
    // 延长cookie有效期（24小时）
    const response = NextResponse.json({
      loggedIn: true,
      isAdmin: true,
      timestamp: new Date().toISOString(),
      message: '管理员会话正常',
      requestId
    })
    
    response.cookies.set({
      name: 'admin_key_verified',
      value: adminCookie,
      path: '/',
      maxAge: 24 * 60 * 60, // 24小时
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    })
    
    return response

  } catch (error) {
    console.error('[管理员心跳API] 错误:', error)
    return NextResponse.json(
      { 
        loggedIn: false, 
        isAdmin: false,
        message: '心跳检查失败'
      },
      { status: 500 }
    )
  }
}

export const dynamic = 'force-dynamic'