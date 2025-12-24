// /app/admin/keys/generate/page.tsx - 完整版本
'use client'

import { useState } from 'react'
import { 
  Key, ArrowLeft, Plus, Copy, Check, RefreshCw, Download, 
  Clock, Users, Hash, Tag, AlertCircle, Sparkles
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function GenerateKeysPage() {
  const router = useRouter()
  
  // 表单状态
  const [duration, setDuration] = useState<number>(30) // 30天
  const [maxUses, setMaxUses] = useState<number | null>(1) // 1次使用
  const [count, setCount] = useState<number>(1) // 生成数量
  const [prefix, setPrefix] = useState<string>('XY') // 密钥前缀
  const [customPrefix, setCustomPrefix] = useState<boolean>(false)
  const [description, setDescription] = useState<string>('')
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([])
  const [generating, setGenerating] = useState<boolean>(false)
  const [copiedAll, setCopiedAll] = useState<boolean>(false)

  // 时长选项（单位：天）
  const durationOptions = [
    { value: 1, label: '1小时', display: '1小时' },
    { value: 1, label: '1天', display: '1天' },
    { value: 7, label: '7天', display: '7天' },
    { value: 30, label: '30天', display: '30天' },
    { value: 90, label: '90天', display: '3个月' },
    { value: 180, label: '180天', display: '6个月' },
    { value: 365, label: '365天', display: '1年' },
    { value: 730, label: '730天', display: '2年' }
  ]

  // 使用次数选项
  const maxUsesOptions = [
    { value: 1, label: '1次' },
    { value: 3, label: '3次' },
    { value: 5, label: '5次' },
    { value: 10, label: '10次' },
    { value: null, label: '无限次' }
  ]

  // 预设前缀选项
  const prefixOptions = [
    { value: 'XY', label: 'XY (系统默认)' },
    { value: 'VIP', label: 'VIP (会员专用)' },
    { value: 'TEST', label: 'TEST (测试专用)' },
    { value: 'PROMO', label: 'PROMO (促销活动)' }
  ]

  // 生成随机密钥
  const generateRandomKey = (): string => {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 避免容易混淆的字符
    const length = 8
    let result = ''
    
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    
    // 格式：前缀-时长-随机码
    const prefixToUse = customPrefix ? prefix : prefix
    const durationCode = duration === 1 ? '1H' : duration === 1 ? '1D' : duration.toString()
    
    return `${prefixToUse}-${durationCode}-${result}`
  }

  // 生成密钥
  const handleGenerateKeys = () => {
    setGenerating(true)
    
    // 模拟API调用延迟
    setTimeout(() => {
      const newKeys: string[] = []
      for (let i = 0; i < count; i++) {
        newKeys.push(generateRandomKey())
      }
      
      setGeneratedKeys(newKeys)
      setGenerating(false)
    }, 800)
  }

  // 复制所有密钥
  const copyAllKeys = () => {
    const keysText = generatedKeys.join('\n')
    navigator.clipboard.writeText(keysText)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  // 下载密钥
  const downloadKeys = () => {
    const keysText = generatedKeys.join('\n')
    const blob = new Blob([keysText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `密钥_${new Date().toLocaleDateString('zh-CN')}.txt`
    link.click()
  }

  // 清除生成的密钥
  const clearKeys = () => {
    setGeneratedKeys([])
  }

  // 提交到数据库
  const handleSubmit = async () => {
    if (generatedKeys.length === 0) {
      alert('请先生成密钥')
      return
    }

    try {
      setGenerating(true)
      
      const response = await fetch('/api/admin/keys/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keys: generatedKeys,
          duration_days: duration,
          max_uses: maxUses,
          description: description || undefined
        }),
        credentials: 'include'
      })

      const result = await response.json()

      if (result.success) {
        alert(`✅ 成功创建了 ${generatedKeys.length} 个密钥！`)
        // 跳转回密钥列表页
        router.push('/admin/keys')
      } else {
        throw new Error(result.error || '创建密钥失败')
      }
    } catch (error: any) {
      console.error('创建密钥失败:', error)
      alert(`❌ 创建密钥失败: ${error.message}`)
    } finally {
      setGenerating(false)
    }
  }

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
                创建带有使用次数限制的访问密钥
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
                  密钥有效期
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {durationOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDuration(option.value)}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${duration === option.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {option.display}
                    </button>
                  ))}
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  选择密钥的有效期，过期后密钥将自动失效
                </p>
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
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  限制密钥可以被使用的次数，选择"无限次"则不限制使用次数
                </p>
              </div>

              {/* 生成数量 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Hash className="w-4 h-4 mr-2 text-purple-400" />
                  生成数量
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="w-20">
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
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-center"
                    />
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  可批量生成 1-100 个密钥，适用于批量发放或促销活动
                </p>
              </div>

              {/* 密钥前缀 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Tag className="w-4 h-4 mr-2 text-amber-400" />
                  密钥前缀
                </label>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {prefixOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setPrefix(option.value)
                          setCustomPrefix(false)
                        }}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors ${!customPrefix && prefix === option.value
                          ? 'bg-amber-600 text-white'
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
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${customPrefix
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      自定义前缀
                    </button>
                    
                    {customPrefix && (
                      <input
                        type="text"
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                        maxLength={4}
                        placeholder="输入2-4位大写字母"
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
                      />
                    )}
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  密钥格式：{prefix}-{duration === 1 ? '1H' : duration === 1 ? '1D' : duration}-XXXXXXXX
                </p>
              </div>

              {/* 描述（可选） */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  备注说明（可选）
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="输入此批密钥的用途说明，便于后续管理..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 h-20 resize-none"
                  maxLength={200}
                />
                <p className="text-gray-500 text-xs mt-2">
                  最多200个字符，建议填写生成用途便于追踪
                </p>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={handleGenerateKeys}
              disabled={generating}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:opacity-90 rounded-lg text-white font-medium flex items-center justify-center disabled:opacity-50"
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
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 rounded-lg text-white font-medium"
              >
                保存到数据库
              </button>
            )}
          </div>
        </div>

        {/* 右侧：预览与结果 */}
        <div className="space-y-6">
          {/* 预览卡片 */}
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">密钥预览</h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">单个密钥示例</span>
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                    格式预览
                  </span>
                </div>
                <code className="font-mono text-lg text-white bg-gray-800 px-4 py-3 rounded-lg block text-center">
                  {prefix}-{duration === 1 ? '1H' : duration === 1 ? '1D' : duration}-ABCD1234
                </code>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="text-gray-500">
                    <span className="block">有效期:</span>
                    <span className="text-blue-400">
                      {duration === 1 ? '1小时' : 
                       duration === 1 ? '1天' : 
                       duration === 7 ? '7天' : 
                       duration === 30 ? '30天' : 
                       duration === 90 ? '3个月' : 
                       duration === 180 ? '6个月' : 
                       duration === 365 ? '1年' : 
                       duration === 730 ? '2年' : `${duration}天`}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    <span className="block">使用次数:</span>
                    <span className="text-green-400">
                      {maxUses === null ? '无限次' : `${maxUses}次`}
                    </span>
                  </div>
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-2 gap-3">
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
                    title="复制所有密钥"
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
                    <RefreshCw className="w-5 h-5 text-red-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {generatedKeys.map((key, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <code className="font-mono text-sm text-white">{key}</code>
                      <span className="text-xs text-gray-500">#{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-300">
                    请务必复制并保存这些密钥，点击"保存到数据库"按钮后，这些密钥将正式生效。
                    建议同时下载备份，以防丢失。
                  </p>
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
                您已成功生成 {generatedKeys.length} 个密钥，请选择后续操作
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
                className="px-4 py-2 bg-blue-600 hover:opacity-90 rounded-lg text-sm text-white"
              >
                复制所有密钥
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 rounded-lg text-sm text-white"
              >
                保存到数据库
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
    </div>
  )
}