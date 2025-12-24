// /app/admin/users/types.ts - 修复版本
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
  
  // 关联字段
  accessKeys: AccessKey[]
  aiUsageRecords: AiUsageRecord[]
  gameHistory: GameHistory[]
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

// 🔥 关键修复：简化的归一化函数
export function normalizeUserDetail(data: any): UserDetail {
  if (!data) {
    console.warn('❌ normalizeUserDetail: 输入数据为空')
    return {} as UserDetail
  }
  
  // 🔍 调试日志：查看原始数据
  console.log('🔄 归一化输入数据 - 原始结构:', {
    原始字段: Object.keys(data),
    accessKeys存在: 'accessKeys' in data,
    accessKeys类型: typeof data.accessKeys,
    accessKeys是数组: Array.isArray(data.accessKeys),
    accessKeys长度: data.accessKeys?.length || 0,
    aiUsageRecords存在: 'aiUsageRecords' in data,
    aiUsageRecords类型: typeof data.aiUsageRecords,
    aiUsageRecords是数组: Array.isArray(data.aiUsageRecords),
    aiUsageRecords长度: data.aiUsageRecords?.length || 0,
    gameHistory存在: 'gameHistory' in data,
    gameHistory长度: data.gameHistory?.length || 0
  })
  
  // 🔍 深度调试：查看实际内容
  if (data.accessKeys) {
    console.log('🗝️ 原始密钥数组详情:', {
      是数组: Array.isArray(data.accessKeys),
      长度: data.accessKeys.length,
      第一个元素: data.accessKeys[0],
      第一个元素字段: data.accessKeys[0] ? Object.keys(data.accessKeys[0]) : []
    })
  }
  
  // 🎯 核心修复：正确处理空数组和null值
  const result: UserDetail = {
    // 基本字段直接映射（支持驼峰和下划线）
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
    
    // 🔥 关键修复：使用正确的数组处理逻辑
    accessKeys: normalizeAccessKeys(data.accessKeys),
    aiUsageRecords: normalizeAiUsageRecords(data.aiUsageRecords),
    gameHistory: normalizeGameHistory(data.gameHistory)
  }
  
  console.log('✅ 归一化完成:', {
    accessKeys数量: result.accessKeys.length,
    aiUsageRecords数量: result.aiUsageRecords.length,
    gameHistory数量: result.gameHistory.length,
    第一条密钥: result.accessKeys.length > 0 ? {
      id: result.accessKeys[0].id,
      keyCode: result.accessKeys[0].keyCode,
      isActive: result.accessKeys[0].isActive
    } : '无',
    第一条AI记录: result.aiUsageRecords.length > 0 ? {
      id: result.aiUsageRecords[0].id,
      feature: result.aiUsageRecords[0].feature,
      success: result.aiUsageRecords[0].success
    } : '无'
  })
  
  return result
}

// 🔥 修复：正确处理空数组和字段名兼容
export function normalizeAccessKeys(keys: any): AccessKey[] {
  // ❌ 原来的问题：if (!keys || !Array.isArray(keys)) return []
  // ✅ 修复：正确处理空数组
  
  console.log('🔧 normalizeAccessKeys 输入:', {
    输入类型: typeof keys,
    是数组: Array.isArray(keys),
    输入值: keys
  })
  
  // 处理undefined或null
  if (keys === undefined || keys === null) {
    console.log('📭 keys 是 undefined 或 null，返回空数组')
    return []
  }
  
  // 处理非数组
  if (!Array.isArray(keys)) {
    console.warn('❌ keys 不是数组:', typeof keys, keys)
    return []
  }
  
  // 处理空数组（这是关键！）
  if (keys.length === 0) {
    console.log('📭 keys 是空数组，返回空数组')
    return []
  }
  
  console.log('🔧 开始处理密钥数组，长度:', keys.length)
  
  const result = keys.map((key, index) => {
    // 🔥 深度调试每个密钥
    console.log(`🔧 处理密钥 ${index + 1}:`, {
      所有字段: Object.keys(key),
      keyCode字段值: key.keyCode,
      key_code字段值: key.key_code,
      isActive字段值: key.isActive,
      is_active字段值: key.is_active
    })
    
    // 🔥 智能字段名检测
    const keyCode = key.keyCode || key.key_code || ''
    const isActive = key.isActive !== undefined 
      ? key.isActive 
      : (key.is_active !== undefined ? key.is_active : true)
    
    return {
      id: key.id || 0,
      keyCode: keyCode,
      isActive: isActive,
      usedCount: key.usedCount || key.used_count || 0,
      maxUses: key.maxUses || key.max_uses || 1,
      keyExpiresAt: key.keyExpiresAt || key.key_expires_at || null,
      accountValidForDays: key.accountValidForDays || key.account_valid_for_days || 30,
      userId: key.userId || key.user_id || null,
      usedAt: key.usedAt || key.used_at || null,
      createdAt: key.createdAt || key.created_at || '',
      updatedAt: key.updatedAt || key.updated_at || ''
    }
  })
  
  console.log('✅ normalizeAccessKeys 输出:', {
    处理数量: result.length,
    第一个结果: result[0]
  })
  
  return result
}

// 🔥 同样修复AI记录处理
export function normalizeAiUsageRecords(records: any): AiUsageRecord[] {
  console.log('🔧 normalizeAiUsageRecords 输入:', {
    输入类型: typeof records,
    是数组: Array.isArray(records),
    输入值: records
  })
  
  if (records === undefined || records === null) {
    console.log('📭 records 是 undefined 或 null，返回空数组')
    return []
  }
  
  if (!Array.isArray(records)) {
    console.warn('❌ records 不是数组:', typeof records, records)
    return []
  }
  
  if (records.length === 0) {
    console.log('📭 records 是空数组，返回空数组')
    return []
  }
  
  console.log('🔧 开始处理AI记录数组，长度:', records.length)
  
  const result = records.map(record => ({
    id: record.id || 0,
    userId: record.userId || record.user_id || '',
    feature: record.feature || 'unknown',
    createdAt: record.createdAt || record.created_at || '',
    requestData: record.requestData || record.request_data || {},
    responseData: record.responseData || record.response_data || {},
    success: record.success !== undefined ? record.success : true
  }))
  
  console.log('✅ normalizeAiUsageRecords 输出:', {
    处理数量: result.length,
    第一个结果: result[0]
  })
  
  return result
}

// 🔥 同样修复游戏记录处理
export function normalizeGameHistory(games: any): GameHistory[] {
  console.log('🔧 normalizeGameHistory 输入:', {
    输入类型: typeof games,
    是数组: Array.isArray(games),
    输入值: games
  })
  
  if (games === undefined || games === null) {
    console.log('📭 games 是 undefined 或 null，返回空数组')
    return []
  }
  
  if (!Array.isArray(games)) {
    console.warn('❌ games 不是数组:', typeof games, games)
    return []
  }
  
  if (games.length === 0) {
    console.log('📭 games 是空数组，返回空数组')
    return []
  }
  
  console.log('🔧 开始处理游戏记录数组，长度:', games.length)
  
  const result = games.map(game => ({
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
  
  console.log('✅ normalizeGameHistory 输出:', {
    处理数量: result.length,
    第一个结果: result[0]
  })
  
  return result
}
