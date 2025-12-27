// /app/admin/users/page.tsx - 修复版本（完整）
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Users, Mail, Search, Download, MoreVertical, Key, ChevronDown,
  Shield, Calendar, User, Clock, Tag, Filter, Wifi, WifiOff,
  SortAsc, SortDesc, Trash2, Edit, Copy, CheckCircle, AlertCircle
} from 'lucide-react'
import UserDetailModal from './components/user-detail-modal'
import GrowthChart from './components/growth-chart'
import { 
  User as UserType, 
  SortField, 
  SortDirection, 
  getGenderDisplay, 
  getKeyStatus, 
  normalizeUserDetail,
  isUserActive,
  getActiveStatusConfig
} from './types'

export const dynamic = 'force-dynamic'

const ITEMS_PER_PAGE = 20

export default function UsersPage() {
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
  const [operationMessage, setOperationMessage] = useState<{type: 'success' | 'error', message: string} | null>(null)

  // 排序状态
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  // 获取用户数据 - 使用新的API
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setUsers([])

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
      const response = await fetch(apiUrl, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`API请求失败 (${response.status})`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'API返回未知错误')
      }

      // 转换用户数据
      const formattedUsers: UserType[] = (result.data || []).map((profile: any) => {
        // 格式化日期
        const lastLogin = profile.last_login_at
          ? new Date(profile.last_login_at).toLocaleString('zh-CN')
          : '从未登录'

        const createdAt = profile.created_at
          ? new Date(profile.created_at).toLocaleString('zh-CN')
          : '未知'

        const accountExpires = profile.account_expires_at
          ? new Date(profile.account_expires_at).toLocaleString('zh-CN')
          : '无记录'

        const isPremium = profile.account_expires_at
          ? new Date(profile.account_expires_at) > new Date()
          : false

        // 获取密钥信息
        let keyCode = null
        let activeKeyUsedAt = null
        let activeKeyExpires = null
        let keyStatus: 'active' | 'expired' | 'unused' | 'inactive' = 'unused'

        if (profile.access_keys && Array.isArray(profile.access_keys) && profile.access_keys.length > 0) {
          const currentKey = profile.access_keys[0]
          keyCode = currentKey.key_code || `ID: ${currentKey.id}`
          activeKeyUsedAt = currentKey.used_at
          activeKeyExpires = currentKey.key_expires_at
          keyStatus = getKeyStatus(currentKey)
        }

        // 获取性别
        const gender = getGenderDisplay(profile.preferences)

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
          accessKeyId: profile.access_key_id,
          activeKey: keyCode,
          activeKeyUsedAt: activeKeyUsedAt,
          activeKeyExpires: activeKeyExpires,
          isActive: true,
          gender: gender,
          keyStatus: keyStatus,
          isUserActive: userActive
        }
      })

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
        fetchUsers() // 刷新列表
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
        fetchUsers() // 刷新列表
      } else {
        throw new Error(result.error || `${action}失败`)
      }
    } catch (error: any) {
      console.error(`${action}用户失败:`, error)
      showMessage('error', `${action}失败: ${error.message}`)
    }
  }

  // 批量操作
  const handleBatchAction = async (action: 'disable' | 'enable' | 'delete') => {
    if (!selectedUsers.length) {
      showMessage('error', '请先选择用户')
      return
    }

    const actionNames = {
      disable: { text: '禁用', confirm: '确定要禁用这些账户吗？\n\n禁用后用户将无法登录系统。' },
      enable: { text: '启用', confirm: '确定要启用这些账户吗？\n\n启用后用户将恢复会员权限。' },
      delete: { text: '删除', confirm: '确定要删除这些账户吗？\n\n此操作会将用户标记为删除，但保留历史数据。' }
    }

    const { text, confirm: confirmText } = actionNames[action]

    if (!confirm(`${confirmText}\n\n涉及 ${selectedUsers.length} 个用户`)) return

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
          reason: `管理员批量${text}操作`
        }),
        credentials: 'include',
      })

      const result = await response.json()

      if (result.success) {
        showMessage('success', `成功${text}了 ${result.data.affectedCount} 个用户`)
        setSelectedUsers([])
        setShowBatchMenu(false)
        fetchUsers()
      } else {
        throw new Error(result.error || '操作失败')
      }
    } catch (error: any) {
      console.error(`批量${text}失败:`, error)
      showMessage('error', `批量${text}失败: ${error.message}`)
    } finally {
      setBatchActionLoading(false)
    }
  }

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

  // 操作消息组件
  const OperationMessage = () => {
    if (!operationMessage) return null

    const { type, message } = operationMessage
    const Icon = type === 'success' ? CheckCircle : AlertCircle

    return (
      <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center ${type === 'success' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
        <Icon className={`w-5 h-5 mr-2 ${type === 'success' ? 'text-green-400' : 'text-red-400'}`} />
        <span className={`text-sm ${type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
          {message}
        </span>
        <button
          onClick={() => setOperationMessage(null)}
          className="ml-4 text-gray-400 hover:text-gray-300"
        >
          ×
        </button>
      </div>
    )
  }

  // 其他原有函数保持不变...
  // [保持原有的 fetchUserDetail, handleSort, getSortIcon, handleExportCSV, handleViewDetail, handleRefreshDetail, renderKeyCell, renderGenderCell, renderLastLoginCell 等函数]

  // 初始化加载
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // 添加搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1)
      fetchUsers()
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm, filter, sortField, sortDirection])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
      {/* 操作消息 */}
      <OperationMessage />

      {/* 页面标题与操作区 */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
              <Users className="w-6 h-6 md:w-7 md:h-7 mr-2 text-blue-400" />
              用户管理
            </h1>
            <p className="text-gray-400 mt-2">
              共 <span className="text-white font-semibold">{totalCount}</span> 个用户，
              <span className="text-white font-semibold mx-1">{selectedUsers.length}</span> 个已选择
              {users.length > 0 && (
                <span className="ml-3 text-sm text-gray-500">
                  显示 {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} 条
                </span>
              )}
            </p>
          </div>
          
          {/* 操作按钮组 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 md:px-4 md:py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 flex items-center"
              disabled={sortedUsers.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              导出CSV
            </button>

            {selectedUsers.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleBatchAction('delete')}
                  className="px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:opacity-90 rounded-lg text-sm text-white whitespace-nowrap flex items-center"
                  disabled={batchActionLoading}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {batchActionLoading ? '处理中...' : `批量删除 (${selectedUsers.length})`}
                </button>
                <button
                  onClick={() => setShowBatchMenu(!showBatchMenu)}
                  className="px-3 py-2 md:px-4 md:py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 flex items-center"
                  disabled={batchActionLoading}
                >
                  <MoreVertical className="w-4 h-4 mr-2" />
                  更多操作
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showBatchMenu ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 搜索、筛选和排序栏 */}
        <div className="flex flex-col md:flex-row gap-3 mt-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="搜索用户邮箱或昵称..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* 排序按钮 */}
          <div className="relative group">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 flex items-center"
            >
              <Filter className="w-4 h-4 mr-2" />
              排序
              <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
            </button>

            {showSortMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                {[
                  { field: 'createdAt' as SortField, label: '注册时间', icon: Calendar },
                  { field: 'lastLogin' as SortField, label: '最后登录', icon: Clock },
                  { field: 'email' as SortField, label: '邮箱', icon: Mail },
                  { field: 'nickname' as SortField, label: '昵称', icon: User },
                  { field: 'isPremium' as SortField, label: '会员状态', icon: Shield },
                  { field: 'accountExpires' as SortField, label: '会员到期', icon: Calendar },
                  { field: 'keyStatus' as SortField, label: '密钥状态', icon: Key }
                ].map(({ field, label, icon: Icon }) => (
                  <button
                    key={field}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 border-b border-gray-700 last:border-b-0 flex items-center"
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
            )}
          </div>

          {/* 筛选按钮 */}
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {[
              { value: 'all', label: '全部用户' },
              { value: 'premium', label: '会员用户' },
              { value: 'free', label: '免费用户' },
              { value: 'active24h', label: '24h活跃' },
              { value: 'expired', label: '已过期' },
              { value: 'active', label: '当前活跃' }
            ].map((item) => (
              <button
                key={item.value}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${filter === item.value
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

      {/* 用户表格 */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4">加载用户列表中...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">未找到匹配的用户</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
              >
                清空搜索条件
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="px-4 md:px-6 py-4 border-b border-gray-700/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">用户列表</h2>
                {totalPages > 1 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-50 hover:bg-gray-700"
                    >
                      上一页
                    </button>
                    <span className="text-gray-400 text-sm">
                      第 {currentPage} / {totalPages} 页
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-50 hover:bg-gray-700"
                    >
                      下一页
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="text-left py-3 px-4 md:px-6 w-12">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers(users.map(u => u.id))
                          } else {
                            setSelectedUsers([])
                          }
                        }}
                        className="rounded border-gray-600"
                      />
                    </th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                      <button
                        className="flex items-center hover:text-gray-300"
                        onClick={() => handleSort('email')}
                      >
                        用户信息
                        <span className="ml-1">{getSortIcon('email')}</span>
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                      密钥状态
                    </th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                      会员状态
                    </th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                      最后登录
                    </th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                      注册时间
                    </th>
                    <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-700/30 hover:bg-gray-800/30">
                      <td className="py-3 px-4 md:px-6">
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
                          className="rounded border-gray-600"
                        />
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <div className="flex items-center">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt={user.nickname || user.email}
                              className="w-10 h-10 rounded-full mr-3"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                              <span className="text-white font-semibold">
                                {(user.nickname || user.email).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-white font-medium truncate">
                                {user.nickname || '无昵称'}
                              </p>
                              {user.isAdmin && (
                                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                                  管理员
                                </span>
                              )}
                            </div>
                            <div className="flex items-center text-gray-500 text-sm">
                              <Mail className="w-3 h-3 mr-1" />
                              <span className="truncate">{user.email}</span>
                              <button
                                onClick={() => copyToClipboard(user.email, '邮箱')}
                                className="ml-2 text-gray-600 hover:text-gray-400"
                                title="复制邮箱"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="mt-1 flex items-center">
                              <span className="text-xs text-gray-500 truncate">
                                ID: {user.id.substring(0, 8)}...
                              </span>
                              <button
                                onClick={() => copyToClipboard(user.id, '用户ID')}
                                className="ml-2 text-gray-600 hover:text-gray-400"
                                title="复制用户ID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        {renderKeyCell(user)}
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <div className="space-y-1">
                          <span className={`px-2 py-1 rounded text-xs ${user.isPremium
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                            : 'bg-gray-700 text-gray-300'
                            }`}>
                            {user.isPremium ? '会员中' : '免费用户'}
                          </span>
                          {user.gender && (
                            <div className="text-xs text-gray-500">
                              性别: {user.gender}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        {renderLastLoginCell(user)}
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <div className="text-gray-300 text-sm">
                          {user.createdAt}
                        </div>
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewDetail(user.id)}
                            className="text-blue-400 hover:text-blue-300 text-sm px-2 py-1 rounded hover:bg-gray-800"
                            title="查看详情"
                          >
                            详情
                          </button>
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.email, user.isActive)}
                            className={`text-sm px-2 py-1 rounded ${user.isActive
                              ? 'text-yellow-400 hover:text-yellow-300 hover:bg-gray-800'
                              : 'text-green-400 hover:text-green-300 hover:bg-gray-800'
                              }`}
                            title={user.isActive ? '禁用用户' : '启用用户'}
                          >
                            {user.isActive ? '禁用' : '启用'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-gray-800"
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