// /app/admin/users/types.ts - 完整类型定义
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
  activeKeyUsedAt: string | null
  activeKeyExpires: string | null
  isActive: boolean
  gender: string
  keyStatus?: 'active' | 'expired' | 'unused' // 密钥状态
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
export type SortField = 'id' | 'email' | 'nickname' | 'keyStatus' | 'isPremium' | 'gender' | 'lastLogin' | 'createdAt' | 'accountExpires'
export type SortDirection = 'asc' | 'desc'

// 性别显示函数
export function getGenderDisplay(preferences: any): string {
  if (!preferences || !preferences.gender) return '未设置';
  
  const genderMap: Record<string, string> = {
    'male': '男',
    'female': '女',
    'other': '其他',
    'non_binary': '非二元',
    'M': '男',
    'F': '女',
    '男': '男',
    '女': '女',
    '未知': '未设置',
    '未设置': '未设置',
    '': '未设置',
    null: '未设置',
    undefined: '未设置'
  };
  
  const genderKey = String(preferences.gender).toLowerCase();
  return genderMap[genderKey] || String(preferences.gender);
}

// 获取密钥状态
export function getKeyStatus(key: any): 'active' | 'expired' | 'unused' {
  if (!key) return 'unused';
  
  const isExpired = key.key_expires_at && new Date(key.key_expires_at) < new Date();
  const isUsed = key.used_at;
  
  if (isExpired) return 'expired';
  if (isUsed) return 'active';
  return 'unused';
}

// 归一化用户详情数据
export function normalizeUserDetail(data: any): UserDetail {
  if (!data) return {} as UserDetail;
  
  // 智能检测字段名
  const accessKeysData = []
  if (data.access_keys && Array.isArray(data.access_keys)) {
    accessKeysData.push(...data.access_keys)
  } else if (data.accessKeys && Array.isArray(data.accessKeys)) {
    accessKeysData.push(...data.accessKeys)
  }
  
  const aiRecordsData = []
  if (data.ai_usage_records && Array.isArray(data.ai_usage_records)) {
    aiRecordsData.push(...data.ai_usage_records)
  } else if (data.aiUsageRecords && Array.isArray(data.aiUsageRecords)) {
    aiRecordsData.push(...data.aiUsageRecords)
  }
  
  const gameHistoryData = []
  if (data.game_history && Array.isArray(data.game_history)) {
    gameHistoryData.push(...data.game_history)
  } else if (data.gameHistory && Array.isArray(data.gameHistory)) {
    gameHistoryData.push(...data.gameHistory)
  }
  
  return {
    id: data.id || '',
    email: data.email || '',
    nickname: data.nickname || null,
    full_name: data.full_name || data.fullName || null,
    avatar_url: data.avatar_url || data.avatarUrl || null,
    bio: data.bio || null,
    preferences: data.preferences || {},
    account_expires_at: data.account_expires_at || data.accountExpiresAt || null,
    last_login_at: data.last_login_at || data.lastLoginAt || null,
    last_login_session: data.last_login_session || data.lastLoginSession || null,
    access_key_id: data.access_key_id || data.accessKeyId || null,
    created_at: data.created_at || data.createdAt || '',
    updated_at: data.updated_at || data.updatedAt || '',
    access_keys: accessKeysData,
    ai_usage_records: aiRecordsData,
    game_history: gameHistoryData
  }
}
