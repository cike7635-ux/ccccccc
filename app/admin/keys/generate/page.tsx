// /app/admin/keys/generate/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { 
  Key, ArrowLeft, Plus, Copy, Check, RefreshCw, Download, 
  Clock, Users, Hash, Tag, AlertCircle, Sparkles, Calendar,
  Settings, X, Save, AlertTriangle, CalendarDays, Timer
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function GenerateKeysPage() {
  const router = useRouter()
  
  // 表单状态
  const [durationHours, setDurationHours] = useState<number>(24) // 默认24小时（1天）
  const [maxUses, setMaxUses] = useState<number | null>(1)
  const [count, setCount] = useState<number>(1)
  const [prefix, setPrefix] = useState<string>('XY')
  const [customPrefix, setCustomPrefix] = useState<boolean>(false)
  const [description, setDescription] = useState<string>('')
  
  // 激活截止时间设置
  const [activationDeadlineType, setActivationDeadlineType] = useState<'relative' | 'absolute'>('relative')
  const [activationDeadlineDays, setActivationDeadlineDays] = useState<number>(365)
  const [activationDeadlineDate, setActivationDeadlineDate] = useState<string>('')
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false)
  
  // 结果状态
  const [generatedKeys, setGeneratedKeys] = useState<any[]>([])
  const [generating, setGenerating] = useState<boolean>(false)
  const [copiedAll, setCopiedAll] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 时长选项（单位：小时）
  const durationOptions = [
    { hours: 1, label: '1小时', display: '1小时', key: '1h' },
    { hours: 2, label: '2小时', display: '2小时', key: '2h' },
    { hours: 4, label: '4小时', display: '4小时', key: '4h' },
    { hours: 12, label: '12小时', display: '12小时', key: '12h' },
    { hours: 24, label: '1天', display: '1天', key: '1d' },
    { hours: 48, label: '2天', display: '2天', key: '2d' },
    { hours: 168, label: '7天', display: '7天', key: '7d' },
    { hours: 720, label: '30天', display: '30天', key: '30d' },
    { hours: 2160, label: '90天', display: '3个月', key: '90d' },
    { hours: 4320, label: '180天', display: '6个月', key: '180d' },
    { hours: 8760, label: '365天', display: '1年', key: '365d' },
    { hours: -1, label: 'custom', display: '自定义', key: 'custom' }
  ]

  // 使用次数选项
  const maxUsesOptions = [
    { value: 1, label: '1次' },
    { value: 2, label: '2次' },
    { value: 4, label: '4次' },
    { value: 10, label: '10次' },
    { value: null, label: '无限次' }
  ]

  // 预设前缀选项
  const prefixOptions = [
    { value: 'XY', label: 'XY (系统默认)' },
    { value: 'VIP', label: 'VIP (会员专用)' },
    { value: 'TEST', label: 'TEST (测试专用)' },
    { value: 'PROMO', label: 'PROMO (促销活动)' },
    { value: 'LOVE', label: 'LOVE (情侣专用)' }
  ]

  // 激活截止时间选项
  const activationDeadlineOptions = [
    { days: 7, label: '7天内必须激活' },
    { days: 30, label: '30天内必须激活' },
    { days: 90, label: '90天内必须激活' },
    { days: 180, label: '半年内必须激活' },
    { days: 365, label: '1年内必须激活（默认）' },
    { days: 730, label: '2年内必须激活' }
  ]

  // 处理时长选择
  const handleDurationSelect = (hours: number) => {
    if (hours === -1) {
      // 显示自定义输入框（在高级设置中）
      setShowAdvancedSettings(true)
    } else {
      setDurationHours(hours)
    }
  }

  // 处理自定义时长输入
  const handleCustomDurationChange = (hours: number) => {
    if (hours >= 0.25 && hours <= 87600) { // 15分钟到10年
      setDurationHours(hours)
    }
  }

  // 格式化时长显示
  const formatDuration = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60)
      return `${minutes}分钟`
    } else if (hours < 24) {
      return `${hours}小时`
    } else if (hours < 24 * 30) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      if (remainingHours === 0) {
        return `${days}天`
      } else {
        return `${days}天${remainingHours}小时`
      }
    } else if (hours < 24 * 365) {
      const months = Math.floor(hours / (24 * 30))
      const remainingDays = Math.floor((hours % (24 * 30)) / 24)
      if (remainingDays === 0) {
        return `${months}个月`
      } else {
        return `${months}个月${remainingDays}天`
      }
    } else {
      const years = Math.floor(hours / (24 * 365))
      const remainingMonths = Math.floor((hours % (24 * 365)) / (24 * 30))
      if (remainingMonths === 0) {
        return `${years}年`
      } else {
        return `${years}年${remainingMonths}个月`
      }
    }
  }

  // 生成时长代码（用于密钥格式）
  const getDurationCode = (hours: number): string => {
    if (hours < 24) {
      return `${hours}H`
    } else if (hours < 24 * 30) {
      const days = Math.floor(hours / 24)
      return `${days}D`
    } else if (hours < 24 * 365) {
      const months = Math.round(hours / (24 * 30))
      return `${months}M`
    } else {
      const years = Math.round(hours / (24 * 365))
      return `${years}Y`
    }
  }

  // 清除消息
  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  // 生成密钥
  const handleGenerateKeys = async () => {
    if (generating) return
    
    try {
      setGenerating(true)
      setError(null)
      setGeneratedKeys([])

      // 准备请求数据
      const requestData = {
        count,
        prefix,
        duration: durationHours, // 直接传递小时数
        max_uses: maxUses,
        description: description || undefined,
        activation_deadline_days: activationDeadlineType === 'relative' ? activationDeadlineDays : undefined,
        activation_deadline_type: activationDeadlineType,
        ...(activationDeadlineType === 'absolute' && activationDeadlineDate && {
          activation_deadline_date: activationDeadlineDate
        })
      }

      console.log('📤 发送请求数据:', requestData)

      const response = await fetch('/api/admin/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        credentials: 'include'
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || `请求失败 (${response.status})`)
      }

      if (!result.success) {
        throw new Error(result.error || '生成密钥失败')
      }

      console.log('✅ 生成结果:', result.data)

      // 保存生成的密钥
      setGeneratedKeys(result.data.keys || [])
      setSuccess(result.message || `成功生成 ${result.data.generated_count || 0} 个密钥`)

    } catch (error: any) {
      console.error('❌ 生成密钥失败:', error)
      setError(`生成密钥失败: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

  // 复制所有密钥
  const copyAllKeys = () => {
    if (generatedKeys.length === 0) return
    
    const keysText = generatedKeys.map(k => k.key_code).join('\n')
    navigator.clipboard.writeText(keysText)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  // 下载密钥
  const downloadKeys = () => {
    if (generatedKeys.length === 0) return
    
    const keysText = generatedKeys.map(k => 
      `${k.key_code} | ${formatDuration(k.original_duration_hours)} | 激活截止: ${new Date(k.key_expires_at).toLocaleDateString('zh-CN')}`
    ).join('\n')
    
    const blob = new Blob([keysText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `love-ludo-keys_${new Date().toISOString().split('T')[0]}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  // 清除生成的密钥
  const clearKeys = () => {
    setGeneratedKeys([])
    setSuccess(null)
  }

  // 初始化激活截止日期
  useEffect(() => {
    const today = new Date()
    const oneYearLater = new Date(today)
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
    setActivationDeadlineDate(oneYearLater.toISOString().split('T')[0])
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
      {/* 页面标题 */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link
              href="/admin/keys"
              className="mr-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
                <Key className="w-6 h-6 md:w-7 md:h-7 mr-2 text-amber-400" />
                生成新密钥
              </h1>
              <p className="text-gray-400 mt-2">
                创建带有激活截止时间和使用时长限制的访问密钥
                {generatedKeys.length > 0 && (
                  <span className="ml-2 text-amber-400">
                    • 已生成 {generatedKeys.length} 个密钥
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
              <p className="text-red-400">{error}</p>
            </div>
            <button onClick={clearMessages} className="p-1 hover:bg-red-500/20 rounded">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Check className="w-5 h-5 text-green-400 mr-3" />
              <p className="text-green-400">{success}</p>
            </div>
            <button onClick={clearMessages} className="p-1 hover:bg-green-500/20 rounded">
              <X className="w-4 h-4 text-green-400" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* 左侧：配置表单 */}
        <div className="space-y-6">
          {/* 配置卡片 */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-amber-400" />
              密钥配置
            </h2>
            
            <div className="space-y-6">
              {/* 时长选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-blue-400" />
                  用户使用时长（激活后可使用）
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {durationOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleDurationSelect(option.hours)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        durationHours === option.hours
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {option.display}
                    </button>
                  ))}
                </div>
                
                <div className="mt-3 p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-400 text-sm">
                    <span className="text-blue-400">当前选择:</span> {formatDuration(durationHours)}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    密钥格式: {prefix}-{getDurationCode(durationHours)}-XXXXXXXX
                  </p>
                </div>
              </div>

              {/* 激活截止时间设置 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-purple-400" />
                  激活截止时间（必须在此时间前激活）
                </label>
                
                <div className="space-y-3">
                  {/* 类型选择 */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActivationDeadlineType('relative')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activationDeadlineType === 'relative'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      相对时间
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivationDeadlineType('absolute')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activationDeadlineType === 'absolute'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      绝对日期
                    </button>
                  </div>

                  {/* 相对时间选项 */}
                  {activationDeadlineType === 'relative' && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {activationDeadlineOptions.map((option) => (
                        <button
                          key={option.days}
                          type="button"
                          onClick={() => setActivationDeadlineDays(option.days)}
                          className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                            activationDeadlineDays === option.days
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 绝对日期选择 */}
                  {activationDeadlineType === 'absolute' && (
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={activationDeadlineDate}
                        onChange={(e) => setActivationDeadlineDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      />
                      <p className="text-gray-500 text-xs">
                        密钥必须在此日期前激活使用，过期后无法激活
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex items-start">
                    <Timer className="w-4 h-4 text-purple-400 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm text-purple-300 mb-1">
                        {activationDeadlineType === 'relative' 
                          ? `密钥必须在 ${activationDeadlineDays} 天内激活`
                          : `密钥必须在 ${new Date(activationDeadlineDate).toLocaleDateString('zh-CN')} 前激活`
                        }
                      </p>
                      <p className="text-xs text-purple-400">
                        注意：激活截止时间不同于使用时长。密钥必须在此时间前激活，激活后可使用{formatDuration(durationHours)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 使用次数 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Users className="w-4 h-4 mr-2 text-green-400" />
                  使用次数限制
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {maxUsesOptions.map((option) => (
                    <button
                      key={option.value || 'unlimited'}
                      type="button"
                      onClick={() => setMaxUses(option.value)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${maxUses === option.value
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-500 text-sm">
                    选择"无限次"则不限制使用次数，"2次"表示每个密钥最多可用2次
                  </p>
                  <p className="text-green-400 text-xs mt-1">
                    当前选择: {maxUses === null ? '无限次' : `${maxUses}次`}
                  </p>
                </div>
              </div>

              {/* 生成数量 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Hash className="w-4 h-4 mr-2 text-purple-400" />
                  生成数量
                </label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">1个</span>
                    <span className="text-gray-400 text-sm">100个</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500 [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={count}
                        onChange={(e) => {
                          const value = parseInt(e.target.value)
                          if (value >= 1 && value <= 100) {
                            setCount(value)
                          }
                        }}
                        className="w-32 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-center text-lg font-bold"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        个
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-500 text-sm">
                    可批量生成 1-100 个密钥，适用于批量发放或促销活动
                  </p>
                  <p className="text-purple-400 text-xs mt-1">
                    预计总使用次数: {maxUses === null ? '∞' : `${count * maxUses}次`}
                  </p>
                </div>
              </div>

              {/* 密钥前缀 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Tag className="w-4 h-4 mr-2 text-amber-400" />
                  密钥前缀
                </label>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {prefixOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setPrefix(option.value)
                          setCustomPrefix(false)
                        }}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                          !customPrefix && prefix === option.value
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {option.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={() => setCustomPrefix(!customPrefix)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        customPrefix
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      自定义前缀
                    </button>
                    
                    {customPrefix && (
                      <div className="flex-1 flex items-center space-x-2">
                        <input
                          type="text"
                          value={prefix}
                          onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                          maxLength={6}
                          placeholder="输入2-6位大写字母"
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                        />
                        <button
                          onClick={() => {
                            if (prefix.length >= 2) {
                              setCustomPrefix(false)
                            } else {
                              setError('前缀至少需要2个字符')
                            }
                          }}
                          className="px-3 py-2 bg-green-600 hover:opacity-90 rounded-lg text-white text-sm"
                        >
                          确定
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-500 text-sm">
                    密钥格式：<code className="text-amber-400">{prefix}-{getDurationCode(durationHours)}-XXXXXXXX</code>
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    示例：{prefix}-{getDurationCode(durationHours)}-A1B2C3D4
                  </p>
                </div>
              </div>

              {/* 描述（可选） */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                  备注说明（可选）
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="输入此批密钥的用途说明，便于后续管理..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 h-24 resize-none"
                  maxLength={200}
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-gray-500 text-xs">
                    最多200个字符，建议填写生成用途便于追踪
                  </p>
                  <span className={`text-xs ${description.length >= 190 ? 'text-red-400' : 'text-gray-500'}`}>
                    {description.length}/200
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 高级设置 */}
          <button
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 flex items-center justify-center"
          >
            <Settings className="w-5 h-5 mr-2" />
            {showAdvancedSettings ? '隐藏高级设置' : '显示高级设置'}
          </button>

          {showAdvancedSettings && (
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 animate-slide-down">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-blue-400" />
                高级设置
              </h3>
              
              <div className="space-y-4">
                {/* 自定义时长（小时） */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    自定义时长（小时）
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="number"
                      min="0.25"
                      max="87600"
                      step="0.25"
                      value={durationHours}
                      onChange={(e) => handleCustomDurationChange(parseFloat(e.target.value))}
                      className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                      placeholder="输入小时数（0.25-87600）"
                    />
                    <span className="text-gray-300 whitespace-nowrap">小时</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    支持小数（如0.5=30分钟，1.5=1.5小时）
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={handleGenerateKeys}
              disabled={generating}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 rounded-lg text-white font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-2" />
                  生成密钥 ({count}个)
                </>
              )}
            </button>
          </div>
        </div>

        {/* 右侧：预览与结果 */}
        <div className="space-y-6">
          {/* 预览卡片 */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-purple-400" />
              密钥预览
            </h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">单个密钥示例</span>
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                    格式预览
                  </span>
                </div>
                <code className="font-mono text-lg text-white bg-gray-800 px-4 py-3 rounded-lg block text-center border border-gray-700 hover:border-gray-600 transition-colors">
                  {prefix}-{getDurationCode(durationHours)}-A1B2C3D4
                </code>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="text-gray-500">
                    <span className="block text-xs mb-1">使用时长:</span>
                    <span className="text-blue-400 font-medium">
                      {formatDuration(durationHours)}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    <span className="block text-xs mb-1">激活截止:</span>
                    <span className="text-purple-400 font-medium">
                      {activationDeadlineType === 'relative' 
                        ? `${activationDeadlineDays}天内`
                        : new Date(activationDeadlineDate).toLocaleDateString('zh-CN')
                      }
                    </span>
                  </div>
                  <div className="text-gray-500">
                    <span className="block text-xs mb-1">使用次数:</span>
                    <span className="text-green-400 font-medium">
                      {maxUses === null ? '无限次' : `${maxUses}次`}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    <span className="block text-xs mb-1">前缀:</span>
                    <span className="text-amber-400 font-medium">
                      {prefix}
                    </span>
                  </div>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-400 text-xs">密钥总数</p>
                  <p className="text-xl font-bold text-white mt-1">{count}个</p>
                </div>
                <div className="p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-400 text-xs">预计使用次数</p>
                  <p className="text-xl font-bold text-white mt-1">
                    {maxUses === null ? '∞' : `${count * maxUses}次`}
                  </p>
                </div>
                <div className="p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-400 text-xs">使用时长</p>
                  <p className="text-xl font-bold text-white mt-1">{formatDuration(durationHours)}</p>
                </div>
                <div className="p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-400 text-xs">前缀代码</p>
                  <p className="text-xl font-bold text-white mt-1">{prefix}</p>
                </div>
              </div>

              {/* 配置汇总 */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-3">配置汇总</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs">前缀:</span>
                    <span className="text-amber-400 font-medium mt-1">{prefix}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs">使用时长:</span>
                    <span className="text-blue-400 font-medium mt-1">{formatDuration(durationHours)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs">激活截止:</span>
                    <span className="text-purple-400 font-medium mt-1">
                      {activationDeadlineType === 'relative' 
                        ? `${activationDeadlineDays}天内`
                        : new Date(activationDeadlineDate).toLocaleDateString('zh-CN')
                      }
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs">使用限制:</span>
                    <span className="text-green-400 font-medium mt-1">
                      {maxUses === null ? '无限次' : `${maxUses}次`}
                    </span>
                  </div>
                </div>
                {description && (
                  <div className="mt-3 pt-3 border-t border-gray-700/50">
                    <span className="text-gray-400 text-xs">备注:</span>
                    <p className="text-gray-300 text-sm mt-1 truncate">{description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 生成结果 */}
          {generatedKeys.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center">
                  <Key className="w-5 h-5 mr-2 text-green-400" />
                  已生成密钥 ({generatedKeys.length}个)
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={copyAllKeys}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    title={copiedAll ? '已复制' : '复制所有密钥'}
                  >
                    {copiedAll ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={downloadKeys}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    title="下载密钥"
                  >
                    <Download className="w-5 h-5 text-blue-400" />
                  </button>
                  <button
                    onClick={clearKeys}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="清除所有密钥"
                  >
                    <X className="w-5 h-5 text-red-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {generatedKeys.map((key, index) => (
                  <div
                    key={key.id || index}
                    className="p-3 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                          #{index + 1}
                        </span>
                        <code className="font-mono text-sm text-white truncate flex-1">{key.key_code}</code>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(key.key_code)
                          const buttons = document.querySelectorAll(`[data-key-index="${index}"]`)
                          buttons.forEach(btn => {
                            const icon = btn.querySelector('svg')
                            if (icon) {
                              const originalClass = icon.className.baseVal
                              icon.className.baseVal = originalClass.replace('text-gray-400', 'text-green-400').replace('Copy', 'Check')
                              setTimeout(() => {
                                icon.className.baseVal = originalClass
                              }, 2000)
                            }
                          })
                        }}
                        data-key-index={index}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-opacity"
                        title="复制密钥"
                      >
                        <Copy className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="text-gray-500">
                        <span className="text-blue-400">时长:</span> {formatDuration(key.original_duration_hours)}
                      </div>
                      <div className="text-gray-500">
                        <span className="text-purple-400">激活截止:</span> {new Date(key.key_expires_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="w-4 h-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-300 mb-1">
                      重要提示
                    </p>
                    <ul className="text-xs text-gray-400 space-y-1">
                      <li>• 请务必复制并保存这些密钥</li>
                      <li>• 密钥已自动保存到数据库</li>
                      <li>• 建议同时下载备份，以防丢失</li>
                      <li>• 密钥格式: {prefix}-{getDurationCode(durationHours)}-随机码</li>
                      <li>• 密钥必须在此时间前激活: {activationDeadlineType === 'relative' 
                        ? `${activationDeadlineDays}天内`
                        : new Date(activationDeadlineDate).toLocaleDateString('zh-CN')
                      }</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      {generatedKeys.length > 0 && (
        <div className="mt-6 p-4 bg-gray-800/30 border border-gray-700/50 rounded-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-medium text-white mb-1">下一步操作</h4>
              <p className="text-gray-400 text-sm">
                已成功生成 {generatedKeys.length} 个密钥，请选择后续操作
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={clearKeys}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300"
              >
                清除重做
              </button>
              <button
                onClick={copyAllKeys}
                className={`px-4 py-2 rounded-lg text-sm text-white ${copiedAll ? 'bg-green-600' : 'bg-blue-600 hover:opacity-90'}`}
              >
                {copiedAll ? '✓ 已复制' : '复制所有密钥'}
              </button>
              <Link
                href="/admin/keys"
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 rounded-lg text-sm text-white flex items-center"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回密钥列表
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 数据库状态提示 */}
      <div className="mt-4 p-3 bg-gray-800/20 border border-gray-700/30 rounded-lg">
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
          <p className="text-xs text-gray-400">
            数据库状态: <span className="text-green-400">连接正常</span> | 
            当前配置: {formatDuration(durationHours)} · {activationDeadlineType === 'relative' 
              ? `${activationDeadlineDays}天内激活`
              : `${new Date(activationDeadlineDate).toLocaleDateString('zh-CN')}前激活`
            } · {maxUses === null ? '无限次' : `${maxUses}次`} · {count}个密钥
          </p>
        </div>
      </div>
    </div>
  )
}