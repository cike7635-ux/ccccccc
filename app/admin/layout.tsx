// /app/admin/layout.tsx - 适配隐藏式侧边导航
'use client';

import { usePathname } from 'next/navigation';
import AdminNavbar from '@/components/admin/navbar';
import './admin-styles.css';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  // 如果不是管理员路由，返回原始布局
  if (!isAdminRoute) {
    return <>{children}</>;
  }

  // 直接返回导航栏，内容会被导航栏组件处理
  return <AdminNavbar>{children}</AdminNavbar>;
}