// /app/admin/keys/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { 
  Key, Copy, Check, Trash2, Plus, Search, Filter, Download, 
  Shield, Clock, Users, Eye, EyeOff, RefreshCw, AlertCircle,
  BarChart3, MoreVertical, ChevronDown, Edit, Ban, Loader2,
  ExternalLink, Calendar, Hash, Zap, Settings, Star, User,
  Mail, Smartphone, Globe, Lock, Unlock, FileText, Info,
  X, ChevronUp, ChevronRight, ChevronLeft, ChevronFirst, ChevronLast
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// 主页面组件
export default function KeysPage() {
  return (
    <Suspense fallback={<KeysLoading />}>
      <KeysContent />
    </Suspense>
  )
}

// 加载状态组件
function KeysLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">正在加载密钥管理页面...</p>
        </div>
      </div>
    </div>
  )
}

// 主内容组件
function KeysContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // 状态管理
  const [keys, setKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [operationLoading, setOperationLoading] = useState<number | null>(null)
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalItems, setTotalItems] = useState(0)
  
  // 筛选状态
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // 获取密钥数据
  const fetchKeys = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('📡 开始获取密钥数据...')
      
      const response = await fetch('/api/admin/keys/list', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' }
      })

      console.log('📦 API响应状态:', response.status)
      
      if (!response.ok) {
        throw new Error(`API请求失败 (${response.status})`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '获取密钥数据失败')
      }

      const keysData = result.data || []
      console.log(`✅ 获取到 ${keysData.length} 条密钥数据`)
      
      setKeys(keysData)
      setTotalItems(keysData.length)

    } catch (error: any) {
      console.error('❌ 获取密钥数据失败:', error)
      setError(`获取数据失败: ${error.message}`)
      setKeys([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 复制密钥到剪贴板
  const copyToClipboard = (keyCode: string) => {
    navigator.clipboard.writeText(keyCode)
    setCopiedKey(keyCode)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // 计算密钥状态
  const getKeyStatus = (key: any) => {
    const now = new Date()
    
    if (!key.is_active) {
      return {
        label: '已禁用',
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/15',
        icon: Ban
      }
    }
    
    // 检查绝对有效期是否过期
    if (key.key_expires_at && new Date(key.key_expires_at) < now) {
      return {
        label: '已过期',
        color: 'text-red-400',
        bgColor: 'bg-red-500/15',
        icon: AlertCircle
      }
    }
    
    // 检查是否已使用
    if (key.used_count > 0 || key.used_at || key.user_id) {
      return {
        label: '已使用',
        color: 'text-green-400',
        bgColor: 'bg-green-500/15',
        icon: Check
      }
    }
    
    // 未使用
    return {
      label: '未使用',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      icon: Clock
    }
  }

  // 计算剩余有效期
  const getRemainingTime = (key: any): { text: string; color: string; isExpired: boolean } => {
    const now = new Date()
    
    // 1. 检查绝对有效期（激活截止时间）
    if (key.key_expires_at) {
      const expiryDate = new Date(key.key_expires_at)
      const diffMs = expiryDate.getTime() - now.getTime()
      
      if (diffMs <= 0) {
        return { 
          text: '已过期', 
          color: 'text-red-400',
          isExpired: true
        }
      }
      
      // 未激活，显示激活截止时间
      if (!key.used_at && !key.user_id) {
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        
        if (diffDays <= 7) {
          return { 
            text: `${diffDays}天后激活截止`, 
            color: 'text-amber-400',
            isExpired: false
          }
        }
        return { 
          text: `${diffDays}天后激活截止`, 
          color: 'text-blue-400',
          isExpired: false
        }
      }
    }
    
    // 2. 如果已激活，计算使用有效期
    if (key.used_at) {
      const usedDate = new Date(key.used_at)
      
      // 优先使用 original_duration_hours 计算
      let expiryTime
      if (key.original_duration_hours) {
        expiryTime = new Date(usedDate.getTime() + key.original_duration_hours * 60 * 60 * 1000)
      } else {
        expiryTime = new Date(usedDate.getTime() + key.account_valid_for_days * 24 * 60 * 60 * 1000)
      }
      
      const diffMs = expiryTime.getTime() - now.getTime()
      
      if (diffMs <= 0) {
        return { 
          text: '已过期', 
          color: 'text-red-400',
          isExpired: true
        }
      }
      
      // 转换为友好的时间显示
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffHours / 24)
      const remainingHours = diffHours % 24
      
      if (diffDays > 0) {
        if (remainingHours > 0) {
          return { 
            text: `${diffDays}天${remainingHours}小时后过期`, 
            color: diffDays <= 7 ? 'text-amber-400' : 'text-green-400',
            isExpired: false
          }
        }
        return { 
          text: `${diffDays}天后过期`, 
          color: diffDays <= 7 ? 'text-amber-400' : 'text-green-400',
          isExpired: false
        }
      } else {
        return { 
          text: `${diffHours}小时后过期`, 
          color: diffHours <= 24 ? 'text-amber-400' : 'text-blue-400',
          isExpired: false
        }
      }
    }
    
    // 3. 未激活也没有绝对有效期
    return { 
      text: `有效期${key.account_valid_for_days}天`, 
      color: 'text-green-400',
      isExpired: false
    }
  }

  // 获取时长显示
  const getDurationDisplay = (key: any): string => {
    // 优先使用 original_duration_hours
    if (key.original_duration_hours) {
      const hours = key.original_duration_hours
      
      if (hours < 24) {
        // 显示小时
        const displayHours = Math.floor(hours)
        const displayMinutes = Math.round((hours - displayHours) * 60)
        
        if (displayHours === 0) {
          return `${displayMinutes}分钟`
        } else if (displayMinutes === 0) {
          return `${displayHours}小时`
        } else {
          return `${displayHours}小时${displayMinutes}分钟`
        }
      } else if (hours < 24 * 30) {
        // 显示天
        const days = hours / 24
        if (days === Math.floor(days)) {
          return `${days}天`
        } else {
          // 显示天和小时
          const fullDays = Math.floor(days)
          const remainingHours = Math.round((days - fullDays) * 24)
          return `${fullDays}天${remainingHours}小时`
        }
      } else {
        // 显示月
        const months = hours / (24 * 30)
        if (months === Math.floor(months)) {
          return `${months}个月`
        } else {
          // 转换为天
          const days = Math.round(hours / 24)
          return `${days}天`
        }
      }
    }
    
    // 回退到 account_valid_for_days
    const days = key.account_valid_for_days
    if (days < 30) {
      return `${days}天`
    } else {
      const months = Math.round(days / 30)
      return `${months}个月`
    }
  }

  // 过滤密钥
  const filteredKeys = useMemo(() => {
    return keys.filter(key => {
      // 搜索过滤 - 通过密钥代码
      const searchMatch = search === '' || 
        key.key_code.toLowerCase().includes(search.toLowerCase())
      
      // 状态过滤
      const now = new Date()
      const status = getKeyStatus(key)
      let statusMatch = true
      
      switch (statusFilter) {
        case 'active':
          statusMatch = key.is_active && (!key.key_expires_at || new Date(key.key_expires_at) > now)
          break
        case 'used':
          statusMatch = key.used_count > 0 || key.used_at || key.user_id
          break
        case 'unused':
          statusMatch = key.used_count === 0 && !key.used_at && !key.user_id && key.is_active
          break
        case 'expired':
          statusMatch = key.key_expires_at && new Date(key.key_expires_at) < now
          break
        case 'inactive':
          statusMatch = !key.is_active
          break
        default:
          statusMatch = true
      }

      return searchMatch && statusMatch
    }).sort((a, b) => {
      // 按创建时间倒序
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [keys, search, statusFilter])

  // 分页数据
  const paginatedKeys = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredKeys.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredKeys, currentPage, itemsPerPage])

  // 计算统计
  const stats = useMemo(() => {
    const now = new Date()
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    const sevenDaysLater = new Date()
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)
    
    return {
      total: keys.length,
      active: keys.filter(k => k.is_active && (!k.key_expires_at || new Date(k.key_expires_at) > now)).length,
      used: keys.filter(k => k.used_count > 0 || k.used_at || k.user_id).length,
      unused: keys.filter(k => k.used_count === 0 && !k.used_at && !k.user_id && k.is_active).length,
      expired: keys.filter(k => k.key_expires_at && new Date(k.key_expires_at) < now).length,
      inactive: keys.filter(k => !k.is_active).length,
      todayExpiring: keys.filter(k => {
        if (!k.key_expires_at) return false
        const expiry = new Date(k.key_expires_at)
        return expiry.toDateString() === today.toDateString()
      }).length,
      nearExpiring: keys.filter(k => {
        if (!k.key_expires_at) return false
        const expiry = new Date(k.key_expires_at)
        return expiry > now && expiry <= sevenDaysLater
      }).length
    }
  }, [keys])

  // 初始化加载
  useEffect(() => {
    fetchKeys()
  }, [fetchKeys, refreshTrigger])

  // 清除成功消息
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // 页面改变时重置到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
      {/* 页面标题与操作区 */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
              <Key className="w-6 h-6 md:w-7 md:h-7 mr-2 text-amber-400" />
              密钥管理
            </h1>
            <p className="text-gray-400 mt-2">
              共 {stats.total} 个密钥 • 
              <span className="mx-2 text-green-400">{stats.active} 个有效</span> • 
              <span className="mx-2 text-amber-400">{stats.unused} 个未使用</span>
              {stats.todayExpiring > 0 && (
                <span className="ml-2 text-red-400">⚠️ {stats.todayExpiring} 个今日过期</span>
              )}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/keys/generate"
              className="px-3 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 rounded-lg text-sm text-white flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              生成新密钥
            </Link>
          </div>
        </div>

        {/* 成功消息 */}
        {successMessage && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg animate-fade-in">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-400 mr-3" />
              <p className="text-green-400">{successMessage}</p>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg animate-fade-in">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
              <div>
                <p className="text-red-400">{error}</p>
                <button
                  onClick={fetchKeys}
                  className="mt-2 text-sm text-red-300 hover:text-red-200 flex items-center"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  重试
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 搜索和筛选栏 */}
        <div className="flex flex-col md:flex-row gap-3 mt-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="搜索密钥代码..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {[
              { value: 'all', label: '全部密钥', count: stats.total, color: 'text-gray-400' },
              { value: 'active', label: '有效', count: stats.active, color: 'text-green-400' },
              { value: 'unused', label: '未使用', count: stats.unused, color: 'text-amber-400' },
              { value: 'used', label: '已使用', count: stats.used, color: 'text-blue-400' },
              { value: 'expired', label: '已过期', count: stats.expired, color: 'text-red-400' },
              { value: 'inactive', label: '已禁用', count: stats.inactive, color: 'text-gray-400' }
            ].map((item) => (
              <button
                key={item.value}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap flex items-center ${statusFilter === item.value
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                onClick={() => setStatusFilter(item.value)}
              >
                <span className={statusFilter !== item.value ? item.color : ''}>
                  {item.label}
                </span>
                {item.count !== undefined && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500/20 rounded text-xs">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 密钥列表表格 */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-700/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">密钥列表</h2>
              <p className="text-gray-400 text-sm mt-1">
                显示 {paginatedKeys.length} / {filteredKeys.length} 个密钥 • 第 {currentPage} 页，共 {Math.ceil(filteredKeys.length / itemsPerPage)} 页
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchKeys}
                className="px-3 py-1 bg-gray-800 rounded text-sm hover:bg-gray-700 flex items-center transition-colors disabled:opacity-50"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                {loading ? '加载中...' : '刷新'}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 md:p-16 text-center">
            <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4">正在加载密钥数据...</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="p-8 md:p-16 text-center">
            <Key className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">暂无密钥数据</h3>
            <p className="text-gray-500 mb-6">数据库中尚未创建密钥，请先生成密钥</p>
            <Link
              href="/admin/keys/generate"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 rounded-lg text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              立即生成密钥
            </Link>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="p-8 md:p-16 text-center">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">未找到匹配的密钥</h3>
            <p className="text-gray-500 mb-4">请尝试调整搜索条件或筛选状态</p>
            {search && (
              <p className="text-gray-500 text-sm mb-6">搜索词: "{search}"</p>
            )}
            <button
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
              }}
              className="inline-flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"
            >
              清除所有筛选
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="border-b border-gray-700/50 bg-gray-900/50">
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">密钥代码</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">描述</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">有效期</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">状态</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">使用者</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">使用次数</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">剩余有效期</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedKeys.map((key) => {
                    const status = getKeyStatus(key)
                    const StatusIcon = status.icon
                    const remaining = getRemainingTime(key)
                    const durationDisplay = getDurationDisplay(key)
                    
                    return (
                      <tr 
                        key={key.id} 
                        className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="py-3 px-4 md:px-6">
                          <div className="flex items-center space-x-2">
                            <code 
                              className="font-mono text-sm bg-gray-900 px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer truncate max-w-[180px]"
                              onClick={() => copyToClipboard(key.key_code)}
                              title="点击复制密钥"
                            >
                              {key.key_code}
                            </code>
                            <button
                              onClick={() => copyToClipboard(key.key_code)}
                              className={`p-1.5 rounded transition-colors ${copiedKey === key.key_code ? 'bg-green-500/20' : 'hover:bg-gray-700'}`}
                              title={copiedKey === key.key_code ? '已复制' : '复制密钥'}
                            >
                              {copiedKey === key.key_code ? (
                                <Check className="w-4 h-4 text-green-400" />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          </div>
                        </td>
                        
                        <td className="py-3 px-4 md:px-6">
                          <div className="max-w-[150px]">
                            <p className="text-gray-300 text-sm truncate" title={key.description || ''}>
                              {key.description || '-'}
                            </p>
                          </div>
                        </td>
                        
                        <td className="py-3 px-4 md:px-6">
                          <div className="flex flex-col">
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium mb-1 w-fit">
                              {durationDisplay}
                            </span>
                            {key.key_expires_at && (
                              <span className="text-gray-500 text-xs">
                                激活截止: {new Date(key.key_expires_at).toLocaleDateString('zh-CN')}
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="py-3 px-4 md:px-6">
                          <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs ${status.bgColor} ${status.color}`}>
                            <StatusIcon className="w-3 h-3 mr-1.5" />
                            {status.label}
                          </span>
                        </td>
                        
                        <td className="py-3 px-4 md:px-6">
                          {key.user ? (
                            <div className="space-y-1 max-w-[150px]">
                              <div className="flex items-center">
                                <User className="w-3 h-3 text-gray-500 mr-1" />
                                <p className="text-gray-300 text-sm truncate">{key.user.email}</p>
                              </div>
                              {key.user.nickname && (
                                <p className="text-gray-500 text-xs truncate">{key.user.nickname}</p>
                              )}
                              {key.used_at && (
                                <p className="text-gray-600 text-xs">使用于: {new Date(key.used_at).toLocaleDateString('zh-CN')}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">-</span>
                          )}
                        </td>
                        
                        <td className="py-3 px-4 md:px-6">
                          <div className="flex items-center space-x-2">
                            <Hash className="w-4 h-4 text-gray-400" />
                            <div>
                              <span className="text-gray-300 text-sm">
                                {key.max_uses ? `${key.used_count || 0} / ${key.max_uses}` : '∞ 次'}
                              </span>
                              {key.max_uses && (
                                <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                                  <div 
                                    className="bg-green-500 h-1.5 rounded-full"
                                    style={{ width: `${Math.min(100, ((key.used_count || 0) / key.max_uses) * 100)}%` }}
                                  ></div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        <td className="py-3 px-4 md:px-6">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className={`text-sm ${remaining.color}`}>
                              {remaining.text}
                            </span>
                          </div>
                        </td>
                        
                        <td className="py-3 px-4 md:px-6 text-gray-300 text-sm">
                          {new Date(key.created_at).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 分页控件 */}
            {filteredKeys.length > itemsPerPage && (
              <div className="px-4 md:px-6 py-4 border-t border-gray-700/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center text-sm text-gray-400">
                    显示第 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredKeys.length)} 条，
                    共 {filteredKeys.length} 条记录
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
                    >
                      <option value={10}>10 条/页</option>
                      <option value={20}>20 条/页</option>
                      <option value={50}>50 条/页</option>
                      <option value={100}>100 条/页</option>
                    </select>
                    
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronFirst className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                      </button>
                      
                      <span className="px-3 py-1 text-sm text-gray-300">
                        {currentPage} / {Math.ceil(filteredKeys.length / itemsPerPage)}
                      </span>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredKeys.length / itemsPerPage), prev + 1))}
                        disabled={currentPage >= Math.ceil(filteredKeys.length / itemsPerPage)}
                        className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.ceil(filteredKeys.length / itemsPerPage))}
                        disabled={currentPage >= Math.ceil(filteredKeys.length / itemsPerPage)}
                        className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLast className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}