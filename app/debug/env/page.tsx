// /app/debug/env/page.tsx
export default function EnvDebugPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">环境变量调试</h1>
      <div className="bg-gray-100 p-4 rounded">
        <pre>
          ADMIN_EMAILS: {process.env.ADMIN_EMAILS}<br/>
          NEXT_PUBLIC_ADMIN_KEY: {process.env.NEXT_PUBLIC_ADMIN_KEY ? '***已设置***' : '未设置'}<br/>
          NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '已设置' : '未设置'}<br/>
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: {process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? '已设置' : '未设置'}<br/>
          NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '已设置' : '未设置'}
        </pre>
      </div>
    </div>
  );
}
