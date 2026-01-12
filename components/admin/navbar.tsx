// /components/admin/navbar.tsx - 完整修复版本
'use client'

import {
  LayoutDashboard,
  Users,
  Key,
  Brain,
  Settings,
  LogOut,
  Menu,
  X,
  MessageSquare
} from 'lucide-react'

const navItems = [
  { href: '/admin/dashboard', label: '仪表板', icon: LayoutDashboard },
  { href: '/admin/users', label: '用户管理', icon: Users },
  { href: '/admin/keys', label: '密钥管理', icon: Key },
  { href: '/admin/ai-usage', label: 'AI统计', icon: Brain },
  { href: '/admin/feedback', label: '反馈管理', icon: MessageSquare },
  { href: '/admin/settings', label: '系统设置', icon: Settings },
]

export default function AdminNavbar() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // 确保组件在客户端渲染
  useEffect(() => {
    setIsMounted(true)

    // 关闭移动端菜单当路由变化时
    setIsMobileMenuOpen(false)
  }, [pathname])

  // 服务器端渲染时返回简单版本
  if (!isMounted) {
    return (
      <nav className="admin-navbar bg-gray-800 text-white">
        <div className="navbar-container p-4">
          <div className="flex justify-between items-center">
            <div className="logo-link flex items-center space-x-3">
              <div className="logo-icon w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                LL
              </div>
              <span className="logo-text text-lg font-bold">Love Ludo 后台</span>
            </div>
            <div className="w-8 h-8"></div> {/* 占位 */}
          </div>
        </div>
      </nav>
    )
  }

  const handleNavClick = (href: string) => {
    // 如果是移动端，点击后关闭菜单
    if (window.innerWidth < 768) {
      setIsMobileMenuOpen(false)
    }
  }

  const handleLogout = () => {
    // 清除管理员会话
    document.cookie = 'admin_key_verified=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    sessionStorage.removeItem('admin_session')

    // 导航到登录页
    window.location.href = '/admin'
  }

  return (
    <nav className="admin-navbar bg-gray-800 text-white shadow-lg">
      <div className="navbar-container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="navbar-logo">
            <Link href="/admin/dashboard" className="logo-link flex items-center space-x-3">
              <div className="logo-icon w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold">
                LL
              </div>
              <div>
                <span className="logo-text text-lg font-bold block">Love Ludo</span>
                <span className="logo-subtext text-xs text-gray-300 block">后台管理系统</span>
              </div>
            </Link>
          </div>

          {/* 桌面导航 */}
          <div className="navbar-desktop hidden md:flex items-center space-x-2">
            <div className="nav-items flex space-x-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/admin/dashboard' &&
                    pathname?.startsWith(item.href))
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    onClick={() => handleNavClick(item.href)}
                  >
                    <Icon className="nav-icon w-5 h-5" />
                    <span className="nav-label text-sm font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* 退出按钮 */}
            <div className="navbar-actions ml-4">
              <button
                onClick={handleLogout}
                className="logout-button flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <LogOut className="logout-icon w-5 h-5" />
                <span className="text-sm font-medium">退出后台</span>
              </button>
            </div>
          </div>

          {/* 移动端菜单按钮 */}
          <button
            className="mobile-menu-button md:hidden p-2 rounded-lg hover:bg-gray-700"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="menu-icon w-6 h-6" />
            ) : (
              <Menu className="menu-icon w-6 h-6" />
            )}
          </button>
        </div>

        {/* 移动端菜单面板 */}
        {isMobileMenuOpen && (
          <div className="navbar-mobile md:hidden bg-gray-800 border-t border-gray-700">
            <div className="mobile-nav-items py-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/admin/dashboard' &&
                    pathname?.startsWith(item.href))
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`mobile-nav-item flex items-center space-x-3 px-4 py-3 rounded-lg mx-2 my-1 transition-colors ${isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    onClick={() => handleNavClick(item.href)}
                  >
                    <Icon className="mobile-nav-icon w-5 h-5" />
                    <span className="mobile-nav-label text-sm font-medium">{item.label}</span>
                  </Link>
                )
              })}

              {/* 移动端退出按钮 */}
              <button
                onClick={handleLogout}
                className="mobile-logout-button flex items-center space-x-3 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg mx-2 my-1 mt-4 w-[calc(100%-1rem)] transition-colors"
              >
                <LogOut className="mobile-logout-icon w-5 h-5" />
                <span className="text-sm font-medium">退出后台</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}