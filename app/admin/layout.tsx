// /app/admin/layout.tsx - 简化的版本
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 这个布局由中间件保护，这里不需要额外验证
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {/* 简单的管理导航 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-xl font-bold text-blue-600">Love Ludo</span>
                  <span className="ml-2 text-sm text-gray-500">后台管理</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/lobby"
                className="px-3 py-1 text-sm text-gray-700 hover:text-blue-600 hover:bg-gray-100 rounded-md"
              >
                返回游戏
              </a>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
