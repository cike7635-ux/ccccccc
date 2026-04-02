// /components/admin/navbar.tsx - 隐藏式侧边导航
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Key,
  Brain,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Palette,
  Shield,
  ChevronRight,
  ChevronLeft,
  Gamepad2
} from 'lucide-react';

const navItems = [
  { href: '/admin/dashboard', label: '仪表板', icon: LayoutDashboard },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin/keys', label: '密钥管理', icon: Key },
  { href: '/admin/ai-usage', label: 'AI统计', icon: Brain },
  { href: '/admin/themes', label: '主题管理', icon: Palette },
  { href: '/admin/games', label: '游戏记录', icon: Gamepad2 },
  { href: '/admin/feedback', label: '反馈管理', icon: MessageSquare },
  { href: '/admin/settings', label: '系统设置', icon: Settings },
];

interface AdminNavbarProps {
  children: React.ReactNode;
}

export default function AdminNavbar({ children }: AdminNavbarProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测设备尺寸
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // 在移动设备上默认关闭侧边栏
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // 路由变化时在移动设备上关闭侧边栏
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleNavClick = (href: string) => {
    // 在移动设备上点击后关闭侧边栏
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    // 清除管理员会话
    document.cookie = 'admin_key_verified=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'admin_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    sessionStorage.removeItem('admin_session');

    // 导航到登录页
    window.location.href = '/admin';
  };

  return (
    <div className="admin-layout">
      {/* 侧边导航栏 */}
      <div 
        className={`admin-sidebar fixed top-0 left-0 h-full bg-gray-800 text-white z-50 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-16'} border-r border-gray-700`}
      >
        <div className="sidebar-header flex items-center justify-between h-16 px-4 border-b border-gray-700">
          <div className={`flex items-center space-x-3 ${!isSidebarOpen && 'justify-center'}`}>
            <div className="logo-icon w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            {isSidebarOpen && (
              <div>
                <span className="logo-text text-lg font-bold block text-white">Love Ludo</span>
                <span className="logo-subtext text-xs text-gray-300 block">后台管理</span>
              </div>
            )}
          </div>
          <button
            className="sidebar-toggle p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            onClick={toggleSidebar}
            aria-label={isSidebarOpen ? '收起侧边栏' : '展开侧边栏'}
          >
            {isSidebarOpen ? (
              <ChevronLeft className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="sidebar-content py-4">
          <div className="nav-items space-y-1 px-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/admin/dashboard' &&
                  pathname?.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors ${isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    } ${!isSidebarOpen && 'justify-center'}`}
                  onClick={() => handleNavClick(item.href)}
                >
                  <Icon className="nav-icon w-5 h-5 flex-shrink-0" />
                  {isSidebarOpen && (
                    <span className="nav-label text-sm font-medium">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* 退出按钮 */}
          <div className="mt-auto pt-4 px-2">
            <button
              onClick={handleLogout}
              className={`logout-button flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors ${!isSidebarOpen && 'justify-center'}`}
            >
              <LogOut className="logout-icon w-5 h-5 flex-shrink-0 text-red-400" />
              {isSidebarOpen && (
                <span className="logout-label text-sm font-medium text-red-400">退出</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className={`admin-main transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-16'}`}>
        {/* 顶部导航栏 */}
        <header className="top-navbar fixed top-0 right-0 left-0 h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 z-40">
          <div className="flex items-center">
            <button
              className="mobile-menu-button md:hidden p-2 rounded-lg hover:bg-gray-700 transition-colors"
              onClick={toggleSidebar}
              aria-label="切换侧边栏"
            >
              <Menu className="menu-icon w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-white ml-4">
              {navItems.find(item => 
                pathname === item.href || 
                (item.href !== '/admin/dashboard' && pathname?.startsWith(item.href))
              )?.label || '后台管理'}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-300">
              管理员
            </div>
          </div>
        </header>

        {/* 内容区域 */}
        <div className="main-content pt-16">
          {children}
        </div>
      </div>
    </div>
  );
}