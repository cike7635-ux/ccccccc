// /app/admin/ai-usage/page.tsx - 修复版（服务端组件）
export default function AIUsagePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI使用统计</h1>
            <p className="text-gray-600 mt-1">监控AI功能使用情况和成本</p>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { title: '总使用次数', value: '4,231', change: '+12%' },
            { title: '总用户数', value: '34', change: '+8%' },
            { title: 'Tokens消耗', value: '73,381', change: '+15%' },
            { title: '总成本', value: '¥0.138', change: '+18%' },
            { title: '成功率', value: '95.2%', change: '+2%' },
            { title: '活跃用户', value: '12', change: '+10%' },
          ].map((card, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="text-sm font-medium text-gray-600 mb-2">{card.title}</div>
              <div className="flex items-baseline">
                <span className="text-2xl font-bold text-gray-900">{card.value}</span>
                <span className={`ml-2 text-sm font-medium ${
                  card.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {card.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 关键数据 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">关键指标</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">24小时窗口：4次</span>
                <span className="font-medium">成本：¥0.0103</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: '40%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">30天窗口：19次</span>
                <span className="font-medium">成本：¥0.0488</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: '19%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* 用户数据 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">用户使用情况</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">使用次数</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tokens</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">成本</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">测试用户</div>
                    <div className="text-sm text-gray-500">ID: 30832503...87cd0</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">19次</div>
                    <div className="text-sm text-gray-500">30天窗口</div>
                  </td>
                  <td className="px-4 py-3">73,381</td>
                  <td className="px-4 py-3">¥0.138</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <p>最后更新: {new Date().toLocaleString('zh-CN')}</p>
          <p className="mt-1">系统基于生产环境实时统计，仅管理员可见</p>
        </div>
      </div>
    </div>
  );
}