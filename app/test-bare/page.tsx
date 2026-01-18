// /app/test-bare/page.tsx - 修复导入错误
import { getUserData } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function TestBarePage() {
  const { user } = await getUserData();
  
  return (
    <div className="p-10 text-white">
      <p>Data Fetched for: {user?.email}</p>
    </div>
  );
}