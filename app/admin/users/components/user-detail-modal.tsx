// /app/admin/users/components/user-detail-modal.tsx - 去除了 date-fns 依赖的简化版本
'use client'

import { 
  X, Mail, User, Calendar, Key, Brain, Gamepad2, 
  Copy, Check, Clock, Award, Users, History, BarChart3, 
  ExternalLink, Shield, Database, RefreshCw, AlertCircle,
  TrendingUp, Zap, Crown, Clock3, Hash, Globe
} from 'lucide-react'
import { UserDetail, normalizeUserDetail, AccessKey, AiUsageRecord, GameHistory } from '../types'
import { useState, useEffect, useMemo, useCallback } from 'react'

interface UserDetailModalProps {
  isOpen: boolean
  onClose: () => void
  userDetail: UserDetail | null
  loading: boolean
  onRefresh?: () => void
}

type TabType = 'info' | 'keys' | 'ai' | 'games' | 'debug'

// 日期格式化工具函数（不需要 date-fns）
const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return '无记录'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '格式错误'
    
    // 格式: 2024-12-23 14:30:45
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch (error) {
    return '格式错误'
  }
}

const formatDateOnly = (dateString: string | null): string => {
  if (!dateString) return '无记录'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '格式错误'
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    return `${year}-${month}-${day}`
  } catch (error) {
    return '格式错误'
  }
}

const formatRelativeTime = (dateString: string | null): string => {
  if (!dateString) return '从未'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '未知'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffSeconds < 60) return '刚刚'
    if (diffMinutes < 60) return `${diffMinutes}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    
    return formatDateOnly(dateString)
  } catch (error) {
    return '未知'
  }
}

const formatDuration = (dateString: string | null): string => {
  if (!dateString) return '从未'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '未知'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffSeconds < 60) return `${diffSeconds}秒前`
    if (diffMinutes < 60) return `${diffMinutes}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 30) return `${diffDays}天前`
    
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) return `${diffMonths}个月前`
    
    const diffYears = Math.floor(diffMonths / 12)
    return `${diffYears}年前`
  } catch (error) {
    return '未知'
  }
}

// 计算日期差（天）
const calculateDaysDifference = (dateString1: string | null, dateString2: string | null = null): number => {
  try {
    const date1 = dateString1 ? new Date(dateString1) : new Date()
    const date2 = dateString2 ? new Date(dateString2) : new Date()
    
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return 0
    
    const diffMs = Math.abs(date2.getTime() - date1.getTime())
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  } catch (error) {
    return 0
  }
}

// 判断日期是否在另一个日期之后
const isAfter = (dateString1: string | null, dateString2: string | null): boolean => {
  try {
    const date1 = dateString1 ? new Date(dateString1) : null
    const date2 = dateString2 ? new Date(dateString2) : null
    
    if (!date1 || !date2 || isNaN(date1.getTime()) || isNaN(date2.getTime())) return false
    return date1.getTime() > date2.getTime()
  } catch (error) {
    return false
  }
}

// 判断日期是否在另一个日期之前
const isBefore = (dateString1: string | null, dateString2: string | null): boolean => {
  try {
    const date1 = dateString1 ? new Date(dateString1) : null
    const date2 = dateString2 ? new Date(dateString2) : null
    
    if (!date1 || !date2 || isNaN(date1.getTime()) || isNaN(date2.getTime())) return false
    return date1.getTime() < date2.getTime()
  } catch (error) {
    return false
  }
}

export default function UserDetailModal({ 
  isOpen, 
  onClose, 
  userDetail: rawUserDetail, 
  loading,
  onRefresh 
}: UserDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const [copied, setCopied] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [showRawData, setShowRawData] = useState(false)

// 🔥 关键优化：使用归一化的用户数据
const userDetail = useMemo(() => {
  if (!rawUserDetail) return null
  return normalizeUserDetail(rawUserDetail)
}, [rawUserDetail])

// 🔥 性能优化：缓存计算值
const {
  isPremiumUser,
  daysRemaining,
  membershipStatus,
  memberSinceDays,
  lastActiveDays,
  gameStats,
  keyStats,
  aiStats
} = useMemo(() => {
  if (!userDetail) {
    return {
      isPremiumUser: false,
      daysRemaining: 0,
      membershipStatus: 'free' as const,
      memberSinceDays: 0,
      lastActiveDays: 0,
      gameStats: null,
      keyStats: null,
      aiStats: null
    }
  }

  const now = new Date()
  
  // 会员状态
  const expiresAt = userDetail.accountExpiresAt
  const isPremiumUser = expiresAt ? isAfter(expiresAt, now.toISOString()) : false
  const daysRemaining = expiresAt ? calculateDaysDifference(expiresAt, now.toISOString()) : 0
  
  // 注册时间
  const createdAt = userDetail.createdAt
  const memberSinceDays = createdAt ? calculateDaysDifference(createdAt, now.toISOString()) : 0
  
  // 最后活跃
  const lastLoginAt = userDetail.lastLoginAt
  const lastActiveDays = lastLoginAt ? calculateDaysDifference(lastLoginAt, now.toISOString()) : -1

  // 游戏统计
  const games = userDetail.gameHistory || []
  const totalGames = games.length
  const wins = games.filter(g => g.winnerId === userDetail.id).length
  const losses = games.filter(g => g.winnerId && g.winnerId !== userDetail.id).length
  const draws = games.filter(g => !g.winnerId).length
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0

  // 密钥统计
  const keys = userDetail.accessKeys || []
  const activeKeys = keys.filter(k => k.isActive).length
  const expiredKeys = keys.filter(k => k.keyExpiresAt && isBefore(k.keyExpiresAt, now.toISOString())).length
  const usedKeys = keys.filter(k => k.usedAt).length

  // AI统计
  const aiRecords = userDetail.aiUsageRecords || []
  const successfulAiCalls = aiRecords.filter(r => r.success).length
  const failedAiCalls = aiRecords.filter(r => !r.success).length
  const aiSuccessRate = aiRecords.length > 0 ? Math.round((successfulAiCalls / aiRecords.length) * 100) : 0

  return {
    isPremiumUser,
    daysRemaining,
    membershipStatus: isPremiumUser ? 'premium' : 'free' as const,
    memberSinceDays,
    lastActiveDays,
    gameStats: {
      totalGames,
      wins,
      losses,
      draws,
      winRate,
      avgGameDuration: 0 // 需要游戏时长数据
    },
    keyStats: {
      total: keys.length,
      active: activeKeys,
      expired: expiredKeys,
      used: usedKeys,
      unused: keys.length - usedKeys
    },
    aiStats: {
      total: aiRecords.length,
      successful: successfulAiCalls,
      failed: failedAiCalls,
      successRate: aiSuccessRate,
      lastUsed: aiRecords[0]?.createdAt || null
    }
  }
}, [userDetail])

// 🔥 调试信息收集和数据验证
useEffect(() => {
  if (userDetail) {
    // 1. 收集原始调试信息
    const debugData = {
      timestamp: new Date().toISOString(),
      rawDataStructure: {
        keys: Object.keys(rawUserDetail || {}),
        hasAccessKeys: 'accessKeys' in (rawUserDetail || {}),
        hasAccessKeysAlt: 'access_keys' in (rawUserDetail || {}),
        keysCount: (rawUserDetail as any)?.accessKeys?.length || (rawUserDetail as any)?.access_keys?.length || 0
      },
      normalizedData: {
        id: userDetail.id,
        email: userDetail.email,
        accessKeysCount: userDetail.accessKeys?.length || 0,
        aiRecordsCount: userDetail.aiUsageRecords?.length || 0,
        gameHistoryCount: userDetail.gameHistory?.length || 0
      },
      dataQuality: {
        hasEmail: !!userDetail.email,
        hasAccessKeyId: !!userDetail.accessKeyId,
        isValidAccessKeyId: typeof userDetail.accessKeyId === 'number',
        hasKeysArray: Array.isArray(userDetail.accessKeys),
        hasAiArray: Array.isArray(userDetail.aiUsageRecords),
        hasGameArray: Array.isArray(userDetail.gameHistory)
      }
    }

    console.log('🔍 用户详情数据调试:', debugData)
    setDebugInfo(debugData)
    
    // 2. 🎯 新增：关键数据验证（这是我们最需要的）
    console.log('🎯 关键数据验证:', {
      '原始数据字段': Object.keys(rawUserDetail || {}),
      '原始accessKeys类型': typeof (rawUserDetail as any)?.accessKeys,
      '原始accessKeys是数组': Array.isArray((rawUserDetail as any)?.accessKeys),
      '原始accessKeys长度': (rawUserDetail as any)?.accessKeys?.length || 0,
      '原始aiUsageRecords长度': (rawUserDetail as any)?.aiUsageRecords?.length || 0,
      '---': '---',
      '归一化后accessKeys长度': userDetail.accessKeys?.length || 0,
      '归一化后aiUsageRecords长度': userDetail.aiUsageRecords?.length || 0,
      '归一化后gameHistory长度': userDetail.gameHistory?.length || 0,
      '---': '---',
      'accessKeyId值': userDetail.accessKeyId,
      'accessKeyId类型': typeof userDetail.accessKeyId
    })
    
    // 3. 🔍 详细检查每个密钥
    if (userDetail.accessKeys && userDetail.accessKeys.length > 0) {
      console.log('🗝️ 密钥详情（第一个）:', userDetail.accessKeys[0])
      console.log('🗝️ 密钥所有字段:', Object.keys(userDetail.accessKeys[0] || {}))
    } else {
      console.log('❌ 归一化后accessKeys为空数组')
    }
    
    // 4. 🔍 详细检查AI记录
    if (userDetail.aiUsageRecords && userDetail.aiUsageRecords.length > 0) {
      console.log('🤖 AI记录详情（前2条）:', userDetail.aiUsageRecords.slice(0, 2))
      console.log('🤖 AI记录字段（第一条）:', Object.keys(userDetail.aiUsageRecords[0] || {}))
    } else {
      console.log('❌ 归一化后aiUsageRecords为空数组')
    }
    
    // 5. 🔥 如果归一化后为空但原始数据不为空，说明归一化函数有问题
    const rawAccessKeysLength = (rawUserDetail as any)?.accessKeys?.length || 0
    const normalizedAccessKeysLength = userDetail.accessKeys?.length || 0
    
    if (rawAccessKeysLength > 0 && normalizedAccessKeysLength === 0) {
      console.error('🚨 数据丢失警告：原始数据有密钥但归一化后为空！')
      console.error('原始accessKeys:', (rawUserDetail as any)?.accessKeys)
      console.error('请检查 normalizeUserDetail 函数！')
    }
    
    const rawAiRecordsLength = (rawUserDetail as any)?.aiUsageRecords?.length || 0
    const normalizedAiRecordsLength = userDetail.aiUsageRecords?.length || 0
    
    if (rawAiRecordsLength > 0 && normalizedAiRecordsLength === 0) {
      console.error('🚨 数据丢失警告：原始数据有AI记录但归一化后为空！')
      console.error('原始aiUsageRecords:', (rawUserDetail as any)?.aiUsageRecords)
      console.error('请检查 normalizeUserDetail 函数！')
    }
  }
}, [userDetail, rawUserDetail])

// 🔥 自动刷新
useEffect(() => {
  if (!autoRefresh || !onRefresh) return
  
  const interval = setInterval(() => {
    console.log('🔄 自动刷新用户数据...')
    onRefresh()
    setLastRefresh(new Date())
  }, 30000) // 30秒刷新一次
  
  return () => clearInterval(interval)
}, [autoRefresh, onRefresh])

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text)
      setTimeout(() => setCopied(null), 2000)
    })
  }, [])

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh()
      setLastRefresh(new Date())
    }
  }, [onRefresh])

  // 🔥 渲染函数
  if (!isOpen) return null

  const renderLoading = () => (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-gray-300 text-lg font-medium mb-2">加载用户详情中...</p>
        <p className="text-gray-500 text-sm">正在获取用户数据、密钥记录和AI使用记录</p>
        {lastRefresh && (
          <p className="text-gray-600 text-xs mt-4">
            最后刷新: {formatDuration(lastRefresh.toISOString())}
          </p>
        )}
      </div>
    </div>
  )

  const renderError = () => (
    <div className="flex-1 flex items-center justify-center p-12">
      <div className="text-center max-w-md">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
        <h3 className="text-xl font-semibold text-white mb-2">无法加载用户数据</h3>
        <p className="text-gray-400 mb-6">可能的原因：用户不存在、数据损坏或网络问题</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
          >
            关闭
          </button>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              重试
            </button>
          )}
        </div>
      </div>
    </div>
  )

  const renderTabs = () => [
    { id: 'info', label: '基本信息', icon: User, badge: null },
    { 
      id: 'keys', 
      label: '密钥记录', 
      icon: Key, 
      badge: keyStats?.total || 0,
      description: `${keyStats?.used || 0}已使用`
    },
    { 
      id: 'ai', 
      label: 'AI使用', 
      icon: Brain, 
      badge: aiStats?.total || 0,
      description: `${aiStats?.successRate || 0}%成功率`
    },
    { 
      id: 'games', 
      label: '游戏记录', 
      icon: Gamepad2, 
      badge: gameStats?.totalGames || 0,
      description: `${gameStats?.winRate || 0}%胜率`
    },
    { 
      id: 'debug', 
      label: '调试信息', 
      icon: Database, 
      badge: null,
      description: '开发者'
    }
  ]

  const renderHeader = () => (
    <div className="flex items-center justify-between p-6 border-b border-gray-700/50 bg-gradient-to-r from-gray-800 to-gray-900">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg">
            <User className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">用户详情</h2>
            {userDetail && (
              <div className="flex items-center gap-3 mt-1">
                <p className="text-gray-300 flex items-center">
                  <Mail className="w-4 h-4 mr-1.5" />
                  {userDetail.email}
                </p>
                <span className="text-gray-500">•</span>
                <code className="text-xs bg-gray-800 px-2 py-1 rounded font-mono text-gray-400">
                  ID: {userDetail.id?.substring?.(0, 8)}...
                </code>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors group"
            title="刷新数据"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 group-hover:text-blue-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          title="关闭"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </div>
  )

  const renderInfoTab = () => (
    <div className="space-y-6">
      {/* 用户状态卡片 */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${isPremiumUser ? 'bg-gradient-to-br from-amber-600 to-amber-800' : 'bg-gradient-to-br from-gray-700 to-gray-800'}`}>
              {isPremiumUser ? <Crown className="w-6 h-6 text-white" /> : <Users className="w-6 h-6 text-gray-300" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">会员状态</h3>
              <p className="text-gray-400 text-sm">
                {membershipStatus === 'premium' ? '高级会员' : '免费用户'}
              </p>
            </div>
          </div>
          {isPremiumUser ? (
            <div className="text-right">
              <div className="text-2xl font-bold text-amber-400">{daysRemaining}天</div>
              <div className="text-gray-400 text-sm">剩余有效期</div>
            </div>
          ) : (
            <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg text-white text-sm font-medium transition-all">
              升级会员
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock3 className="w-4 h-4 text-blue-400" />
              <p className="text-sm text-gray-400">会员时长</p>
            </div>
            <p className="text-white text-xl font-semibold">{memberSinceDays}天</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-green-400" />
              <p className="text-sm text-gray-400">最后活跃</p>
            </div>
            <p className="text-white text-xl font-semibold">
              {lastActiveDays >= 0 ? `${lastActiveDays}天前` : '从未'}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Hash className="w-4 h-4 text-purple-400" />
              <p className="text-sm text-gray-400">用户ID</p>
            </div>
            <div className="flex items-center">
              <code className="text-white text-sm font-mono truncate">{userDetail?.id?.substring(0, 12)}...</code>
              <button
                onClick={() => copyToClipboard(userDetail?.id || '')}
                className="ml-2 p-1 hover:bg-gray-700 rounded"
              >
                <Copy className="w-3 h-3 text-gray-400" />
              </button>
            </div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <p className="text-sm text-gray-400">当前会话</p>
            </div>
            <p className="text-white text-sm truncate">
              {userDetail?.lastLoginSession?.substring(0, 16) || '无'}...
            </p>
          </div>
        </div>
      </div>

      {/* 基本信息网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-blue-400" />
            <h4 className="text-white font-medium">联系信息</h4>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">邮箱地址</p>
              <div className="flex items-center justify-between">
                <p className="text-white truncate">{userDetail?.email}</p>
                <button
                  onClick={() => copyToClipboard(userDetail?.email || '')}
                  className="ml-2 p-1.5 hover:bg-gray-700 rounded"
                >
                  {copied === userDetail?.email ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">昵称</p>
              <p className="text-white">{userDetail?.nickname || '未设置'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">个人简介</p>
              <p className="text-gray-300 text-sm">{userDetail?.bio || '暂无介绍'}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-400" />
            <h4 className="text-white font-medium">时间信息</h4>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">注册时间</p>
              <p className="text-white">{formatDateTime(userDetail?.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">最后登录</p>
              <p className="text-white">{formatDateTime(userDetail?.lastLoginAt)}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {formatRelativeTime(userDetail?.lastLoginAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">最后更新</p>
              <p className="text-white">{formatDateTime(userDetail?.updatedAt)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-green-400" />
            <h4 className="text-white font-medium">账户信息</h4>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">会员到期</p>
              <p className="text-white">{formatDateTime(userDetail?.accountExpiresAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">当前密钥ID</p>
              <p className="text-white font-mono">{userDetail?.accessKeyId || '无'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">用户偏好</p>
              <pre className="text-gray-300 text-xs bg-gray-800/30 p-2 rounded overflow-x-auto">
                {JSON.stringify(userDetail?.preferences || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* 当前使用的密钥 */}
      {userDetail?.accessKeyId && (userDetail.accessKeys || []).length > 0 && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-amber-400" />
            <h4 className="text-white font-medium">当前使用的密钥</h4>
          </div>
          {(() => {
            const currentKey = userDetail.accessKeys.find(k => k.id === userDetail.accessKeyId)
            if (!currentKey) return null
            
            const isExpired = currentKey.keyExpiresAt && isBefore(currentKey.keyExpiresAt, new Date().toISOString())
            
            return (
              <div className={`bg-gradient-to-r ${isExpired ? 'from-red-900/20 to-red-800/10 border-red-700/30' : 'from-amber-900/20 to-amber-800/10 border-amber-700/30'} rounded-lg p-4 border`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-black/30 rounded">
                      <Key className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <code className="text-lg font-mono text-white">{currentKey.keyCode}</code>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                          正在使用
                        </span>
                        {isExpired && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                            已过期
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(currentKey.keyCode)}
                      className="p-2 hover:bg-gray-700 rounded"
                    >
                      {copied === currentKey.keyCode ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-gray-400">有效天数</p>
                    <p className="text-white">{currentKey.accountValidForDays}天</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">使用状态</p>
                    <p className={`text-sm ${currentKey.usedAt ? 'text-green-400' : 'text-gray-400'}`}>
                      {currentKey.usedAt ? '已使用' : '未使用'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">使用次数</p>
                    <p className="text-white">{currentKey.usedCount}/{currentKey.maxUses}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">过期时间</p>
                    <p className={`text-sm ${isExpired ? 'text-red-400' : 'text-white'}`}>
                      {formatDateTime(currentKey.keyExpiresAt) || '无限制'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )

  const renderKeysTab = () => (
    <div className="space-y-6">
      {/* 密钥统计 */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-600 to-amber-800 rounded-lg">
              <Key className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">密钥统计</h3>
              <p className="text-gray-400 text-sm">用户使用过的所有访问密钥</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{keyStats?.total || 0}</div>
            <div className="text-gray-400 text-sm">总密钥数</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm text-gray-400">激活状态</p>
            </div>
            <p className="text-white text-2xl font-semibold">{keyStats?.active || 0}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <p className="text-sm text-gray-400">已使用</p>
            </div>
            <p className="text-white text-2xl font-semibold">{keyStats?.used || 0}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <p className="text-sm text-gray-400">已过期</p>
            </div>
            <p className="text-white text-2xl font-semibold">{keyStats?.expired || 0}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
              <p className="text-sm text-gray-400">未使用</p>
            </div>
            <p className="text-white text-2xl font-semibold">{keyStats?.unused || 0}</p>
          </div>
        </div>
      </div>

      {/* 密钥列表 */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">密钥记录</h3>
        
        {(!userDetail?.accessKeys || userDetail.accessKeys.length === 0) ? (
          <div className="text-center py-8">
            <Key className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">暂无密钥记录</p>
            <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
              该用户尚未使用或分配任何密钥。密钥可以通过密钥管理页面生成并分配给用户。
            </p>
            <div className="mt-6 p-4 bg-gray-800/30 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-gray-400 mb-2">数据说明：</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• 密钥记录通过 user_id 字段关联用户</li>
                <li>• 当前使用的密钥通过 access_key_id 字段关联</li>
                <li>• 如果两个字段都为空，则不会显示记录</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">密钥代码</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">状态</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">使用情况</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">有效天数</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">过期时间</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {userDetail.accessKeys.map((key: AccessKey, index: number) => {
                  const isCurrentKey = key.id === userDetail.accessKeyId
                  const isExpired = key.keyExpiresAt && isBefore(key.keyExpiresAt, new Date().toISOString())
                  const isUsed = !!key.usedAt
                  
                  return (
                    <tr 
                      key={key.id || index} 
                      className={`border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors ${
                        isCurrentKey ? 'bg-amber-900/10' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <code className={`text-sm px-3 py-2 rounded font-mono ${
                            isCurrentKey 
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                              : 'bg-gray-900 text-gray-300 border border-gray-700'
                          }`}>
                            {key.keyCode}
                          </code>
                          {isCurrentKey && (
                            <span className="ml-2 px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full whitespace-nowrap">
                              当前使用
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1.5">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            !key.isActive
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {key.isActive ? '激活' : '停用'}
                          </span>
                          {isExpired && (
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded">
                              已过期
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <span className="text-white font-medium mr-2">
                            {key.usedCount}/{key.maxUses}
                          </span>
                          {isUsed && (
                            <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">
                              已使用
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-white">{key.accountValidForDays}天</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className={`text-sm ${isExpired ? 'text-red-400' : 'text-gray-300'}`}>
                            {formatDateTime(key.keyExpiresAt) || '无限制'}
                          </span>
                          {key.keyExpiresAt && (
                            <span className="text-gray-500 text-xs">
                              {isExpired ? '已过期' : `剩余${calculateDaysDifference(key.keyExpiresAt, new Date().toISOString())}天`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => copyToClipboard(key.keyCode)}
                          className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                          title="复制密钥"
                        >
                          {copied === key.keyCode ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )

  const renderAiTab = () => (
    <div className="space-y-6">
      {/* AI使用统计 */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI使用统计</h3>
              <p className="text-gray-400 text-sm">用户调用AI功能的历史记录</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{aiStats?.total || 0}</div>
            <div className="text-gray-400 text-sm">总调用次数</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm text-gray-400">成功调用</p>
            </div>
            <p className="text-white text-2xl font-semibold">{aiStats?.successful || 0}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <p className="text-sm text-gray-400">失败调用</p>
            </div>
            <p className="text-white text-2xl font-semibold">{aiStats?.failed || 0}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <p className="text-sm text-gray-400">成功率</p>
            </div>
            <p className="text-white text-2xl font-semibold">{aiStats?.successRate || 0}%</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <p className="text-sm text-gray-400">最后使用</p>
            </div>
            <p className="text-white text-sm truncate">{formatRelativeTime(aiStats?.lastUsed)}</p>
          </div>
        </div>
      </div>

      {/* AI记录列表 */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">AI调用记录</h3>
        
        {(!userDetail?.aiUsageRecords || userDetail.aiUsageRecords.length === 0) ? (
          <div className="text-center py-8">
            <Brain className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">暂无AI使用记录</p>
            <p className="text-gray-500 text-sm mt-2">
              该用户尚未使用AI功能。AI功能包括任务生成、主题建议等。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {userDetail.aiUsageRecords.map((record: AiUsageRecord, index: number) => (
              <div 
                key={record.id || index} 
                className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 hover:border-gray-600/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded ${record.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      <Brain className={`w-5 h-5 ${record.success ? 'text-green-400' : 'text-red-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{record.feature}</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          record.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {record.success ? '成功' : '失败'}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                          #{record.id}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        {formatDateTime(record.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(JSON.stringify({
                        request: record.requestData,
                        response: record.responseData
                      }, null, 2))}
                      className="p-1.5 hover:bg-gray-700 rounded"
                      title="复制记录"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-400">请求数据</p>
                      <span className="text-xs text-gray-500">
                        {record.requestData ? Object.keys(record.requestData).length : 0}个字段
                      </span>
                    </div>
                    <div className="relative">
                      <pre className="text-xs bg-gray-900/50 p-3 rounded overflow-x-auto max-h-48">
                        {record.requestData ? JSON.stringify(record.requestData, null, 2) : '{}'}
                      </pre>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-400">响应数据</p>
                      <span className="text-xs text-gray-500">
                        {record.responseData ? Object.keys(record.responseData).length : 0}个字段
                      </span>
                    </div>
                    <div className="relative">
                      <pre className="text-xs bg-gray-900/50 p-3 rounded overflow-x-auto max-h-48">
                        {record.responseData ? JSON.stringify(record.responseData, null, 2) : '{}'}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderGamesTab = () => (
    <div className="space-y-6">
      {/* 游戏统计 */}
      {gameStats && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">游戏统计</h3>
                <p className="text-gray-400 text-sm">用户游戏对局数据统计</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{gameStats.totalGames}</div>
              <div className="text-gray-400 text-sm">总对局数</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-4 h-4 text-green-400" />
                <p className="text-sm text-gray-400">胜场</p>
              </div>
              <p className="text-white text-2xl font-semibold">{gameStats.wins}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-sm text-gray-400">负场</p>
              </div>
              <p className="text-white text-2xl font-semibold">{gameStats.losses}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-400">平局</p>
              </div>
              <p className="text-white text-2xl font-semibold">{gameStats.draws}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <p className="text-sm text-gray-400">胜率</p>
              </div>
              <p className="text-white text-2xl font-semibold">{gameStats.winRate}%</p>
            </div>
          </div>
        </div>
      )}

      {/* 游戏记录列表 */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">游戏历史记录</h3>
        
        {(!userDetail?.gameHistory || userDetail.gameHistory.length === 0) ? (
          <div className="text-center py-8">
            <Gamepad2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">暂无游戏记录</p>
            <p className="text-gray-500 text-sm mt-2">
              该用户尚未进行任何游戏。游戏记录在游戏结束后自动生成。
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">游戏时间</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">对手</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">结果</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">时长</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">任务完成</th>
                </tr>
              </thead>
              <tbody>
                {userDetail.gameHistory.map((game: GameHistory, index: number) => {
                  const isPlayer1 = game.player1Id === userDetail.id
                  const opponentId = isPlayer1 ? game.player2Id : game.player1Id
                  
                  // 计算游戏时长
                  let duration = '未知'
                  if (game.startedAt && game.endedAt) {
                    try {
                      const start = new Date(game.startedAt)
                      const end = new Date(game.endedAt)
                      const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
                      duration = minutes > 60 
                        ? `${Math.floor(minutes / 60)}小时${minutes % 60}分钟` 
                        : `${minutes}分钟`
                    } catch {
                      duration = '计算错误'
                    }
                  }
                  
                  // 计算任务完成情况
                  const taskResults = game.taskResults || []
                  const completedTasks = taskResults.filter((task: any) => task.completed).length
                  const totalTasks = taskResults.length
                  
                  return (
                    <tr key={game.id || index} className="border-b border-gray-700/30 hover:bg-gray-800/30">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-gray-300 text-sm">{formatDateTime(game.startedAt)}</span>
                          <span className="text-gray-500 text-xs">
                            {game.roomId ? `房间: ${game.roomId.substring(0, 8)}...` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-gray-300">
                          {opponentId ? opponentId.substring(0, 12) + '...' : '未知对手'}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          game.winnerId === userDetail.id
                            ? 'bg-green-500/20 text-green-400'
                            : game.winnerId && game.winnerId !== userDetail.id
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {game.winnerId === userDetail.id
                            ? '胜利'
                            : game.winnerId && game.winnerId !== userDetail.id
                            ? '失败'
                            : '平局'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 text-gray-400 mr-1" />
                          <span className="text-gray-300">{duration}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <span className="text-gray-300 mr-2">
                            {totalTasks > 0 ? `${completedTasks}/${totalTasks}` : '无'}
                          </span>
                          {totalTasks > 0 && (
                            <div className="w-16 bg-gray-700 rounded-full h-1.5">
                              <div 
                                className="bg-green-500 h-1.5 rounded-full" 
                                style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                              ></div>
                            </div>
                          )}
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
    </div>
  )

  const renderDebugTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">调试信息</h3>
              <p className="text-gray-400 text-sm">数据结构和查询状态</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              自动刷新
            </label>
            <button
              onClick={() => setShowRawData(!showRawData)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
            >
              {showRawData ? '隐藏原始数据' : '显示原始数据'}
            </button>
          </div>
        </div>

        {/* 数据状态 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">API字段检测</p>
            <p className="text-white font-mono text-sm">
              {debugInfo?.rawDataStructure?.hasAccessKeys ? '驼峰' : 
               debugInfo?.rawDataStructure?.hasAccessKeysAlt ? '下划线' : '未知'}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">原始密钥数</p>
            <p className="text-white text-xl font-bold">
              {debugInfo?.rawDataStructure?.keysCount || 0}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">归一化密钥数</p>
            <p className="text-white text-xl font-bold">
              {debugInfo?.normalizedData?.accessKeysCount || 0}
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">当前密钥ID</p>
            <p className="text-white font-mono">
              {userDetail?.accessKeyId || 'null'}
            </p>
          </div>
        </div>

        {/* 原始数据展示 */}
        {showRawData && debugInfo && (
          <div className="mb-6">
            <h4 className="text-white font-medium mb-3">原始API响应</h4>
            <pre className="text-xs bg-gray-900/50 p-4 rounded-lg overflow-x-auto max-h-96">
              {JSON.stringify(rawUserDetail, null, 2)}
            </pre>
          </div>
        )}

        {/* 数据质量检查 */}
        <div className="bg-gray-800/30 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3">数据质量检查</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {debugInfo?.dataQuality && Object.entries(debugInfo.dataQuality).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-gray-300 text-sm">{key}</span>
                <span className="text-gray-500 text-xs">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 操作面板 */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">操作面板</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => {
              const info = `用户详情报告\n` +
                         `邮箱: ${userDetail?.email}\n` +
                         `ID: ${userDetail?.id}\n` +
                         `昵称: ${userDetail?.nickname || '未设置'}\n` +
                         `会员: ${isPremiumUser ? `剩余${daysRemaining}天` : '免费用户'}\n` +
                         `注册: ${formatDateTime(userDetail?.createdAt)}\n` +
                         `最后登录: ${formatDateTime(userDetail?.lastLoginAt)}\n` +
                         `密钥记录: ${keyStats?.total || 0}条\n` +
                         `AI记录: ${aiStats?.total || 0}条\n` +
                         `游戏记录: ${gameStats?.totalGames || 0}条`
              copyToClipboard(info)
              alert('用户报告已复制到剪贴板')
            }}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors flex flex-col items-center justify-center"
          >
            <Copy className="w-5 h-5 mb-2" />
            <span>复制用户报告</span>
          </button>
          
          <button
            onClick={() => {
              console.log('当前用户详情数据:', {
                原始数据: rawUserDetail,
                归一化数据: userDetail,
                调试信息: debugInfo
              })
              alert('数据已打印到控制台')
            }}
            className="px-4 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors flex flex-col items-center justify-center"
          >
            <Database className="w-5 h-5 mb-2" />
            <span>打印到控制台</span>
          </button>
          
          <button
            onClick={() => {
              fetch(`/api/admin/data?table=profiles&detailId=${userDetail?.id}`)
                .then(r => r.json())
                .then(data => {
                  console.log('实时API测试:', data)
                  alert('API测试完成，结果在控制台')
                })
                .catch(err => {
                  console.error('API测试失败:', err)
                  alert('API测试失败，详情在控制台')
                })
            }}
            className="px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors flex flex-col items-center justify-center"
          >
            <RefreshCw className="w-5 h-5 mb-2" />
            <span>测试API连接</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-800 shadow-2xl">
        {/* 头部 */}
        {renderHeader()}
        
        {/* 加载状态 */}
        {loading && renderLoading()}
        
        {/* 错误状态 */}
        {!loading && !userDetail && renderError()}
        
        {/* 内容区域 */}
        {!loading && userDetail && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* 标签页导航 */}
            <div className="border-b border-gray-800 bg-gradient-to-r from-gray-800/50 to-gray-900/50 px-6">
              <div className="flex overflow-x-auto">
                {renderTabs().map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  
                  return (
                    <button
                      key={tab.id}
                      className={`flex items-center px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'border-blue-500 text-blue-400 bg-gradient-to-r from-blue-500/5 to-blue-500/10'
                          : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {tab.label}
                      {tab.badge !== null && (
                        <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full min-w-[20px] flex items-center justify-center ${
                          isActive 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-gray-700 text-gray-400'
                        }`}>
                          {tab.badge}
                        </span>
                      )}
                      {tab.description && (
                        <span className="ml-2 text-xs text-gray-500 hidden lg:inline">
                          {tab.description}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 标签页内容 */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'info' && renderInfoTab()}
              {activeTab === 'keys' && renderKeysTab()}
              {activeTab === 'ai' && renderAiTab()}
              {activeTab === 'games' && renderGamesTab()}
              {activeTab === 'debug' && renderDebugTab()}
            </div>
          </div>
        )}

        {/* 底部 */}
        <div className="flex justify-between items-center p-6 border-t border-gray-800 bg-gradient-to-r from-gray-900 to-gray-950">
          <div className="text-sm text-gray-500">
            {userDetail && (
              <div className="flex items-center gap-4">
                <span>最后更新: {formatDateTime(userDetail.updatedAt)}</span>
                {lastRefresh && (
                  <span>• 上次刷新: {formatRelativeTime(lastRefresh.toISOString())}</span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                const userInfo = {
                  id: userDetail?.id,
                  email: userDetail?.email,
                  nickname: userDetail?.nickname,
                  isPremium: isPremiumUser,
                  stats: {
                    keys: keyStats?.total,
                    ai: aiStats?.total,
                    games: gameStats?.totalGames
                  }
                }
                console.log('导出用户信息:', userInfo)
                copyToClipboard(JSON.stringify(userInfo, null, 2))
                alert('用户信息已复制为JSON')
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors flex items-center"
            >
              <Database className="w-4 h-4 mr-2" />
              导出JSON
            </button>
            
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
