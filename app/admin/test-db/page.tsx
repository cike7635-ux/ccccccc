// /app/admin/test-db/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestDBPage() {
  const [testResults, setTestResults] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<string[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'测试中' | '成功' | '失败'>('测试中')

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    let emoji = 'ℹ️'
    if (type === 'error') emoji = '❌'
    if (type === 'success') emoji = '✅'
    
    setLogs(prev => [`[${timestamp}] ${emoji} ${message}`, ...prev.slice(0, 19)])
  }

  const testDatabaseConnection = async () => {
    setLoading(true)
    setLogs([])
    setConnectionStatus('测试中')
    
    const supabase = createClient()
    const results: any = {}

    try {
      addLog('开始数据库连接测试...')
      addLog(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`, 'info')
      
      // 测试1: 测试简单连接（查询单个字段）
      addLog('测试1: 测试基本连接...')
      const { data: simpleTest, error: simpleError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)

      if (simpleError) {
        addLog(`基本连接失败: ${simpleError.message}`, 'error')
        addLog(`错误代码: ${simpleError.code}`, 'error')
        addLog(`错误详情: ${simpleError.details}`, 'error')
        addLog(`错误提示: ${simpleError.hint}`, 'error')
      } else {
        addLog(`基本连接成功! 找到 ${simpleTest?.length || 0} 条记录`, 'success')
      }

      // 测试2: 查询 profiles 表（正确的方式）
      addLog('测试2: 查询 profiles 表数据...')
      try {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .limit(10)

        if (profilesError) {
          addLog(`profiles 表查询失败: ${profilesError.message}`, 'error')
          results.profiles = {
            success: false,
            count: 0,
            error: profilesError.message,
            code: profilesError.code
          }
        } else {
          const count = profiles?.length || 0
          addLog(`profiles 表: ${count} 条记录`, 'success')
          results.profiles = {
            success: true,
            count: count,
            data: profiles,
            error: null
          }
        }
      } catch (err: any) {
        addLog(`profiles 表查询异常: ${err.message}`, 'error')
        results.profiles = {
          success: false,
          count: 0,
          error: err.message
        }
      }

      // 测试3: 查询 access_keys 表
      addLog('测试3: 查询 access_keys 表...')
      try {
        const { data: keys, error: keysError } = await supabase
          .from('access_keys')
          .select('*')
          .limit(10)

        if (keysError) {
          addLog(`access_keys 表查询失败: ${keysError.message}`, 'error')
          results.accessKeys = {
            success: false,
            count: 0,
            error: keysError.message,
            code: keysError.code
          }
        } else {
          const count = keys?.length || 0
          addLog(`access_keys 表: ${count} 条记录`, 'success')
          results.accessKeys = {
            success: true,
            count: count,
            data: keys,
            error: null
          }
        }
      } catch (err: any) {
        addLog(`access_keys 表查询异常: ${err.message}`, 'error')
        results.accessKeys = {
          success: false,
          count: 0,
          error: err.message
        }
      }

      // 测试4: 测试所有表的连接（检查存在性）
      addLog('测试4: 检查所有表的存在性...')
      const allTables = [
        'profiles',
        'access_keys',
        'ai_usage_records',
        'themes',
        'tasks',
        'rooms',
        'game_sessions',
        'game_history',
        'game_moves',
        'key_usage_history'
      ]

      results.allTables = {}

      for (const table of allTables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('id')
            .limit(1)

          if (error) {
            if (error.code === 'PGRST301') {
              results.allTables[table] = { exists: false, error: '表不存在' }
              addLog(`表 ${table}: 不存在`, 'error')
            } else if (error.code === '42501') {
              results.allTables[table] = { exists: true, error: '权限不足' }
              addLog(`表 ${table}: 存在，但权限不足`, 'error')
            } else {
              results.allTables[table] = { exists: false, error: error.message }
              addLog(`表 ${table}: 查询错误 - ${error.message}`, 'error')
            }
          } else {
            results.allTables[table] = { exists: true, count: '至少1条' }
            addLog(`表 ${table}: 存在且有数据`, 'success')
          }
        } catch (err: any) {
          results.allTables[table] = { exists: false, error: err.message }
          addLog(`表 ${table}: 异常 - ${err.message}`, 'error')
        }
      }

      // 总结连接状态
      const hasSuccess = results.profiles?.success || results.accessKeys?.success
      if (hasSuccess) {
        setConnectionStatus('成功')
        addLog('✅ 数据库连接测试成功完成!', 'success')
      } else {
        setConnectionStatus('失败')
        addLog('❌ 数据库连接测试失败', 'error')
      }

    } catch (err: any) {
      setConnectionStatus('失败')
      addLog(`❌ 测试过程中发生异常: ${err.message}`, 'error')
    }

    setTestResults(results)
    setLoading(false)
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      testDatabaseConnection()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">数据库连接测试</h1>
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                connectionStatus === '测试中' ? 'bg-yellow-900/50 text-yellow-300' :
                connectionStatus === '成功' ? 'bg-green-900/50 text-green-300' :
                'bg-red-900/50 text-red-300'
              }`}>
                {connectionStatus}
              </div>
              <div className="text-gray-400">
                使用环境: {process.env.NODE_ENV === 'development' ? '开发' : '生产'}
              </div>
            </div>
          </div>
          
          <button
            onClick={testDatabaseConnection}
            disabled={loading}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                测试中...
              </>
            ) : (
              <>重新测试</>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：主要测试结果 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 连接状态卡片 */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">连接状态</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${
                  testResults.profiles?.success 
                    ? 'bg-green-900/20 border border-green-700/50' 
                    : 'bg-red-900/20 border border-red-700/50'
                }`}>
                  <div className="flex items-center mb-3">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      testResults.profiles?.success ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                    }`}></div>
                    <span className="text-white font-medium">用户表 (profiles)</span>
                  </div>
                  <div className="text-center">
                    {testResults.profiles?.success ? (
                      <>
                        <div className="text-2xl font-bold text-green-400 mb-1">{testResults.profiles.count}</div>
                        <div className="text-gray-300 text-sm">条用户记录</div>
                      </>
                    ) : (
                      <>
                        <div className="text-red-400 font-medium mb-1">查询失败</div>
                        <div className="text-gray-400 text-xs">{testResults.profiles?.error}</div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg ${
                  testResults.accessKeys?.success 
                    ? 'bg-green-900/20 border border-green-700/50' 
                    : 'bg-red-900/20 border border-red-700/50'
                }`}>
                  <div className="flex items-center mb-3">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      testResults.accessKeys?.success ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                    }`}></div>
                    <span className="text-white font-medium">密钥表 (access_keys)</span>
                  </div>
                  <div className="text-center">
                    {testResults.accessKeys?.success ? (
                      <>
                        <div className="text-2xl font-bold text-green-400 mb-1">{testResults.accessKeys.count}</div>
                        <div className="text-gray-300 text-sm">条密钥记录</div>
                      </>
                    ) : (
                      <>
                        <div className="text-red-400 font-medium mb-1">查询失败</div>
                        <div className="text-gray-400 text-xs">{testResults.accessKeys?.error}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 所有表状态 */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">所有表状态</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {testResults.allTables && Object.entries(testResults.allTables).map(([table, info]: [string, any]) => (
                  <div 
                    key={table} 
                    className={`p-3 rounded-lg border transition-all ${
                      info.exists 
                        ? 'bg-green-900/10 border-green-700/30 hover:bg-green-900/20' 
                        : 'bg-red-900/10 border-red-700/30 hover:bg-red-900/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-200 text-sm font-medium truncate" title={table}>
                        {table}
                      </span>
                      <div className={`w-2 h-2 rounded-full ${
                        info.exists ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                      }`}></div>
                    </div>
                    <div className="text-xs text-gray-400 truncate" title={info.error || '正常'}>
                      {info.exists ? (info.count || '存在') : (info.error || '不存在')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 环境变量状态 */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">环境变量状态</h3>
              
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className={`p-3 rounded-lg ${
                    process.env.NEXT_PUBLIC_SUPABASE_URL 
                      ? 'bg-green-900/20 border border-green-700/30' 
                      : 'bg-red-900/20 border border-red-700/30'
                  }`}>
                    <div className="text-gray-300 text-sm font-medium mb-1">SUPABASE_URL</div>
                    <div className="text-xs text-gray-400 truncate" title={process.env.NEXT_PUBLIC_SUPABASE_URL || '未设置'}>
                      {process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ 未设置'}
                    </div>
                  </div>
                  
                  <div className={`p-3 rounded-lg ${
                    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 
                      ? 'bg-green-900/20 border border-green-700/30' 
                      : 'bg-red-900/20 border border-red-700/30'
                  }`}>
                    <div className="text-gray-300 text-sm font-medium mb-1">PUBLISHABLE_KEY</div>
                    <div className="text-xs text-gray-400">
                      {process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 
                        ? '✅ 已设置' 
                        : '❌ 未设置'}
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                  <div className="text-gray-300 text-sm font-medium mb-1">当前客户端</div>
                  <div className="text-xs text-gray-400">
                    使用的是: <code className="text-blue-300">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
                    <div className="text-gray-500 mt-1">
                      注意：这是游戏界面使用的环境变量名，保持兼容
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：日志和诊断 */}
          <div className="space-y-6">
            {/* 测试日志 */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">测试日志</h3>
                <button 
                  onClick={() => setLogs([])}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  清空日志
                </button>
              </div>
              
              <div className="bg-gray-900/70 rounded-lg p-4 h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-gray-500 text-center py-16">
                    <div className="text-4xl mb-2">📋</div>
                    <p>暂无日志记录</p>
                  </div>
                ) : (
                  <div className="space-y-1 font-mono">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`text-xs whitespace-nowrap ${
                          log.includes('✅') ? 'text-green-400' :
                          log.includes('❌') ? 'text-red-400' :
                          'text-gray-300'
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 诊断建议 */}
            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">诊断建议</h3>
              
              <div className="space-y-3">
                {(!testResults.profiles?.success || !testResults.accessKeys?.success) && (
                  <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
                    <h4 className="text-sm font-medium text-white mb-1">需要修复的问题</h4>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• 检查 RLS（行级安全）策略设置</li>
                      <li>• 确认匿名密钥有读取权限</li>
                      <li>• 验证表名是否正确（区分大小写）</li>
                      <li>• 检查网络连接和 CORS 设置</li>
                    </ul>
                  </div>
                )}

                {testResults.profiles?.success && testResults.accessKeys?.success && (
                  <div className="p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
                    <h4 className="text-sm font-medium text-white mb-1">连接正常</h4>
                    <ul className="text-gray-300 text-sm space-y-1">
                      <li>• ✅ 数据库连接正常</li>
                      <li>• ✅ 表结构存在</li>
                      <li>• ✅ 权限配置正确</li>
                      <li>• ✅ 环境变量有效</li>
                    </ul>
                  </div>
                )}

                <div className="p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                  <h4 className="text-sm font-medium text-white mb-1">技术信息</h4>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• 客户端：Supabase JS Client</li>
                    <li>• 认证：匿名密钥（Publishable Key）</li>
                    <li>• 查询方式：REST API</li>
                    <li>• 数据格式：JSON</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部数据预览 */}
        {testResults.profiles?.data && testResults.profiles.data.length > 0 && (
          <div className="mt-6 bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">数据预览</h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">profiles 表（第一条记录）</h4>
                <pre className="text-gray-300 text-sm overflow-auto max-h-60 bg-gray-900 p-3 rounded">
                  {JSON.stringify(testResults.profiles.data[0], null, 2)}
                </pre>
              </div>
              
              {testResults.accessKeys?.data && testResults.accessKeys.data.length > 0 && (
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">access_keys 表（第一条记录）</h4>
                  <pre className="text-gray-300 text-sm overflow-auto max-h-60 bg-gray-900 p-3 rounded">
                    {JSON.stringify(testResults.accessKeys.data[0], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 加载状态 */}
        {loading && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-md w-full mx-4">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <h3 className="text-xl font-bold text-white mb-2">测试数据库连接</h3>
                <p className="text-gray-400 text-center">正在连接到 Supabase，请稍候...</p>
                <div className="mt-4 text-gray-500 text-sm">
                  <div className="animate-pulse">检查环境变量...</div>
                  <div className="animate-pulse mt-1">建立网络连接...</div>
                  <div className="animate-pulse mt-1">查询数据库表...</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
