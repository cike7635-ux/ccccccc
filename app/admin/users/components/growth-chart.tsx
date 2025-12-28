'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, Calendar, Users, RefreshCw, AlertCircle } from 'lucide-react'

interface GrowthData {
  date: string
  count: number
  cumulative: number
}

interface ApiResponse {
  success: boolean
  data?: GrowthData[]
  totalGrowth?: number
  error?: string
}

export default function GrowthChart() {
  const [growthData, setGrowthData] = useState<GrowthData[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d')
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  // 获取增长数据 - 改进版本
  const fetchGrowthData = useCallback(async (forceRetry = false) => {
    if (!forceRetry) {
      setLoading(true)
    }
    setError(null)
    
    try {
      console.log(`📊 请求增长数据，范围: ${timeRange}，重试次数: ${retryCount}`)
      
      const response = await fetch(`/api/admin/users/growth?range=${timeRange}`, {
        credentials: 'include',
        cache: 'no-store', // 不缓存，获取最新数据
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      console.log('📊 图表API响应状态:', response.status)
      
      const result: ApiResponse = await response.json()
      console.log('📊 图表API返回数据:', result)
      
      if (!response.ok) {
        throw new Error(`API请求失败 (${response.status}): ${result.error || '未知错误'}`)
      }
      
      if (!result.success) {
        throw new Error(result.error || 'API返回未知错误')
      }
      
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('API返回数据格式不正确')
      }
      
      if (result.data.length === 0) {
        console.warn('图表API返回空数据，可能没有用户数据')
      }
      
      // 验证数据格式
      const validData = result.data.filter(item => 
        item && 
        typeof item.date === 'string' && 
        typeof item.count === 'number' && 
        typeof item.cumulative === 'number'
      )
      
      if (validData.length === 0 && result.data.length > 0) {
        throw new Error('数据格式验证失败')
      }
      
      setGrowthData(validData)
      setLastUpdated(new Date())
      setRetryCount(0) // 重置重试计数
      
    } catch (error: any) {
      console.error('❌ 获取增长数据失败:', error)
      
      // 只有在没有重试过的情况下才显示错误
      if (retryCount < 2 && !forceRetry) {
        console.log(`🔄 第 ${retryCount + 1} 次重试...`)
        setRetryCount(prev => prev + 1)
        // 2秒后重试
        setTimeout(() => {
          fetchGrowthData(true)
        }, 2000)
      } else {
        setError(error.message || '获取增长数据失败')
        // 生成降级数据，而不是模拟数据
        setGrowthData(generateFallbackData())
      }
    } finally {
      if (!forceRetry) {
        setLoading(false)
      }
    }
  }, [timeRange, retryCount])

  // 生成降级数据（零数据，而不是模拟数据）
  const generateFallbackData = (): GrowthData[] => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const fallbackData: GrowthData[] = []
    
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (days - 1 - i))
      
      fallbackData.push({
        date: date.toLocaleDateString('zh-CN', { 
          month: 'short', 
          day: 'numeric' 
        }),
        count: 0,
        cumulative: 0
      })
    }
    
    return fallbackData
  }

  // 初始化加载和监听timeRange变化
  useEffect(() => {
    fetchGrowthData()
  }, [timeRange, fetchGrowthData])

  // 计算统计
  const totalGrowth = growthData.reduce((sum, day) => sum + day.count, 0)
  const maxCount = Math.max(...growthData.map(d => d.count), 1) // 至少为1，避免除零

  // 获取柱子颜色 - 根据数据量使用不同颜色
  const getBarColor = (count: number) => {
    if (count === 0) return 'from-gray-600 to-gray-500'
    if (count <= 2) return 'from-blue-400 to-blue-300'
    if (count <= 5) return 'from-blue-500 to-blue-400'
    if (count <= 10) return 'from-blue-600 to-blue-500'
    return 'from-blue-700 to-blue-600'
  }

  // 获取柱子高度 - 使用像素单位
  const getBarHeight = (count: number): string => {
    const MAX_PIXEL_HEIGHT = 80
    const MIN_PIXEL_HEIGHT = 12
    
    if (count === 0) return `${MIN_PIXEL_HEIGHT}px`
    
    const pixelHeight = (count / maxCount) * MAX_PIXEL_HEIGHT
    return `${Math.max(pixelHeight, MIN_PIXEL_HEIGHT)}px`
  }

  // 手动刷新
  const handleRefresh = () => {
    setRetryCount(0)
    fetchGrowthData()
  }

  // 计算增长趋势
  const calculateGrowthTrend = () => {
    if (growthData.length < 2) return 0
    
    const firstDay = growthData[0].count
    const lastDay = growthData[growthData.length - 1].count
    
    if (firstDay === 0) return lastDay > 0 ? 100 : 0
    
    return ((lastDay - firstDay) / firstDay) * 100
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-400 flex items-center">
              <Users className="w-4 h-4 mr-1" />
              用户增长趋势
            </p>
          </div>
          <div className="flex space-x-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  timeRange === range
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
                onClick={() => {
                  setTimeRange(range)
                  setError(null)
                }}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        
        <div className="h-40 flex flex-col items-center justify-center border border-red-500/30 rounded-lg bg-red-500/10 p-4">
          <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
          <p className="text-red-400 text-sm text-center mb-2">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30 transition-colors flex items-center"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={chartContainerRef} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-400 flex items-center">
            <Users className="w-4 h-4 mr-1" />
            用户增长趋势
            {lastUpdated && (
              <span className="ml-2 text-xs text-gray-500">
                更新于 {lastUpdated.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            过去 {timeRange === '7d' ? '7天' : timeRange === '30d' ? '30天' : '90天'} 新增 {totalGrowth} 人
          </p>
        </div>
        <div className="flex space-x-1">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                timeRange === range
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
              }`}
              onClick={() => setTimeRange(range)}
              disabled={loading}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-gray-400 text-sm">
            加载增长数据{retryCount > 0 ? ` (重试 ${retryCount})` : ''}...
          </p>
        </div>
      ) : (
        <>
          {/* 柱状图 */}
          <div className="relative">
            <div className="flex items-end h-32 gap-1 mb-2">
              {growthData.map((day, index) => {
                const height = getBarHeight(day.count)
                const color = getBarColor(day.count)
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group">
                    <div className="text-xs text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {day.count}
                    </div>
                    <div
                      className={`w-3/4 bg-gradient-to-t ${color} rounded-t-sm transition-all duration-300 hover:opacity-80 cursor-pointer group-hover:shadow-lg group-hover:shadow-blue-500/20`}
                      style={{ height }}
                      title={`${day.date}: 新增 ${day.count} 人，累计 ${day.cumulative} 人`}
                    />
                    <div className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                      {day.date.split('/')[1]}
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Y轴网格线 */}
            <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none">
              {[0, 25, 50, 75, 100].map((percent) => (
                <div
                  key={percent}
                  className="absolute left-0 right-0 border-t border-gray-700/30"
                  style={{ top: `${percent}%` }}
                />
              ))}
            </div>
          </div>

          {/* 统计信息 */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-700/50">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">今日新增</p>
              <p className="text-lg font-bold text-white">
                {growthData.length > 0 ? growthData[growthData.length - 1]?.count || 0 : 0}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">平均每日</p>
              <p className="text-lg font-bold text-white">
                {growthData.length > 0 ? Math.round(totalGrowth / growthData.length) : 0}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">增长率</p>
              <p className="text-lg font-bold flex items-center justify-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span className={calculateGrowthTrend() >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {calculateGrowthTrend() >= 0 ? '+' : ''}
                  {calculateGrowthTrend().toFixed(1)}%
                </span>
              </p>
            </div>
          </div>
          
          {/* 刷新按钮 */}
          <div className="mt-3 text-center">
            <button
              onClick={handleRefresh}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center justify-center mx-auto px-3 py-1 rounded hover:bg-gray-800/50 transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              刷新数据
            </button>
          </div>
        </>
      )}
    </div>
  )
}