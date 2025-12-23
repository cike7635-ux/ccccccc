// /app/admin/test-nav/page.tsx
'use client'

export default function TestNavPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">导航栏测试页面</h1>
      <div className="space-y-4">
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-2">测试说明：</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-2">
            <li>点击各个导航链接，应能正确跳转</li>
            <li>移动端点击菜单按钮应显示/隐藏菜单</li>
            <li>退出按钮应清除会话并跳转</li>
            <li>无需刷新即可更新导航栏状态</li>
          </ul>
        </div>
        
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-2">当前状态：</h2>
          <div className="text-green-400">✓ 页面加载完成</div>
          <div className="text-green-400">✓ 导航栏已渲染</div>
          <div className="mt-4">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
            >
              刷新页面测试
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}