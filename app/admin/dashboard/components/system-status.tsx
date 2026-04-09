// /app/admin/dashboard/components/system-status.tsx
'use client'

import { useState } from 'react'
import { Shield, CheckCircle, AlertCircle, Activity, RefreshCw } from 'lucide-react'

interface SystemStatusItem {
  name: string
  status: 'normal' | 'warning' | 'error'
  description: string
}

export default function SystemStatus() {
  const [statuses, setStatuses] = useState<SystemStatusItem[]>([
    { name: 'API服务', status: 'normal', description: '接口响应正常' },
    { name: '数据库', status: 'normal', description: '连接稳定' },
    { name: '游戏服务器', status: 'normal', description: '运行中' },
    { name: '安全防护', status: 'normal', description: '已启用' }
  ])

  const [isRefreshing, setIsRefreshing] = useState(false)

  // 🔥 优化：移除自动检查，改为手动刷新
  const handleRefresh = async () => {
    setIsRefreshing(true)
    
    // 模拟状态检查
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setStatuses(prev => prev.map(status => ({
      ...status,
      status: Math.random() > 0.95 ? 'error' : 
              Math.random() > 0.9 ? 'warning' : 'normal'
    })))
    
    setIsRefreshing(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-400'
      case 'warning': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle className="w-4 h-4" />
      case 'warning': return <AlertCircle className="w-4 h-4" />
      case 'error': return <AlertCircle className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Shield className="w-5 h-5 mr-2 text-blue-400" />
          系统状态
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? '检查中...' : '手动检查'}
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statuses.map((status, index) => (
          <div key={index} className="bg-gray-900/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-400">{status.name}</span>
              <div className={`${getStatusColor(status.status)}`}>
                {getStatusIcon(status.status)}
              </div>
            </div>
            <p className={`text-lg font-semibold mb-2 ${getStatusColor(status.status)}`}>
              {status.status === 'normal' ? '正常' : 
               status.status === 'warning' ? '警告' : '异常'}
            </p>
            <p className="text-xs text-gray-500">{status.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}