// /app/admin/users/types.ts - 修复版
export interface User {
  id: string
  email: string
  nickname: string | null
  fullName: string | null
  avatarUrl: string | null
  bio: string | null
  preferences: any
  isAdmin: boolean
  isPremium: boolean
  lastLogin: string
  lastLoginRaw: string | null
  accountExpires: string | null
  accountExpiresRaw: string | null
  createdAt: string
  createdAtRaw: string | null
  accessKeyId: number | null
  activeKey: string | null
  isActive: boolean
  gender: string
  keyStatus?: 'active' | 'expired' | 'unused' | 'inactive'
  isUserActive?: boolean
}

export interface UserDetail {
  id: string
  email: string
  nickname: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  preferences: any
  account_expires_at: string | null
  last_login_at: string | null
  last_login_session: string | null
  access_key_id: number | null
  created_at: string
  updated_at: string
  access_keys: any[]
  ai_usage_records: any[]
  game_history: any[]
  key_usage_history?: any[]
  current_access_key?: any
}

// 排序类型
export type SortField = 
  | 'createdAt' | 'lastLogin' | 'accountExpires' 
  | 'email' | 'nickname' | 'id' | 'isPremium' | 'keyStatus'

export type SortDirection = 'asc' | 'desc'

// 性别显示函数
export function getGenderDisplay(preferences: any): string {
  if (!preferences || !preferences.gender) return '未设置'
  
  const genderMap: Record<string, string> = {
    'male': '男', 'female': '女', 'other': '其他',
    'non_binary': '非二元', 'M': '男', 'F': '女',
    '男': '男', '女': '女', '未知': '未设置',
    '未设置': '未设置', '': '未设置',
    null: '未设置', undefined: '未设置'
  }
  
  const genderKey = String(preferences.gender).toLowerCase()
  return genderMap[genderKey] || String(preferences.gender)
}

// 检查用户是否活跃 - 修复版
export function isUserActive(lastLoginAt: string | null): boolean {
  if (!lastLoginAt) return false
  
  try {
    const lastLogin = new Date(lastLoginAt)
    const now = new Date()
    const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000)
    return lastLogin > threeMinutesAgo
  } catch {
    return false
  }
}

// 获取活跃状态配置
export function getActiveStatusConfig(isActive: boolean) {
  return isActive 
    ? {
        label: '活跃',
        color: 'text-green-400',
        bgColor: 'bg-green-500/15',
        icon: '🟢'
      }
    : {
        label: '离线',
        color: 'text-gray-400',
        bgColor: 'bg-gray-500/10',
        icon: '⚫'
      }
}

// 获取密钥状态
export function getKeyStatus(key: any): 'active' | 'expired' | 'unused' | 'inactive' {
  if (!key) return 'unused'
  
  if (key.is_active === false) return 'inactive'
  
  if (key.key_expires_at) {
    try {
      const expiryDate = new Date(key.key_expires_at)
      if (expiryDate < new Date()) {
        return 'expired'
      }
    } catch {
      // 日期解析失败，不视为过期
    }
  }
  
  return 'active'
}

// 归一化用户详情
export function normalizeUserDetail(data: any): UserDetail {
  if (!data) return {} as UserDetail
  
  // 日期格式化函数
  const formatDate = (dateString: any) => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      return isNaN(date.getTime()) ? null : dateString
    } catch {
      return null
    }
  }
  
  return {
    id: data.id || '',
    email: data.email || '',
    nickname: data.nickname || null,
    full_name: data.full_name || data.fullName || null,
    avatar_url: data.avatar_url || data.avatarUrl || null,
    bio: data.bio || null,
    preferences: data.preferences || {},
    account_expires_at: formatDate(data.account_expires_at || data.accountExpiresAt),
    last_login_at: formatDate(data.last_login_at || data.lastLoginAt),
    last_login_session: data.last_login_session || data.lastLoginSession || null,
    access_key_id: data.access_key_id || data.accessKeyId || null,
    created_at: formatDate(data.created_at || data.createdAt) || '',
    updated_at: formatDate(data.updated_at || data.updatedAt) || '',
    access_keys: data.access_keys || data.accessKeys || [],
    ai_usage_records: data.ai_usage_records || data.aiUsageRecords || [],
    game_history: data.game_history || data.gameHistory || []
  }
}

// 日期比较函数 - 新增
export function compareDates(dateA: string | null, dateB: string | null, direction: SortDirection): number {
  if (!dateA && !dateB) return 0
  if (!dateA) return direction === 'asc' ? 1 : -1
  if (!dateB) return direction === 'asc' ? -1 : 1
  
  try {
    const timeA = new Date(dateA).getTime()
    const timeB = new Date(dateB).getTime()
    
    if (isNaN(timeA) || isNaN(timeB)) return 0
    
    if (direction === 'asc') {
      return timeA - timeB
    } else {
      return timeB - timeA
    }
  } catch {
    return 0
  }
}