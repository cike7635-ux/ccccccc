// /app/admin/dashboard/page.tsx
'use client'

import { useState, useEffect } from 'react'
import StatsCards from './components/stats-cards'
import UserGrowthChart from './components/user-growth-chart'
import SystemStatus from './components/system-status'
import RecentUsers from './components/recent-users'
import QuickActions from './components/quick-actions'
import DataOverview from './components/data-overview'
import { DashboardStats, User } from './types'

// 模拟数据（作为 fallback）
const mockStats: DashboardStats = {
  totalUsers: 1234,
  activeUsers: 45,
  premiumUsers: 89,
  expiredUsers: 23,
  totalKeys: 567,
  usedKeys: 345,
  availableKeys: 222,
  aiUsageCount: 12345,
  totalGames: 890,
  activeGames: 12,
  totalRevenue: 12345.67,
  todayRevenue: 123.45,
  averageSessionDuration: 25.6
}

const mockUsers: User[] = [
  { id: '1', email: 'user1@example.com', nickname: '用户1', last_login_at: new Date(Date.now() - 3600000).toISOString(), account_expires_at: new Date(Date.now() + 86400000).toISOString() },
  { id: '2', email: 'user2@example.com', nickname: '用户2', last_login_at: new Date(Date.now() - 7200000).toISOString(), account_expires_at: new Date(Date.now() - 86400000).toISOString() },
  { id: '3', email: 'user3@example.com', nickname: '用户3', last_login_at: new Date(Date.now() - 10800000).toISOString(), account_expires_at: new Date(Date.now() + 172800000).toISOString() },
  { id: '4', email: 'user4@example.com', nickname: '用户4', last_login_at: new Date(Date.now() - 14400000).toISOString(), account_expires_at: null },
  { id: '5', email: 'user5@example.com', nickname: '用户5', last_login_at: new Date(Date.now() - 18000000).toISOString(), account_expires_at: new Date(Date.now() + 259200000).toISOString() }
]

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>(mockStats)
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 从API获取真实数据
        const response = await fetch('/api/admin/dashboard', { credentials: 'include' });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setStats(result.data.stats);
            setUsers(result.data.users);
          } else {
            console.error('获取数据失败:', result.error);
            // 使用模拟数据作为fallback
            setStats(mockStats);
            setUsers(mockUsers);
          }
        } else {
          console.error('API请求失败:', response.status);
          // 使用模拟数据作为fallback
          setStats(mockStats);
          setUsers(mockUsers);
        }
      } catch (error: unknown) {
        console.error('获取数据失败:', error);
        // 使用模拟数据作为fallback
        setStats(mockStats);
        setUsers(mockUsers);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">加载仪表板数据...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-white">后台仪表板</h1>
        <p className="text-gray-400 mt-2">实时监控系统数据和用户活动</p>
      </div>

      <div className="space-y-6">
        <StatsCards stats={stats} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <UserGrowthChart />
          </div>
          <div>
            <SystemStatus />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentUsers users={users} />
          </div>
          <div className="space-y-6">
            <QuickActions />
            <DataOverview stats={stats} />
          </div>
        </div>
      </div>
    </div>
  )
}