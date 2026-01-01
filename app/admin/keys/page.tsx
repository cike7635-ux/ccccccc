'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'

// 1. 从lucide-react单独导入图标，避免barrel optimization冲突
import { Key } from 'lucide-react'
import { Copy } from 'lucide-react'
import { Check } from 'lucide-react'
import { Trash2 } from 'lucide-react'
import { Plus } from 'lucide-react'
import { Search } from 'lucide-react'
import { Filter } from 'lucide-react'
import { Download } from 'lucide-react'
import { Shield } from 'lucide-react'
import { Clock } from 'lucide-react'
import { Users } from 'lucide-react'
import { Eye } from 'lucide-react'
import { EyeOff } from 'lucide-react'
import { RefreshCw } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import { MoreVertical } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { Ban } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { Calendar } from 'lucide-react'
import { Hash } from 'lucide-react'
import { Zap } from 'lucide-react'
import { User } from 'lucide-react'
import { Unlock } from 'lucide-react'
import { Info } from 'lucide-react'
import { X } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { ChevronLeft } from 'lucide-react'
import { ChevronFirst } from 'lucide-react'
import { ChevronLast } from 'lucide-react'
import { BarChart3 } from 'lucide-react'
import { File } from 'lucide-react'
import { FileText } from 'lucide-react'
import { ExternalLink } from 'lucide-react'

// 2. 导入其他依赖
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// 3. 导入组件和类型
import ExportModal from './components/ExportModal'
import { AccessKey, KeyStatus, RemainingTime, RecentUser } from './types'

// 4. 在组件内部定义状态配置
const statusConfig: Record<KeyStatus, {
  label: string
  color: string
  bgColor: string
  icon: any
}> = {
  unused: { label: '未使用', color: 'text-amber-400', bgColor: 'bg-amber-500/15', icon: Clock },
  used: { label: '已使用', color: 'text-green-400', bgColor: 'bg-green-500/15', icon: Check },
  expired: { label: '已过期', color: 'text-red-400', bgColor: 'bg-red-500/15', icon: AlertCircle },
  disabled: { label: '已禁用', color: 'text-gray-400', bgColor: 'bg-gray-500/15', icon: Ban },
  unknown: { label: '未知', color: 'text-gray-400', bgColor: 'bg-gray-500/15', icon: AlertCircle }
}

// 主页面组件
export default function KeysPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <KeysContent />
    </Suspense>
  )
}

// 加载状态组件
function LoadingPage() {
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
  const [keys, setKeys] = useState<AccessKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [operationLoading, setOperationLoading] = useState<number | null>(null)
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)

  // 筛选状态
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | KeyStatus>('all')
  const [sortBy, setSortBy] = useState<'created_at' | 'key_code' | 'used_count'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // 统计信息
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    used: 0,
    unused: 0,
    expired: 0,
    inactive: 0,
    todayExpiring: 0,
    nearExpiring: 0,
    total_users: 0,
    total_uses: 0
  })

  // 获取密钥数据
  const fetchKeys = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      console.log('📡 开始获取密钥数据（增强版）...')

      const response = await fetch('/api/admin/keys/list', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Accept': 'application/json'
        }
      })

      console.log('📦 API响应状态:', response.status)

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error(`API请求失败 (${response.status})`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '获取密钥数据失败')
      }

      const keysData: AccessKey[] = result.data || []
      console.log(`✅ 获取到 ${keysData.length} 条密钥数据`)

      // 确保每个密钥都有必要的数据
      const processedKeys = keysData.map(key => ({
        ...key,
        // 确保数组字段存在
        recent_users: key.recent_users || [],
        total_users: key.total_users || 0,
        // 确保状态字段存在
        key_status: key.key_status || 'unknown',
        remaining_time: key.remaining_time || { text: '未知', color: 'text-gray-400', isExpired: false },
        duration_display: key.duration_display || '未知',
        // 确保日期格式
        created_at_formatted: key.created_at_formatted ||
          (key.created_at ? new Date(key.created_at).toLocaleString('zh-CN') : '未知')
      }))

      setKeys(processedKeys)

      // 计算统计数据
      const now = new Date()
      const today = new Date()
      today.setHours(23, 59, 59, 999)

      const sevenDaysLater = new Date()
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

      // 计算总用户数和总使用次数
      const totalUsers = processedKeys.reduce((sum, key) => sum + (key.total_users || 0), 0)
      const totalUses = processedKeys.reduce((sum, key) => sum + (key.usage_count || 0), 0)

      const statsData = {
        total: processedKeys.length,
        active: processedKeys.filter(k => k.is_active).length,
        used: processedKeys.filter(k => k.key_status === 'used').length,
        unused: processedKeys.filter(k => k.key_status === 'unused').length,
        expired: processedKeys.filter(k => k.key_status === 'expired').length,
        inactive: processedKeys.filter(k => k.key_status === 'disabled').length,
        todayExpiring: processedKeys.filter(k => {
          if (!k.key_expires_at || !k.is_active) return false
          const expiry = new Date(k.key_expires_at)
          return expiry > now && expiry.toDateString() === today.toDateString()
        }).length,
        nearExpiring: processedKeys.filter(k => {
          if (!k.key_expires_at || !k.is_active) return false
          const expiry = new Date(k.key_expires_at)
          return expiry > now && expiry <= sevenDaysLater && expiry.toDateString() !== today.toDateString()
        }).length,
        total_users: totalUsers,
        total_uses: totalUses
      }

      console.log('📊 增强统计数据:', statsData)
      setStats(statsData)

    } catch (error: any) {
      console.error('❌ 获取密钥数据失败:', error)
      setError(`获取数据失败: ${error.message}`)
      setKeys([])
    } finally {
      setLoading(false)
    }
  }, [router])

  // 复制密钥到剪贴板
  const copyToClipboard = (keyCode: string) => {
    navigator.clipboard.writeText(keyCode)
    setCopiedKey(keyCode)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // 计算密钥状态（备用函数）
  const getKeyStatus = (key: AccessKey): KeyStatus => {
    // 如果API已经提供了状态，直接使用
    if (key.key_status && key.key_status !== 'unknown') {
      return key.key_status
    }

    const now = new Date()

    // 1. 已禁用
    if (!key.is_active) {
      return 'disabled'
    }

    // 2. 已过期
    if (key.key_expires_at && new Date(key.key_expires_at) < now) {
      return 'expired'
    }

    // 3. 已使用（used_at不为空或user_id不为空）
    if (key.used_at !== null || key.user_id !== null) {
      return 'used'
    }

    // 4. 未使用
    return 'unused'
  }

  // 计算剩余有效期（备用函数）
  const getRemainingTime = (key: AccessKey): RemainingTime => {
    // 如果API已经提供了剩余时间，直接使用
    if (key.remaining_time && key.remaining_time.text !== '未知') {
      return key.remaining_time
    }

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
        expiryTime = new Date(usedDate.getTime() + parseFloat(key.original_duration_hours as any) * 60 * 60 * 1000)
      } else if (key.account_valid_for_days) {
        expiryTime = new Date(usedDate.getTime() + (key.account_valid_for_days || 30) * 24 * 60 * 60 * 1000)
      } else {
        return {
          text: '永不过期',
          color: 'text-green-400',
          isExpired: false
        }
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
      text: `有效期${key.account_valid_for_days || 30}天`,
      color: 'text-green-400',
      isExpired: false
    }
  }

  // 获取时长显示（备用函数）
  const getDurationDisplay = (key: AccessKey): string => {
    // 如果API已经提供了时长显示，直接使用
    if (key.duration_display && key.duration_display !== '未知') {
      return key.duration_display
    }

    // 优先使用 original_duration_hours
    if (key.original_duration_hours) {
      const hours = parseFloat(key.original_duration_hours as any)

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
    const days = key.account_valid_for_days || 30
    if (days < 30) {
      return `${days}天`
    } else {
      const months = Math.round(days / 30)
      return `${months}个月`
    }
  }

  // 优化的使用者列渲染函数 - 方案A（标签式）
  const renderUsers = (key: AccessKey) => {
    const recentUsers = key.recent_users || []
    const totalUsers = key.total_users || 0

    if (totalUsers === 0 && recentUsers.length === 0) {
      return <span className="text-gray-500 text-sm">-</span>
    }

    // 提取邮箱前缀（@之前的部分）用于简洁显示
    const getEmailPrefix = (email: string) => {
      const prefix = email.split('@')[0]
      return prefix.length > 12 ? prefix.substring(0, 12) + '...' : prefix
    }

    return (
      <div className="max-w-[200px]">
        <div className="flex flex-wrap gap-1.5">
          {/* 用户标签 */}
          {recentUsers.slice(0, 2).map((user, index) => (
            <div
              key={index}
              className="group relative"
            >
              <div className="px-2.5 py-1.5 bg-gray-800/60 hover:bg-gray-700/80 rounded-lg border border-gray-700/50 transition-all duration-200 cursor-help shadow-sm hover:shadow-md">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border border-gray-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-2.5 h-2.5 text-gray-300" />
                  </div>
                  <span className="text-xs font-medium text-gray-300">
                    {getEmailPrefix(user.email)}
                  </span>
                </div>
              </div>

              {/* 悬停提示框 */}
              <div className="absolute z-50 hidden group-hover:block -top-10 left-1/2 -translate-x-1/2">
                <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
                  <p className="text-xs font-medium text-gray-200 mb-1">用户信息</p>
                  <p className="text-xs text-gray-300 break-all">{user.email}</p>
                  {user.nickname && (
                    <p className="text-xs text-gray-500 mt-1">昵称: {user.nickname}</p>
                  )}
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 border-r border-b border-gray-700 rotate-45"></div>
              </div>
            </div>
          ))}

          {/* 更多用户计数 */}
          {totalUsers > 2 && (
            <div className="group relative">
              <div className="px-2.5 py-1.5 bg-gradient-to-r from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 rounded-lg border border-blue-500/30 transition-all duration-200 cursor-help shadow-sm hover:shadow-md">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-blue-400">
                    +{totalUsers - 2}
                  </span>
                </div>
              </div>

              {/* 悬停提示框 */}
              <div className="absolute z-50 hidden group-hover:block -top-10 left-1/2 -translate-x-1/2">
                <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-xl">
                  <p className="text-xs font-medium text-gray-200 mb-1">使用者统计</p>
                  <p className="text-xs text-gray-300">共 {totalUsers} 个使用者</p>
                  <p className="text-xs text-gray-500 mt-1">点击查看详情查看所有用户</p>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 border-r border-b border-gray-700 rotate-45"></div>
              </div>
            </div>
          )}
        </div>

        {/* 当只有一个用户时显示完整邮箱 */}
        {totalUsers === 1 && recentUsers.length === 1 && (
          <div className="mt-2">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-800/30 rounded-lg border border-gray-700/30">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                <User className="w-3 h-3 text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-300 truncate" title={recentUsers[0].email}>
                  {recentUsers[0].email}
                </p>
                {recentUsers[0].nickname && (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {recentUsers[0].nickname}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
  // 过滤密钥
  const filteredKeys = useMemo(() => {
    return keys.filter(key => {
      // 搜索过滤
      const searchMatch = search === '' ||
        key.key_code.toLowerCase().includes(search.toLowerCase()) ||
        (key.description && key.description.toLowerCase().includes(search.toLowerCase())) ||
        (key.profiles?.email && key.profiles.email.toLowerCase().includes(search.toLowerCase())) ||
        // 搜索使用者邮箱
        (key.recent_users && key.recent_users.some(user =>
          user.email.toLowerCase().includes(search.toLowerCase())
        ))

      // 状态过滤
      if (statusFilter === 'all') {
        return searchMatch
      }

      // 获取密钥状态
      const keyStatus = getKeyStatus(key)

      // 状态匹配
      return searchMatch && keyStatus === statusFilter

    }).sort((a, b) => {
      // 排序
      let aValue: any, bValue: any

      if (sortBy === 'key_code') {
        aValue = a.key_code
        bValue = b.key_code
      } else if (sortBy === 'used_count') {
        aValue = a.used_count || 0
        bValue = b.used_count || 0
      } else {
        aValue = a.created_at
        bValue = b.created_at
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }, [keys, search, statusFilter, sortBy, sortOrder])

  // 分页数据
  const paginatedKeys = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredKeys.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredKeys, currentPage, itemsPerPage])

  // 单个密钥操作
  const handleKeyAction = async (keyId: number, action: 'disable' | 'enable' | 'delete') => {
    const actionText = {
      disable: '禁用',
      enable: '启用',
      delete: '删除'
    }[action]

    if (action === 'delete') {
      if (!confirm(`确定要删除此密钥吗？\n此操作不可撤销！`)) {
        return
      }
    } else {
      if (!confirm(`确定要${actionText}此密钥吗？`)) {
        return
      }
    }

    setOperationLoading(keyId)

    try {
      const response = await fetch(`/api/admin/keys/${keyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        setSuccessMessage(`密钥已${actionText}`)
        setTimeout(() => setSuccessMessage(null), 3000)

        // 刷新数据
        setRefreshTrigger(prev => prev + 1)

        // 如果删除了选中的密钥，从选中列表中移除
        if (action === 'delete') {
          setSelectedKeys(prev => prev.filter(id => id !== keyId))
        }
      } else {
        throw new Error(result.error || `${actionText}失败`)
      }
    } catch (error: any) {
      alert(`❌ ${actionText}失败: ${error.message}`)
    } finally {
      setOperationLoading(null)
    }
  }

  // 批量操作
  const handleBulkAction = async (action: 'disable' | 'enable' | 'delete') => {
    if (selectedKeys.length === 0) return

    const actionText = {
      disable: '禁用',
      enable: '启用',
      delete: '删除'
    }[action]

    const confirmText = {
      disable: `确定要禁用选中的 ${selectedKeys.length} 个密钥吗？\n禁用后密钥将无法使用。`,
      enable: `确定要启用选中的 ${selectedKeys.length} 个密钥吗？\n启用后密钥可以正常使用。`,
      delete: `确定要删除选中的 ${selectedKeys.length} 个密钥吗？\n此操作不可撤销！`
    }[action]

    if (!confirm(confirmText)) return

    setBulkOperationLoading(true)

    try {
      const response = await fetch('/api/admin/keys/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          keyIds: selectedKeys
        }),
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        setSuccessMessage(`成功${actionText}了 ${selectedKeys.length} 个密钥`)
        setTimeout(() => setSuccessMessage(null), 3000)

        // 刷新数据
        setRefreshTrigger(prev => prev + 1)
        setSelectedKeys([])
        setShowBulkActions(false)
      } else {
        throw new Error(result.error || `${actionText}失败`)
      }
    } catch (error: any) {
      alert(`❌ 批量${actionText}失败: ${error.message}`)
    } finally {
      setBulkOperationLoading(false)
    }
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedKeys.length === filteredKeys.length) {
      setSelectedKeys([])
    } else {
      setSelectedKeys(filteredKeys.map(key => key.id))
    }
  }

  // 查看密钥详情
  const viewKeyDetail = (keyId: number) => {
    window.open(`/admin/keys/${keyId}`, '_blank')
  }

  // 复制选中的密钥
  const copySelectedKeys = () => {
    const selectedKeyCodes = keys
      .filter(key => selectedKeys.includes(key.id))
      .map(key => key.key_code)

    if (selectedKeyCodes.length === 0) return

    const text = selectedKeyCodes.join('\n')
    navigator.clipboard.writeText(text)
    setSuccessMessage(`已复制 ${selectedKeyCodes.length} 个密钥到剪贴板`)
    setTimeout(() => setSuccessMessage(null), 2000)
  }

  // 导出功能
  const handleExport = async (format: 'csv' | 'json' | 'txt') => {
    try {
      setBulkOperationLoading(true)

      const response = await fetch('/api/admin/keys/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          selected_ids: selectedKeys.length > 0 ? selectedKeys : undefined,
          filters: {
            status: statusFilter,
            search
          }
        }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('导出请求失败')
      }

      // 创建下载链接
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')

      const filename = response.headers.get('Content-Disposition')
        ?.split('filename=')[1]
        ?.replace(/"/g, '') || `love-ludo-keys-export.${format}`

      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setSuccessMessage(`导出成功，文件已开始下载`)
      setTimeout(() => setSuccessMessage(null), 3000)

    } catch (error: any) {
      alert(`❌ 导出失败: ${error.message}`)
    } finally {
      setBulkOperationLoading(false)
    }
  }

  // 格式化日期
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return '格式错误'
    }
  }

  // 初始加载
  useEffect(() => {
    fetchKeys()
  }, [fetchKeys, refreshTrigger])

  // 自动清除成功消息
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // 页面改变时重置到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, itemsPerPage])

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
            {selectedKeys.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('disable')}
                  disabled={bulkOperationLoading}
                  className="px-3 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:opacity-90 rounded-lg text-sm text-white whitespace-nowrap disabled:opacity-50"
                >
                  {bulkOperationLoading ? '处理中...' : `批量禁用 (${selectedKeys.length})`}
                </button>
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  disabled={bulkOperationLoading}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 flex items-center disabled:opacity-50"
                >
                  <MoreVertical className="w-4 h-4 mr-2" />
                  更多操作
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showBulkActions ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 flex items-center"
            >
              <Filter className="w-4 h-4 mr-2" />
              高级筛选
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportModal(!showExportModal)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                导出数据
              </button>

              {showExportModal && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={bulkOperationLoading}
                    className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 border-b border-gray-700 flex items-center disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 mr-2 text-green-400" />
                    CSV格式
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    disabled={bulkOperationLoading}
                    className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 border-b border-gray-700 flex items-center disabled:opacity-50"
                  >
                    <File className="w-4 h-4 mr-2 text-blue-400" />
                    JSON格式
                  </button>
                  <button
                    onClick={() => handleExport('txt')}
                    disabled={bulkOperationLoading}
                    className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 flex items-center disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 mr-2 text-amber-400" />
                    文本格式
                  </button>
                </div>
              )}
            </div>

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

        {/* 批量操作下拉菜单 */}
        {showBulkActions && selectedKeys.length > 0 && (
          <div className="mt-4 p-4 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg animate-slide-down">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white mb-2">批量操作 ({selectedKeys.length}个密钥)</h3>
                <p className="text-gray-400 text-sm">选择要执行的操作：</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('enable')}
                  disabled={bulkOperationLoading}
                  className="px-3 py-2 bg-green-600 hover:opacity-90 rounded-lg text-sm text-white flex items-center disabled:opacity-50"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  批量启用
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  disabled={bulkOperationLoading}
                  className="px-3 py-2 bg-red-600 hover:opacity-90 rounded-lg text-sm text-white flex items-center disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  批量删除
                </button>
                <button
                  onClick={copySelectedKeys}
                  className="px-3 py-2 bg-blue-600 hover:opacity-90 rounded-lg text-sm text-white flex items-center"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  复制密钥
                </button>
                <button
                  onClick={() => setShowBulkActions(false)}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300"
                >
                  <X className="w-4 h-4" />
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
              placeholder="搜索密钥代码、描述、邮箱..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {[
              { value: 'all' as const, label: '全部密钥', count: stats.total, color: 'text-gray-400' },
              { value: 'unused' as const, label: '未使用', count: stats.unused, color: 'text-amber-400' },
              { value: 'used' as const, label: '已使用', count: stats.used, color: 'text-blue-400' },
              { value: 'expired' as const, label: '已过期', count: stats.expired, color: 'text-red-400' },
              { value: 'disabled' as const, label: '已禁用', count: stats.inactive, color: 'text-gray-400' }
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

        {/* 高级筛选 */}
        {showAdvancedFilters && (
          <div className="mt-4 p-4 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg animate-slide-down">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  排序方式
                </label>
                <select
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="created_at">创建时间</option>
                  <option value="key_code">密钥代码</option>
                  <option value="used_count">使用次数</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  排序顺序
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSortOrder('desc')}
                    className={`flex-1 px-3 py-2 rounded-lg ${sortOrder === 'desc' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    最新优先
                  </button>
                  <button
                    onClick={() => setSortOrder('asc')}
                    className={`flex-1 px-3 py-2 rounded-lg ${sortOrder === 'asc' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                  >
                    最早优先
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  每页显示
                </label>
                <select
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                >
                  <option value={10}>10 条/页</option>
                  <option value={20}>20 条/页</option>
                  <option value={50}>50 条/页</option>
                  <option value={100}>100 条/页</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('all')
                      setSortBy('created_at')
                      setSortOrder('desc')
                      setItemsPerPage(20)
                    }}
                    className="flex-1 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"
                  >
                    重置所有筛选
                  </button>
                  <button
                    onClick={() => setShowAdvancedFilters(false)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
                  >
                    关闭高级筛选
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 统计面板 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors cursor-pointer">
          <div className="flex items-center">
            <Key className="w-5 h-5 mr-2 text-amber-400" />
            <p className="text-sm text-gray-400">总密钥数</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white mt-2">{stats.total}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors cursor-pointer">
          <div className="flex items-center">
            <Shield className="w-5 h-5 mr-2 text-green-400" />
            <p className="text-sm text-gray-400">有效密钥</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white mt-2">{stats.active}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors cursor-pointer">
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-2 text-amber-400" />
            <p className="text-sm text-gray-400">未使用</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-amber-400 mt-2">{stats.unused}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors cursor-pointer">
          <div className="flex items-center">
            <Check className="w-5 h-5 mr-2 text-blue-400" />
            <p className="text-sm text-gray-400">已使用</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-blue-400 mt-2">{stats.used}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors cursor-pointer">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-red-400" />
            <p className="text-sm text-gray-400">已过期</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-red-400 mt-2">{stats.expired}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors cursor-pointer">
          <div className="flex items-center">
            <Ban className="w-5 h-5 mr-2 text-gray-400" />
            <p className="text-sm text-gray-400">已禁用</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-gray-400 mt-2">{stats.inactive}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors cursor-pointer">
          <div className="flex items-center">
            <Users className="w-5 h-5 mr-2 text-green-400" />
            <p className="text-sm text-gray-400">总使用者</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-green-400 mt-2">{stats.total_users}</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors cursor-pointer">
          <div className="flex items-center">
            <Zap className="w-5 h-5 mr-2 text-amber-400" />
            <p className="text-sm text-gray-400">总使用次数</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-amber-400 mt-2">{stats.total_uses}</p>
        </div>
      </div>

      {/* 密钥列表表格 */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-700/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">密钥列表</h2>
              <p className="text-gray-400 text-sm mt-1">
                {selectedKeys.length > 0 && (
                  <span className="text-amber-400 mr-3">已选中 {selectedKeys.length} 个密钥</span>
                )}
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
                {loading ? '加载中...' : '刷新数据'}
              </button>
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1 bg-gray-800 rounded text-sm hover:bg-gray-700 text-gray-300"
              >
                {selectedKeys.length === filteredKeys.length && filteredKeys.length > 0 ? '取消全选' : '全选当前页'}
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
                    <th className="text-left py-3 px-4 md:px-6">
                      <input
                        type="checkbox"
                        checked={selectedKeys.length === filteredKeys.length && filteredKeys.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-600 bg-gray-800"
                      />
                    </th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">密钥代码</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">描述</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">有效期</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">状态</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">使用者</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">使用次数</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">剩余有效期</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">创建时间</th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedKeys.map((key) => {
                    const keyStatus = key.key_status || getKeyStatus(key)
                    const status = statusConfig[keyStatus]
                    const StatusIcon = status.icon
                    const remaining = key.remaining_time || getRemainingTime(key)
                    const durationDisplay = key.duration_display || getDurationDisplay(key)
                    const isSelected = selectedKeys.includes(key.id)
                    const isOperationLoading = operationLoading === key.id

                    return (
                      <tr
                        key={key.id}
                        className={`border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors ${isSelected ? 'bg-blue-500/5' : ''}`}
                      >
                        <td className="py-3 px-4 md:px-6">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedKeys(prev => [...prev, key.id])
                              } else {
                                setSelectedKeys(prev => prev.filter(id => id !== key.id))
                              }
                            }}
                            className="rounded border-gray-600 bg-gray-800"
                            disabled={isOperationLoading}
                          />
                        </td>

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
                              disabled={isOperationLoading}
                              className={`p-1.5 rounded transition-colors ${copiedKey === key.key_code ? 'bg-green-500/20' : 'hover:bg-gray-700'} disabled:opacity-50`}
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
                            {key.key_expires_at && !key.used_at && !key.user_id && (
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

                        {/* 🔥 修改后的使用者列 */}
                        <td className="py-3 px-4 md:px-6">
                          {renderUsers(key)}
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
                          {key.created_at_formatted || formatDate(key.created_at)}
                        </td>

                        <td className="py-3 px-4 md:px-6">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => viewKeyDetail(key.id)}
                              className="p-1.5 hover:bg-blue-500/20 rounded transition-colors"
                              title="查看详情"
                            >
                              <Eye className="w-4 h-4 text-blue-400" />
                            </button>
                            <button
                              onClick={() => handleKeyAction(key.id, key.is_active ? 'disable' : 'enable')}
                              disabled={isOperationLoading}
                              className="p-1.5 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                              title={key.is_active ? '禁用密钥' : '启用密钥'}
                            >
                              {isOperationLoading ? (
                                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                              ) : key.is_active ? (
                                <EyeOff className="w-4 h-4 text-amber-400" />
                              ) : (
                                <Eye className="w-4 h-4 text-green-400" />
                              )}
                            </button>
                            <button
                              onClick={() => handleKeyAction(key.id, 'delete')}
                              disabled={isOperationLoading}
                              className="p-1.5 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                              title="删除密钥"
                            >
                              {isOperationLoading ? (
                                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-red-400" />
                              )}
                            </button>
                          </div>
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

      {/* 底部提示信息 */}
      <div className="mt-6 p-4 bg-gray-800/30 border border-gray-700/50 rounded-lg">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-400 mr-2 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-white mb-1">操作说明</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• <span className="text-amber-400">禁用</span>：密钥暂时不可用，但保留记录</li>
              <li>• <span className="text-green-400">启用</span>：恢复禁用的密钥</li>
              <li>• <span className="text-red-400">删除</span>：永久删除密钥，不可恢复</li>
              <li>• <span className="text-blue-400">使用者显示</span>：每个密钥显示前两个使用者，点击查看详情可看到所有使用者</li>
              <li>• 支持批量操作：选中多个密钥后可使用批量功能</li>
              <li>• 支持高级筛选：点击"高级筛选"按钮查看更多选项</li>
              <li>• 支持导出功能：可导出CSV、JSON或文本格式</li>
              <li>• 小时级别密钥：支持1小时、2小时、4小时、12小时等时长</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 全局样式 */}
      <style jsx global>{`
  .animate-fade-in {
    animation: fadeIn 0.3s ease-in-out;
  }
  .animate-slide-down {
    animation: slideDown 0.3s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideDown {
    from { 
      opacity: 0;
      transform: translateY(-10px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* 平滑悬停动画 */
  .group-hover\:block {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* 悬停提示框动画 */
  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: translate(-50%, 10px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  .group:hover .group-hover\:block {
    animation: tooltipFadeIn 0.2s ease-out;
  }
`}</style>
    </div>
  )
}