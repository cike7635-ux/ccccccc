// /app/admin/keys/[id]/page.tsx - 完整修复版（已添加延长用户会员功能）
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Key, Copy, Check, AlertCircle,
  User, Calendar, Clock, Shield, Loader2,
  ExternalLink, Ban, Eye, EyeOff, Trash2, Edit,
  Users, Plus, Save, RefreshCw, ChevronDown, ChevronUp,
  HardDrive, Zap, FileText, History, ShieldCheck, ShieldAlert,
  Globe, Cpu, Battery, BatteryCharging, BatteryFull,
  Lock, Unlock, CalendarClock, Timer, TimerReset
} from 'lucide-react'

// 定义接口（确保与API返回的数据结构一致）
interface Profile {
  email: string
  nickname: string | null
  id?: string
  created_at?: string
  last_login_at?: string | null
}

interface KeyUsageHistory {
  id: number
  user_id: string
  access_key_id: number
  used_at: string
  usage_type: string
  previous_key_id: number | null
  next_key_id: number | null
  operation_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  profiles?: Profile | null
}

interface AccessKeyDetail {
  id: number
  key_code: string | null
  description: string | null
  is_active: boolean
  used_count: number | null
  max_uses: number | null
  key_expires_at: string | null
  account_valid_for_days: number | null
  user_id: string | null
  used_at: string | null
  created_at: string | null
  updated_at: string | null
  original_duration_hours: number | null
  duration_unit: string | null
  profiles?: Profile | null  // API返回的是这个字段
}

interface KeyData {
  key_info: AccessKeyDetail
  usage_history: KeyUsageHistory[]
  statistics: {
    total_uses: number
    unique_users: number
    average_duration_hours: number
    first_use: string | null
    last_use: string | null
    usage_by_type: Record<string, number>
  }
}

export default function KeyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const keyId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyData, setKeyData] = useState<KeyData | null>(null)
  const [copied, setCopied] = useState(false)
  const [operationLoading, setOperationLoading] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // 展开/收起状态
  const [showAllUsers, setShowAllUsers] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showExtendOptions, setShowExtendOptions] = useState(false)

  // 自定义期限表单
  const [customDuration, setCustomDuration] = useState({
    original_duration_hours: '',
    account_valid_for_days: '',
    max_uses: '',
    key_expires_at: '',
    description: ''
  })

  // 延长表单（用于延长密钥有效期）
  const [extendForm, setExtendForm] = useState({
    days: '',
    hours: '',
    reason: ''
  })

  // 🔥 新增：延长用户会员表单
  const [extendUserForm, setExtendUserForm] = useState({
    days: '',
    hours: '',
    reason: ''
  })

  // 获取密钥详情
  const fetchKeyDetail = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log(`🔍 获取密钥详情 ID: ${keyId}`)
      const response = await fetch(`/api/admin/keys/${keyId}`, {
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
          throw new Error('密钥不存在或已被删除')
        }
        throw new Error(`获取密钥详情失败 (${response.status})`)
      }

      const result = await response.json()

      if (result.success && result.data) {
        console.log('✅ 密钥详情数据:', result.data)
        setKeyData(result.data)

        // 初始化表单数据
        const key = result.data.key_info
        setCustomDuration({
          original_duration_hours: key.original_duration_hours?.toString() || '',
          account_valid_for_days: key.account_valid_for_days?.toString() || '30',
          max_uses: key.max_uses?.toString() || '1',
          key_expires_at: key.key_expires_at ?
            new Date(key.key_expires_at).toISOString().slice(0, 16) : '',
          description: key.description || ''
        })
      } else {
        throw new Error(result.error || '获取数据失败')
      }
    } catch (error: any) {
      console.error('❌ 获取密钥详情失败:', error)
      setError(error.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  // 复制密钥到剪贴板
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

  // 获取密钥状态
  const getKeyStatus = () => {
    if (!keyData?.key_info) return {
      label: '未知',
      color: 'text-gray-400',
      bgColor: 'bg-gray-400/10',
      icon: AlertCircle
    }

    const key = keyData.key_info
    const now = new Date()

    // 已禁用
    if (!key.is_active) {
      return {
        label: '已禁用',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        icon: Ban
      }
    }

    // 已过期
    if (key.key_expires_at && new Date(key.key_expires_at) < now) {
      return {
        label: '已过期',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        icon: AlertCircle
      }
    }

    // 已使用（有使用记录或使用者）
    const hasUsage = keyData.statistics.total_uses > 0 || key.used_at || key.user_id
    if (hasUsage) {
      return {
        label: '已使用',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        icon: Check
      }
    }

    // 未使用
    return {
      label: '未使用',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      icon: Clock
    }
  }

  // 计算剩余有效期
  const getRemainingTime = () => {
    if (!keyData?.key_info) return { text: '未知', color: 'text-gray-400', isExpired: false }

    const key = keyData.key_info
    const now = new Date()

    // 如果有绝对过期时间
    if (key.key_expires_at) {
      const expiry = new Date(key.key_expires_at)
      const diffMs = expiry.getTime() - now.getTime()

      if (diffMs <= 0) {
        return {
          text: '已过期',
          color: 'text-red-400',
          isExpired: true
        }
      }

      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))

      if (diffDays > 30) {
        const months = Math.floor(diffDays / 30)
        return {
          text: `${months}个月后过期`,
          color: 'text-green-400',
          isExpired: false
        }
      } else if (diffDays > 7) {
        return {
          text: `${diffDays}天后过期`,
          color: 'text-blue-400',
          isExpired: false
        }
      } else if (diffDays > 1) {
        return {
          text: `${diffDays}天后过期`,
          color: 'text-amber-400',
          isExpired: false
        }
      } else {
        return {
          text: `${diffHours}小时后过期`,
          color: 'text-red-400',
          isExpired: false
        }
      }
    }

    // 计算基于使用时间的有效期
    if (key.used_at) {
      const usedDate = new Date(key.used_at)
      let expiryTime: Date

      if (key.original_duration_hours) {
        expiryTime = new Date(usedDate.getTime() + (parseFloat(key.original_duration_hours.toString()) * 60 * 60 * 1000))
      } else if (key.account_valid_for_days) {
        expiryTime = new Date(usedDate.getTime() + (key.account_valid_for_days * 24 * 60 * 60 * 1000))
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

      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))

      if (diffDays > 30) {
        const months = Math.floor(diffDays / 30)
        return {
          text: `${months}个月后过期`,
          color: 'text-green-400',
          isExpired: false
        }
      } else if (diffDays > 7) {
        return {
          text: `${diffDays}天后过期`,
          color: 'text-blue-400',
          isExpired: false
        }
      } else if (diffDays > 1) {
        return {
          text: `${diffDays}天后过期`,
          color: 'text-amber-400',
          isExpired: false
        }
      } else {
        return {
          text: `${diffHours}小时后过期`,
          color: 'text-red-400',
          isExpired: false
        }
      }
    }

    // 未激活也没有过期时间
    if (key.account_valid_for_days) {
      return {
        text: `激活后有效期${key.account_valid_for_days}天`,
        color: 'text-blue-400',
        isExpired: false
      }
    }

    return {
      text: '永不过期',
      color: 'text-green-400',
      isExpired: false
    }
  }

  // 格式化时长显示
  const getDurationDisplay = () => {
    if (!keyData?.key_info) return '未知'

    const key = keyData.key_info

    // 优先显示原始时长（小时）
    if (key.original_duration_hours) {
      const hours = parseFloat(key.original_duration_hours.toString())

      if (hours < 24) {
        return `${hours}小时`
      } else if (hours < 24 * 30) {
        const days = Math.round(hours / 24)
        return `${days}天`
      } else {
        const months = Math.round(hours / (24 * 30))
        return `${months}个月`
      }
    }

    // 回退到账户有效期天数
    if (key.account_valid_for_days) {
      if (key.account_valid_for_days < 30) {
        return `${key.account_valid_for_days}天`
      } else {
        const months = Math.round(key.account_valid_for_days / 30)
        return `${months}个月`
      }
    }

    return '永不过期'
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

  // 格式化使用类型
  const formatUsageType = (type: string) => {
    const typeMap: Record<string, string> = {
      'activate': '激活',
      'renew': '续期',
      'transfer': '转移',
      'upgrade': '升级',
      'downgrade': '降级',
      'reset': '重置'
    }
    return typeMap[type] || type
  }

  // 密钥操作：禁用/启用/删除
  const handleKeyAction = async (action: 'disable' | 'enable' | 'delete') => {
    const actionText = {
      disable: '禁用',
      enable: '启用',
      delete: '删除'
    }[action]

    const confirmText = {
      disable: `确定要禁用此密钥吗？禁用后密钥将无法使用。`,
      enable: `确定要启用此密钥吗？启用后密钥可以正常使用。`,
      delete: `确定要删除此密钥吗？此操作不可撤销！`
    }[action]

    if (!confirm(confirmText)) return

    setOperationLoading(action)

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
        if (action !== 'delete') {
          fetchKeyDetail()
        } else {
          // 删除成功后跳转到密钥列表
          setTimeout(() => {
            router.push('/admin/keys')
          }, 1500)
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

  // 更新自定义期限
  const handleUpdateDuration = async () => {
    if (!keyData?.key_info) return

    const updates: any = {}

    // 只发送有变化的字段
    if (customDuration.original_duration_hours !== '') {
      updates.original_duration_hours = parseFloat(customDuration.original_duration_hours)
    }

    if (customDuration.account_valid_for_days !== '') {
      updates.account_valid_for_days = parseInt(customDuration.account_valid_for_days)
    }

    if (customDuration.max_uses !== '') {
      updates.max_uses = parseInt(customDuration.max_uses)
    }

    if (customDuration.key_expires_at !== '') {
      updates.key_expires_at = new Date(customDuration.key_expires_at).toISOString()
    }

    if (customDuration.description !== keyData.key_info.description) {
      updates.description = customDuration.description
    }

    if (Object.keys(updates).length === 0) {
      alert('没有需要更新的字段')
      return
    }

    setOperationLoading('update')

    try {
      const response = await fetch(`/api/admin/keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        setSuccessMessage('密钥期限已更新')
        setTimeout(() => setSuccessMessage(null), 3000)
        fetchKeyDetail() // 刷新数据
      } else {
        throw new Error(result.error || '更新失败')
      }
    } catch (error: any) {
      alert(`❌ 更新失败: ${error.message}`)
    } finally {
      setOperationLoading(null)
    }
  }

  // 延长密钥有效期
  const handleExtendExpiry = async (type: 'quick' | 'custom', value?: number) => {
    if (!keyData?.key_info) return

    let days: number | undefined
    let hours: number | undefined

    if (type === 'quick' && value) {
      days = value
    } else if (type === 'custom') {
      if (extendForm.days) {
        days = parseInt(extendForm.days)
      } else if (extendForm.hours) {
        hours = parseInt(extendForm.hours)
      }
    }

    if (!days && !hours) {
      alert('请指定延长的天数或小时数')
      return
    }

    const confirmText = days
      ? `确定要将密钥有效期延长${days}天吗？`
      : `确定要将密钥有效期延长${hours}小时吗？`

    if (!confirm(confirmText)) return

    setOperationLoading('extend')

    try {
      const response = await fetch(`/api/admin/keys/${keyId}/extend-expiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days,
          hours,
          reason: extendForm.reason || '管理员手动延长'
        }),
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        setSuccessMessage(days
          ? `密钥有效期已延长${days}天`
          : `密钥有效期已延长${hours}小时`
        )
        setTimeout(() => setSuccessMessage(null), 3000)
        fetchKeyDetail() // 刷新数据

        // 重置表单
        setExtendForm({ days: '', hours: '', reason: '' })
        setShowExtendOptions(false)
      } else {
        throw new Error(result.error || '延长失败')
      }
    } catch (error: any) {
      alert(`❌ 延长失败: ${error.message}`)
    } finally {
      setOperationLoading(null)
    }
  }

  // 🔥 新增：延长用户会员时间
  const handleExtendUserAccount = async () => {
    const userInfo = getUserInfo()
    if (!userInfo || !userInfo.id) {
      alert('无法获取用户信息')
      return
    }

    let days: number | undefined
    let hours: number | undefined

    if (extendUserForm.days) {
      days = parseInt(extendUserForm.days)
    } else if (extendUserForm.hours) {
      hours = parseInt(extendUserForm.hours)
    }

    if (!days && !hours) {
      alert('请指定延长的天数或小时数')
      return
    }

    const confirmText = days
      ? `确定要将用户 "${userInfo.email}" 的会员时间延长${days}天吗？`
      : `确定要将用户 "${userInfo.email}" 的会员时间延长${hours}小时吗？`

    if (!confirm(confirmText)) return

    setOperationLoading('extendUser')

    try {
      const response = await fetch(`/api/admin/users/${userInfo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extend_days: days,
          extend_hours: hours,
          reason: extendUserForm.reason || '管理员手动延长'
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
        fetchKeyDetail()

        // 重置表单
        setExtendUserForm({ days: '', hours: '', reason: '' })
      } else {
        throw new Error(result.error || '延长失败')
      }
    } catch (error: any) {
      alert(`❌ 延长失败: ${error.message}`)
    } finally {
      setOperationLoading(null)
    }
  }

  // 安全获取用户信息（兼容API返回的数据结构）
  const getUserInfo = () => {
    if (!keyData?.key_info) return null

    const key = keyData.key_info

    // 优先使用 profiles 字段（API实际返回）
    if (key.profiles && key.profiles.email) {
      return {
        email: key.profiles.email,
        nickname: key.profiles.nickname,
        id: key.user_id || key.profiles.id
      }
    }

    return null
  }

  // 初始加载
  useEffect(() => {
    if (keyId) {
      fetchKeyDetail()
    }
  }, [keyId])

  if (loading && !keyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">正在加载密钥详情...</p>
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
                onClick={fetchKeyDetail}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                重试
              </button>
              <Link
                href="/admin/keys"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回列表
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!keyData || !keyData.key_info) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Key className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">密钥不存在</h3>
            <p className="text-gray-400 mb-6">请求的密钥ID不存在或已被删除</p>
            <Link
              href="/admin/keys"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回密钥列表
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const key = keyData.key_info
  const status = getKeyStatus()
  const remaining = getRemainingTime()
  const durationDisplay = getDurationDisplay()
  const StatusIcon = status.icon
  const userInfo = getUserInfo()

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
                href="/admin/keys"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回密钥列表
              </Link>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
                <Key className="w-6 h-6 md:w-7 md:h-7 mr-2 text-amber-400" />
                密钥详情
                <span className="ml-3 text-sm bg-gray-800 text-gray-300 px-3 py-1 rounded-full">
                  ID: {key.id}
                </span>
              </h1>
              <p className="text-gray-400 mt-2">
                查看和编辑此密钥的详细信息，管理使用者和有效期
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(key.key_code || `ID: ${key.id}`)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-white flex items-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    复制密钥
                  </>
                )}
              </button>

              <button
                onClick={fetchKeyDetail}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
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
                <Shield className="w-5 h-5 mr-2 text-blue-400" />
                密钥信息
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">密钥代码</label>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 bg-gray-900 px-3 py-2 rounded-lg font-mono text-white text-lg break-all">
                      {key.key_code || `ID: ${key.id}`}
                    </code>
                    <button
                      onClick={() => copyToClipboard(key.key_code || `ID: ${key.id}`)}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                      title="复制密钥"
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
                  <label className="block text-sm text-gray-400 mb-1">描述</label>
                  <p className="text-white bg-gray-900/50 px-3 py-2 rounded-lg">
                    {key.description || '无描述'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">状态</label>
                    <div className="flex items-center gap-2">
                      <StatusIcon className="w-4 h-4" />
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.bgColor} ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">激活状态</label>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${key.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={key.is_active ? 'text-green-400' : 'text-red-400'}>
                        {key.is_active ? '已激活' : '未激活'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 统计信息 */}
          <div>
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Zap className="w-5 h-5 mr-2 text-amber-400" />
                使用统计
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">总使用次数</span>
                  <span className="text-white text-lg font-bold">
                    {keyData.statistics.total_uses}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">唯一用户数</span>
                  <span className="text-blue-400 text-lg font-bold">
                    {keyData.statistics.unique_users}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">最大使用次数</span>
                  <span className="text-green-400 text-lg font-bold">
                    {key.max_uses || '∞'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-400">当前使用次数</span>
                  <span className="text-amber-400 text-lg font-bold">
                    {key.used_count || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 时间信息和有效期 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              时间信息
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-gray-500 text-xs">创建时间</span>
                <p className="text-white text-sm">{formatDate(key.created_at)}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">最后更新</span>
                <p className="text-white text-sm">{formatDate(key.updated_at)}</p>
              </div>
              {key.used_at && (
                <div>
                  <span className="text-gray-500 text-xs">首次使用</span>
                  <p className="text-white text-sm">{formatDate(key.used_at)}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
              <Timer className="w-4 h-4 mr-2 text-green-400" />
              有效期信息
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-gray-500 text-xs">原始时长</span>
                <p className="text-white text-lg font-bold">{durationDisplay}</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">账户有效期</span>
                <p className="text-white text-sm">{key.account_valid_for_days || 30}天</p>
              </div>
              <div>
                <span className="text-gray-500 text-xs">过期时间</span>
                <p className="text-white text-sm">
                  {key.key_expires_at ? formatDate(key.key_expires_at) : '永不过期'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
              <Battery className="w-4 h-4 mr-2 text-amber-400" />
              剩余有效期
            </h3>
            <div className="space-y-2">
              <div>
                <span className="text-gray-500 text-xs">状态</span>
                <p className={`text-lg font-bold ${remaining.color}`}>
                  {remaining.text}
                </p>
              </div>
              {remaining.isExpired ? (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-red-400 text-xs">
                    此密钥已过期，需要重新激活或延长有效期
                  </p>
                </div>
              ) : (
                <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400 text-xs">
                    密钥有效，可以正常使用
                  </p>
                </div>
              )}
              <button
                onClick={() => setShowExtendOptions(true)}
                className="mt-2 w-full px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded-lg text-white text-sm flex items-center justify-center gap-1"
              >
                <TimerReset className="w-3 h-3" />
                延长密钥有效期
              </button>
            </div>
          </div>
        </div>

        {/* 🔥 修改后的使用者信息部分（包含延长用户会员功能） */}
        {userInfo && (
          <div className="mb-6">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-400" />
                当前使用者
              </h2>

              <div className="p-4 bg-gray-900/50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">邮箱</label>
                    <p className="text-white">{userInfo.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">昵称</label>
                    <p className="text-white">{userInfo.nickname || '未设置'}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">用户ID</label>
                    <p className="text-white font-mono text-sm break-all">{userInfo.id || '未知'}</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">最后登录</label>
                    <p className="text-white">
                      {key.profiles?.last_login_at ? formatDate(key.profiles.last_login_at) : '从未登录'}
                    </p>
                  </div>
                </div>

                {/* 🔥 新增：延长用户会员时间表单 */}
                <div className="mt-6 pt-6 border-t border-gray-700/50">
                  <h3 className="text-md font-semibold text-white mb-3 flex items-center">
                    <CalendarClock className="w-4 h-4 mr-2 text-green-400" />
                    延长此用户会员时间
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
                            value={extendUserForm.days}
                            onChange={(e) => setExtendUserForm(prev => ({
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
                            value={extendUserForm.hours}
                            onChange={(e) => setExtendUserForm(prev => ({
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
                        value={extendUserForm.reason}
                        onChange={(e) => setExtendUserForm(prev => ({ ...prev, reason: e.target.value }))}
                        placeholder="请输入延长原因..."
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                        maxLength={100}
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setExtendUserForm({ days: '', hours: '', reason: '' })}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300"
                      >
                        清空
                      </button>
                      <button
                        onClick={handleExtendUserAccount}
                        disabled={operationLoading === 'extendUser'}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 rounded-lg text-white flex items-center gap-2 disabled:opacity-50"
                      >
                        {operationLoading === 'extendUser' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            延长中...
                          </>
                        ) : (
                          <>
                            <CalendarClock className="w-4 h-4" />
                            延长用户会员时间
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {userInfo.id && (
                  <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <Link
                      href={`/admin/users/${userInfo.id}`}
                      className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-2"
                      target="_blank"
                    >
                      <ExternalLink className="w-4 h-4" />
                      查看用户详情
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


        {/* 所有使用者 */}
        {keyData.all_users && keyData.all_users.length > 0 && (
          <div className="mb-6">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-purple-400" />
                所有使用者
                <span className="ml-3 bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">
                  {keyData.all_users.length} 个用户
                </span>
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-800/50">
                      <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">用户</th>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">使用次数</th>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">首次使用</th>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">最后使用</th>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium text-sm">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyData.all_users.map((user, index) => (
                      <tr
                        key={user.user_id}
                        className={`border-t border-gray-700/30 ${index === 0 ? 'bg-blue-500/5' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={user.nickname || user.email}
                                className="w-8 h-8 rounded-full mr-3"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-3">
                                <User className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-gray-300 text-sm truncate" title={user.email}>
                                {user.email}
                              </p>
                              {user.nickname && (
                                <p className="text-gray-500 text-xs truncate">{user.nickname}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">
                            {user.usage_count} 次
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-sm">
                          {formatDate(user.first_used)}
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-sm">
                          {formatDate(user.last_used)}
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/admin/users/${user.user_id}`}
                            className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                            target="_blank"
                          >
                            <ExternalLink className="w-3 h-3" />
                            查看详情
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700/50 flex items-center justify-between">
                <div className="text-gray-400 text-sm">
                  此密钥被 {keyData.statistics.unique_users} 个不同用户使用过，
                  总计 {keyData.statistics.total_uses} 次使用
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                    激活: {keyData.statistics.usage_by_type?.activate || 0}
                  </span>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                    续期: {keyData.statistics.usage_by_type?.renew || 0}
                  </span>
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                    转移: {keyData.statistics.usage_by_type?.transfer || 0}
                  </span>
                  {keyData.statistics.usage_by_type?.admin_extend && (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                      管理延长: {keyData.statistics.usage_by_type.admin_extend}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 自定义期限和延长功能 */}
        <div className="space-y-6">
          {/* 自定义期限表单 */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <CalendarClock className="w-5 h-5 mr-2 text-green-400" />
                自定义密钥期限
              </h2>
              <button
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="text-gray-400 hover:text-white flex items-center gap-1"
              >
                {showAdvancedSettings ? (
                  <>
                    收起设置
                    <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    展开设置
                    <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <div className={`space-y-4 transition-all duration-300 ${showAdvancedSettings ? 'block' : 'hidden'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">原始时长（小时）</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="8760"
                      value={customDuration.original_duration_hours}
                      onChange={(e) => setCustomDuration(prev => ({
                        ...prev,
                        original_duration_hours: e.target.value
                      }))}
                      placeholder="例如：24表示1天，720表示30天"
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    />
                    <span className="text-gray-400 text-sm whitespace-nowrap">小时</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    小时级别：1=1小时，24=1天，720=30天
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">账户有效期（天）</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={customDuration.account_valid_for_days}
                      onChange={(e) => setCustomDuration(prev => ({
                        ...prev,
                        account_valid_for_days: e.target.value
                      }))}
                      placeholder="账户有效天数"
                      className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                    />
                    <span className="text-gray-400 text-sm whitespace-nowrap">天</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    激活后的有效期天数
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">最大使用次数</label>
                  <input
                    type="number"
                    min="1"
                    value={customDuration.max_uses}
                    onChange={(e) => setCustomDuration(prev => ({
                      ...prev,
                      max_uses: e.target.value
                    }))}
                    placeholder="最多使用次数"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    输入∞表示无限次使用
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">过期时间</label>
                  <input
                    type="datetime-local"
                    value={customDuration.key_expires_at}
                    onChange={(e) => setCustomDuration(prev => ({
                      ...prev,
                      key_expires_at: e.target.value
                    }))}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    设置具体过期时间，留空表示永不过期
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">描述</label>
                <textarea
                  value={customDuration.description}
                  onChange={(e) => setCustomDuration(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  placeholder="密钥描述"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white h-20 resize-none"
                  maxLength={200}
                />
                <div className="flex justify-between mt-1">
                  <p className="text-gray-500 text-xs">
                    可选，用于记录密钥用途
                  </p>
                  <span className="text-gray-500 text-xs">
                    {customDuration.description.length}/200
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-700/50">
                <button
                  onClick={() => {
                    // 重置表单
                    setCustomDuration({
                      original_duration_hours: key.original_duration_hours?.toString() || '',
                      account_valid_for_days: key.account_valid_for_days?.toString() || '30',
                      max_uses: key.max_uses?.toString() || '1',
                      key_expires_at: key.key_expires_at ?
                        new Date(key.key_expires_at).toISOString().slice(0, 16) : '',
                      description: key.description || ''
                    })
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300"
                >
                  重置
                </button>
                <button
                  onClick={handleUpdateDuration}
                  disabled={operationLoading === 'update'}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 rounded-lg text-white flex items-center gap-2 disabled:opacity-50"
                >
                  {operationLoading === 'update' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      保存期限设置
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 延长密钥有效期功能 */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <TimerReset className="w-5 h-5 mr-2 text-amber-400" />
                延长密钥有效期
              </h2>
              <button
                onClick={() => setShowExtendOptions(!showExtendOptions)}
                className="text-gray-400 hover:text-white flex items-center gap-1"
              >
                {showExtendOptions ? (
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

            {showExtendOptions && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">快速延长</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[7, 30, 90, 180].map((days) => (
                      <button
                        key={days}
                        onClick={() => handleExtendExpiry('quick', days)}
                        disabled={operationLoading === 'extend'}
                        className="px-4 py-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-lg text-center transition-colors disabled:opacity-50"
                      >
                        <div className="text-amber-400 text-lg font-bold mb-1">{days}天</div>
                        <div className="text-gray-400 text-xs">延长有效期</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700/50">
                  <label className="block text-sm font-medium text-gray-300 mb-2">自定义延长</label>
                  <div className="space-y-3">
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
                            max="240"
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
                        placeholder="请输入延长原因，便于后续追溯..."
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
                        maxLength={100}
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setExtendForm({ days: '', hours: '', reason: '' })}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300"
                      >
                        清空
                      </button>
                      <button
                        onClick={() => handleExtendExpiry('custom')}
                        disabled={operationLoading === 'extend' || (!extendForm.days && !extendForm.hours)}
                        className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 rounded-lg text-white flex items-center gap-2 disabled:opacity-50"
                      >
                        {operationLoading === 'extend' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            延长中...
                          </>
                        ) : (
                          <>
                            <TimerReset className="w-4 h-4" />
                            自定义延长
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 操作区域 */}
        <div className="mt-6 bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">密钥操作</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleKeyAction(key.is_active ? 'disable' : 'enable')}
              disabled={operationLoading === 'disable' || operationLoading === 'enable'}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white flex items-center gap-2 disabled:opacity-50"
            >
              {operationLoading === 'disable' || operationLoading === 'enable' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : key.is_active ? (
                <>
                  <Ban className="w-4 h-4" />
                  禁用密钥
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  启用密钥
                </>
              )}
            </button>

            <button
              onClick={() => handleKeyAction('delete')}
              disabled={operationLoading === 'delete'}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white flex items-center gap-2 disabled:opacity-50"
            >
              {operationLoading === 'delete' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  删除密钥
                </>
              )}
            </button>

            <Link
              href={`/admin/keys/generate?template=${key.id}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              生成相似密钥
            </Link>

            <button
              onClick={fetchKeyDetail}
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
                密钥ID: <span className="text-gray-300">{key.id}</span>
              </span>
              <span className="text-gray-500 text-xs">
                状态: <span className={status.color}>{status.label}</span>
              </span>
              <span className="text-gray-500 text-xs">
                使用次数: <span className="text-amber-400">{keyData.statistics.total_uses}</span>
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