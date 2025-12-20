// /app/admin/users/page.tsx - 修复版本
import { validateAdminSession } from '@/lib/admin/auth';

export default async function UsersPage() {
  await validateAdminSession();
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">用户管理</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">用户管理功能正在开发中...</p>
        <p className="mt-4">
          <a href="/admin" className="text-blue-600 hover:text-blue-800">
            返回仪表板
          </a>
        </p>
      </div>
    </div>
  );
}
