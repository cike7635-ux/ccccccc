'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, User, Mail, Calendar, Clock, Shield, Key, 
  Copy, Check, X, AlertCircle, Loader2, RefreshCw, ExternalLink,
  Edit, Trash2, FileText, History, Cpu, Battery, ShieldCheck,
  Users, ChevronDown, ChevronUp, Timer, TimerReset, CalendarClock,
  Gamepad2, Trophy
} from 'lucide-react'

interface ProfileDetail {
  id: string
  email: string
  nickname: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  preferences: any
  access_key_id: number | null
  account_expires_at: string | null
  created_at: string
  updated_at: string
  last_login_at: string | null
  last_login_session: string | null
  
  // 关联数据
  current_key?: {
    id: number
    key_code: string
    is_active: boolean
    original_duration_hours: number | null
    duration_unit: string | null
    key_expires_at: string | null
  }
  
  key_history?: Array<{
    id: number
    used_at: string
    usage_type: string
    notes: string | null
    access_keys: {
      key_code: string
      original_duration_hours: number | null
      duration_unit: string | null
    }
  }>
  
  ai_records?: Array<{
    id: number
    feature: string
    created_at: string
    request_data: any
    response_data: any
    success: boolean
  }>
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userData, setUserData] = useState<ProfileDetail | null>(null)
  const [copied, setCopied] = useState(false)
  const [operationLoading, setOperationLoading] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // 展开/收起状态
  const [showKeyHistory, setShowKeyHistory] = useState(true)
  const [showAIRecords, setShowAIRecords] = useState(false)
  const [showExtendForm, setShowExtendForm] = useState(false)
  const [showGameRecords, setShowGameRecords] = useState(false)
  
  // 游戏记录
  const [gameRecords, setGameRecords] = useState<any[]>([])
  const [gameLoading, setGameLoading] = useState(false)
  
  // 延长表单
  const [extendForm, setExtendForm] = useState({
    days: '',
    hours: '',
    reason: ''
  })

  // 获取用户详情
  const fetchUserDetail = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log(`🔍 获取用户详情 ID: ${userId}`)
      const response = await fetch(`/api/admin/users/${userId}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        if (response.status === 404) {
          throw new Error('用户不存在或已被删除')
        }
        throw new Error(`获取用户详情失败 (${response.status})`)
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        console.log('✅ 用户详情数据:', result.data)
        setUserData(result.data)
      } else {
        throw new Error(result.error || '获取数据失败')
      }
    } catch (error: any) {
      console.error('❌ 获取用户详情失败:', error)
      setError(error.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string) => {
    if (!text) return
    
    const copyTextToClipboard = (text: string) => {
      // 尝试使用 navigator.clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text)
      } else {
        // 备用方案：创建临时输入元素
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        try {
          const successful = document.execCommand('copy')
          if (!successful) {
            throw new Error('复制失败')
          }
        } catch (error) {
          throw error
        } finally {
          document.body.removeChild(textArea)
        }
      }
    }

    try {
      copyTextToClipboard(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('复制到剪贴板失败:', error)
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
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (error) {
      return '格式错误'
    }
  }

  // 计算会员状态
  const getMembershipStatus = () => {
    if (!userData) return { label: '未知', color: 'text-gray-400', isActive: false }
    
    if (!userData.account_expires_at) {
      return {
        label: '免费用户',
        color: 'text-gray-400',
        isActive: false
      }
    }
    
    const now = new Date()
    const expiry = new Date(userData.account_expires_at)
    
    if (expiry < now) {
      return {
        label: '已过期',
        color: 'text-red-400',
        isActive: false
      }
    }
    
    // 计算剩余天数
    const diffMs = expiry.getTime() - now.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    
    let label = '会员中'
    let color = 'text-green-400'
    
    if (diffDays <= 7) {
      label = `即将过期 (${diffDays}天)`
      color = 'text-yellow-400'
    } else if (diffDays <= 30) {
      label = `会员中 (${diffDays}天)`
    } else {
      const months = Math.floor(diffDays / 30)
      label = `会员中 (${months}个月)`
    }
    
    return {
      label,
      color,
      isActive: true,
      daysRemaining: diffDays
    }
  }

  // 获取游戏记录
  const fetchGameRecords = async () => {
    try {
      setGameLoading(true)
      
      console.log(`🔍 获取用户游戏记录 ID: ${userId}`)
      const response = await fetch(`/api/admin/games?user_id=${userId}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login')
          return
        }
        throw new Error(`获取游戏记录失败 (${response.status})`)
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        console.log('✅ 游戏记录数据:', result.data)
        setGameRecords(result.data)
      } else {
        throw new Error(result.error || '获取数据失败')
      }
    } catch (error: any) {
      console.error('❌ 获取游戏记录失败:', error)
    } finally {
      setGameLoading(false)
    }
  }

  // 格式化游戏时间
  const formatGameDuration = (startStr: string | null, endStr: string | null) => {
    if (!startStr || !endStr) return '未知'
    try {
      const start = new Date(startStr)
      const end = new Date(endStr)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return '未知'
      const diff = Math.floor((end.getTime() - start.getTime()) / 1000)
      const minutes = Math.floor(diff / 60)
      const seconds = diff % 60
      return `${minutes}分${seconds}秒`
    } catch {
      return '未知'
    }
  }

  // 计算用户在游戏中的角色
  const getUserRoleInGame = (game: any) => {
    if (game.player1_id === userId) return 'player1'
    if (game.player2_id === userId) return 'player2'
    return 'unknown'
  }

  // 获取用户在游戏中的昵称
  const getUserNicknameInGame = (game: any) => {
    const role = getUserRoleInGame(game)
    if (role === 'player1') return game.player1?.nickname || '玩家1'
    if (role === 'player2') return game.player2?.nickname || '玩家2'
    return '未知'
  }

  // 获取对手昵称
  const getOpponentNickname = (game: any) => {
    const role = getUserRoleInGame(game)
    if (role === 'player1') return game.player2?.nickname || '玩家2'
    if (role === 'player2') return game.player1?.nickname || '玩家1'
    return '未知'
  }

  // 检查用户是否是赢家
  const isUserWinner = (game: any) => {
    return game.winner_id === userId
  }

  // 获取游戏结果
  const getGameResult = (game: any) => {
    if (!game.winner_id) return '平局'
    if (game.winner_id === userId) return '胜利'
    return '失败'
  }

  // 格式化使用类型
  const formatUsageType = (type: string) => {
    const typeMap: Record<string, string> = {
      'activate': '激活',
      'renew': '续费',
      'admin_extend': '管理员延长',
      'transfer': '转移'
    }
    return typeMap[type] || type
  }

  // 延长用户会员时间
  const handleExtendMembership = async () => {
    if (!userData) return
    
    let days: number | undefined
    let hours: number | undefined
    
    if (extendForm.days) {
      days = parseInt(extendForm.days)
    } else if (extendForm.hours) {
      hours = parseInt(extendForm.hours)
    }
    
    if (!days && !hours) {
      alert('请指定延长的天数或小时数')
      return
    }
    
    const confirmText = days 
      ? `确定要将用户 "${userData.email}" 的会员时间延长${days}天吗？`
      : `确定要将用户 "${userData.email}" 的会员时间延长${hours}小时吗？`
    
    if (!confirm(confirmText)) return
    
    setOperationLoading('extend')
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          extend_days: days,
          extend_hours: hours,
          reason: extendForm.reason || '管理员手动延长'
        }),
        credentials: 'include'
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSuccessMessage(days 
          ? `用户会员时间已延长${days}天`
          : `用户会员时间已延长${hours}小时`
        )
        setTimeout(() => setSuccessMessage(null), 3000)
        
        // 刷新数据
        fetchUserDetail()
        
        // 重置表单
        setExtendForm({ days: '', hours: '', reason: '' })
        setShowExtendForm(false)
      } else {
        throw new Error(result.error || '延长失败')
      }
    } catch (error: any) {
      alert(`❌ 延长失败: ${error.message}`)
    } finally {
      setOperationLoading(null)
    }
  }

  // 删除用户
  const handleDeleteUser = async () => {
    if (!userData) return
    
    if (!confirm(`确定要删除用户 "${userData.email}" 吗？\n\n此操作会将用户标记为已删除，但保留历史数据。`)) {
      return
    }
    
    setOperationLoading('delete')
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert('用户已标记为删除')
        router.push('/admin/users')
      } else {
        throw new Error(result.error || '删除失败')
      }
    } catch (error: any) {
      alert(`❌ 删除失败: ${error.message}`)
    } finally {
      setOperationLoading(null)
    }
  }

  // 获取性别显示
  const getGenderDisplay = () => {
    if (!userData?.preferences) return '未设置'
    
    const gender = userData.preferences.gender
    if (gender === 'male') return '男'
    if (gender === 'female') return '女'
    if (gender === 'non_binary') return '非二元'
    if (gender === 'other') return '其他'
    return '未设置'
  }

  // 初始加载
  useEffect(() => {
    if (userId) {
      fetchUserDetail()
      fetchGameRecords()
    }
  }, [userId])

  if (loading && !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">正在加载用户详情...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
            <div className="flex items-center gap-3 text-red-400 mb-2">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-lg font-semibold">加载失败</h3>
            </div>
            <p className="text-gray-300 mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={fetchUserDetail}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </button>
              <Link
                href="/admin/users"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回用户列表
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">用户不存在</h3>
            <p className="text-gray-400 mb-6">请求的用户ID不存在或已被删除</p>
            <Link
              href="/admin/users"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回用户列表
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const membership = getMembershipStatus()
  const genderDisplay = getGenderDisplay()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* 成功消息 */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl animate-fade-in">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-400 mr-3" />
              <p className="text-green-400">{successMessage}</p>
            </div>
          </div>
        )}

        {/* 头部 */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回用户列表
              </Link>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
                <User className="w-6 h-6 md:w-7 md:h-7 mr-2 text-blue-400" />
                用户详情
                <span className="ml-3 text-sm bg-gray-800 text-gray-300 px-3 py-1 rounded-full">
                  ID: {userData.id.substring(0, 8)}...
                </span>
              </h1>
              <p className="text-gray-400 mt-2">
                查看和管理此用户的详细信息
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={fetchUserDetail}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </button>
              
              <button
                onClick={handleDeleteUser}
                disabled={operationLoading === 'delete'}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white flex items-center gap-2 disabled:opacity-50"
              >
                {operationLoading === 'delete' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                删除用户
              </button>
            </div>
          </div>
        </div>

        {/* 主要信息卡片 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* 基本信息 */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-400" />
                基本信息
              </h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">邮箱</label>
                    <div className="flex items-center gap-3">
                      <p className="text-white">{userData.email}</p>
                      <button
                        onClick={() => copyToClipboard(userData.email)}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="复制邮箱"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">昵称</label>
                    <p className="text-white">{userData.nickname || '未设置'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">性别</label>
                    <div className="flex items-center">
                      <span className={`px-2 py-1 rounded text-sm ${
                        genderDisplay === '男' ? 'bg-blue-500/10 text-blue-400' :
                        genderDisplay === '女' ? 'bg-pink-500/10 text-pink-400' :
                        'bg-purple-500/10 text-purple-400'
                      }`}>
                        {genderDisplay}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">全名</label>
                    <p className="text-white">{userData.full_name || '未设置'}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">个人简介</label>
                  <p className="text-white bg-gray-900/50 px-3 py-2 rounded-lg min-h-[60px]">
                    {userData.bio || '暂无简介'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 会员状态 */}
          <div>
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-green-400" />
                会员状态
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">状态</span>
                  <span className={`text-lg font-bold ${membership.color}`}>
                    {membership.label}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">到期时间</span>
                  <span className="text-white">
                    {userData.account_expires_at ? formatDate(userData.account_expires_at) : '无'}
                  </span>
                </div>
                
                {userData.current_key && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">当前使用密钥</label>
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-400" />
                      <code className="text-sm bg-gray-900 px-2 py-1 rounded">
                        {userData.current_key.key_code}
                      </code>
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t border-gray-700/50">
                  <button
                    onClick={() => setShowExtendForm(!showExtendForm)}
                    className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm flex items-center justify-center gap-2"
                  >
                    <TimerReset className="w-4 h-4" />
                    延长会员时间
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 延长会员时间表单 */}
        {showExtendForm && (
          <div className="mb-6">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-md font-semibold text-white mb-3 flex items-center">
                <CalendarClock className="w-4 h-4 mr-2 text-green-400" />
                延长会员时间
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">延长天数</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={extendForm.days}
                        onChange={(e) => setExtendForm(prev => ({ 
                          ...prev, 
                          days: e.target.value,
                          hours: '' // 清空小时输入
                        }))}
                        placeholder="输入天数"
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                      />
                      <span className="text-gray-400 text-sm">天</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">延长小时数</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={extendForm.hours}
                        onChange={(e) => setExtendForm(prev => ({ 
                          ...prev, 
                          hours: e.target.value,
                          days: '' // 清空天数输入
                        }))}
                        placeholder="输入小时数"
                        className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                      />
                      <span className="text-gray-400 text-sm">小时</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">延长原因（可选）</label>
                  <input
                    type="text"
                    value={extendForm.reason}
                    onChange={(e) => setExtendForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="请输入延长原因..."
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    maxLength={100}
                  />
                </div>
                
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setExtendForm({ days: '', hours: '', reason: '' })
                      setShowExtendForm(false)
                    }}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleExtendMembership}
                    disabled={operationLoading === 'extend'}
                    className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 rounded-lg text-white flex items-center gap-2 disabled:opacity-50"
                  >
                    {operationLoading === 'extend' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        延长中...
                      </>
                    ) : (
                      <>
                        <TimerReset className="w-4 h-4" />
                        确认延长
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 时间信息 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              时间信息
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-gray-500 text-xs">注册时间</span>
                <p className="text-white text-sm">{formatDate(userData.created_at)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">最后更新</span>
                <p className="text-white text-sm">{formatDate(userData.updated_at)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              登录信息
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-gray-500 text-xs">最后登录时间</span>
                <p className="text-white text-sm">{formatDate(userData.last_login_at)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">最后登录会话</span>
                <p className="text-white text-sm font-mono text-xs">
                  {userData.last_login_session || '无记录'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
              <Battery className="w-4 h-4 mr-2" />
              统计信息
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-gray-500 text-xs">密钥使用记录</span>
                <p className="text-white text-lg font-bold">
                  {userData.key_history?.length || 0} 次
                </p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">AI使用记录</span>
                <p className="text-white text-lg font-bold">
                  {userData.ai_records?.length || 0} 次
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 密钥使用历史 */}
        {(userData.key_history && userData.key_history.length > 0) && (
          <div className="mb-6">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <History className="w-5 h-5 mr-2 text-amber-400" />
                  密钥使用历史
                  <span className="ml-3 bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm">
                    {userData.key_history.length} 条记录
                  </span>
                </h2>
                <button
                  onClick={() => setShowKeyHistory(!showKeyHistory)}
                  className="text-gray-400 hover:text-white flex items-center gap-1"
                >
                  {showKeyHistory ? (
                    <>
                      收起
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      展开
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
              
              {showKeyHistory && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-800/50">
                        <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">使用时间</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">密钥代码</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">使用类型</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userData.key_history.map((record) => (
                        <tr 
                          key={record.id} 
                          className="border-t border-gray-700/30"
                        >
                          <td className="py-3 px-4">
                            <span className="text-gray-300 text-sm">
                              {formatDate(record.used_at)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <Key className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                              <code className="text-gray-300 text-sm truncate">
                                {record.access_keys?.key_code || '未知密钥'}
                              </code>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              record.usage_type === 'activate' ? 'bg-green-500/20 text-green-400' :
                              record.usage_type === 'renew' ? 'bg-blue-500/20 text-blue-400' :
                              record.usage_type === 'admin_extend' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {formatUsageType(record.usage_type)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-500 text-sm">
                              {record.notes || '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI使用记录 */}
        {(userData.ai_records && userData.ai_records.length > 0) && (
          <div className="mb-6">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <Cpu className="w-5 h-5 mr-2 text-blue-400" />
                  AI使用记录
                  <span className="ml-3 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm">
                    {userData.ai_records.length} 条记录
                  </span>
                </h2>
                <button
                  onClick={() => setShowAIRecords(!showAIRecords)}
                  className="text-gray-400 hover:text-white flex items-center gap-1"
                >
                  {showAIRecords ? (
                    <>
                      收起
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      展开
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
              
              {showAIRecords && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-800/50">
                        <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">使用时间</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">功能</th>
                        <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userData.ai_records.slice(0, 20).map((record) => (
                        <tr 
                          key={record.id} 
                          className="border-t border-gray-700/30"
                        >
                          <td className="py-3 px-4">
                            <span className="text-gray-300 text-sm">
                              {formatDate(record.created_at)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-300 text-sm">
                              {record.feature}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              record.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {record.success ? '成功' : '失败'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {userData.ai_records.length > 20 && (
                    <div className="mt-4 text-center text-gray-500 text-sm">
                      显示前20条记录，共{userData.ai_records.length}条
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 游戏记录 */}
        <div className="mb-6">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <Gamepad2 className="w-5 h-5 mr-2 text-purple-400" />
                游戏记录
                <span className="ml-3 bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">
                  {gameRecords.length} 场游戏
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchGameRecords}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 flex items-center gap-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  刷新
                </button>
                <button
                  onClick={() => setShowGameRecords(!showGameRecords)}
                  className="text-gray-400 hover:text-white flex items-center gap-1"
                >
                  {showGameRecords ? (
                    <>
                      收起
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      展开
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* 游戏统计 */}
            {showGameRecords && gameRecords.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-800/50 rounded-lg">
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">总场次</div>
                  <div className="text-white text-lg font-bold">{gameRecords.length}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">7天内场次</div>
                  <div className="text-white text-lg font-bold">
                    {gameRecords.filter(g => {
                      const endedAt = new Date(g.ended_at);
                      const sevenDaysAgo = new Date();
                      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                      return endedAt >= sevenDaysAgo;
                    }).length}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">胜场</div>
                  <div className="text-white text-lg font-bold">
                    {gameRecords.filter(g => g.winner_id === userId).length}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-1">胜率</div>
                  <div className="text-white text-lg font-bold">
                    {gameRecords.length > 0 ? 
                      ((gameRecords.filter(g => g.winner_id === userId).length / gameRecords.length) * 100).toFixed(1) + '%' : 
                      '0.0%'
                    }
                  </div>
                </div>
              </div>
            )}
            
            {gameLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin mr-2" />
                <span className="text-gray-400">加载游戏记录中...</span>
              </div>
            ) : showGameRecords ? (
              gameRecords.length === 0 ? (
                <div className="text-center py-8">
                  <Gamepad2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">该用户暂无游戏记录</p>
                </div>
              ) : (
                <div>
                  {/* 游戏统计 */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-800/50 rounded-lg">
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">总场次</div>
                      <div className="text-white text-lg font-bold">{gameRecords.length}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">7天内场次</div>
                      <div className="text-white text-lg font-bold">
                        {gameRecords.filter(g => {
                          const endedAt = new Date(g.ended_at);
                          const sevenDaysAgo = new Date();
                          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                          return endedAt >= sevenDaysAgo;
                        }).length}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">胜场</div>
                      <div className="text-white text-lg font-bold">
                        {gameRecords.filter(g => g.winner_id === userId).length}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">负场</div>
                      <div className="text-white text-lg font-bold">
                        {gameRecords.filter(g => g.winner_id && g.winner_id !== userId).length}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-400 mb-1">胜率</div>
                      <div className="text-white text-lg font-bold">
                        {gameRecords.length > 0 ? 
                          ((gameRecords.filter(g => g.winner_id === userId).length / gameRecords.length) * 100).toFixed(1) + '%' : 
                          '0.0%'
                        }
                      </div>
                    </div>
                  </div>
                  
                  {/* 游戏记录表格 */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-800/50">
                          <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm border-b border-gray-700/50">对局ID</th>
                          <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm border-b border-gray-700/50">对手</th>
                          <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm border-b border-gray-700/50">结果</th>
                          <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm border-b border-gray-700/50">时长</th>
                          <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm border-b border-gray-700/50">开始时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameRecords.map((game) => {
                          const gameResult = getGameResult(game);
                          const userRole = getUserRoleInGame(game);
                          return (
                            <tr key={game.id} className="border-b border-gray-700/30 hover:bg-gray-800/30">
                              <td className="py-3 px-4">
                                <span className="text-white font-mono text-sm">{game.room_id?.substring(0, 8)}</span>
                              </td>
                              <td className="py-3 px-4">
                                <div>
                                  <div className="text-white text-sm">{getOpponentNickname(game)}</div>
                                  <div className="text-gray-400 text-xs">你是{userRole === 'player1' ? '玩家1' : userRole === 'player2' ? '玩家2' : '未知'}</div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-sm ${gameResult === '胜利' ? 'text-green-400' : gameResult === '失败' ? 'text-red-400' : 'text-yellow-400'}`}>
                                  {gameResult}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-gray-300 text-sm">{formatGameDuration(game.started_at, game.ended_at)}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-gray-300 text-sm">{formatDate(game.started_at)}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center py-4 text-gray-400">
                点击展开查看游戏记录
              </div>
            )}
          </div>
        </div>

        {/* 操作区域 */}
        <div className="mt-6 bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">用户操作</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowExtendForm(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white flex items-center gap-2"
            >
              <TimerReset className="w-4 h-4" />
              延长会员时间
            </button>
            
            <Link
              href={`/admin/users?search=${encodeURIComponent(userData.email)}`}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              在列表中查找
            </Link>
            
            <button
              onClick={fetchUserDetail}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              刷新数据
            </button>
          </div>
        </div>

        {/* 页面底部信息 */}
        <div className="mt-6 p-4 bg-gray-800/20 border border-gray-700/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
              <p className="text-xs text-gray-400">
                页面最后更新: {new Date().toLocaleString('zh-CN')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-500 text-xs">
                用户ID: <span className="text-gray-300">{userData.id.substring(0, 8)}...</span>
              </span>
              <span className="text-gray-500 text-xs">
                状态: <span className={membership.color}>{membership.label}</span>
              </span>
              <span className="text-gray-500 text-xs">
                密钥记录: <span className="text-amber-400">{userData.key_history?.length || 0}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 全局样式 */}
      <style jsx global>{`
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}