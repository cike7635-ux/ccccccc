// /app/admin/keys/generate/page.tsx
'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Key, ArrowLeft, Plus, Copy, Check, RefreshCw, Download, 
  Clock, Users, Hash, Tag, AlertCircle, Sparkles, Calendar,
  Settings, X, Save, Upload, FileText, Filter, 
  Search, ChevronDown, ChevronUp, Zap, Star, Gift, Crown,
  Info, ExternalLink, History, Trash2, Eye, EyeOff
} from 'lucide-react'

// ============ 类型定义 ============
interface DurationOption {
  value: number;
  label: string;
  display: string;
  key: string;
  group: 'short' | 'medium' | 'long' | 'custom';
  description?: string;
}

interface MaxUsesOption {
  value: number | null;
  label: string;
  key: string;
}

interface PrefixOption {
  value: string;
  label: string;
  key: string;
  color: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  duration: number;
  maxUses: number | null;
  prefix: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}

interface GeneratedKey {
  id: string;
  code: string;
  prefix: string;
  durationCode: string;
  durationText: string;
  maxUses: number | null;
  description?: string;
  timestamp: number;
}

// ============ 常量配置 ============
const DURATION_OPTIONS: DurationOption[] = [
  { value: 1/24, label: '1小时', display: '1小时', key: '1h', group: 'short', description: '短期测试' },
  { value: 1, label: '1天', display: '1天', key: '1d', group: 'short', description: '日常试用' },
  { value: 2, label: '2天', display: '2天', key: '2d', group: 'medium', description: '周末体验' },
  { value: 7, label: '7天', display: '7天', key: '7d', group: 'medium', description: '一周体验' },
  { value: 30, label: '30天', display: '30天', key: '30d', group: 'long', description: '月度会员' },
  { value: 90, label: '90天', display: '3个月', key: '90d', group: 'long', description: '季度会员' },
  { value: 180, label: '180天', display: '6个月', key: '180d', group: 'long', description: '半年会员' },
  { value: 365, label: '365天', display: '1年', key: '365d', group: 'long', description: '年度会员' },
  { value: -1, label: 'custom', display: '自定义', key: 'custom', group: 'custom', description: '完全自定义' }
]

const MAX_USES_OPTIONS: MaxUsesOption[] = [
  { value: 1, label: '1次', key: '1-use' },
  { value: 2, label: '2次', key: '2-use' },
  { value: 4, label: '4次', key: '4-use' },
  { value: 10, label: '10次', key: '10-use' },
  { value: null, label: '无限次', key: 'unlimited' },
  { value: -1, label: '自定义', key: 'custom' }
]

const PREFIX_OPTIONS: PrefixOption[] = [
  { value: 'XY', label: 'XY', key: 'xy', color: 'text-amber-500 bg-amber-500/10' },
  { value: 'VIP', label: 'VIP', key: 'vip', color: 'text-purple-500 bg-purple-500/10' },
  { value: 'TEST', label: 'TEST', key: 'test', color: 'text-blue-500 bg-blue-500/10' },
  { value: 'PROMO', label: 'PROMO', key: 'promo', color: 'text-green-500 bg-green-500/10' },
  { value: 'LOVE', label: 'LOVE', key: 'love', color: 'text-pink-500 bg-pink-500/10' }
]

const TEMPLATES: Template[] = [
  {
    id: 'trial',
    name: '试用体验',
    description: '2天试用期，限用4次',
    duration: 2,
    maxUses: 4,
    prefix: 'XY',
    count: 5,
    color: 'bg-gradient-to-r from-blue-500 to-blue-600',
    icon: <Sparkles className="w-4 h-4" />
  },
  {
    id: 'weekly',
    name: '周度会员',
    description: '7天有效期，限用10次',
    duration: 7,
    maxUses: 10,
    prefix: 'VIP',
    count: 10,
    color: 'bg-gradient-to-r from-purple-500 to-purple-600',
    icon: <Crown className="w-4 h-4" />
  },
  {
    id: 'monthly',
    name: '月度会员',
    description: '30天有效期，无限次使用',
    duration: 30,
    maxUses: null,
    prefix: 'VIP',
    count: 20,
    color: 'bg-gradient-to-r from-amber-500 to-orange-500',
    icon: <Star className="w-4 h-4" />
  },
  {
    id: 'promo',
    name: '促销活动',
    description: '自定义时长，批量生成',
    duration: 30,
    maxUses: 1,
    prefix: 'PROMO',
    count: 50,
    color: 'bg-gradient-to-r from-green-500 to-emerald-500',
    icon: <Gift className="w-4 h-4" />
  }
]

// ============ 工具函数 ============
const generateRandomKey = (prefix: string, durationCode: string): string => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const length = 8
  let result = ''
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  
  return `${prefix}-${durationCode}-${result}`
}

const getDurationText = (duration: number): string => {
  if (duration === 1/24) return '1小时'
  if (duration === 1) return '1天'
  if (duration === 2) return '2天'
  if (duration === 7) return '7天'
  if (duration === 30) return '30天'
  if (duration === 90) return '3个月'
  if (duration === 180) return '6个月'
  if (duration === 365) return '1年'
  return `${duration}天`
}

const getDurationCode = (duration: number): string => {
  if (duration === 1/24) return '1H'
  if (duration === 1) return '1D'
  if (duration === 2) return '2D'
  if (duration === 7) return '7D'
  if (duration === 30) return '30D'
  if (duration === 90) return '90D'
  if (duration === 180) return '180D'
  if (duration === 365) return '365D'
  return `${duration}D`
}

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('zh-CN').format(num)
}

const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// ============ 可复用组件 ============
interface ButtonGroupProps<T> {
  options: Array<{ value: T; label: string; key: string }>
  value: T
  onChange: (value: T) => void
  className?: string
  buttonClassName?: string
  activeClassName?: string
}

function ButtonGroup<T>({
  options,
  value,
  onChange,
  className = '',
  buttonClassName = '',
  activeClassName = 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
}: ButtonGroupProps<T>) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-2 ${className}`}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] ${
            value === option.value
              ? activeClassName
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
          } ${buttonClassName}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface ConfigCardProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}

function ConfigCard({ title, icon, children, className = '' }: ConfigCardProps) {
  return (
    <div className={`bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 ${className}`}>
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
        {icon}
        <span className="ml-2">{title}</span>
      </h2>
      {children}
    </div>
  )
}

interface KeyItemProps {
  key: string
  index: number
  code: string
  onCopy: (code: string) => void
}

function KeyItem({ key, index, code, onCopy }: KeyItemProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-3 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-all duration-200 group hover:bg-gray-900/70">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
            #{index + 1}
          </span>
          <code className="font-mono text-sm text-white truncate flex-1">{code}</code>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors relative group/copy"
          title={copied ? '已复制' : '复制密钥'}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400 group-hover/copy:text-gray-300" />
          )}
        </button>
      </div>
    </div>
  )
}

// ============ 主组件 ============
export default function GenerateKeysPage() {
  const router = useRouter()
  
  // ============ 状态管理 ============
  const [duration, setDuration] = useState<number>(30)
  const [maxUses, setMaxUses] = useState<number | null>(1)
  const [count, setCount] = useState<number>(1)
  const [prefix, setPrefix] = useState<string>('XY')
  const [customPrefix, setCustomPrefix] = useState<boolean>(false)
  const [description, setDescription] = useState<string>('')
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([])
  const [generating, setGenerating] = useState<boolean>(false)
  const [showCustomDays, setShowCustomDays] = useState<boolean>(false)
  const [customDays, setCustomDays] = useState<number>(30)
  const [showCustomUses, setShowCustomUses] = useState<boolean>(false)
  const [customUses, setCustomUses] = useState<number>(2)
  const [copiedAll, setCopiedAll] = useState<boolean>(false)
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false)
  const [importMode, setImportMode] = useState<boolean>(false)
  const [importText, setImportText] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const keysContainerRef = useRef<HTMLDivElement>(null)

  // ============ 计算值 ============
  const durationText = useMemo(() => getDurationText(duration), [duration])
  const durationCode = useMemo(() => getDurationCode(duration), [duration])
  const totalUses = useMemo(() => {
    if (maxUses === null) return '∞'
    return formatNumber(count * maxUses)
  }, [maxUses, count])

  const groupedDurationOptions = useMemo(() => {
    const groups: Record<string, DurationOption[]> = {
      short: [],
      medium: [],
      long: [],
      custom: []
    }
    DURATION_OPTIONS.forEach(option => {
      groups[option.group].push(option)
    })
    return groups
  }, [])

  // ============ 事件处理 ============
  const handleDurationSelect = useCallback((value: number) => {
    if (value === -1) {
      setShowCustomDays(true)
    } else {
      setDuration(value)
      setShowCustomDays(false)
    }
  }, [])

  const handleMaxUsesSelect = useCallback((value: number | null) => {
    if (value === -1) {
      setShowCustomUses(true)
      setMaxUses(customUses)
    } else {
      setMaxUses(value)
      setShowCustomUses(false)
    }
  }, [customUses])

  const handleCustomDaysChange = useCallback((value: number) => {
    if (value >= 1 && value <= 999) {
      setCustomDays(value)
      setDuration(value)
    }
  }, [])

  const handleCustomUsesChange = useCallback((value: number) => {
    if (value >= 1 && value <= 999) {
      setCustomUses(value)
      setMaxUses(value)
    }
  }, [])

  const handleApplyTemplate = useCallback((template: Template) => {
    setDuration(template.duration)
    setMaxUses(template.maxUses)
    setCount(template.count)
    setPrefix(template.prefix)
    setActiveTemplate(template.id)
    setDescription(`${template.name} - ${template.description}`)
  }, [])

  const generateKeys = useCallback(() => {
    setGenerating(true)
    setError(null)
    
    // 模拟API调用延迟
    setTimeout(() => {
      try {
        const newKeys: GeneratedKey[] = []
        for (let i = 0; i < count; i++) {
          const keyCode = generateRandomKey(prefix, durationCode)
          newKeys.push({
            id: `${Date.now()}-${i}`,
            code: keyCode,
            prefix,
            durationCode,
            durationText: durationText,
            maxUses,
            description,
            timestamp: Date.now()
          })
        }
        
        setGeneratedKeys(newKeys)
        setSuccess(`成功生成 ${newKeys.length} 个密钥`)
        
        // 自动滚动到结果区域
        setTimeout(() => {
          keysContainerRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
        
      } catch (err) {
        setError('生成密钥时发生错误')
      } finally {
        setGenerating(false)
      }
    }, 500)
  }, [count, prefix, durationCode, durationText, maxUses, description])

  const copyAllKeys = useCallback(() => {
    const keysText = generatedKeys.map(k => k.code).join('\n')
    navigator.clipboard.writeText(keysText)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }, [generatedKeys])

  const downloadKeys = useCallback(() => {
    const keysText = generatedKeys.map(k => k.code).join('\n')
    const blob = new Blob([keysText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `love-ludo-keys_${new Date().toLocaleDateString('zh-CN')}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }, [generatedKeys])

  const clearKeys = useCallback(() => {
    setGeneratedKeys([])
    setSuccess(null)
  }, [])

  const handleImport = useCallback(() => {
    const keys = importText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    if (keys.length > 0) {
      const importedKeys: GeneratedKey[] = keys.map((code, index) => ({
        id: `imported-${Date.now()}-${index}`,
        code,
        prefix: code.split('-')[0] || 'IMP',
        durationCode: code.split('-')[1] || 'IMP',
        durationText: '已导入',
        maxUses: null,
        timestamp: Date.now()
      }))
      
      setGeneratedKeys(prev => [...prev, ...importedKeys])
      setImportText('')
      setImportMode(false)
      setSuccess(`成功导入 ${keys.length} 个密钥`)
    }
  }, [importText])

  const handleSubmit = useCallback(async () => {
    if (generatedKeys.length === 0) {
      setError('请先生成密钥')
      return
    }

    setGenerating(true)
    setError(null)
    
    try {
      const requestData = {
        keys: generatedKeys.map(k => k.code),
        duration_days: duration,
        max_uses: maxUses,
        description: description || undefined
      }

      const response = await fetch('/api/admin/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(`✅ 成功保存 ${generatedKeys.length} 个密钥到数据库！`)
        setTimeout(() => {
          router.push('/admin/keys')
        }, 1500)
      } else {
        throw new Error(result.error || '保存密钥失败')
      }
    } catch (err: any) {
      setError(`❌ 保存失败: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }, [generatedKeys, duration, maxUses, description, router])

  const handleCopyKey = useCallback((code: string) => {
    navigator.clipboard.writeText(code)
  }, [])

  // ============ 副作用 ============
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // ============ 渲染 ============
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-4 md:p-6">
      {/* 页面标题 */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center">
            <Link
              href="/admin/keys"
              className="mr-4 p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="返回密钥列表"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center">
                <Key className="w-6 h-6 md:w-7 md:h-7 mr-2 text-amber-400" />
                密钥生成器
              </h1>
              <p className="text-gray-400 mt-2">
                创建带有使用次数限制的访问密钥
                {generatedKeys.length > 0 && (
                  <span className="ml-2 text-amber-400">
                    • 已生成 {generatedKeys.length} 个密钥
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 flex items-center"
            >
              {showAdvanced ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
              高级选项
            </button>
            <button
              onClick={() => setImportMode(!importMode)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm text-white flex items-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              导入密钥
            </button>
          </div>
        </div>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg animate-fade-in">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg animate-fade-in">
          <div className="flex items-center">
            <Check className="w-5 h-5 text-green-400 mr-3" />
            <p className="text-green-400">{success}</p>
          </div>
        </div>
      )}

      {/* 导入模式 */}
      {importMode && (
        <div className="mb-6 p-6 bg-gray-800/50 border border-gray-700/50 rounded-xl animate-slide-down">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Upload className="w-5 h-5 mr-2 text-blue-400" />
              批量导入密钥
            </h3>
            <button
              onClick={() => setImportMode(false)}
              className="p-2 hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="每行输入一个密钥代码，例如：&#10;XY-30D-A1B2C3D4&#10;VIP-7D-E5F6G7H8"
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 h-40 resize-none font-mono"
          />
          <div className="flex justify-between items-center mt-4">
            <div className="text-gray-500 text-sm">
              已输入 {importText.split('\n').filter(l => l.trim()).length} 个密钥
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setImportMode(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 高级选项 */}
      {showAdvanced && (
        <div className="mb-6 p-6 bg-gray-800/50 border border-gray-700/50 rounded-xl animate-slide-down">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <Zap className="w-5 h-5 mr-2 text-amber-400" />
            高级选项
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                密钥模板
              </label>
              <div className="space-y-3">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleApplyTemplate(template)}
                    className={`w-full p-4 rounded-lg border transition-all duration-200 hover:scale-[1.02] ${
                      activeTemplate === template.id
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-gray-700/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 text-white ${template.color}`}>
                          {template.icon}
                        </div>
                        <div className="text-left">
                          <div className="font-medium text-white">{template.name}</div>
                          <div className="text-sm text-gray-400">{template.description}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-400 font-bold">{template.count}个</div>
                        <div className="text-xs text-gray-500">{template.prefix}前缀</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                性能选项
              </label>
              <div className="space-y-4">
                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">虚拟滚动</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only" id="virtual-scroll" />
                      <label htmlFor="virtual-scroll" className="block w-12 h-6 rounded-full bg-gray-700 cursor-pointer"></label>
                      <span className="dot absolute left-1 top-1 bg-gray-300 w-4 h-4 rounded-full transition"></span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    启用后在大批量密钥生成时提升性能
                  </p>
                </div>
                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">批量生成间隔</span>
                    <span className="text-amber-400 text-sm">0.5秒</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    step="100"
                    defaultValue="500"
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    控制批量生成时的延迟，避免浏览器卡顿
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* 左侧：配置表单 */}
        <div className="space-y-6">
          {/* 密钥配置卡片 */}
          <ConfigCard
            title="密钥配置"
            icon={<Sparkles className="w-5 h-5 text-amber-400" />}
          >
            <div className="space-y-6">
              {/* 时长选择 - 分组显示 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-blue-400" />
                  密钥有效期
                </label>
                
                {/* 短时长组 (1小时, 1天) */}
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">短期选项</div>
                  <ButtonGroup
                    options={groupedDurationOptions.short.map(opt => ({
                      value: opt.value,
                      label: opt.display,
                      key: opt.key
                    }))}
                    value={duration}
                    onChange={handleDurationSelect}
                    activeClassName="bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                  />
                </div>
                
                {/* 中时长组 (2天, 7天) */}
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">中期选项</div>
                  <ButtonGroup
                    options={groupedDurationOptions.medium.map(opt => ({
                      value: opt.value,
                      label: opt.display,
                      key: opt.key
                    }))}
                    value={duration}
                    onChange={handleDurationSelect}
                    activeClassName="bg-gradient-to-r from-green-600 to-emerald-700 text-white"
                  />
                </div>
                
                {/* 长时长组 (30天以上) */}
                <div className="mb-4">
                  <div className="text-xs text-gray-500 mb-2">长期选项</div>
                  <ButtonGroup
                    options={groupedDurationOptions.long.map(opt => ({
                      value: opt.value,
                      label: opt.display,
                      key: opt.key
                    }))}
                    value={duration}
                    onChange={handleDurationSelect}
                    activeClassName="bg-gradient-to-r from-purple-600 to-purple-700 text-white"
                  />
                </div>
                
                {/* 自定义选项 */}
                <div>
                  <ButtonGroup
                    options={groupedDurationOptions.custom.map(opt => ({
                      value: opt.value,
                      label: opt.display,
                      key: opt.key
                    }))}
                    value={duration}
                    onChange={handleDurationSelect}
                    activeClassName="bg-gradient-to-r from-amber-600 to-orange-600 text-white"
                  />
                  
                  {/* 自定义天数输入框 */}
                  {showCustomDays && (
                    <div className="mt-4 p-4 bg-gray-900/70 rounded-lg border border-amber-500/50 animate-slide-down">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Settings className="w-4 h-4 mr-2 text-amber-400" />
                          <span className="text-sm font-medium text-gray-300">自定义天数</span>
                        </div>
                        <button
                          onClick={() => setShowCustomDays(false)}
                          className="p-1 hover:bg-red-500/20 rounded"
                          title="取消自定义"
                        >
                          <X className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <input
                            type="number"
                            min="1"
                            max="999"
                            value={customDays}
                            onChange={(e) => handleCustomDaysChange(parseInt(e.target.value) || 30)}
                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-center"
                            placeholder="输入天数"
                          />
                          <span className="text-gray-300 whitespace-nowrap">天</span>
                        </div>
                        
                        <div className="flex space-x-2 overflow-x-auto pb-2">
                          {[1, 3, 7, 15, 30, 60, 90, 180].map((day) => (
                            <button
                              key={`quick-${day}`}
                              type="button"
                              onClick={() => handleCustomDaysChange(day)}
                              className={`px-3 py-1.5 rounded text-xs ${
                                customDays === day
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                              }`}
                            >
                              {day}天
                            </button>
                          ))}
                        </div>
                        
                        <p className="text-gray-500 text-xs">
                          当前自定义: {customDays} 天
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-400 text-sm">
                    <span className="text-blue-400">当前选择:</span> {durationText}
                    <span className="ml-3 text-amber-400">格式: {prefix}-{durationCode}-XXXXXXXX</span>
                  </p>
                </div>
              </div>

              {/* 使用次数选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                  <Users className="w-4 h-4 mr-2 text-green-400" />
                  使用次数限制
                </label>
                
                <ButtonGroup
                  options={MAX_USES_OPTIONS.map(opt => ({
                    value: opt.value,
                    label: opt.label,
                    key: opt.key
                  }))}
                  value={maxUses}
                  onChange={handleMaxUsesSelect}
                  activeClassName="bg-gradient-to-r from-green-600 to-emerald-600 text-white"
                />
                
                {/* 自定义使用次数输入框 */}
                {showCustomUses && (
                  <div className="mt-4 p-4 bg-gray-900/70 rounded-lg border border-green-500/50 animate-slide-down">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <Settings className="w-4 h-4 mr-2 text-green-400" />
                        <span className="text-sm font-medium text-gray-300">自定义使用次数</span>
                      </div>
                      <button
                        onClick={() => setShowCustomUses(false)}
                        className="p-1 hover:bg-red-500/20 rounded"
                        title="取消自定义"
                      >
                        <X className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={customUses}
                          onChange={(e) => handleCustomUsesChange(parseInt(e.target.value) || 2)}
                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-center"
                          placeholder="输入次数"
                        />
                        <span className="text-gray-300 whitespace-nowrap">次</span>
                      </div>
                      
                      <div className="flex space-x-2 overflow-x-auto pb-2">
                        {[1, 2, 4, 8, 16, 32, 64].map((use) => (
                          <button
                            key={`quick-use-${use}`}
                            type="button"
                            onClick={() => handleCustomUsesChange(use)}
                            className={`px-3 py-1.5 rounded text-xs ${
                              customUses === use
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            {use}次
                          </button>
                        ))}
                      </div>
                      
                      <p className="text-gray-500 text-xs">
                        当前自定义: {customUses} 次
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="mt-4 p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-500 text-sm">
                    选择"无限次"则不限制使用次数，"2次"表示每个密钥最多可用2次
                  </p>
                  <p className="text-green-400 text-sm mt-1">
                    当前选择: {maxUses === null ? '无限次' : `${maxUses}次`}
                  </p>
                </div>
              </div>

              {/* 生成数量 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
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
                
                <div className="mt-4 p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-500 text-sm">
                    可批量生成 1-100 个密钥，适用于批量发放或促销活动
                  </p>
                  <p className="text-purple-400 text-sm mt-1">
                    预计总使用次数: {totalUses}次
                  </p>
                </div>
              </div>

              {/* 密钥前缀 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
                  <Tag className="w-4 h-4 mr-2 text-amber-400" />
                  密钥前缀
                </label>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {PREFIX_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setPrefix(option.value)
                          setCustomPrefix(false)
                        }}
                        className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] ${
                          !customPrefix && prefix === option.value
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {option.label}
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
                
                <div className="mt-4 p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-500 text-sm">
                    密钥格式：<code className="text-amber-400">{prefix}-{durationCode}-XXXXXXXX</code>
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    示例：{prefix}-{durationCode}-A1B2C3D4
                  </p>
                </div>
              </div>

              {/* 描述（可选） */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center">
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
          </ConfigCard>

          {/* 操作按钮 */}
          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={generateKeys}
              disabled={generating}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 rounded-lg text-white font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-[1.02]"
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
            
            {generatedKeys.length > 0 && (
              <button
                onClick={handleSubmit}
                disabled={generating}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 rounded-lg text-white font-medium disabled:opacity-50 transition-all duration-200 hover:scale-[1.02]"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    保存到数据库
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 右侧：预览与结果 */}
        <div className="space-y-6" ref={keysContainerRef}>
          {/* 预览卡片 */}
          <ConfigCard
            title="密钥预览"
            icon={<Sparkles className="w-5 h-5 text-purple-400" />}
          >
            <div className="space-y-4">
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">单个密钥示例</span>
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                    格式预览
                  </span>
                </div>
                <code className="font-mono text-lg text-white bg-gray-800 px-4 py-3 rounded-lg block text-center border border-gray-700 hover:border-gray-600 transition-colors">
                  {prefix}-{durationCode}-A1B2C3D4
                </code>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="text-gray-500">
                    <span className="block text-xs mb-1">有效期:</span>
                    <span className="text-blue-400 font-medium">
                      {durationText}
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
                  <div className="text-gray-500">
                    <span className="block text-xs mb-1">格式:</span>
                    <span className="text-gray-400 font-medium">
                      {durationCode}
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
                  <p className="text-xl font-bold text-white mt-1">{totalUses}次</p>
                </div>
                <div className="p-3 bg-gray-900/30 rounded-lg">
                  <p className="text-gray-400 text-xs">有效期</p>
                  <p className="text-xl font-bold text-white mt-1">{durationText}</p>
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
                    <span className="text-gray-400 text-xs">时长:</span>
                    <span className="text-blue-400 font-medium mt-1">{durationText}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs">使用限制:</span>
                    <span className="text-green-400 font-medium mt-1">
                      {maxUses === null ? '无限次' : `${maxUses}次`}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-400 text-xs">生成数量:</span>
                    <span className="text-purple-400 font-medium mt-1">{count}个</span>
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
          </ConfigCard>

          {/* 生成结果 */}
          {generatedKeys.length > 0 && (
            <ConfigCard
              title={`已生成密钥 (${generatedKeys.length}个)`}
              icon={<Key className="w-5 h-5 text-green-400" />}
              className="animate-slide-up"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-gray-400 text-sm">
                    生成时间: {new Date(generatedKeys[0].timestamp).toLocaleTimeString('zh-CN')}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={copyAllKeys}
                    className={`p-2 rounded-lg transition-colors relative group ${
                      copiedAll ? 'bg-green-500/20' : 'hover:bg-gray-700'
                    }`}
                    title={copiedAll ? '已复制' : '复制所有密钥'}
                  >
                    {copiedAll ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <>
                        <Copy className="w-5 h-5 text-gray-400 group-hover:text-gray-300" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping opacity-75"></span>
                      </>
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
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {generatedKeys.map((key, index) => (
                  <KeyItem
                    key={key.id}
                    index={index}
                    code={key.code}
                    onCopy={handleCopyKey}
                  />
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start">
                  <Info className="w-4 h-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-300 mb-1">
                      操作提示
                    </p>
                    <ul className="text-xs text-gray-400 space-y-1">
                      <li>• 请务必保存这些密钥，点击保存按钮后密钥将正式生效</li>
                      <li>• 建议下载备份，以防数据丢失</li>
                      <li>• 密钥格式: {prefix}-{durationCode}-随机码</li>
                      <li>• 每个密钥最多可使用: {maxUses === null ? '无限次' : `${maxUses}次`}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </ConfigCard>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      {generatedKeys.length > 0 && (
        <div className="mt-6 p-4 bg-gray-800/30 border border-gray-700/50 rounded-lg animate-slide-up">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-medium text-white mb-1">下一步操作</h4>
              <p className="text-gray-400 text-sm">
                您已成功生成 {generatedKeys.length} 个密钥，请选择后续操作
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={clearKeys}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
              >
                清除重做
              </button>
              <button
                onClick={copyAllKeys}
                className={`px-4 py-2 rounded-lg text-sm text-white transition-colors ${
                  copiedAll ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {copiedAll ? '✓ 已复制' : '复制所有密钥'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={generating}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 rounded-lg text-sm text-white disabled:opacity-50 transition-all duration-200 hover:scale-[1.02]"
              >
                {generating ? '保存中...' : '保存到数据库'}
              </button>
              <Link
                href="/admin/keys"
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 rounded-lg text-sm text-white flex items-center transition-all duration-200 hover:scale-[1.02]"
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
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
            <p className="text-xs text-gray-400">
              数据库状态: <span className="text-green-400">连接正常</span> | 
              当前配置: {durationText} · {maxUses === null ? '无限次' : `${maxUses}次`} · {count}个密钥
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => window.open('/admin/test-db', '_blank')}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              测试连接
            </button>
            <button
              onClick={() => router.push('/admin/keys')}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center"
            >
              <History className="w-3 h-3 mr-1" />
              查看历史
            </button>
          </div>
        </div>
      </div>

      {/* 全局样式 */}
      <style jsx global>{`
        .animate-fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        .animate-slide-down {
          animation: slideDown 0.3s ease-out;
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(75, 85, 99, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.7);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { 
            opacity: 0;
            transform: translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(10px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
