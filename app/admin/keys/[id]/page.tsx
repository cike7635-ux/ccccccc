// /app/admin/keys/[id]/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, Key, Copy, Check, AlertCircle, 
  User, Calendar, Clock, Shield, Loader2,
  ExternalLink, Ban, Eye, EyeOff, Trash2, Edit
} from 'lucide-react'
import Link from 'next/link'

export default function KeyDetailPage() {
  const params = useParams()
  const router = useRouter()
  const keyId = params.id as string
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyData, setKeyData] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!keyId) return
    
    const fetchKeyDetail = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/admin/keys/${keyId}`, {
          credentials: 'include'
        })
        
        if (!response.ok) {
          throw new Error(`获取密钥详情失败 (${response.status})`)
        }
        
        const result = await response.json()
        if (result.success) {
          console.log('密钥详情数据:', result.data)
          setKeyData(result.data)
        } else {
          throw new Error(result.error || '获取数据失败')
        }
      } catch (error: any) {
        console.error('获取密钥详情失败:', error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }
    
    fetchKeyDetail()
  }, [keyId])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getKeyStatus = (key: any) => {
    const now = new Date()
    if (!key.is_active) return 'disabled'
    if (key.key_expires_at && new Date(key.key_expires_at) < now) return 'expired'
    if (key.used_at !== null || key.user_id !== null) return 'used'
    return 'unused'
  }

  const getDurationDisplay = (key: any): string => {
    if (key.original_duration_hours) {
      const hours = parseFloat(key.original_duration_hours)
      if (hours < 24) {
        return `${hours}小时`
      } else {
        const days = Math.round(hours / 24)
        return `${days}天`
      }
    }
    return `${key.account_valid_for_days}天`
  }

  if (loading) {
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
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">加载失败</h3>
            <p className="text-red-400 mb-4">{error}</p>
            <Link
              href="/admin/keys"
              className="inline-flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回密钥列表
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!keyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Key className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">未找到密钥</h3>
            <p className="text-gray-500 mb-4">该密钥不存在或已被删除</p>
            <Link
              href="/admin/keys"
              className="inline-flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回密钥列表
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const key = keyData.key_info
  const status = getKeyStatus(key)
  const statusColors: Record<string, string> = {
    unused: 'text-amber-400 bg-amber-500/15',
    used: 'text-green-400 bg-green-500/15',
    expired: 'text-red-400 bg-red-500/15',
    disabled: 'text-gray-400 bg-gray-500/15'
  }
  const statusLabels: Record<string, string> = {
    unused: '未使用',
    used: '已使用',
    expired: '已过期',
    disabled: '已禁用'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
      {/* 返回按钮 */}
      <div className="mb-6">
        <Link
          href="/admin/keys"
          className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回密钥列表
        </Link>
      </div>

      {/* 标题和操作 */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
              <Key className="w-6 h-6 md:w-7 md:h-7 mr-2 text-amber-400" />
              密钥详情
            </h1>
            <p className="text-gray-400 mt-2">密钥ID: {key.id}</p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(key.key_code)}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded-lg text-white flex items-center"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  复制密钥
                </>
              )}
            </button>
            
            <Link
              href="/admin/keys"
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回列表
            </Link>
          </div>
        </div>
      </div>

      {/* 主要信息卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 左侧：基本信息 */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Key className="w-5 h-5 mr-2 text-amber-400" />
            基本信息
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">密钥代码</label>
              <code className="bg-gray-900 px-3 py-2 rounded-lg font-mono text-white block break-all">
                {key.key_code}
              </code>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">描述</label>
              <p className="text-white">{key.description || '无描述'}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">状态</label>
                <div className={`inline-flex items-center px-3 py-1 rounded-full ${statusColors[status]}`}>
                  <span className="text-sm font-medium">{statusLabels[status]}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">激活状态</label>
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${key.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={key.is_active ? 'text-green-400' : 'text-red-400'}>
                    {key.is_active ? '已激活' : '未激活'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：使用信息 */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-blue-400" />
            使用信息
          </h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">使用次数</label>
                <p className="text-xl font-bold text-white">
                  {key.used_count || 0}
                  {key.max_uses ? ` / ${key.max_uses}` : ' / ∞'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">有效期</label>
                <p className="text-xl font-bold text-amber-400">
                  {getDurationDisplay(key)}
                </p>
              </div>
            </div>
            
            {key.profiles && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">使用者</label>
                <div className="flex items-center p-3 bg-gray-900/50 rounded-lg">
                  <User className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-white">{key.profiles.email}</p>
                    {key.profiles.nickname && (
                      <p className="text-gray-400 text-sm">昵称: {key.profiles.nickname}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">使用时间</label>
              <p className="text-white">
                {key.used_at ? new Date(key.used_at).toLocaleString('zh-CN') : '未使用'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 时间信息卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            创建时间
          </h3>
          <p className="text-white text-lg">
            {new Date(key.created_at).toLocaleString('zh-CN')}
          </p>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            最后更新
          </h3>
          <p className="text-white text-lg">
            {new Date(key.updated_at).toLocaleString('zh-CN')}
          </p>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            过期时间
          </h3>
          <p className="text-white text-lg">
            {key.key_expires_at 
              ? new Date(key.key_expires_at).toLocaleString('zh-CN')
              : '永不过期'}
          </p>
        </div>
      </div>

      {/* 使用历史（如果有） */}
      {keyData.usage_history && keyData.usage_history.length > 0 && (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">使用历史</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">时间</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">使用者</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">使用类型</th>
                </tr>
              </thead>
              <tbody>
                {keyData.usage_history.map((history: any) => (
                  <tr key={history.id} className="border-b border-gray-700/30">
                    <td className="py-3 px-4 text-gray-300 text-sm">
                      {new Date(history.used_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-3 px-4 text-gray-300 text-sm">
                      {history.profiles?.email || history.user_id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                        {history.usage_type || '激活'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 操作区域 */}
      <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">操作</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              const action = key.is_active ? '禁用' : '启用'
              if (confirm(`确定要${action}这个密钥吗？`)) {
                // TODO: 实现启用/禁用逻辑
                console.log(`${action}密钥 ${key.id}`)
              }
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white flex items-center"
          >
            {key.is_active ? (
              <>
                <Ban className="w-4 h-4 mr-2" />
                禁用密钥
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                启用密钥
              </>
            )}
          </button>
          
          <button
            onClick={() => {
              if (confirm('确定要删除这个密钥吗？此操作不可撤销！')) {
                // TODO: 实现删除逻辑
                console.log('删除密钥', key.id)
              }
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white flex items-center"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            删除密钥
          </button>
        </div>
      </div>
    </div>
  )
}