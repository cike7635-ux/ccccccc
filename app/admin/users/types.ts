// /app/admin/users/types.ts - 最终修复版本
export interface User {
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
  
  // 计算字段
  isActive?: boolean
  isPremium?: boolean
  daysRemaining?: number
  lastLogin?: string
  accountExpires?: string
  activeKey?: string | null
}

export interface UserDetail {
  // 基本字段（驼峰命名）
  id: string
  email: string
  nickname: string | null
  fullName: string | null
  avatarUrl: string | null
  bio: string | null
  preferences: any
  accountExpiresAt: string | null
  lastLoginAt: string | null
  lastLoginSession: string | null
  accessKeyId: number | null
  createdAt: string
  updatedAt: string
  
  // 兼容性字段：所有密钥
  accessKeys: AccessKey[]
  
  // AI使用记录
  aiUsageRecords: AiUsageRecord[]
  
  // 游戏历史记录
  gameHistory: GameHistory[]
  
  // 🔥 新增：当前使用的密钥
  currentAccessKey: AccessKey | null
}

export interface AccessKey {
  id: number
  keyCode: string
  isActive: boolean
  usedCount: number
  maxUses: number
  keyExpiresAt: string | null
  accountValidForDays: number
  userId: string | null
  usedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AiUsageRecord {
  id: number
  userId: string
  feature: string
  createdAt: string
  requestData: any
  responseData: any
  success: boolean
}

export interface GameHistory {
  id: string
  roomId: string | null
  sessionId: string | null
  player1Id: string
  player2Id: string
  winnerId: string | null
  startedAt: string | null
  endedAt: string | null
  taskResults: any[]
}

// 🔥 最终修复：正确处理混合命名
export function normalizeUserDetail(data: any): UserDetail {
  if (!data) {
    console.warn('❌ normalizeUserDetail: 输入数据为空')
    return {} as UserDetail
  }
  
  // 🔍 关键：打印完整的原始数据结构
  console.log('🎯 完整原始数据结构分析:', {
    所有字段: Object.keys(data),
    accessKeys字段存在: 'accessKeys' in data,
    accessKeys值: data.accessKeys,
    accessKeys是数组: Array.isArray(data.accessKeys),
    accessKeys长度: data.accessKeys?.length || 0,
    aiUsageRecords字段存在: 'aiUsageRecords' in data,
    aiUsageRecords值: data.aiUsageRecords,
    aiUsageRecords是数组: Array.isArray(data.aiUsageRecords),
    aiUsageRecords长度: data.aiUsageRecords?.length || 0,
    currentAccessKey字段存在: 'currentAccessKey' in data,
    currentAccessKey值: data.currentAccessKey
  })
  
  // 🔍 如果字段存在但是空数组，打印API验证
  if ('accessKeys' in data && Array.isArray(data.accessKeys) && data.accessKeys.length === 0) {
    console.warn('⚠️ 前端收到accessKeys为空数组！但API返回有数据')
    // 尝试直接调用API验证
    fetch('/api/admin/data?table=profiles&detailId=50be6bfc-ec45-4ba8-9200-f4b14d129a24')
      .then(r => r.json())
      .then(apiData => {
        console.log('🔍 API直接验证:', {
          API返回accessKeys长度: apiData.data?.accessKeys?.length || 0,
          API返回accessKeys: apiData.data?.accessKeys?.[0],
          API返回aiUsageRecords长度: apiData.data?.aiUsageRecords?.length || 0
        })
      })
  }
  
  // 🔥 核心修复：直接使用前端接收的字段名
  // 注意：前端接收的是混合命名，accessKeys和aiUsageRecords是驼峰命名
  const accessKeysData = data.accessKeys || []
  const aiUsageRecordsData = data.aiUsageRecords || []
  const currentAccessKeyData = data.currentAccessKey || null
  
  console.log('🔧 数据提取结果:', {
    accessKeys数据: accessKeysData,
    accessKeys长度: accessKeysData.length,
    aiUsageRecords数据: aiUsageRecordsData,
    aiUsageRecords长度: aiUsageRecordsData.length,
    currentAccessKey数据: currentAccessKeyData
  })
  
  // 如果前端接收的是空数组，但实际API有数据，可能是数据传递问题
  // 我们尝试从currentAccessKey构建一个密钥数组
  let finalAccessKeys = accessKeysData
  if (accessKeysData.length === 0 && currentAccessKeyData) {
    console.log('🔄 使用currentAccessKey构建密钥数组')
    finalAccessKeys = [currentAccessKeyData]
  }
  
  const result: UserDetail = {
    // 基本字段（支持混合命名）
    id: data.id || '',
    email: data.email || '',
    nickname: data.nickname || null,
    fullName: data.fullName || data.full_name || null,
    avatarUrl: data.avatarUrl || data.avatar_url || null,
    bio: data.bio || null,
    preferences: data.preferences || {},
    accountExpiresAt: data.accountExpiresAt || data.account_expires_at || null,
    lastLoginAt: data.lastLoginAt || data.last_login_at || null,
    lastLoginSession: data.lastLoginSession || data.last_login_session || null,
    accessKeyId: data.accessKeyId || data.access_key_id || null,
    createdAt: data.createdAt || data.created_at || '',
    updatedAt: data.updatedAt || data.updated_at || '',
    
    // 🔥 直接使用提取的数据
    accessKeys: normalizeAccessKeys(finalAccessKeys),
    aiUsageRecords: normalizeAiUsageRecords(aiUsageRecordsData),
    gameHistory: normalizeGameHistory(data.gameHistory || []),
    currentAccessKey: currentAccessKeyData ? normalizeAccessKey(currentAccessKeyData) : null
  }
  
  console.log('✅ 归一化最终结果:', {
    密钥数量: result.accessKeys.length,
    AI记录数量: result.aiUsageRecords.length,
    当前密钥存在: !!result.currentAccessKey,
    第一条密钥: result.accessKeys.length > 0 ? result.accessKeys[0] : '无',
    第一条AI记录: result.aiUsageRecords.length > 0 ? result.aiUsageRecords[0] : '无'
  })
  
  return result
}

// 简化的归一化函数
export function normalizeAccessKeys(keys: any): AccessKey[] {
  if (!Array.isArray(keys)) return []
  
  console.log('🔧 normalizeAccessKeys 处理:', {
    输入长度: keys.length,
    第一个元素: keys[0],
    第一个元素字段: keys[0] ? Object.keys(keys[0]) : []
  })
  
  return keys.map(key => ({
    id: key.id || 0,
    keyCode: key.keyCode || key.key_code || '',
    isActive: key.isActive !== undefined ? key.isActive : 
             (key.is_active !== undefined ? key.is_active : true),
    usedCount: key.usedCount || key.used_count || 0,
    maxUses: key.maxUses || key.max_uses || 1,
    keyExpiresAt: key.keyExpiresAt || key.key_expires_at || null,
    accountValidForDays: key.accountValidForDays || key.account_valid_for_days || 30,
    userId: key.userId || key.user_id || null,
    usedAt: key.usedAt || key.used_at || null,
    createdAt: key.createdAt || key.created_at || '',
    updatedAt: key.updatedAt || key.updated_at || ''
  }))
}

export function normalizeAccessKey(key: any): AccessKey {
  return {
    id: key.id || 0,
    keyCode: key.keyCode || key.key_code || '',
    isActive: key.isActive !== undefined ? key.isActive : 
             (key.is_active !== undefined ? key.is_active : true),
    usedCount: key.usedCount || key.used_count || 0,
    maxUses: key.maxUses || key.max_uses || 1,
    keyExpiresAt: key.keyExpiresAt || key.key_expires_at || null,
    accountValidForDays: key.accountValidForDays || key.account_valid_for_days || 30,
    userId: key.userId || key.user_id || null,
    usedAt: key.usedAt || key.used_at || null,
    createdAt: key.createdAt || key.created_at || '',
    updatedAt: key.updatedAt || key.updated_at || ''
  }
}

export function normalizeAiUsageRecords(records: any): AiUsageRecord[] {
  if (!Array.isArray(records)) return []
  
  console.log('🔧 normalizeAiUsageRecords 处理:', {
    输入长度: records.length,
    第一个元素: records[0],
    第一个元素字段: records[0] ? Object.keys(records[0]) : []
  })
  
  return records.map(record => ({
    id: record.id || 0,
    userId: record.userId || record.user_id || '',
    feature: record.feature || 'unknown',
    createdAt: record.createdAt || record.created_at || '',
    requestData: record.requestData || record.request_data || {},
    responseData: record.responseData || record.response_data || {},
    success: record.success !== undefined ? record.success : true
  }))
}

export function normalizeGameHistory(games: any): GameHistory[] {
  if (!Array.isArray(games)) return []
  
  return games.map(game => ({
    id: game.id || '',
    roomId: game.roomId || game.room_id || null,
    sessionId: game.sessionId || game.session_id || null,
    player1Id: game.player1Id || game.player1_id || '',
    player2Id: game.player2Id || game.player2_id || '',
    winnerId: game.winnerId || game.winner_id || null,
    startedAt: game.startedAt || game.started_at || null,
    endedAt: game.endedAt || game.ended_at || null,
    taskResults: game.taskResults || game.task_results || []
  }))
}
