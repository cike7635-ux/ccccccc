// /app/admin/users/types.ts - 优化版本
// 类型定义优化：同时支持驼峰和下划线命名，保持向后兼容

// 用户列表项
export interface User {
  // 数据库原始字段（下划线）
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
  
  // 前端计算字段（驼峰）
  isActive?: boolean
  isPremium?: boolean
  daysRemaining?: number
  lastLogin?: string
  accountExpires?: string
  activeKey?: string | null
}

// 用户详情 - 主接口（驼峰命名）
export interface UserDetail {
  // 🔥 基本字段（支持两种命名）
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
  
  // 🔥 关联字段（驼峰命名）
  accessKeys: AccessKey[]
  aiUsageRecords: AiUsageRecord[]
  gameHistory: GameHistory[]
  
  // 🔥 向后兼容字段（通过索引签名）
  [key: string]: any
}

// 向后兼容接口
export interface LegacyUserDetail {
  // 下划线字段
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
  
  // 下划线关联字段
  access_keys?: any[]
  ai_usage_records?: any[]
  game_history?: any[]
  
  // 驼峰关联字段
  accessKeys?: any[]
  aiUsageRecords?: any[]
  gameHistory?: any[]
}

// 类型守卫
export function isUserDetail(data: any): data is UserDetail {
  return data && typeof data.id === 'string' && typeof data.email === 'string'
}

export function isLegacyUserDetail(data: any): data is LegacyUserDetail {
  return data && typeof data.id === 'string' && typeof data.email === 'string'
}

// 访问密钥类型
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
  
  // 向后兼容
  key_code?: string
  is_active?: boolean
  used_count?: number
  max_uses?: number
  key_expires_at?: string | null
  account_valid_for_days?: number
  user_id?: string | null
  used_at?: string | null
  created_at?: string
  updated_at?: string
}

// AI使用记录类型
export interface AiUsageRecord {
  id: number
  userId: string
  feature: string
  createdAt: string
  requestData: any
  responseData: any
  success: boolean
  
  // 向后兼容
  user_id?: string
  created_at?: string
  request_data?: any
  response_data?: any
}

// 游戏历史记录类型
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
  
  // 向后兼容
  room_id?: string | null
  session_id?: string | null
  player1_id?: string
  player2_id?: string
  winner_id?: string | null
  started_at?: string | null
  ended_at?: string | null
  task_results?: any[]
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: any
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
  }
}

// 用户列表API响应
export interface UsersApiResponse extends ApiResponse<User[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
  }
}

// 用户详情API响应
export interface UserDetailApiResponse extends ApiResponse<UserDetail> {}

// 工具函数：数据转换
export function normalizeUserDetail(data: any): UserDetail {
  if (!data) return {} as UserDetail
  
  // 优先使用驼峰字段
  return {
    id: data.id || '',
    email: data.email || '',
    nickname: data.nickname || data.nickname || null,
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
    
    // 智能处理关联字段
    accessKeys: normalizeAccessKeys(data.accessKeys || data.access_keys || []),
    aiUsageRecords: normalizeAiUsageRecords(data.aiUsageRecords || data.ai_usage_records || []),
    gameHistory: normalizeGameHistory(data.gameHistory || data.game_history || [])
  }
}

export function normalizeAccessKeys(keys: any[]): AccessKey[] {
  return keys.map(key => ({
    id: key.id || 0,
    keyCode: key.keyCode || key.key_code || '',
    isActive: key.isActive !== undefined ? key.isActive : (key.is_active !== undefined ? key.is_active : true),
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

export function normalizeAiUsageRecords(records: any[]): AiUsageRecord[] {
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

export function normalizeGameHistory(games: any[]): GameHistory[] {
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