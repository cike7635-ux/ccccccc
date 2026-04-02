// /app/admin/users/page.tsx - 完整修复版本，添加会员到期时间列
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users, Mail, Search, Download, MoreVertical, Key, ChevronDown,
  Shield, Calendar, User, Clock, Tag, Filter, Wifi, WifiOff,
  SortAsc, SortDesc, Trash2, Edit, Copy, CheckCircle, AlertCircle,
  ExternalLink, Loader2, RefreshCw, TrendingUp, Venus, Mars, UserX
} from 'lucide-react'
import UserDetailModal from './components/user-detail-modal'
import GrowthChart from './components/growth-chart'
import {
  UserType,
  SortField,
  SortDirection,
  getGenderDisplay,
  getKeyStatus,
  normalizeUserDetail,
  isUserActive,
  getActiveStatusConfig,
  compareDates
} from './types'
import { useHeartbeat } from '@/hooks/use-heartbeat'

export const dynamic = 'force-dynamic'

const ITEMS_PER_PAGE = 20

export default function UsersPage() {
  // 使用心跳功能
  useHeartbeat()

  // 状态管理
  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedUserDetail, setSelectedUserDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showBatchMenu, setShowBatchMenu] = useState(false)
  const [batchActionLoading, setBatchActionLoading] = useState(false)
  const [operationMessage, setOperationMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null)

  // 排序状态
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showSortMenu, setShowSortMenu] = useState(false)

  // 统计数据状态（从API获取）
  const [stats, setStats] = useState({
    total: 0,
    premium: 0,
    active24h: 0,
    male: 0,
    female: 0,
    otherGender: 0,
    unknown: 0,
    activeNow: 0,
    deleted: 0
  })

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  // 获取用户数据 - 使用新的API
  const fetchUsers = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setLoading(true)
    } else {
      setLoading(true)
      setUsers([])
    }

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        sortField: sortField,
        sortDirection: sortDirection,
        filter: filter,
      })

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim())
      }

      const apiUrl = `/api/admin/users/list?${params.toString()}`
      console.log('📡 请求用户列表API:', apiUrl)

      const response = await fetch(apiUrl, {
        credentials: 'include',
        cache: forceRefresh ? 'no-cache' : 'default'
      })

      if (!response.ok) {
        throw new Error(`API请求失败 (${response.status})`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'API返回未知错误')
      }

      // 获取统计数据
      await fetchStats()

      // 转换用户数据
      const formattedUsers: UserType[] = (result.data || []).map((profile: any) => {
        // 统一日期格式化函数
        const formatDate = (dateString: string | null) => {
          if (!dateString) return '无记录'
          try {
            const date = new Date(dateString)
            if (isNaN(date.getTime())) return '无效日期'

            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')

            return `${year}年${month}月${day}日 ${hours}:${minutes}`
          } catch {
            return '无效日期'
          }
        }

        const lastLogin = formatDate(profile.last_login_at)
        const createdAt = formatDate(profile.created_at)
        const accountExpires = formatDate(profile.account_expires_at)

        const isPremium = profile.account_expires_at
          ? new Date(profile.account_expires_at) > new Date()
          : false

        // 🔧 修复：从 profile.current_key 获取密钥信息
        let keyCode = null
        let keyStatus: 'active' | 'expired' | 'unused' | 'inactive' = 'unused'
        let accessKeyId = null

        if (profile.current_key) {
          const currentKey = profile.current_key
          keyCode = currentKey.key_code || `ID: ${currentKey.id}`
          keyStatus = getKeyStatus(currentKey)
          accessKeyId = currentKey.id
        }

        // 获取性别
        const gender = getGenderDisplay(profile.preferences, profile.gender_display)

        // 计算用户活跃状态
        const userActive = isUserActive(profile.last_login_at)

        return {
          id: profile.id,
          email: profile.email,
          nickname: profile.nickname,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
          bio: profile.bio,
          preferences: profile.preferences,
          isAdmin: profile.email === '2200691917@qq.com',
          isPremium: isPremium,
          lastLogin: lastLogin,
          lastLoginRaw: profile.last_login_at,
          accountExpires: accountExpires,
          accountExpiresRaw: profile.account_expires_at,
          createdAt: createdAt,
          createdAtRaw: profile.created_at,
          accessKeyId: accessKeyId,
          activeKey: keyCode,
          isActive: !profile.account_expires_at || new Date(profile.account_expires_at) > new Date(),
          gender: gender,
          keyStatus: keyStatus,
          isUserActive: userActive
        }
      })

      console.log(`✅ 格式化后用户数据: ${formattedUsers.length} 条`)

      setUsers(formattedUsers)
      setTotalCount(result.pagination?.total || 0)

    } catch (error) {
      console.error('获取用户数据失败:', error)
      setUsers([])
      setTotalCount(0)
      showMessage('error', '加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, filter, sortField, sortDirection])

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/users/stats', {
        credentials: 'include',
        cache: 'no-cache'
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setStats(result.data)
        }
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }

  // 获取用户详情
  const fetchUserDetail = async (userId: string) => {
    setDetailLoading(true)
    setSelectedUserDetail(null)

    try {
      // 🔧 修复：使用正确的API端点
      const response = await fetch(`/api/admin/data?table=profiles&detailId=${userId}`, {
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('🔍 获取用户详情API响应:', {
        status: response.status,
        ok: response.ok,
        url: response.url
      })

      if (!response.ok) {
        throw new Error(`获取详情失败: ${response.status}`)
      }

      const result = await response.json()
      console.log('📊 用户详情API返回数据:', {
        success: result.success,
        hasData: !!result.data,
        dataKeys: result.data ? Object.keys(result.data) : [],
        aiRecordsCount: result.data?.ai_usage_records?.length || 0
      })

      if (!result.success) {
        throw new Error(result.error || '未找到用户详情')
      }

      if (!result.data) {
        throw new Error('API返回数据为空')
      }

      // 🔥 关键修复：确保数据格式正确
      const userDetail = normalizeUserDetail(result.data)

      console.log('✅ 归一化后的用户详情:', {
        id: userDetail.id,
        email: userDetail.email,
        aiRecords: userDetail.ai_usage_records?.length || 0,
        accessKeys: userDetail.access_keys?.length || 0
      })

      setSelectedUserDetail(userDetail)

    } catch (error: any) {
      console.error('❌ 获取用户详情失败:', error)
      setSelectedUserDetail(null)
      showMessage('error', `获取用户详情失败: ${error.message}`)
    } finally {
      setDetailLoading(false)
    }
  }

  // 显示操作消息
  const showMessage = useCallback((type: 'success' | 'error', message: string) => {
    setOperationMessage({ type, message })
    setTimeout(() => setOperationMessage(null), 5000)
  }, [])

  // 删除单个用户
  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`确定要删除用户 "${email}" 吗？\n\n此操作会将用户标记为已删除，但保留历史数据。`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const result = await response.json()

      if (result.success) {
        showMessage('success', `用户 ${email} 已删除`)
        fetchUsers(true) // 强制刷新列表
        fetchStats() // 刷新统计数据
      } else {
        throw new Error(result.error || '删除失败')
      }
    } catch (error: any) {
      console.error('删除用户失败:', error)
      showMessage('error', `删除失败: ${error.message}`)
    }
  }

  // 启用/禁用用户
  const handleToggleUserStatus = async (userId: string, email: string, currentStatus: boolean) => {
    const action = currentStatus ? '禁用' : '启用'
    if (!confirm(`确定要${action}用户 "${email}" 吗？`)) {
      return
    }

    try {
      // 创建状态更新API
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !currentStatus
        }),
        credentials: 'include',
      })

      const result = await response.json()

      if (result.success) {
        showMessage('success', `用户 ${email} 已${action}`)
        fetchUsers(true) // 刷新列表
      } else {
        throw new Error(result.error || `${action}失败`)
      }
    } catch (error: any) {
      console.error(`${action}用户失败:`, error)
      showMessage('error', `${action}失败: ${error.message}`)
    }
  }

  // 排序处理
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setShowSortMenu(false)
    setCurrentPage(1) // 回到第一页
  }

  // 获取排序图标
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      )
    }
    return sortDirection === 'asc'
      ? <SortAsc className="w-4 h-4 text-blue-400" />
      : <SortDesc className="w-4 h-4 text-blue-400" />
  }

  // 🔥 优化批量操作函数
  const handleBatchAction = async (action: 'disable' | 'enable' | 'delete') => {
    if (!selectedUsers.length) {
      showMessage('error', '请先选择用户')
      return
    }

    // 🔥 优化确认对话框
    const actionConfigs = {
      disable: {
        text: '禁用',
        confirm: `确定要禁用这 ${selectedUsers.length} 个账户吗？\n\n禁用后用户将无法登录系统。`,
        warning: '此操作会影响用户的登录权限。'
      },
      enable: {
        text: '启用',
        confirm: `确定要启用这 ${selectedUsers.length} 个账户吗？\n\n启用后用户将恢复会员权限。`,
        warning: '此操作会恢复用户的会员权限。'
      },
      delete: {
        text: '删除',
        confirm: `⚠️ 重要警告：确定要删除这 ${selectedUsers.length} 个账户吗？\n\n此操作会将用户标记为删除，但保留历史数据。\n用户邮箱将被修改为 deleted_ 前缀，无法再登录。`,
        warning: '此操作是软删除，用户数据会保留但无法登录。'
      }
    }

    const config = actionConfigs[action]
    const userCount = selectedUsers.length

    // 创建更友好的确认消息
    const confirmMessage = `${config.confirm}\n\n操作涉及 ${userCount} 个用户：\n${users
      .filter(u => selectedUsers.includes(u.id))
      .slice(0, 5) // 只显示前5个用户，避免太长
      .map(u => `• ${u.nickname || u.email}`)
      .join('\n')}${userCount > 5 ? `\n... 等 ${userCount} 个用户` : ''}`

    if (!confirm(confirmMessage)) return

    setBatchActionLoading(true)

    try {
      const response = await fetch('/api/admin/users/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userIds: selectedUsers,
          action: action,
          reason: `管理员批量${config.text}操作 - ${new Date().toLocaleString()}`
        }),
        credentials: 'include',
      })

      const result = await response.json()

      if (result.success) {
        showMessage('success', `✅ 成功${config.text}了 ${result.data.affectedCount} 个用户`)
        setSelectedUsers([])
        setShowBatchMenu(false)

        // 延迟刷新，给服务器一点时间处理
        setTimeout(() => {
          fetchUsers(true)
          fetchStats()
        }, 1000)
      } else {
        throw new Error(result.error || '操作失败')
      }
    } catch (error: any) {
      console.error(`批量${config.text}失败:`, error)
      showMessage('error', `❌ 批量${config.text}失败: ${error.message}`)
    } finally {
      setBatchActionLoading(false)
    }
  }

  // 🔧 优化：全选/取消全选逻辑
  const handleSelectAll = () => {
    if (selectedUsers.length === users.length && users.length > 0) {
      // 取消全选当前页
      setSelectedUsers([])
    } else {
      // 全选当前页
      const currentPageUserIds = users.map(user => user.id)
      setSelectedUsers(prev => {
        // 合并已选中的用户（可能来自其他页面）和当前页用户
        const combined = new Set([...prev, ...currentPageUserIds])
        return Array.from(combined)
      })
    }
  }

  // CSV导出
  const handleExportCSV = () => {
    if (users.length === 0) {
      showMessage('error', '没有数据可导出')
      return
    }

    const headers = ['ID', '邮箱', '昵称', '性别', '会员状态', '当前密钥', '密钥状态', '最后登录', '活跃状态', '注册时间', '会员到期时间']
    const csvData = users.map(user => [
      user.id,
      user.email,
      user.nickname || '',
      user.gender,
      user.isPremium ? '会员中' : '免费',
      user.activeKey || '',
      user.keyStatus === 'active' ? '已激活' : user.keyStatus === 'expired' ? '已过期' : user.keyStatus === 'inactive' ? '已禁用' : '未使用',
      user.lastLogin,
      user.isUserActive ? '活跃' : '离线',
      user.createdAt,
      user.accountExpires
    ])

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `用户列表_${new Date().toLocaleDateString('zh-CN')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showMessage('success', 'CSV导出成功')
  }

  // 查看详情
  const handleViewDetail = async (userId: string) => {
    await fetchUserDetail(userId)
    setDetailModalOpen(true)
  }

  // 刷新详情数据
  const handleRefreshDetail = useCallback(async () => {
    if (selectedUserDetail?.id) {
      await fetchUserDetail(selectedUserDetail.id)
      showMessage('success', '用户详情已刷新')
    }
  }, [selectedUserDetail])

  // 复制用户ID
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showMessage('success', `已复制${label}`)
    } catch (error) {
      console.error('复制失败:', error)
      showMessage('error', '复制失败')
    }
  }

  // 刷新列表
  const handleRefreshList = () => {
    fetchUsers(true)
    fetchStats()
    showMessage('success', '用户列表已刷新')
  }

  // 操作消息组件
  const OperationMessage = () => {
    if (!operationMessage) return null

    const { type, message } = operationMessage
    const Icon = type === 'success' ? CheckCircle : AlertCircle

    return (
      <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center animate-fade-in ${type === 'success' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
        <Icon className={`w-5 h-5 mr-2 ${type === 'success' ? 'text-green-400' : 'text-red-400'}`} />
        <span className={`text-sm ${type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
          {message}
        </span>
        <button
          onClick={() => setOperationMessage(null)}
          className="ml-4 text-gray-400 hover:text-gray-300 transition-colors"
        >
          ×
        </button>
      </div>
    )
  }

  // 🔧 批量操作状态显示组件
  const BatchOperationStatus = () => {
    if (!batchActionLoading || selectedUsers.length === 0) return null

    return (
      <div className="fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg bg-blue-500/20 border border-blue-500/30 animate-fade-in">
        <div className="flex items-center">
          <Loader2 className="w-5 h-5 mr-2 text-blue-400 animate-spin" />
          <span className="text-blue-300 text-sm">
            正在批量处理 {selectedUsers.length} 个用户...
          </span>
        </div>
      </div>
    )
  }

  // 渲染密钥单元格
  const renderKeyCell = (user: UserType) => {
    if (!user.activeKey || user.activeKey === '无') {
      return (
        <div className="flex items-center text-gray-500">
          <Key className="w-3 h-3 mr-1" />
          <span className="text-sm">无</span>
        </div>
      )
    }

    // 如果密钥是"ID: xxx"格式，只显示ID部分
    let displayKey = user.activeKey
    if (displayKey.startsWith('ID:')) {
      displayKey = displayKey.replace('ID: ', '')
    }

    // 根据状态显示不同颜色
    const statusConfig = {
      active: { label: '已激活', color: 'bg-green-500/10 text-green-400', iconColor: 'text-green-400' },
      expired: { label: '已过期', color: 'bg-red-500/10 text-red-400', iconColor: 'text-red-400' },
      inactive: { label: '已禁用', color: 'bg-gray-500/10 text-gray-400', iconColor: 'text-gray-400' },
      unused: { label: '未使用', color: 'bg-yellow-500/10 text-yellow-400', iconColor: 'text-yellow-400' }
    }

    const status = user.keyStatus || 'unused'
    const config = statusConfig[status] || statusConfig.unused

    // 检查是否是有效的密钥代码（包含破折号）
    const isValidKeyCode = displayKey.includes('-')

    return (
      <div className="space-y-1.5">
        <div className="flex items-center">
          <Key className={`w-3.5 h-3.5 mr-2 ${config.iconColor}`} />
          <code
            className={`text-sm px-2.5 py-1.5 rounded font-mono truncate max-w-[120px] hover:opacity-90 transition-opacity cursor-pointer ${isValidKeyCode
              ? 'bg-gray-800 text-gray-200 border border-gray-700'
              : 'bg-blue-500/10 text-blue-400'
              }`}
            title={`密钥: ${displayKey} (${config.label})`}
            onClick={(e) => {
              e.stopPropagation()
              copyToClipboard(displayKey, '密钥代码')
            }}
          >
            {displayKey}
          </code>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-xs px-2 py-1 rounded-full ${config.color} font-medium`}>
            {config.label}
          </span>
          {user.accessKeyId && (
            <span className="text-gray-600 text-xs">ID: {user.accessKeyId}</span>
          )}
        </div>
      </div>
    )
  }

  // 渲染性别单元格
  const renderGenderCell = (user: UserType) => {
    const gender = user.gender || '未设置'

    const genderColors: Record<string, { bg: string, text: string }> = {
      '男': { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Mars },
      '女': { bg: 'bg-pink-500/10', text: 'text-pink-400', icon: Venus },
      '其他': { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: User },
      '非二元': { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: User },
      '未设置': { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: UserX }
    }

    const { bg, text, icon: Icon } = genderColors[gender] || genderColors['未设置']

    return (
      <div className="flex items-center">
        <Icon className={`w-3 h-3 mr-1 ${text}`} />
        <span className={`px-2 py-1 rounded text-xs ${bg} ${text}`}>
          {gender}
        </span>
      </div>
    )
  }

  // 渲染最后登录时间和活跃状态
  const renderLastLoginCell = (user: UserType) => {
    const config = getActiveStatusConfig(!!user.isUserActive)

    return (
      <div className="space-y-2">
        {/* 最后登录时间 */}
        <div className="text-gray-300 text-sm">
          {user.lastLogin}
        </div>

        {/* 活跃状态标签 */}
        <div className="flex items-center">
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${config.bgColor} ${config.color}`}
            title={user.isUserActive ? '3分钟内在线，当前活跃' : '超过3分钟未活动'}
          >
            <span className="mr-1.5">{config.icon}</span>
            {config.label}
          </span>
        </div>
      </div>
    )
  }

  // 初始化加载
  useEffect(() => {
    fetchUsers()
    fetchStats()
  }, [fetchUsers])

  // 搜索防抖
  useEffect(() => {
    if (searchDebounce) {
      clearTimeout(searchDebounce)
    }

    const timer = setTimeout(() => {
      setCurrentPage(1)
      fetchUsers()
    }, 500)

    setSearchDebounce(timer)

    return () => {
      if (searchDebounce) {
        clearTimeout(searchDebounce)
      }
    }
  }, [searchTerm, filter, sortField, sortDirection])

  // 动画样式
  const styles = `
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fade-in 0.3s ease-out;
    }
    
    /* 移动端优化 */
    @media (max-width: 768px) {
      .table-container {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      
      .stat-card {
        padding: 0.75rem;
      }
      
      .action-buttons {
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      
      .user-info-cell {
        min-width: 200px;
      }
      
      .filter-buttons {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 0.5rem;
      }
    }
    
    @media (max-width: 640px) {
      .stat-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
      
      .stat-card .text-xl {
        font-size: 1.25rem;
      }
      
      .table-header-cell {
        padding-left: 0.5rem;
        padding-right: 0.5rem;
      }
      
      .table-cell {
        padding-left: 0.5rem;
        padding-right: 0.5rem;
      }
    }
  `

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-3 md:p-6">
      <style jsx>{styles}</style>

      {/* 操作消息 */}
      <OperationMessage />
      <BatchOperationStatus />

      {/* 页面标题与操作区 */}
      <div className="mb-4 md:mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white flex items-center">
              <Users className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 mr-2 text-blue-400" />
              用户管理
              {loading && (
                <Loader2 className="w-4 h-4 md:w-5 md:h-5 ml-2 md:ml-3 text-blue-400 animate-spin" />
              )}
            </h1>
            <p className="text-gray-400 text-sm md:text-base mt-1 md:mt-2">
              共 <span className="text-white font-semibold">{totalCount}</span> 个用户，
              <span className="text-white font-semibold mx-1">{selectedUsers.length}</span> 个已选择
              {users.length > 0 && (
                <span className="ml-2 md:ml-3 text-xs md:text-sm text-gray-500">
                  显示 {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} 条
                </span>
              )}
            </p>
          </div>

          {/* 操作按钮组 */}
          <div className="flex flex-wrap gap-1 md:gap-2 action-buttons">
            <button
              onClick={handleRefreshList}
              className="px-2 py-1.5 md:px-3 md:py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs md:text-sm text-gray-300 flex items-center transition-colors"
              title="刷新列表"
            >
              <RefreshCw className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">刷新</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-2 py-1.5 md:px-3 md:py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs md:text-sm text-gray-300 flex items-center transition-colors"
              disabled={users.length === 0}
            >
              <Download className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden md:inline">导出CSV</span>
            </button>

            {selectedUsers.length > 0 && (
              <div className="flex gap-1 md:gap-2">
                <button
                  onClick={() => handleBatchAction('delete')}
                  className="px-2 py-1.5 md:px-3 md:py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:opacity-90 rounded-lg text-xs md:text-sm text-white whitespace-nowrap flex items-center transition-opacity"
                  disabled={batchActionLoading}
                >
                  {batchActionLoading ? (
                    <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  )}
                  <span className="hidden md:inline">
                    {batchActionLoading ? '处理中...' : `批量删除 (${selectedUsers.length})`}
                  </span>
                  <span className="md:hidden">
                    {batchActionLoading ? '...' : `删 (${selectedUsers.length})`}
                  </span>
                </button>
                <button
                  onClick={() => setShowBatchMenu(!showBatchMenu)}
                  className="px-2 py-1.5 md:px-3 md:py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs md:text-sm text-gray-300 flex items-center transition-colors"
                  disabled={batchActionLoading}
                >
                  <MoreVertical className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 ml-0.5 md:ml-1 transition-transform ${showBatchMenu ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 搜索、筛选和排序栏 */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-3 mt-4 md:mt-6">
          <div className="flex-1 relative">
            <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-500" />
            <input
              type="text"
              placeholder="搜索用户邮箱或昵称..."
              className="w-full pl-8 md:pl-10 pr-3 md:pr-4 py-2 text-sm md:text-base bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* 排序按钮 */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="px-2 py-2 md:px-3 md:py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 flex items-center transition-colors w-full md:w-auto"
            >
              <Filter className="w-4 h-4 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="text-xs md:text-sm">排序</span>
              <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 ml-1 md:ml-1 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>

            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                  {[
                    { field: 'createdAt' as SortField, label: '注册时间', icon: Calendar },
                    { field: 'lastLogin' as SortField, label: '最后登录', icon: Clock },
                    { field: 'gender' as SortField, label: '性别', icon: Users },
                    { field: 'email' as SortField, label: '邮箱', icon: Mail },
                    { field: 'nickname' as SortField, label: '昵称', icon: User },
                    { field: 'isPremium' as SortField, label: '会员状态', icon: Shield },
                    { field: 'accountExpires' as SortField, label: '会员到期', icon: Calendar },
                    { field: 'keyStatus' as SortField, label: '密钥状态', icon: Key }
                  ].map(({ field, label, icon: Icon }) => (
                    <button
                      key={field}
                      className="w-full text-left px-3 py-2 md:px-4 md:py-2 text-sm text-gray-300 hover:bg-gray-700 border-b border-gray-700 last:border-b-0 flex items-center transition-colors"
                      onClick={() => handleSort(field)}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {label}
                      <span className="ml-auto">
                        {getSortIcon(field)}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 筛选按钮 */}
          <div className="flex gap-1 md:gap-2 overflow-x-auto pb-1 md:pb-2 filter-buttons">
            {[
              { value: 'all', label: '全部用户' },
              { value: 'premium', label: '会员用户' },
              { value: 'free', label: '免费用户' },
              { value: 'expired', label: '已过期' },
              { value: 'active24h', label: '24h活跃' },
              { value: 'active', label: '当前活跃' },
              { value: 'male', label: '男性' },
              { value: 'female', label: '女性' },
            ].map((item) => (
              <button
                key={item.value}
                className={`px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm whitespace-nowrap transition-colors ${filter === item.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                onClick={() => {
                  setFilter(item.value)
                  setCurrentPage(1)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3 lg:gap-4 mb-4 md:mb-6 lg:mb-8 stat-grid">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-4 hover:border-gray-600/50 transition-colors stat-card">
          <p className="text-xs md:text-sm text-gray-400">总用户数</p>
          <p className="text-lg md:text-xl lg:text-2xl font-bold text-white mt-1">{stats.total}</p>
          <div className="flex items-center mt-1">
            <Users className="w-3 h-3 md:w-4 md:h-4 mr-1 text-blue-400" />
            <span className="text-xs text-gray-500">活跃账户</span>
          </div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-4 hover:border-gray-600/50 transition-colors stat-card">
          <p className="text-xs md:text-sm text-gray-400">会员用户</p>
          <p className="text-lg md:text-xl lg:text-2xl font-bold text-white mt-1">{stats.premium}</p>
          <div className="flex items-center mt-1">
            <TrendingUp className="w-3 h-3 md:w-4 md:h-4 mr-1 text-green-400" />
            <span className="text-xs text-gray-500">付费用户</span>
          </div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-4 hover:border-gray-600/50 transition-colors stat-card">
          <p className="text-xs md:text-sm text-gray-400">男性用户</p>
          <p className="text-lg md:text-xl lg:text-2xl font-bold text-blue-400 mt-1">{stats.male}</p>
          <div className="flex items-center mt-1">
            <Mars className="w-3 h-3 md:w-4 md:h-4 mr-1 text-blue-400" />
            <span className="text-xs text-gray-500">男性</span>
          </div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-4 hover:border-gray-600/50 transition-colors stat-card">
          <p className="text-xs md:text-sm text-gray-400">女性用户</p>
          <p className="text-lg md:text-xl lg:text-2xl font-bold text-pink-400 mt-1">{stats.female}</p>
          <div className="flex items-center mt-1">
            <Venus className="w-3 h-3 md:w-4 md:h-4 mr-1 text-pink-400" />
            <span className="text-xs text-gray-500">女性</span>
          </div>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-4 hover:border-gray-600/50 transition-colors stat-card">
          <p className="text-xs md:text-sm text-gray-400">活跃用户</p>
          <p className="text-lg md:text-xl lg:text-2xl font-bold text-green-400 mt-1">{stats.activeNow}</p>
          <div className="flex items-center mt-1">
            <Wifi className="w-3 h-3 md:w-4 md:h-4 mr-1 text-green-400" />
            <span className="text-xs text-gray-500">当前在线</span>
          </div>
        </div>
        <div className="col-span-2 md:col-span-4 lg:col-span-2">
          <GrowthChart />
        </div>
      </div>

      {/* 用户表格 */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="px-3 md:px-4 lg:px-6 py-3 md:py-4 border-b border-gray-700/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3">
            <h2 className="text-base md:text-lg lg:text-xl font-semibold text-white">用户列表</h2>
            {totalPages > 1 && (
              <div className="flex items-center space-x-1 md:space-x-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 md:px-3 md:py-1 bg-gray-800 rounded text-xs md:text-sm disabled:opacity-50 hover:bg-gray-700 transition-colors"
                >
                  上一页
                </button>
                <span className="text-gray-400 text-xs md:text-sm">
                  第 {currentPage} / {totalPages} 页
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 md:px-3 md:py-1 bg-gray-800 rounded text-xs md:text-sm disabled:opacity-50 hover:bg-gray-700 transition-colors"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-6 md:p-8 text-center">
            <div className="w-6 h-6 md:w-8 md:h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-2 md:mt-4 text-sm md:text-base">加载用户列表中...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-6 md:p-8 text-center">
            <Users className="w-10 h-10 md:w-12 md:h-12 text-gray-600 mx-auto mb-2 md:mb-3" />
            <p className="text-gray-400 text-sm md:text-base">未找到匹配的用户</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-2 text-blue-400 hover:text-blue-300 text-xs md:text-sm transition-colors"
              >
                清空搜索条件
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto table-container">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="text-left py-2 md:py-3 px-2 md:px-3 lg:px-4 w-10 md:w-12 table-header-cell">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-600 bg-gray-700 w-3 h-3 md:w-4 md:h-4"
                      />
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-3 lg:px-4 text-gray-400 font-medium text-xs md:text-sm table-header-cell user-info-cell">
                      <button
                        className="flex items-center hover:text-gray-300 transition-colors"
                        onClick={() => handleSort('email')}
                      >
                        用户信息
                        <span className="ml-1">{getSortIcon('email')}</span>
                      </button>
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-3 lg:px-4 text-gray-400 font-medium text-xs md:text-sm table-header-cell">
                      密钥状态
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-3 lg:px-4 text-gray-400 font-medium text-xs md:text-sm table-header-cell">
                      <button
                        className="flex items-center hover:text-gray-300 transition-colors"
                        onClick={() => handleSort('gender')}
                      >
                        性别/会员
                        <span className="ml-1">{getSortIcon('gender')}</span>
                      </button>
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-3 lg:px-4 text-gray-400 font-medium text-xs md:text-sm table-header-cell">
                      <button
                        className="flex items-center hover:text-gray-300 transition-colors"
                        onClick={() => handleSort('lastLogin')}
                      >
                        最后登录
                        <span className="ml-1">{getSortIcon('lastLogin')}</span>
                      </button>
                    </th>
                    {/* 🔥 新增：会员到期时间列 */}
                    <th className="text-left py-2 md:py-3 px-2 md:px-3 lg:px-4 text-gray-400 font-medium text-xs md:text-sm table-header-cell">
                      <button
                        className="flex items-center hover:text-gray-300 transition-colors"
                        onClick={() => handleSort('accountExpires')}
                      >
                        会员到期时间
                        <span className="ml-1">{getSortIcon('accountExpires')}</span>
                      </button>
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-3 lg:px-4 text-gray-400 font-medium text-xs md:text-sm table-header-cell">
                      <button
                        className="flex items-center hover:text-gray-300 transition-colors"
                        onClick={() => handleSort('createdAt')}
                      >
                        注册时间
                        <span className="ml-1">{getSortIcon('createdAt')}</span>
                      </button>
                    </th>
                    <th className="text-left py-2 md:py-3 px-2 md:px-3 lg:px-4 text-gray-400 font-medium text-xs md:text-sm table-header-cell">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-2 md:py-3 px-2 md:px-3 lg:px-4 table-cell">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers(prev => [...prev, user.id])
                            } else {
                              setSelectedUsers(prev => prev.filter(id => id !== user.id))
                            }
                          }}
                          className="rounded border-gray-600 bg-gray-700 w-3 h-3 md:w-4 md:h-4"
                        />
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-3 lg:px-4 table-cell">
                        <div className="flex items-center">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.nickname || user.email}
                              className="w-8 h-8 md:w-10 md:h-10 rounded-full mr-2 md:mr-3 object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-2 md:mr-3">
                              <span className="text-white font-semibold text-xs md:text-sm">
                                {(user.nickname || user.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 md:gap-2 mb-0.5 md:mb-1">
                              <p className="text-white font-medium truncate text-xs md:text-sm">
                                {user.nickname || '无昵称'}
                              </p>
                              {user.isAdmin && (
                                <span className="px-1 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                  管
                                </span>
                              )}
                            </div>
                            <div className="flex items-center text-gray-500 text-xs md:text-sm">
                              <Mail className="w-3 h-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{user.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-3 lg:px-4 table-cell">
                        {renderKeyCell(user)}
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-3 lg:px-4 table-cell">
                        <div className="space-y-1 md:space-y-2">
                          {renderGenderCell(user)}
                          <div className="mt-1">
                            <span className={`px-2 py-0.5 md:px-2 md:py-1 rounded text-xs ${user.isPremium
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                              : 'bg-gray-700 text-gray-300'
                              }`}>
                              {user.isPremium ? '会员' : '免费'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-3 lg:px-4 table-cell">
                        {renderLastLoginCell(user)}
                      </td>
                      {/* 🔥 新增：会员到期时间单元格 */}
                      <td className="py-2 md:py-3 px-2 md:px-3 lg:px-4 table-cell">
                        <div className="text-gray-300 text-xs md:text-sm">
                          {user.accountExpires}
                        </div>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-3 lg:px-4 table-cell">
                        <div className="text-gray-300 text-xs md:text-sm">
                          {user.createdAt}
                        </div>
                      </td>
                      <td className="py-2 md:py-3 px-2 md:px-3 lg:px-4 table-cell">
                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                          <button
                            onClick={() => handleViewDetail(user.id)}
                            className="text-blue-400 hover:text-blue-300 text-xs md:text-sm px-1.5 py-0.5 md:px-2 md:py-1 rounded hover:bg-gray-800 transition-colors"
                            title="查看详情"
                          >
                            详情
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.email, user.isActive)}
                            className={`text-xs md:text-sm px-1.5 py-0.5 md:px-2 md:py-1 rounded transition-colors ${user.isActive
                              ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-800'
                              : 'text-green-400 hover:text-green-300 hover:bg-gray-800'
                              }`}
                            title={user.isActive ? '禁用用户' : '启用用户'}
                          >
                            {user.isActive ? '禁用' : '启用'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="text-red-400 hover:text-red-300 text-xs md:text-sm px-1.5 py-0.5 md:px-2 md:py-1 rounded hover:bg-gray-800 transition-colors"
                            title="删除用户"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 用户详情弹窗 */}
      <UserDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        userDetail={selectedUserDetail}
        loading={detailLoading}
        onRefresh={handleRefreshDetail}
      />
    </div>
  )
}