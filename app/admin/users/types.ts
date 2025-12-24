// /app/admin/users/types.ts - 紧急修复版本（解决编译错误）
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
  
  // 新增：密钥使用历史
  keyUsageHistory: KeyUsageHistory[]
  
  // 新增：当前使用的密钥
  currentAccessKey: AccessKey | null
  
  // 兼容性字段：所有密钥
  accessKeys: AccessKey[]
  
  // AI使用记录
  aiUsageRecords: AiUsageRecord[]
  
  // 游戏历史记录
  gameHistory: GameHistory[]
}

export interface KeyUsageHistory {
  id: number
  userId: string
  accessKeyId: number
  usedAt: string
  usageType: 'activate' | 'renew' | 'change' | 'system' | 'admin'
  previousKeyId: number | null
  nextKeyId: number | null
  operationBy: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  
  // 关联数据
  accessKey?: AccessKey | null
  operator?: { id: string; email: string; nickname: string } | null
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

// 🔥 核心修复：简化的归一化函数（去除未定义的函数调用）
export function normalizeUserDetail(data: any): UserDetail {
  if (!data) {
    console.warn('❌ normalizeUserDetail: 输入数据为空')
    return {} as UserDetail
  }
  
  // 🔍 简化的调试日志
  console.log('🔄 归一化开始 - 原始数据字段:', Object.keys(data))
  
  // 🎯 关键发现：从API验证看到数据已经是驼峰命名，且数据完整！
  // 问题在于前端接收的数据与API返回的不一致
  
  // 直接使用data中的字段（API返回的是驼峰命名）
  const result: UserDetail = {
    // 基本字段
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
    
    // 🔥 关键修复：直接使用API返回的数据
    keyUsageHistory: Array.isArray(data.keyUsageHistory) ? data.keyUsageHistory.map((item: any) => ({
      id: item.id || 0,
      userId: item.userId || item.user_id || '',
      accessKeyId: item.accessKeyId || item.access_key_id || 0,
      usedAt: item.usedAt || item.used_at || '',
      usageType: item.usageType || item.usage_type || 'activate',
      previousKeyId: item.previousKeyId || item.previous_key_id || null,
      nextKeyId: item.nextKeyId || item.next_key_id || null,
      operationBy: item.operationBy || item.operation_by || null,
      notes: item.notes || null,
      createdAt: item.createdAt || item.created_at || '',
      updatedAt: item.updatedAt || item.updated_at || '',
      accessKey: item.accessKey ? {
        id: item.accessKey.id || 0,
        keyCode: item.accessKey.keyCode || item.accessKey.key_code || '',
        isActive: item.accessKey.isActive !== undefined ? item.accessKey.isActive : 
                 (item.accessKey.is_active !== undefined ? item.accessKey.is_active : true),
        usedCount: item.accessKey.usedCount || item.accessKey.used_count || 0,
        maxUses: item.accessKey.maxUses || item.accessKey.max_uses || 1,
        keyExpiresAt: item.accessKey.keyExpiresAt || item.accessKey.key_expires_at || null,
        accountValidForDays: item.accessKey.accountValidForDays || item.accessKey.account_valid_for_days || 30,
        userId: item.accessKey.userId || item.accessKey.user_id || null,
        usedAt: item.accessKey.usedAt || item.accessKey.used_at || null,
        createdAt: item.accessKey.createdAt || item.accessKey.created_at || '',
        updatedAt: item.accessKey.updatedAt || item.accessKey.updated_at || ''
      } : null,
      operator: item.operator ? {
        id: item.operator.id || '',
        email: item.operator.email || '',
        nickname: item.operator.nickname || null
      } : null
    })) : [],
    
    currentAccessKey: data.currentAccessKey ? {
      id: data.currentAccessKey.id || 0,
      keyCode: data.currentAccessKey.keyCode || data.currentAccessKey.key_code || '',
      isActive: data.currentAccessKey.isActive !== undefined ? data.currentAccessKey.isActive : 
               (data.currentAccessKey.is_active !== undefined ? data.currentAccessKey.is_active : true),
      usedCount: data.currentAccessKey.usedCount || data.currentAccessKey.used_count || 0,
      maxUses: data.currentAccessKey.maxUses || data.currentAccessKey.max_uses || 1,
      keyExpiresAt: data.currentAccessKey.keyExpiresAt || data.currentAccessKey.key_expires_at || null,
      accountValidForDays: data.currentAccessKey.accountValidForDays || data.currentAccessKey.account_valid_for_days || 30,
      userId: data.currentAccessKey.userId || data.currentAccessKey.user_id || null,
      usedAt: data.currentAccessKey.usedAt || data.currentAccessKey.used_at || null,
      createdAt: data.currentAccessKey.createdAt || data.currentAccessKey.created_at || '',
      updatedAt: data.currentAccessKey.updatedAt || data.currentAccessKey.updated_at || ''
    } : null,
    
    accessKeys: Array.isArray(data.accessKeys) ? data.accessKeys.map((key: any) => ({
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
    })) : [],
    
    aiUsageRecords: Array.isArray(data.aiUsageRecords) ? data.aiUsageRecords.map((record: any) => ({
      id: record.id || 0,
      userId: record.userId || record.user_id || '',
      feature: record.feature || 'unknown',
      createdAt: record.createdAt || record.created_at || '',
      requestData: record.requestData || record.request_data || {},
      responseData: record.responseData || record.response_data || {},
      success: record.success !== undefined ? record.success : true
    })) : [],
    
    gameHistory: Array.isArray(data.gameHistory) ? data.gameHistory.map((game: any) => ({
      id: game.id || '',
      roomId: game.roomId || game.room_id || null,
      sessionId: game.sessionId || game.session_id || null,
      player1Id: game.player1Id || game.player1_id || '',
      player2Id: game.player2Id || game.player2_id || '',
      winnerId: game.winnerId || game.winner_id || null,
      startedAt: game.startedAt || game.started_at || null,
      endedAt: game.endedAt || game.ended_at || null,
      taskResults: game.taskResults || game.task_results || []
    })) : []
  }
  
  console.log('✅ 归一化完成:', {
    密钥使用历史数量: result.keyUsageHistory.length,
    当前密钥存在: !!result.currentAccessKey,
    所有密钥数量: result.accessKeys.length,
    AI记录数量: result.aiUsageRecords.length,
    游戏记录数量: result.gameHistory.length
  })
  
  return result
}

// 🔥 兼容性：保留原有的归一化函数（简化版）
export function normalizeAccessKeys(keys: any): AccessKey[] {
  if (!Array.isArray(keys)) return []
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

export function normalizeAiUsageRecords(records: any): AiUsageRecord[] {
  if (!Array.isArray(records)) return []
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
