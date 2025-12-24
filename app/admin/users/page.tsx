// /app/admin/users/page.tsx - 关键修正部分
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Mail, Calendar, Shield, Search, Filter, Download, MoreVertical, Key, Brain, Gamepad2 } from 'lucide-react'
import UserDetailModal from './components/user-detail-modal'
import { User, UserDetail } from './types'

export const dynamic = 'force-dynamic'

const ITEMS_PER_PAGE = 20

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  // 获取用户数据
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setUsers([])

    try {
      // 构建查询参数
      const params = new URLSearchParams({
        table: 'profiles',
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      })

      // 添加搜索参数
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim())
      }

      // 添加筛选参数
      if (filter !== 'all') {
        params.append('filter', filter)
      }

      // 调用API端点
      const apiUrl = `/api/admin/data?${params.toString()}`
      const response = await fetch(apiUrl, {
        credentials: 'include',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API请求失败 (${response.status}): ${errorText}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'API返回未知错误')
      }

      // 🔥 关键修正：使用下划线字段名
      const formattedUsers: User[] = (result.data || []).map((profile: any) => {
        const lastLogin = profile.last_login_at
          ? new Date(profile.last_login_at).toLocaleString('zh-CN')
          : '从未登录'
        
        const createdAt = profile.created_at
          ? new Date(profile.created_at).toLocaleDateString('zh-CN')
          : '未知'

        const isPremium = profile.account_expires_at
          ? new Date(profile.account_expires_at) > new Date()
          : false

        // 🔥 修正：API列表查询不返回access_keys，所以这里设为null
        const activeKey = null // 列表查询不返回密钥数据

        return {
          id: profile.id,
          email: profile.email,
          nickname: profile.nickname,
          full_name: profile.full_name,  // 下划线
          avatar_url: profile.avatar_url,  // 下划线
          bio: profile.bio,
          preferences: profile.preferences,
          isAdmin: profile.email === '2200691917@qq.com',
          isPremium: isPremium,
          lastLogin: lastLogin,
          lastLoginRaw: profile.last_login_at,  // 下划线
          accountExpires: profile.account_expires_at,  // 下划线
          createdAt: createdAt,
          createdAtRaw: profile.created_at,  // 下划线
          access_key_id: profile.access_key_id,  // 下划线
          activeKey: activeKey, // 列表查询不显示密钥
          activeKeyUsedAt: null,
          activeKeyExpires: null,
          isActive: true,
          // 添加其他下划线字段
          last_login_session: profile.last_login_session,  // 下划线
          updated_at: profile.updated_at  // 下划线
        }
      })

      // 更新状态
      setUsers(formattedUsers)
      setTotalCount(result.pagination?.total || 0)

    } catch (error) {
      console.error('获取用户数据失败:', error)
      // 出错时设置空数据
      setUsers([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm, filter])

  // 获取用户详情
  const fetchUserDetail = async (userId: string) => {
    setDetailLoading(true)
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

      // API返回的是下划线命名，直接使用
      setSelectedUserDetail(result.data)

    } catch (error) {
      console.error('获取用户详情失败:', error)
      // 出错时设置为null
      setSelectedUserDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  // 批量禁用用户
  const handleBatchDisable = async () => {
    if (!selectedUsers.length || !confirm(`确定要禁用这 ${selectedUsers.length} 个账户吗？`)) return
    alert('批量禁用功能正在开发中，请稍后使用')
  }

  // CSV导出
  const handleExportCSV = () => {
    const headers = ['ID', '邮箱', '昵称', '会员状态', '最后登录', '注册时间', '当前密钥', '密钥使用时间']
    const csvData = users.map(user => [
      user.id,
      user.email,
      user.nickname || '',
      user.isPremium ? '会员中' : '免费',
      user.lastLogin,
      user.createdAt,
      user.activeKey || '需查看详情',
      user.activeKeyUsedAt ? new Date(user.activeKeyUsedAt).toLocaleString('zh-CN') : ''
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

  // 初始化加载
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // 处理详情查看
  const handleViewDetail = async (userId: string) => {
    await fetchUserDetail(userId)
    setDetailModalOpen(true)
  }

  // 🔥 关键：在渲染表格时，密钥列显示"需查看详情"
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
      {/* ... 页面标题、搜索栏、统计卡片等代码不变 ... */}
      
      {/* 用户表格 */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
        {/* ... 表格头部代码不变 ... */}
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4">加载用户列表中...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">未找到匹配的用户</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left py-3 px-4 md:px-6">
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
                    />
                  </th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">用户ID</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">邮箱/昵称</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">当前密钥</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">会员状态</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">最后登录</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">注册时间</th>
                  <th className="text-left py-3 px-4 md:px-6 text-gray-400 font-medium text-sm">操作</th>
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
                      />
                    </td>
                    <td className="py-3 px-4 md:px-6">
                      <code className="text-xs bg-gray-900 px-2 py-1 rounded font-mono">
                        {user.id.substring(0, 8)}...
                      </code>
                    </td>
                    <td className="py-3 px-4 md:px-6">
                      <div className="flex items-center">
                        {user.avatar_url ? (
                          <img 
                            src={user.avatar_url} 
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
                      {/* 🔥 关键：列表页面不显示密钥，提示用户查看详情 */}
                      <div className="text-center">
                        <span className="text-gray-500 text-sm">需查看详情</span>
                        {user.access_key_id && (
                          <p className="text-gray-600 text-xs mt-1">
                            密钥ID: {user.access_key_id}
                          </p>
                        )}
                      </div>
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
                        {user.accountExpires && (
                          <p className="text-gray-500 text-xs mt-1">
                            到期: {new Date(user.accountExpires).toLocaleDateString('zh-CN')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 md:px-6 text-gray-300 text-sm">
                      {user.lastLogin}
                    </td>
                    <td className="py-3 px-4 md:px-6 text-gray-300 text-sm">
                      {user.createdAt}
                    </td>
                    <td className="py-3 px-4 md:px-6">
                      <button 
                        onClick={() => handleViewDetail(user.id)}
                        className="text-blue-400 hover:text-blue-300 text-sm hover:underline"
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
        onRefresh={() => {
          if (selectedUserDetail?.id) {
            fetchUserDetail(selectedUserDetail.id)
          }
        }}
      />
    </div>
  )
}
