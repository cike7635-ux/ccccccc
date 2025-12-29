'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2, Shield, AlertCircle } from 'lucide-react'
import AdminNavbar from '@/components/admin/navbar'
import './admin-styles.css'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdminRoute = pathname?.startsWith('/admin')
  const isLoginPage = pathname === '/admin/login'

  // 如果不是管理员路由，返回原始布局
  if (!isAdminRoute) {
    return <>{children}</>
  }

  // 如果是登录页，直接显示
  if (isLoginPage) {
    return <>{children}</>
  }

  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout

    const checkAdminAuth = async () => {
      if (!isMounted) return

      try {
        setError(null)
        
        const controller = new AbortController()
        timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒超时

        const response = await fetch('/api/admin/heartbeat', {
          credentials: 'include',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          console.log('管理员验证失败:', response.status, data.message)
          
          if (isMounted) {
            setError(data.message || '验证失败')
            const loginUrl = `/admin/login?redirect=${encodeURIComponent(pathname)}`
            router.push(loginUrl)
          }
          return
        }

        const data = await response.json()

        if (!data.isAdmin || !data.loggedIn) {
          console.log('管理员权限验证失败:', data.message)
          
          if (isMounted) {
            setError(data.message || '权限验证失败')
            const loginUrl = `/admin/login?redirect=${encodeURIComponent(pathname)}`
            router.push(loginUrl)
          }
          return
        }

        if (isMounted) {
          console.log('管理员验证通过:', data.message)
          setIsAuthenticated(true)
          setIsChecking(false)
        }

      } catch (error: any) {
        clearTimeout(timeoutId)
        
        if (error.name === 'AbortError') {
          console.error('管理员验证超时')
          if (isMounted) {
            setError('验证超时，请检查网络连接')
          }
        } else {
          console.error('管理员验证失败:', error)
          if (isMounted) {
            setError('验证服务异常，请稍后重试')
          }
        }

        if (isMounted) {
          setIsChecking(false)
        }
      }
    }

    checkAdminAuth()

    // 定期检查（每5分钟）
    const interval = setInterval(checkAdminAuth, 5 * 60 * 1000)
    
    return () => {
      isMounted = false
      clearInterval(interval)
      clearTimeout(timeoutId)
    }
  }, [router, pathname])

  // 显示加载状态
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center p-8 rounded-2xl bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-2xl">
          <div className="relative mb-6">
            <Shield className="h-16 w-16 mx-auto text-blue-400 mb-4 animate-pulse" />
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
          </div>
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-blue-400 mb-6" />
          <p className="text-gray-200 text-xl font-semibold mb-2">管理员身份验证</p>
          <p className="text-gray-400 text-sm mb-6">正在验证您的管理员权限...</p>
          <div className="w-48 h-1 bg-gray-700 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // 验证失败但未重定向（显示错误）
  if (!isAuthenticated && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center p-8 rounded-2xl bg-gray-800/80 backdrop-blur-sm border border-gray-700 shadow-2xl max-w-md">
          <AlertCircle className="h-16 w-16 mx-auto text-red-400 mb-6" />
          <h2 className="text-2xl font-bold text-gray-200 mb-4">验证失败</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/admin/login')}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              前往登录
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg font-medium transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 未认证时显示空内容（会被重定向）
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="admin-layout-root min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <AdminNavbar />
      <div className="admin-content-wrapper">
        <div className="admin-bg-pattern absolute inset-0 opacity-5 pointer-events-none" />
        {children}
      </div>
    </div>
  )
}