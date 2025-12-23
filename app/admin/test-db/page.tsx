// /app/admin/test-db/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestDBPage() {
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const testConnection = async () => {
      try {
        const supabase = createClient()
        
        // 测试1: 查询profiles表
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1)

        // 测试2: 查询access_keys表  
        const { data: keys, error: keysError } = await supabase
          .from('access_keys')
          .select('count')
          .limit(1)

        setResult({
          profiles: profilesError ? { error: profilesError.message } : { count: profiles?.length },
          keys: keysError ? { error: keysError.message } : { count: keys?.length }
        })
        
        if (profilesError || keysError) {
          setError(`profiles错误: ${profilesError?.message}, keys错误: ${keysError?.message}`)
        }
        
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    testConnection()
  }, [])

  if (loading) return <div className="p-6">测试数据库连接中...</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">数据库连接测试</h1>
      
      {error ? (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 font-bold">连接失败</p>
          <p className="text-red-300 mt-2">{error}</p>
          <p className="text-gray-400 text-sm mt-4">
            可能原因：
            1. 环境变量未正确设置
            2. Supabase项目配置错误
            3. 网络权限问题
          </p>
        </div>
      ) : (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
          <p className="text-green-400 font-bold">连接成功！</p>
          <div className="mt-4 space-y-2">
            <p className="text-white">profiles表：{result?.profiles?.count ?? 0} 条记录</p>
            <p className="text-white">access_keys表：{result?.keys?.count ?? 0} 条记录</p>
          </div>
        </div>
      )}
      
      <div className="mt-6 bg-gray-800/50 rounded-lg p-4">
        <h3 className="text-white font-medium mb-2">环境变量检查</h3>
        <div className="space-y-1 text-sm">
          <p className="text-gray-400">NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ 已设置' : '❌ 未设置'}</p>
          <p className="text-gray-400">NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ 已设置' : '❌ 未设置'}</p>
        </div>
      </div>
    </div>
  )
}