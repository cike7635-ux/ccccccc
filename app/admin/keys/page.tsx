// /app/admin/keys/page.tsx - 完整版本
'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Key, Copy, Check, Trash2, Plus, Search, Filter, Download, 
  Shield, Clock, Users, Eye, EyeOff, RefreshCw, AlertCircle,
  BarChart3, MoreVertical, ChevronDown, Edit, Ban
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// 动态渲染配置
export const dynamic = 'force-dynamic'

// 密钥类型定义
interface AccessKey {
  id: number
  key_code: string
  key_expires_at: string | null
  account_valid_for_days: number
  is_active: boolean
  used_at: string | null
  created_at: string
  updated_at: string
  user_id: string | null
  
  // 关联的用户信息
  user?: {
    email: string
    nickname: string | null
  }
  
  // 使用历史
  used_count?: number
  max_uses?: number | null
}

export default function KeysPage() {
  const router = useRouter()
  
  const [keys, setKeys] = useState<AccessKey[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used' | 'unused' | 'expired' | 'inactive'>('all')
  const [selectedKeys, setSelectedKeys] = useState<number[]>([])
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    used: 0,
    unused: 0,
    expired: 0,
    inactive: 0
  })

  // 获取密钥数据
  const fetchKeys = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/data?table=access_keys', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`API请求失败 (${response.status})`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '获取密钥数据失败')
      }

      const keysData: AccessKey[] = result.data || []
      setKeys(keysData)

      // 计算统计数据
      const now = new Date()
      const statsData = {
        total: keysData.length,
        active: keysData.filter(k => k.is_active && (!k.key_expires_at || new Date(k.key_expires_at) > now)).length,
        used: keysData.filter(k => k.used_at !== null).length,
        unused: keysData.filter(k => k.used_at === null && k.is_active).length,
        expired: keysData.filter(k => k.key_expires_at && new Date(k.key_expires_at) < now).length,
        inactive: keysData.filter(k => !k.is_active).length
      }
      setStats(statsData)

    } catch (error) {
      console.error('获取密钥数据失败:', error)
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

  // 过滤密钥
  const filteredKeys = keys.filter(key => {
    // 搜索过滤
    const searchMatch = search === '' || 
      key.key_code.toLowerCase().includes(search.toLowerCase()) ||
      key.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      key.user?.nickname?.toLowerCase().includes(search.toLowerCase())

    // 状态过滤
    const now = new Date()
    let statusMatch = true
    
    switch (statusFilter) {
      case 'active':
        statusMatch = key.is_active && (!key.key_expires_at || new Date(key.key_expires_at) > now)
        break
      case 'used':
        statusMatch = key.used_at !== null
        break
      case 'unused':
        statusMatch = key.used_at === null && key.is_active
        break
      case 'expired':
        statusMatch = key.key_expires_at !== null && new Date(key.key_expires_at) < now
        break
      case 'inactive':
        statusMatch = !key.is_active
        break
      default:
        statusMatch = true
    }

    return searchMatch && statusMatch
  })

  // 计算密钥状态
  const getKeyStatus = (key: AccessKey): { label: string, color: string, bgColor: string, icon: any } => {
    const now = new Date()
    
    // 1. 检查是否被禁用
    if (!key.is_active) {
      return {
        label: '已禁用',
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/15',
        icon: Ban
      }
    }
    
    // 2. 检查是否过期
    if (key.key_expires_at && new Date(key.key_expires_at) < now) {
      return {
        label: '已过期',
        color: 'text-red-400',
        bgColor: 'bg-red-500/15',
        icon: AlertCircle
      }
    }
    
    // 3. 检查是否已使用
    if (key.used_at) {
      return {
        label: '已使用',
        color: 'text-green-400',
        bgColor: 'bg-green-500/15',
        icon: Check
      }
    }
    
    // 4. 未使用
    return {
      label: '未使用',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/15',
      icon: Clock
    }
  }

  // 计算剩余有效期
  const getRemainingDays = (expiresAt: string | null, validDays: number): string => {
    if (expiresAt) {
      const expiryDate = new Date(expiresAt)
      const now = new Date()
      const diffTime = expiryDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      if (diffDays > 0) {
        return `${diffDays}天后过期`
      } else if (diffDays === 0) {
        return '今天过期'
      } else {
        return `已过期${Math.abs(diffDays)}天`
      }
    }
    
    // 如果没有过期时间，使用account_valid_for_days计算
    return `有效期${validDays}天`
  }

  // 批量操作
  const handleBulkAction = async (action: 'disable' | 'delete') => {
    if (selectedKeys.length === 0) return
    
    const confirmText = action === 'disable' 
      ? `确定要禁用选中的 ${selectedKeys.length} 个密钥吗？\n禁用后密钥将无法使用。`
      : `确定要删除选中的 ${selectedKeys.length} 个密钥吗？\n此操作不可撤销！`
    
    if (!confirm(confirmText)) return
    
    try {
      const response = await fetch('/api/admin/keys/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          keyIds: selectedKeys
        }),
        credentials: 'include'
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert(`✅ 成功${action === 'disable' ? '禁用' : '删除'}了 ${selectedKeys.length} 个密钥`)
        setSelectedKeys([])
        setShowBulkActions(false)
        fetchKeys() // 刷新数据
      } else {
        throw new Error(result.error || '操作失败')
      }
    } catch (error: any) {
      console.error('批量操作失败:', error)
      alert(`❌ 操作失败: ${error.message}`)
    }
  }

  // 导出密钥为CSV
  const exportToCSV = () => {
    const headers = ['密钥代码', '有效期(天)', '状态', '使用者', '使用时间', '创建时间', '过期时间', '剩余次数']
    
    const csvData = filteredKeys.map(key => {
      const status = getKeyStatus(key)
      const remaining = getRemainingDays(key.key_expires_at, key.account_valid_for_days)
      
      return [
        key.key_code,
        key.account_valid_for_days,
        status.label,
        key.user?.email || '-',
        key.used_at ? new Date(key.used_at).toLocaleString('zh-CN') : '-',
        new Date(key.created_at).toLocaleString('zh-CN'),
        key.key_expires_at ? new Date(key.key_expires_at).toLocaleString('zh-CN') : '-',
        key.max_uses ? `${key.used_count || 0}/${key.max_uses}` : '无限次'
      ]
    })
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `密钥列表_${new Date().toLocaleDateString('zh-CN')}.csv`
    link.click()
  }

  // 初始化加载
  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

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
              共 {stats.total} 个密钥，{selectedKeys.length} 个已选择
              <span className="ml-2 text-xs text-gray-500">
                | 使用次数限制功能已启用
              </span>
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {selectedKeys.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('disable')}
                  className="px-3 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:opacity-90 rounded-lg text-sm text-white whitespace-nowrap"
                >
                  批量禁用 ({selectedKeys.length})
                </button>
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 flex items-center"
                >
                  <MoreVertical className="w-4 h-4 mr-2" />
                  更多操作
                  <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showBulkActions ? 'rotate-180' : ''}`} />
                </button>
                
                {showBulkActions && (
                  <div className="absolute right-0 mt-12 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                    <button
                      onClick={() => handleBulkAction('delete')}
                      className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 border-b border-gray-700 first:rounded-t-lg flex items-center"
                    >
                      <Trash2 className="w-4 h-4 mr-2 text-red-400" />
                      批量删除
                    </button>
                    <button
                      onClick={exportToCSV}
                      className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 last:rounded-b-lg flex items-center"
                    >
                      <Download className="w-4 h-4 mr-2 text-blue-400" />
                      导出选中密钥
                    </button>
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={exportToCSV}
              className="px-3 py-2 md:px-4 md:py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              导出CSV
            </button>
            
            <Link
              href="/admin/keys/generate"
              className="px-3 py-2 md:px-4 md:py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 rounded-lg text-sm text-white flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              生成新密钥
            </Link>
          </div>
        </div>

        {/* 搜索和筛选栏 */}
        <div className="flex flex-col md:flex-row gap-3 mt-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="搜索密钥代码、使用者邮箱或昵称..."
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="relative">
            <button
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 flex items-center"
            >
              <Filter className="w-4 h-4 mr-2" />
              筛选状态
              <ChevronDown className="w-4 h-4 ml-1" />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {[
              { value: 'all', label: '全部密钥', count: stats.total },
              { value: 'active', label: '有效', count: stats.active },
              { value: 'unused', label: '未使用', count: stats.unused },
              { value: 'used', label: '已使用', count: stats.used },
              { value: 'expired', label: '已过期', count: stats.expired },
              { value: 'inactive', label: '已禁用', count: stats.inactive }
            ].map((item) => (
              <button
                key={item.value}
                className={`px-3 py-2 rounded-lg text-sm whitespace-nowrap ${statusFilter === item.value
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                onClick={() => setStatusFilter(item.value as any)}
              >
                {item.label}
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

      {/* 密钥统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center">
            <Key className="w-5 h-5 mr-2 text-amber-400" />
            <p className="text-sm text-gray-400">总密钥数</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white mt-2">{stats.total}</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center">
            <Shield className="w-5 h-5 mr-2 text-green-400" />
            <p className="text-sm text-gray-400">有效密钥</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-white mt-2">{stats.active}</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-2 text-amber-400" />
            <p className="text-sm text-gray-400">未使用</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-amber-400 mt-2">{stats.unused}</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center">
            <Check className="w-5 h-5 mr-2 text-green-400" />
            <p className="text-sm text-gray-400">已使用</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-green-400 mt-2">{stats.used}</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-red-400" />
            <p className="text-sm text-gray-400">已过期</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-red-400 mt-2">{stats.expired}</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center">
            <Ban className="w-5 h-5 mr-2 text-gray-400" />
            <p className="text-sm text-gray-400">已禁用</p>
          </div>
          <p className="text-xl md:text-2xl font-bold text-gray-400 mt-2">{stats.inactive}</p>
        </div>
      </div>

      {/* 密钥列表表格 */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-gray-700/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">密钥列表</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchKeys}
                className="px-3 py-1 bg-gray-800 rounded text-sm hover:bg-gray-700 flex items-center"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </button>
              <span className="text-gray-400 text-sm">
                显示 {filteredKeys.length} / {keys.length} 个密钥
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4">加载密钥列表中...</p>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">未找到匹配的密钥</p>
            {search && (
              <p className="text-gray-500 text-sm mt-2">搜索词: "{search}"</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left py-3 px-4 md:px-6">
                    <input
                      type="checkbox"
                      checked={selectedKeys.length === filteredKeys.length && filteredKeys.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedKeys(filteredKeys.map(k => k.id))
                        } else {
                          setSelectedKeys([])
                        }
                      }}
                      className="rounded border-gray-600"
                    />
                  </th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">密钥代码</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">时长</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">状态</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">使用者</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">使用次数</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">剩余有效期</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">创建时间</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredKeys.map((key) => {
                  const status = getKeyStatus(key)
                  const StatusIcon = status.icon
                  const remaining = getRemainingDays(key.key_expires_at, key.account_valid_for_days)
                  const isSelected = selectedKeys.includes(key.id)
                  
                  return (
                    <tr 
                      key={key.id} 
                      className={`border-b border-gray-700/30 hover:bg-gray-800/30 ${isSelected ? 'bg-blue-500/5' : ''}`}
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
                          className="rounded border-gray-600"
                        />
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <div className="flex items-center space-x-2">
                          <code className="font-mono text-sm bg-gray-900 px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer truncate max-w-[180px]"
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
                        <div className="flex flex-col">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium mb-1">
                            {key.account_valid_for_days} 天
                          </span>
                          {key.key_expires_at && (
                            <span className="text-gray-500 text-xs">
                              至 {new Date(key.key_expires_at).toLocaleDateString('zh-CN')}
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
                          <div className="space-y-1">
                            <p className="text-gray-300 text-sm truncate max-w-[120px]">{key.user.email}</p>
                            {key.user.nickname && (
                              <p className="text-gray-500 text-xs truncate max-w-[120px]">{key.user.nickname}</p>
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
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-300 text-sm">
                            {key.max_uses ? `${key.used_count || 0}/${key.max_uses}` : '无限次'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className={`text-sm ${
                            remaining.includes('已过期') || remaining.includes('今天过期') 
                              ? 'text-red-400' 
                              : 'text-gray-300'
                          }`}>
                            {remaining}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 md:px-6 text-gray-300 text-sm">
                        {new Date(key.created_at).toLocaleString('zh-CN')}
                      </td>
                      <td className="py-3 px-4 md:px-6">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              if (key.is_active) {
                                // 禁用密钥
                                if (confirm('确定要禁用此密钥吗？禁用后密钥将无法使用。')) {
                                  // 调用禁用API
                                  alert('密钥禁用功能待实现')
                                }
                              } else {
                                // 启用密钥
                                if (confirm('确定要启用此密钥吗？')) {
                                  // 调用启用API
                                  alert('密钥启用功能待实现')
                                }
                              }
                            }}
                            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                            title={key.is_active ? '禁用密钥' : '启用密钥'}
                          >
                            {key.is_active ? (
                              <EyeOff className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Eye className="w-4 h-4 text-green-400" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('确定要删除此密钥吗？此操作不可撤销！')) {
                                // 调用删除API
                                alert('密钥删除功能待实现')
                              }
                            }}
                            className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                            title="删除密钥"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 底部提示信息 */}
      <div className="mt-6 p-4 bg-gray-800/30 border border-gray-700/50 rounded-lg">
        <div className="flex items-start">
          <BarChart3 className="w-5 h-5 text-amber-400 mr-2 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-white mb-1">密钥使用提示</h4>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• 未使用的密钥可以分配给新用户</li>
              <li>• 已使用的密钥会显示使用者信息和使用时间</li>
              <li>• 已过期的密钥无法继续使用，但会保留记录</li>
              <li>• 可以禁用密钥以阻止其被使用</li>
              <li>• 支持批量操作和导出功能</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}