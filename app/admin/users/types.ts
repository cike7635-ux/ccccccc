// /app/admin/users/types.ts - 最终修复版本
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
  createdAt: string
  createdAtRaw: string | null
  accessKeyId: number | null
  activeKey: string | null
  activeKeyUsedAt: string | null
  activeKeyExpires: string | null
  isActive: boolean
}

export interface UserDetail {
  // 基本字段
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
  // 关联数据
  access_keys: any[]
  ai_usage_records: any[]
  game_history: any[]
  key_usage_history?: any[]
  current_access_key?: any
}

export interface AccessKey {
  id: number
  key_code: string
  is_active: boolean
  used_count: number
  max_uses: number
  key_expires_at: string | null
  account_valid_for_days: number
  user_id: string | null
  used_at: string | null
  created_at: string
  updated_at: string
}

// 🔥 归一化函数：智能处理混合命名
export function normalizeUserDetail(data: any): UserDetail {
  if (!data) {
    return {} as UserDetail
  }
  
  console.log('🔍 归一化输入数据:', {
    字段列表: Object.keys(data),
    accessKeys存在: 'accessKeys' in data,
    access_keys存在: 'access_keys' in data,
    aiUsageRecords存在: 'aiUsageRecords' in data,
    ai_usage_records存在: 'ai_usage_records' in data
  })
  
  // 智能检测字段名
  const accessKeysData = data.accessKeys || data.access_keys || []
  const aiUsageRecordsData = data.aiUsageRecords || data.ai_usage_records || []
  const gameHistoryData = data.gameHistory || data.game_history || []
  const currentAccessKeyData = data.currentAccessKey || data.current_access_key || null
  
  const result: UserDetail = {
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
    
    access_keys: Array.isArray(accessKeysData) ? accessKeysData : [],
    ai_usage_records: Array.isArray(aiUsageRecordsData) ? aiUsageRecordsData : [],
    game_history: Array.isArray(gameHistoryData) ? gameHistoryData : []
  }
  
  console.log('✅ 归一化完成:', {
    密钥数量: result.access_keys.length,
    AI记录数量: result.ai_usage_records.length,
    游戏记录数量: result.game_history.length
  })
  
  return result
}
