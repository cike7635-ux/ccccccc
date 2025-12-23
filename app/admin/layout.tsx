// /app/admin/layout.tsx - 简化稳定版本
'use client'

import { usePathname } from 'next/navigation'
import AdminNavbar from '@/components/admin/navbar'
import './admin-styles.css'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith('/admin')

  // 如果不是管理员路由，返回原始布局
  if (!isAdminRoute) {
    return <>{children}</>
  }

  return (
    <div className="admin-layout-root min-h-screen bg-gray-900">
      <AdminNavbar />
      <div className="admin-content-wrapper">
        {children}
      </div>
    </div>
  )
}