// /app/admin/unauthorized/page.tsx
export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md p-6">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">访问权限不足</h1>
        <p className="text-gray-600 mb-4">
          您已登录，但您的账户没有管理员权限访问后台。
        </p>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            <strong>请联系系统管理员</strong>将您的邮箱添加到管理员列表。
          </p>
        </div>
        
        <div className="space-y-3">
          <a
            href="/lobby"
            className="block w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            返回游戏大厅
          </a>
          <a
            href="/login?action=logout"
            className="block w-full py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            切换账户
          </a>
        </div>
      </div>
    </div>
  );
}
