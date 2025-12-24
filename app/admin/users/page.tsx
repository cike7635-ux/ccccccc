// /app/admin/users/page.tsx - 修复版本
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  Users, Mail, Search, Download, MoreVertical, Key, ChevronDown, 
  Shield, Calendar, User, Clock, Tag, Filter,
  SortAsc, SortDesc
} from 'lucide-react'
import UserDetailModal from './components/user-detail-modal'
import GrowthChart from './components/growth-chart'
import { User as UserType, SortField, SortDirection, getGenderDisplay, getKeyStatus, normalizeUserDetail } from './types'

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
  
  // 排序状态
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  // 获取用户数据
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setUsers([])

    try {
      const params = new URLSearchParams({
        table: 'profiles',
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      })

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim())
      }

      if (filter !== 'all') {
        params.append('filter', filter)
      }

      const apiUrl = `/api/admin/data?${params.toString()}`
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
        let activeKey = null
        let activeKeyUsedAt = null
        let activeKeyExpires = null
        let keyStatus: 'active' | 'expired' | 'unused' = 'unused'
        
        const accessKeys = profile.access_keys || []
        if (Array.isArray(accessKeys) && accessKeys.length > 0) {
          // 优先使用当前密钥ID对应的密钥
          if (profile.access_key_id) {
            const currentKey = accessKeys.find((key: any) => key.id === profile.access_key_id)
            if (currentKey) {
              activeKey = currentKey.key_code || currentKey.keyCode
              activeKeyUsedAt = currentKey.used_at || currentKey.usedAt
              activeKeyExpires = currentKey.key_expires_at || currentKey.keyExpiresAt
              keyStatus = getKeyStatus(currentKey)
            }
          }
          // 如果没有当前密钥，使用第一个密钥
          if (!activeKey && accessKeys.length > 0) {
            const firstKey = accessKeys[0]
            activeKey = firstKey.key_code || firstKey.keyCode
            activeKeyUsedAt = firstKey.used_at || firstKey.usedAt
            activeKeyExpires = firstKey.key_expires_at || firstKey.keyExpiresAt
            keyStatus = getKeyStatus(firstKey)
          }
        }
        
        // 备用方案
        if (!activeKey && profile.current_access_key) {
          const currentKey = profile.current_access_key
          activeKey = currentKey.key_code || currentKey.keyCode
          activeKeyUsedAt = currentKey.used_at || currentKey.usedAt
          activeKeyExpires = currentKey.key_expires_at || currentKey.keyExpiresAt
          keyStatus = getKeyStatus(currentKey)
        }
        
        if (!activeKey && profile.access_key_id) {
          activeKey = `ID: ${profile.access_key_id}`
        }

        // 获取性别
        const gender = getGenderDisplay(profile.preferences)

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
          activeKey: activeKey || '无',
          activeKeyUsedAt: activeKeyUsedAt,
          activeKeyExpires: activeKeyExpires,
          isActive: true,
          gender: gender,
          keyStatus: keyStatus
        }
      })

      setUsers(formattedUsers)
      setTotalCount(result.pagination?.total || 0)

    } catch (error) {
      console.error('获取用户数据失败:', error)
      setUsers([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, filter])

  // 获取用户详情
  const fetchUserDetail = async (userId: string) => {
    setDetailLoading(true)
    setSelectedUserDetail(null)
    
    try {
      const response = await fetch(`/api/admin/data?table=profiles&detailId=${userId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`获取详情失败: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '未找到用户详情')
      }

      const userDetail = normalizeUserDetail(result.data)
      setSelectedUserDetail(userDetail)

    } catch (error: any) {
      console.error('获取用户详情失败:', error)
      setSelectedUserDetail(null)
    } finally {
      setDetailLoading(false)
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
  }

  // 排序后的用户数据
  const sortedUsers = useMemo(() => {
    if (!users.length) return []
    
    const sorted = [...users].sort((a, b) => {
      let aValue: any
      let bValue: any
      
      switch (sortField) {
        case 'id':
          aValue = a.id
          bValue = b.id
          break
        case 'email':
          aValue = a.email
          bValue = b.email
          break
        case 'nickname':
          aValue = a.nickname || ''
          bValue = b.nickname || ''
          break
        case 'keyStatus':
          aValue = a.keyStatus || 'unused'
          bValue = b.keyStatus || 'unused'
          break
        case 'isPremium':
          aValue = a.isPremium
          bValue = b.isPremium
          break
        case 'gender':
          aValue = a.gender || '未设置'
          bValue = b.gender || '未设置'
          break
        case 'lastLogin':
          aValue = a.lastLoginRaw || ''
          bValue = b.lastLoginRaw || ''
          break
        case 'createdAt':
          aValue = a.createdAtRaw || ''
          bValue = b.createdAtRaw || ''
          break
        case 'accountExpires':
          aValue = a.accountExpiresRaw || ''
          bValue = b.accountExpiresRaw || ''
          break
        default:
          return 0
      }
      
      // 处理空值
      if (!aValue && bValue) return sortDirection === 'asc' ? 1 : -1
      if (aValue && !bValue) return sortDirection === 'asc' ? -1 : 1
      if (!aValue && !bValue) return 0
      
      // 布尔值比较
      if (typeof aValue === 'boolean') {
        return sortDirection === 'asc' 
          ? (aValue === bValue ? 0 : aValue ? -1 : 1)
          : (aValue === bValue ? 0 : aValue ? 1 : -1)
      }
      
      // 日期比较
      if (typeof aValue === 'string' && !isNaN(Date.parse(aValue)) && !isNaN(Date.parse(bValue))) {
        const dateA = new Date(aValue).getTime()
        const dateB = new Date(bValue).getTime()
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
      }
      
      // 字符串比较
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    })
    
    return sorted
  }, [users, sortField, sortDirection])

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

  // 批量操作
  const handleBatchAction = async (action: 'disable' | 'enable' | 'delete') => {
    if (!selectedUsers.length) return
    
    const actionNames = {
      disable: { text: '禁用', confirm: '确定要禁用这些账户吗？\n\n禁用后用户将无法登录系统。' },
      enable: { text: '启用', confirm: '确定要启用这些账户吗？\n\n启用后用户将恢复会员权限。' },
      delete: { text: '删除', confirm: '确定要删除这些账户吗？\n\n此操作会将用户标记为删除，但保留历史数据。' }
    }
    
    const { text, confirm: confirmText } = actionNames[action]
    
    if (!confirm(`${confirmText}\n\n涉及 ${selectedUsers.length} 个用户`)) return
    
    setBatchActionLoading(true)
    
    try {
      const response = await fetch('/api/admin/users/batch-disable', {
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
        alert(`✅ 成功${text}了 ${result.data.affectedCount} 个用户`)
        setSelectedUsers([])
        setShowBatchMenu(false)
        setTimeout(() => {
          fetchUsers()
        }, 1000)
      } else {
        throw new Error(result.error || '操作失败')
      }
    } catch (error: any) {
      console.error(`批量${text}失败:`, error)
      alert(`❌ 批量${text}失败: ${error.message}`)
    } finally {
      setBatchActionLoading(false)
    }
  }

  // CSV导出
  const handleExportCSV = () => {
    const headers = ['ID', '邮箱', '昵称', '性别', '会员状态', '当前密钥', '密钥状态', '最后登录', '注册时间', '会员到期时间']
    const csvData = sortedUsers.map(user => [
      user.id,
      user.email,
      user.nickname || '',
      user.gender,
      user.isPremium ? '会员中' : '免费',
      user.activeKey || '',
      user.keyStatus === 'active' ? '已使用' : user.keyStatus === 'expired' ? '已过期' : '未使用',
      user.lastLogin,
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
    link.click()
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
    }
  }, [selectedUserDetail])

  // 初始化加载
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

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
    
    if (user.activeKey.startsWith('ID:')) {
      return (
        <div className="group relative">
          <span className="text-blue-400 text-sm hover:underline cursor-help">
            需查看详情
          </span>
          <div className="absolute hidden group-hover:block z-50 bg-gray-800 p-2 rounded shadow-lg text-xs min-w-[200px]">
            <div className="font-semibold text-gray-300 mb-1">密钥信息</div>
            <div className="text-gray-400">密钥ID: {user.accessKeyId}</div>
          </div>
        </div>
      )
    }
    
    const keyStatusColors = {
      active: 'bg-green-500/10 text-green-400',
      expired: 'bg-red-500/10 text-red-400',
      unused: 'bg-yellow-500/10 text-yellow-400'
    }
    
    return (
      <div className="space-y-1">
        <div className="flex items-center">
          <Key className="w-3 h-3 mr-1 text-amber-400" />
          <code className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded font-mono truncate max-w-[120px] hover:bg-amber-500/20 transition-colors" title={`密钥: ${user.activeKey}`}>
            {user.activeKey}
          </code>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-xs px-1.5 py-0.5 rounded ${keyStatusColors[user.keyStatus || 'unused']}`}>
            {user.keyStatus === 'active' ? '已使用' : user.keyStatus === 'expired' ? '已过期' : '未使用'}
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
      '男': { bg: 'bg-blue-500/10', text: 'text-blue-400' },
      '女': { bg: 'bg-pink-500/10', text: 'text-pink-400' },
      '其他': { bg: 'bg-purple-500/10', text: 'text-purple-400' },
      '未设置': { bg: 'bg-gray-500/10', text: 'text-gray-400' }
    }
    
    const { bg, text } = genderColors[gender] || genderColors['未设置']
    
    return (
      <span className={`px-2 py-1 rounded text-xs ${bg} ${text}`}>
        {gender}
      </span>
    )
  }

  // 统计数据
  const stats = useMemo(() => {
    const maleCount = sortedUsers.filter(u => u.gender === '男').length
    const femaleCount = sortedUsers.filter(u => u.gender === '女').length
    const otherGenderCount = sortedUsers.filter(u => !['男', '女', '未设置'].includes(u.gender)).length
    const unknownCount = sortedUsers.filter(u => u.gender === '未设置').length
    
    return {
      total: sortedUsers.length,
      premium: sortedUsers.filter(u => u.isPremium).length,
      active24h: sortedUsers.filter(u => 
        u.lastLoginRaw && new Date(u.lastLoginRaw) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length,
      male: maleCount,
      female: femaleCount,
      otherGender: otherGenderCount,
      unknown: unknownCount
    }
  }, [sortedUsers])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
      {/* 页面标题与操作区 */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
              <Users className="w-6 h-6 md:w-7 md:h-7 mr-2 text-blue-400" />
              用户管理
            </h1>
            <p className="text-gray-400 mt-2">
              共 {totalCount} 个用户，{selectedUsers.length} 个已选择
              <span className="ml-2 text-xs text-gray-500">
                | 排序: {sortField} ({sortDirection === 'asc' ? '升序' : '降序'})
              </span>
            </p>
          </div>
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
              <div className="relative">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBatchAction('disable')}
                    className="px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:opacity-90 rounded-lg text-sm text-white whitespace-nowrap"
                    disabled={batchActionLoading}
                  >
                    {batchActionLoading ? '处理中...' : `批量禁用 (${selectedUsers.length})`}
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
                
                {showBatchMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                    <button
                      onClick={() => handleBatchAction('enable')}
                      className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 border-b border-gray-700 first:rounded-t-lg flex items-center"
                      disabled={batchActionLoading}
                    >
                      <Shield className="w-4 h-4 mr-2 text-green-400" />
                      批量启用会员
                    </button>
                    <button
                      onClick={() => handleBatchAction('delete')}
                      className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 last:rounded-b-lg flex items-center"
                      disabled={batchActionLoading}
                    >
                      <Users className="w-4 h-4 mr-2 text-red-400" />
                      批量删除账户
                    </button>
                  </div>
                )}
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
              placeholder="搜索用户ID、邮箱或昵称（支持模糊匹配）..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          
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
                  { field: 'accountExpires' as SortField, label: '会员到期', icon: Calendar },
                  { field: 'gender' as SortField, label: '性别', icon: User },
                  { field: 'isPremium' as SortField, label: '会员状态', icon: Shield },
                  { field: 'email' as SortField, label: '邮箱', icon: Mail },
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
          
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {[
              { value: 'all', label: '全部用户' },
              { value: 'premium', label: '会员用户' },
              { value: 'free', label: '免费用户' },
              { value: 'active24h', label: '24h活跃' },
              { value: 'expired', label: '已过期' }
            ].map((item) => (
              <button
                key={item.value}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${
                  filter === item.value
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <p className="text-sm text-gray-400">总用户数</p>
          <p className="text-xl md:text-2xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <p className="text-sm text-gray-400">会员用户</p>
          <p className="text-xl md:text-2xl font-bold text-white mt-1">{stats.premium}</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <p className="text-sm text-gray-400">男性用户</p>
          <p className="text-xl md:text-2xl font-bold text-blue-400 mt-1">{stats.male}</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <p className="text-sm text-gray-400">女性用户</p>
          <p className="text-xl md:text-2xl font-bold text-pink-400 mt-1">{stats.female}</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <p className="text-sm text-gray-400">其他性别</p>
          <p className="text-xl md:text-2xl font-bold text-purple-400 mt-1">{stats.otherGender}</p>
        </div>
        <div className="col-span-2">
          <GrowthChart />
        </div>
      </div>

      {/* 用户表格 */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
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
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4">加载用户列表中...</p>
          </div>
        ) : sortedUsers.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">未找到匹配的用户</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px]">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left py-3 px-4 md:px-6">
                    <input 
                      type="checkbox" 
                      checked={selectedUsers.length === sortedUsers.length && sortedUsers.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(sortedUsers.map(u => u.id))
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
                      onClick={() => handleSort('id')}
                    >
                      用户ID
                      <span className="ml-1">{getSortIcon('id')}</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                    <button 
                      className="flex items-center hover:text-gray-300"
                      onClick={() => handleSort('email')}
                    >
                      邮箱/昵称
                      <span className="ml-1">{getSortIcon('email')}</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                    <button 
                      className="flex items-center hover:text-gray-300"
                      onClick={() => handleSort('keyStatus')}
                    >
                      当前密钥
                      <span className="ml-1">{getSortIcon('keyStatus')}</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                    <button 
                      className="flex items-center hover:text-gray-300"
                      onClick={() => handleSort('isPremium')}
                    >
                      会员状态
                      <span className="ml-1">{getSortIcon('isPremium')}</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                    <button 
                      className="flex items-center hover:text-gray-300"
                      onClick={() => handleSort('gender')}
                    >
                      性别
                      <span className="ml-1">{getSortIcon('gender')}</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                    <button 
                      className="flex items-center hover:text-gray-300"
                      onClick={() => handleSort('lastLogin')}
                    >
                      最后登录
                      <span className="ml-1">{getSortIcon('lastLogin')}</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                    <button 
                      className="flex items-center hover:text-gray-300"
                      onClick={() => handleSort('createdAt')}
                    >
                      注册时间
                      <span className="ml-1">{getSortIcon('createdAt')}</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                    <button 
                      className="flex items-center hover:text-gray-300"
                      onClick={() => handleSort('accountExpires')}
                    >
                      会员到期
                      <span className="ml-1">{getSortIcon('accountExpires')}</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
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
                      <code className="text-xs bg-gray-900 px-2 py-1 rounded font-mono">
                        {user.id.substring(0, 8)}...
                      </code>
                    </td>
                    <td className="py-3 px-4 md:px-6">
                      <div className="flex items-center">
                        {user.avatarUrl ? (
                          <img 
                            src={user.avatarUrl} 
                            alt={user.nickname || user.email}
                            className="w-8 h-8 rounded-full mr-3"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white font-semibold text-sm">
                              {(user.nickname || user.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="text-white text-sm font-medium truncate max-w-[180px]">
                            {user.nickname || '无昵称'}
                            {user.isAdmin && ' 👑'}
                          </p>
                          <p className="text-gray-500 text-xs truncate max-w-[180px] flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 md:px-6">
                      {renderKeyCell(user)}
                    </td>
                    <td className="py-3 px-4 md:px-6">
                      <div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          user.isPremium 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
                            : 'bg-gray-700 text-gray-300'
                        }`}>
                          {user.isPremium ? '会员中' : '免费用户'}
                        </span>
                        {user.accountExpiresRaw && user.isPremium && (
                          <p className="text-gray-500 text-xs mt-1">
                            到期: {new Date(user.accountExpiresRaw).toLocaleDateString('zh-CN')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 md:px-6">
                      {renderGenderCell(user)}
                    </td>
                    <td className="py-3 px-4 md:px-6 text-gray-300 text-sm">
                      {user.lastLogin}
                    </td>
                    <td className="py-3 px-4 md:px-6 text-gray-300 text-sm">
                      {user.createdAt}
                    </td>
                    <td className="py-3 px-4 md:px-6 text-gray-300 text-sm">
                      {user.accountExpires}
                    </td>
                    <td className="py-3 px-4 md:px-6">
                      <button 
                        onClick={() => handleViewDetail(user.id)}
                        className="text-blue-400 hover:text-blue-300 text-sm hover:underline px-2 py-1 rounded hover:bg-gray-800"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
