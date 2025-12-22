// /app/admin/dashboard/components/user-growth-chart.tsx
'use client'

import { useState } from 'react' // 移除 useEffect
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface GrowthData {
  date: string
  users: number
  games: number
  aiUsage: number
}

export default function UserGrowthChart() {
  const [data] = useState<GrowthData[]>([ // 移除了 setData 和 useEffect
    { date: '01-01', users: 120, games: 45, aiUsage: 89 },
    { date: '01-02', users: 135, games: 52, aiUsage: 78 },
    { date: '01-03', users: 156, games: 67, aiUsage: 92 },
    { date: '01-04', users: 178, games: 73, aiUsage: 105 },
    { date: '01-05', users: 189, games: 81, aiUsage: 112 },
    { date: '01-06', users: 205, games: 89, aiUsage: 124 },
    { date: '01-07', users: 220, games: 95, aiUsage: 135 }
  ])
  const [loading] = useState(false) // 简化加载状态

  if (loading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">用户增长趋势</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-400 text-sm">加载图表数据...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">用户增长趋势</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span className="text-gray-400">用户增长</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-gray-400">游戏次数</span>
          </div>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255,255,255,0.5)"
              fontSize={12}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.5)"
              fontSize={12}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'rgba(30, 30, 40, 0.9)',
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: 'white'
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="users"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="games"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}