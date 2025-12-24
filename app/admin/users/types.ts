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
  // 🔥 统一使用下划线命名，与API保持一致
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

// 🔥 关键修复：增强版归一化函数
export function normalizeUserDetail(data: any): UserDetail {
  if (!data) {
    console.warn('❌ normalizeUserDetail: 输入数据为空')
    return {} as UserDetail
  }
  
  // 🔍 打印完整的API响应，查看真实数据结构
  console.log('🎯 API返回的完整原始数据:', {
    所有字段: Object.keys(data),
    原始数据: data,
    类型检查: {
      是对象: typeof data === 'object',
      是数组: Array.isArray(data),
      是null: data === null
    }
  })
  
  // 🔍 特别检查密钥相关字段
  console.log('🔑 密钥字段详细检查:', {
    // 下划线字段
    has_access_keys: 'access_keys' in data,
    access_keys值: data.access_keys,
    access_keys类型: typeof data.access_keys,
    access_keys长度: data.access_keys?.length || 0,
    
    // 驼峰字段  
    has_accessKeys: 'accessKeys' in data,
    accessKeys值: data.accessKeys,
    accessKeys类型: typeof data.accessKeys,
    accessKeys长度: data.accessKeys?.length || 0,
    
    // 当前密钥
    has_current_access_key: 'current_access_key' in data,
    current_access_key值: data.current_access_key,
    
    // 访问密钥ID
    has_access_key_id: 'access_key_id' in data,
    access_key_id值: data.access_key_id,
    
    has_accessKeyId: 'accessKeyId' in data,
    accessKeyId值: data.accessKeyId
  })
  
  // 🔥 核心修复：智能检测字段名
  // 尝试所有可能的密钥字段名
  let accessKeysData = []
  if (data.access_keys && Array.isArray(data.access_keys)) {
    accessKeysData = data.access_keys
    console.log('✅ 使用 access_keys 字段，长度:', accessKeysData.length)
  } else if (data.accessKeys && Array.isArray(data.accessKeys)) {
    accessKeysData = data.accessKeys
    console.log('✅ 使用 accessKeys 字段，长度:', accessKeysData.length)
  } else if (data.keys && Array.isArray(data.keys)) {
    accessKeysData = data.keys
    console.log('✅ 使用 keys 字段，长度:', accessKeysData.length)
  }
  
  // 🔥 如果没有找到密钥数组，但有当前密钥，则创建一个数组
  if (accessKeysData.length === 0) {
    if (data.current_access_key) {
      accessKeysData = [data.current_access_key]
      console.log('🔄 使用 current_access_key 作为密钥数组')
    } else if (data.currentAccessKey) {
      accessKeysData = [data.currentAccessKey]
      console.log('🔄 使用 currentAccessKey 作为密钥数组')
    }
  }
  
  // 🔥 智能检测AI记录字段
  let aiRecordsData = []
  if (data.ai_usage_records && Array.isArray(data.ai_usage_records)) {
    aiRecordsData = data.ai_usage_records
  } else if (data.aiUsageRecords && Array.isArray(data.aiUsageRecords)) {
    aiRecordsData = data.aiUsageRecords
  }
  
  // 🔥 智能检测游戏历史字段
  let gameHistoryData = []
  if (data.game_history && Array.isArray(data.game_history)) {
    gameHistoryData = data.game_history
  } else if (data.gameHistory && Array.isArray(data.gameHistory)) {
    gameHistoryData = data.gameHistory
  }
  
  // 🔥 构建最终结果（统一使用下划线命名）
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
    
    access_keys: accessKeysData,
    ai_usage_records: aiRecordsData,
    game_history: gameHistoryData
  }
  
  console.log('✅ 归一化完成，结果:', {
    用户ID: result.id,
    邮箱: result.email,
    密钥数量: result.access_keys.length,
    AI记录数量: result.ai_usage_records.length,
    游戏记录数量: result.game_history.length,
    当前密钥ID: result.access_key_id,
    第一条密钥: result.access_keys.length > 0 ? result.access_keys[0] : '无'
  })
  
  return result
}

// 🔥 如果需要，可以添加简化的归一化函数
export function normalizeAccessKeys(keys: any[]): any[] {
  if (!Array.isArray(keys)) return []
  
  return keys.map(key => ({
    id: key.id || 0,
    key_code: key.key_code || key.keyCode || '',
    is_active: key.is_active !== undefined ? key.is_active : 
              (key.isActive !== undefined ? key.isActive : true),
    used_count: key.used_count || key.usedCount || 0,
    max_uses: key.max_uses || key.maxUses || 1,
    key_expires_at: key.key_expires_at || key.keyExpiresAt || null,
    account_valid_for_days: key.account_valid_for_days || key.accountValidForDays || 30,
    user_id: key.user_id || key.userId || null,
    used_at: key.used_at || key.usedAt || null,
    created_at: key.created_at || key.createdAt || '',
    updated_at: key.updated_at || key.updatedAt || ''
  }))
}
// 性别显示函数
export function getGenderDisplay(preferences: any): string {
  if (!preferences || !preferences.gender) return '未设置';
  
  const genderMap: Record<string, string> = {
    'male': '男',
    'female': '女',
    'other': '其他',
    'M': '男',
    'F': '女',
    '男': '男',
    '女': '女',
    '未知': '未设置'
  };
  
  const genderKey = String(preferences.gender).toLowerCase();
  return genderMap[genderKey] || String(preferences.gender);
}
