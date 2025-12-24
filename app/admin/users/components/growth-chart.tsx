// /app/admin/users/components/growth-chart.tsx - 完整修复版
'use client'

import { useState, useEffect, useRef } from 'react'
import { TrendingUp, Calendar, Users } from 'lucide-react'

interface GrowthData {
  date: string
  count: number
  cumulative: number
}

export default function GrowthChart() {
  const [growthData, setGrowthData] = useState<GrowthData[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d')
  const [useMockData, setUseMockData] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  // 获取增长数据
  const fetchGrowthData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/users/growth?range=${timeRange}`, {
        credentials: 'include',
      })
      
      console.log('📊 图表API响应状态:', response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log('📊 图表API返回数据详情:', {
          success: result.success,
          数据长度: result.data?.length,
          总增长: result.totalGrowth,
          第一条数据: result.data?.[0]
        })
        
        if (result.success && result.data && Array.isArray(result.data)) {
          setGrowthData(result.data)
          setUseMockData(false)
          
          // 调试：打印计算后的高度
          const maxCount = Math.max(...result.data.map(d => d.count), 1)
          console.log('📊 高度计算调试:', {
            最大count值: maxCount,
            各柱子高度: result.data.map(day => ({
              日期: day.date,
              count: day.count,
              计算高度: (day.count / maxCount) * 80,
              最终高度: Math.max((day.count / maxCount) * 80, 8)
            }))
          })
        } else {
          console.warn('图表API返回数据格式不正确，使用模拟数据')
          setUseMockData(true)
          generateMockData()
        }
      } else {
        console.warn('图表API调用失败，使用模拟数据')
        setUseMockData(true)
        generateMockData()
      }
    } catch (error) {
      console.error('获取增长数据失败:', error)
      setUseMockData(true)
      generateMockData()
    } finally {
      setLoading(false)
    }
  }

  // 模拟数据（如果API未实现）
  const generateMockData = () => {
    const mockData: GrowthData[] = []
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    
    // 创建日期范围
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (days - 1 - i))
      
      // 生成递增的新增用户数（模拟增长趋势）
      const baseCount = Math.floor(Math.random() * 3) + 1
      const trendFactor = 1 + (i * 0.1) // 模拟增长趋势
      const newUsers = Math.floor(baseCount * trendFactor)
      
      // 计算累计用户数（从30开始）
      const cumulative = 30 + mockData.reduce((sum, day) => sum + day.count, 0) + newUsers
      
      mockData.push({
        date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        count: newUsers,
        cumulative: cumulative
      })
    }
    
    setGrowthData(mockData)
  }

  useEffect(() => {
    fetchGrowthData()
  }, [timeRange])

  // 计算统计
  const totalGrowth = growthData.reduce((sum, day) => sum + day.count, 0)
  const maxCount = Math.max(...growthData.map(d => d.count), 1)

  // 获取柱子颜色
  const getBarColor = (count: number) => {
    if (count === 0) return 'from-gray-500 to-gray-400'
    if (count <= 2) return 'from-blue-400 to-blue-300'
    if (count <= 5) return 'from-blue-500 to-blue-400'
    if (count <= 10) return 'from-blue-600 to-blue-500'
    return 'from-blue-700 to-blue-600'
  }

  // 获取柱子高度
  const getBarHeight = (count: number, maxCount: number) => {
    if (count === 0) return '10px' // 0数据固定10px高度
    
    const baseHeight = (count / maxCount) * 80
    const minHeight = 10 // 最小10px
    const calculatedHeight = Math.max(baseHeight, minHeight)
    
    return `${calculatedHeight}%`
  }

  return (
    <div ref={chartContainerRef} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-400 flex items-center">
            <Users className="w-4 h-4 mr-1" />
            用户增长趋势
            {useMockData && (
              <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">
                模拟数据
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
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-gray-400 text-sm">加载增长数据...</p>
        </div>
      ) : (
        <>
          {/* 柱状图 - 关键修复 */}
          <div className="relative">
            <div className="flex items-end h-32 gap-1 mb-2">
              {growthData.map((day, index) => {
                const height = getBarHeight(day.count, maxCount)
                const color = getBarColor(day.count)
                
                console.log(`📊 渲染柱子 ${index}:`, {
                  日期: day.date,
                  新增: day.count,
                  高度: height,
                  颜色: color
                })
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group">
                    <div className="text-xs text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {day.count}
                    </div>
                    <div
                      className={`w-3/4 bg-gradient-to-t ${color} rounded-t-sm transition-all duration-300 hover:opacity-80 cursor-pointer group-hover:shadow-lg group-hover:shadow-blue-500/20`}
                      style={{ 
                        height: height,
                        minHeight: '10px' // 确保有最小高度
                      }}
                      title={`${day.date}: 新增 ${day.count} 人，累计 ${day.cumulative} 人`}
                    >
                      {/* 柱子内部内容，用于调试 */}
                      <div className="h-full w-full opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center">
                        <span className="text-white text-xs mb-1">{day.count}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {day.date.split('/')[1]}
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* Y轴标签 */}
            <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-gray-500">
              <span>{maxCount}</span>
              <span>{Math.round(maxCount * 0.75)}</span>
              <span>{Math.round(maxCount * 0.5)}</span>
              <span>{Math.round(maxCount * 0.25)}</span>
              <span>0</span>
            </div>
            
            {/* 网格线 */}
            <div className="absolute top-0 left-8 right-0 h-32 pointer-events-none">
              {[0, 25, 50, 75, 100].map((percent) => (
                <div
                  key={percent}
                  className="absolute left-0 right-0 border-t border-gray-700/30"
                  style={{ top: `${100 - percent}%` }}
                />
              ))}
            </div>
          </div>

          {/* 统计信息 */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-700/50">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-1">今日新增</p>
              <p className="text-lg font-bold text-white">
                {growthData[growthData.length - 1]?.count || 0}
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
              <p className="text-lg font-bold text-green-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                {totalGrowth > 0 ? '+' : ''}
                {growthData.length > 1 
                  ? ((totalGrowth / (growthData[0]?.cumulative || 1)) * 100).toFixed(1)
                  : '0.0'}%
              </p>
            </div>
          </div>
          
          {/* 调试信息（仅开发环境显示） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-2 bg-gray-900/50 rounded text-xs">
              <div className="text-gray-400 mb-1">调试信息：</div>
              <div className="text-gray-500">
                数据点数: {growthData.length} | 
                最大count: {maxCount} | 
                总增长: {totalGrowth}
              </div>
            </div>
          )}
          
          {/* 刷新按钮 */}
          <div className="mt-3 text-center">
            <button
              onClick={fetchGrowthData}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center justify-center mx-auto"
              disabled={loading}
            >
              <svg className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              刷新数据
            </button>
          </div>
        </>
      )}
    </div>
  )
}
