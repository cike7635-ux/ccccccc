// /app/test-data/page.tsx - 修复导入错误
import { getUserData } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function TestDataPage() {
  const dataStart = performance.now();
  const { user } = await getUserData(); // 修复：改为getUserData
  const dataTime = performance.now() - dataStart;
  
  return (
    <div className="p-10 text-white">
      <p>Data Fetched for: {user?.email}</p>
      <p>数据获取耗时: <strong>{dataTime.toFixed(0)}ms</strong></p>
    </div>
  );
}