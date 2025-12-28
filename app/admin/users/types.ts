/**
 * LOVE LUDO 后台管理系统 - 用户管理类型定义
 * 完整版：修复所有类型问题，支持新API响应格式
 */

// ============================================
// 1. 核心用户类型
// ============================================

/**
 * 用户基础信息
 */
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
  
  // 🔧 新增字段：API返回的扩展字段
  gender_display?: string
  is_premium?: boolean
  is_active_now?: boolean
  key_status?: string
  formatted_created_at?: string
  formatted_last_login?: string
  
  // 数据库原始字段（用于类型兼容）
  created_at?: string
  last_login_at?: string | null
  account_expires_at?: string | null
  avatar_url?: string | null
  full_name?: string | null
  last_login_session?: string | null
  updated_at?: string | null
  current_key?: any
}

/**
 * 用户详情信息（API返回格式）
 */
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
  access_keys: AccessKey[]
  ai_usage_records: AIUsageRecord[]
  game_history: GameHistory[]
  key_usage_history?: KeyUsageHistory[]
  current_access_key?: AccessKey
  
  // 驼峰命名兼容字段
  fullName?: string | null
  avatarUrl?: string | null
  accountExpiresAt?: string | null
  lastLoginAt?: string | null
  lastLoginSession?: string | null
  accessKeyId?: number | null
  createdAt?: string
  updatedAt?: string
  accessKeys?: AccessKey[]
  aiUsageRecords?: AIUsageRecord[]
  gameHistory?: GameHistory[]
  keyUsageHistory?: KeyUsageHistory[]
  currentAccessKey?: AccessKey
}

// ============================================
// 2. 相关数据类型
// ============================================

/**
 * 访问密钥
 */
export interface AccessKey {
  id: number
  key_code: string
  description: string | null
  is_active: boolean
  used_count: number
  max_uses: number | null
  account_valid_for_days: number | null
  original_duration_hours: number | null
  key_expires_at: string | null
  user_id: string | null
  used_at: string | null
  created_at: string
  updated_at: string
  
  // 驼峰命名兼容字段
  keyCode?: string
  isActive?: boolean
  usedCount?: number
  maxUses?: number | null
  accountValidForDays?: number | null
  originalDurationHours?: number | null
  keyExpiresAt?: string | null
  userId?: string | null
  usedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

/**
 * AI使用记录
 */
export interface AIUsageRecord {
  id: number
  user_id: string
  created_at: string
  input_text: string
  response_text: string
  model: string | null
  tokens_used: number | null
  session_id: string | null
  
  // 驼峰命名兼容字段
  userId?: string
  createdAt?: string
  inputText?: string
  responseText?: string
  model?: string | null
  tokensUsed?: number | null
  sessionId?: string | null
}

/**
 * 游戏历史记录
 */
export interface GameHistory {
  id: number
  user_id: string
  created_at: string
  game_type: string
  score: number | null
  duration_seconds: number | null
  opponent_id: string | null
  result: 'win' | 'loss' | 'draw' | null
  
  // 驼峰命名兼容字段
  userId?: string
  createdAt?: string
  gameType?: string
  score?: number | null
  durationSeconds?: number | null
  opponentId?: string | null
  result?: 'win' | 'loss' | 'draw' | null
}

/**
 * 密钥使用历史
 */
export interface KeyUsageHistory {
  id: number
  user_id: string
  access_key_id: number
  used_at: string
  usage_type: 'activate' | 'renew' | 'transfer'
  operation_by: string | null
  note: string | null
  
  // 驼峰命名兼容字段
  userId?: string
  accessKeyId?: number
  usedAt?: string
  usageType?: 'activate' | 'renew' | 'transfer'
  operationBy?: string | null
  note?: string | null
}

/**
 * 用户统计数据
 */
export interface UserStats {
  total: number
  premium: number
  active24h: number
  male: number
  female: number
  otherGender: number
  unknown: number
  activeNow: number
  deleted: number
  newThisWeek: number
}

/**
 * 增长数据
 */
export interface GrowthData {
  date: string
  count: number
  cumulative: number
}

/**
 * API分页信息
 */
export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * API排序信息
 */
export interface SortInfo {
  field: string
  direction: 'asc' | 'desc'
  dbField?: string
}

/**
 * API响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: string
  pagination?: PaginationInfo
  sortInfo?: SortInfo
  timestamp?: string
  queryTime?: string
}

// ============================================
// 3. 枚举类型
// ============================================

/**
 * 排序字段枚举
 */
export type SortField = 
  | 'createdAt' 
  | 'lastLogin' 
  | 'accountExpires' 
  | 'email' 
  | 'nickname' 
  | 'id' 
  | 'isPremium' 
  | 'keyStatus'
  | 'gender'

/**
 * 排序方向枚举
 */
export type SortDirection = 'asc' | 'desc'

/**
 * 用户筛选类型枚举
 */
export type UserFilterType = 
  | 'all' 
  | 'premium' 
  | 'free' 
  | 'active24h' 
  | 'active' 
  | 'expired' 
  | 'male' 
  | 'female'

/**
 * 密钥状态枚举
 */
export type KeyStatus = 'active' | 'expired' | 'unused' | 'inactive'

/**
 * 用户状态枚举
 */
export type UserStatus = 'active' | 'inactive' | 'expired' | 'deleted'

/**
 * 性别显示值枚举
 */
export type GenderDisplay = '男' | '女' | '其他' | '非二元' | '未设置'

// ============================================
// 4. 工具函数
// ============================================

/**
 * 获取性别显示文本
 * @param preferences 用户偏好设置对象
 * @param genderDisplay API返回的性别显示值（可选）
 * @returns 格式化后的性别显示文本
 */
export function getGenderDisplay(preferences: any, genderDisplay?: string): GenderDisplay {
  // 优先使用API返回的gender_display
  if (genderDisplay && ['男', '女', '其他', '非二元', '未设置'].includes(genderDisplay)) {
    return genderDisplay as GenderDisplay
  }
  
  if (!preferences || !preferences.gender) return '未设置'
  
  const genderMap: Record<string, GenderDisplay> = {
    'male': '男', 'm': '男', '男': '男',
    'female': '女', 'f': '女', '女': '女',
    'other': '其他', 'other': '其他',
    'non_binary': '非二元', 'non_binary': '非二元',
    '未设置': '未设置', '': '未设置',
    'null': '未设置', 'undefined': '未设置'
  }
  
  const genderKey = String(preferences.gender).toLowerCase().trim()
  return genderMap[genderKey] || '未设置'
}

/**
 * 检查用户是否活跃（3分钟内登录）
 * @param lastLoginAt 最后登录时间
 * @returns 是否活跃
 */
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

/**
 * 获取活跃状态配置
 * @param isActive 是否活跃
 * @returns 活跃状态配置对象
 */
export interface ActiveStatusConfig {
  label: string
  color: string
  bgColor: string
  icon: string
}

export function getActiveStatusConfig(isActive: boolean): ActiveStatusConfig {
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

/**
 * 获取密钥状态
 * @param key 密钥对象
 * @returns 密钥状态
 */
export function getKeyStatus(key: any): KeyStatus {
  if (!key) return 'unused'
  
  if (key.is_active === false || key.isActive === false) {
    return 'inactive'
  }
  
  const expiryDate = key.key_expires_at || key.keyExpiresAt
  if (expiryDate) {
    try {
      const expiry = new Date(expiryDate)
      if (expiry < new Date()) {
        return 'expired'
      }
    } catch {
      // 日期解析失败，不视为过期
    }
  }
  
  return 'active'
}

/**
 * 归一化用户详情数据（处理API响应格式）
 * @param data API返回的用户详情数据
 * @returns 归一化后的用户详情
 */
export function normalizeUserDetail(data: any): UserDetail {
  if (!data) return {} as UserDetail
  
  // 日期格式化辅助函数
  const formatDate = (dateString: any): string | null => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      return isNaN(date.getTime()) ? null : date.toISOString()
    } catch {
      return null
    }
  }
  
  // 处理数组字段，确保格式统一
  const normalizeArray = <T>(arr: any[] | undefined, mapper: (item: any) => T): T[] => {
    if (!Array.isArray(arr)) return []
    return arr.map(mapper)
  }
  
  // 处理访问密钥
  const normalizeAccessKey = (key: any): AccessKey => ({
    id: key.id || 0,
    key_code: key.key_code || key.keyCode || '',
    description: key.description || null,
    is_active: key.is_active ?? key.isActive ?? true,
    used_count: key.used_count || key.usedCount || 0,
    max_uses: key.max_uses || key.maxUses || null,
    account_valid_for_days: key.account_valid_for_days || key.accountValidForDays || null,
    original_duration_hours: key.original_duration_hours || key.originalDurationHours || null,
    key_expires_at: formatDate(key.key_expires_at || key.keyExpiresAt),
    user_id: key.user_id || key.userId || null,
    used_at: formatDate(key.used_at || key.usedAt),
    created_at: formatDate(key.created_at || key.createdAt) || new Date().toISOString(),
    updated_at: formatDate(key.updated_at || key.updatedAt) || new Date().toISOString(),
    
    // 驼峰命名兼容字段
    keyCode: key.key_code || key.keyCode || '',
    isActive: key.is_active ?? key.isActive ?? true,
    usedCount: key.used_count || key.usedCount || 0,
    maxUses: key.max_uses || key.maxUses || null,
    accountValidForDays: key.account_valid_for_days || key.accountValidForDays || null,
    originalDurationHours: key.original_duration_hours || key.originalDurationHours || null,
    keyExpiresAt: formatDate(key.key_expires_at || key.keyExpiresAt),
    userId: key.user_id || key.userId || null,
    usedAt: formatDate(key.used_at || key.usedAt),
    createdAt: formatDate(key.created_at || key.createdAt) || new Date().toISOString(),
    updatedAt: formatDate(key.updated_at || key.updatedAt) || new Date().toISOString()
  })
  
  // 处理AI使用记录
  const normalizeAIUsageRecord = (record: any): AIUsageRecord => ({
    id: record.id || 0,
    user_id: record.user_id || record.userId || '',
    created_at: formatDate(record.created_at || record.createdAt) || new Date().toISOString(),
    input_text: record.input_text || record.inputText || '',
    response_text: record.response_text || record.responseText || '',
    model: record.model || null,
    tokens_used: record.tokens_used || record.tokensUsed || null,
    session_id: record.session_id || record.sessionId || null,
    
    // 驼峰命名兼容字段
    userId: record.user_id || record.userId || '',
    createdAt: formatDate(record.created_at || record.createdAt) || new Date().toISOString(),
    inputText: record.input_text || record.inputText || '',
    responseText: record.response_text || record.responseText || '',
    model: record.model || null,
    tokensUsed: record.tokens_used || record.tokensUsed || null,
    sessionId: record.session_id || record.sessionId || null
  })
  
  // 处理游戏历史记录
  const normalizeGameHistory = (history: any): GameHistory => ({
    id: history.id || 0,
    user_id: history.user_id || history.userId || '',
    created_at: formatDate(history.created_at || history.createdAt) || new Date().toISOString(),
    game_type: history.game_type || history.gameType || 'unknown',
    score: history.score || null,
    duration_seconds: history.duration_seconds || history.durationSeconds || null,
    opponent_id: history.opponent_id || history.opponentId || null,
    result: history.result || null,
    
    // 驼峰命名兼容字段
    userId: history.user_id || history.userId || '',
    createdAt: formatDate(history.created_at || history.createdAt) || new Date().toISOString(),
    gameType: history.game_type || history.gameType || 'unknown',
    score: history.score || null,
    durationSeconds: history.duration_seconds || history.durationSeconds || null,
    opponentId: history.opponent_id || history.opponentId || null,
    result: history.result || null
  })
  
  // 处理密钥使用历史
  const normalizeKeyUsageHistory = (history: any): KeyUsageHistory => ({
    id: history.id || 0,
    user_id: history.user_id || history.userId || '',
    access_key_id: history.access_key_id || history.accessKeyId || 0,
    used_at: formatDate(history.used_at || history.usedAt) || new Date().toISOString(),
    usage_type: history.usage_type || history.usageType || 'activate',
    operation_by: history.operation_by || history.operationBy || null,
    note: history.note || null,
    
    // 驼峰命名兼容字段
    userId: history.user_id || history.userId || '',
    accessKeyId: history.access_key_id || history.accessKeyId || 0,
    usedAt: formatDate(history.used_at || history.usedAt) || new Date().toISOString(),
    usageType: history.usage_type || history.usageType || 'activate',
    operationBy: history.operation_by || history.operationBy || null,
    note: history.note || null
  })
  
  // 构建归一化对象
  const normalized: UserDetail = {
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
    created_at: formatDate(data.created_at || data.createdAt) || new Date().toISOString(),
    updated_at: formatDate(data.updated_at || data.updatedAt) || new Date().toISOString(),
    
    // 数组字段
    access_keys: normalizeArray(data.access_keys || data.accessKeys, normalizeAccessKey),
    ai_usage_records: normalizeArray(data.ai_usage_records || data.aiUsageRecords, normalizeAIUsageRecord),
    game_history: normalizeArray(data.game_history || data.gameHistory, normalizeGameHistory),
    key_usage_history: normalizeArray(data.key_usage_history || data.keyUsageHistory, normalizeKeyUsageHistory),
    
    // 当前访问密钥
    current_access_key: data.current_access_key || data.currentAccessKey 
      ? normalizeAccessKey(data.current_access_key || data.currentAccessKey)
      : undefined,
    
    // 驼峰命名兼容字段
    fullName: data.full_name || data.fullName || null,
    avatarUrl: data.avatar_url || data.avatarUrl || null,
    accountExpiresAt: formatDate(data.account_expires_at || data.accountExpiresAt),
    lastLoginAt: formatDate(data.last_login_at || data.lastLoginAt),
    lastLoginSession: data.last_login_session || data.lastLoginSession || null,
    accessKeyId: data.access_key_id || data.accessKeyId || null,
    createdAt: formatDate(data.created_at || data.createdAt) || new Date().toISOString(),
    updatedAt: formatDate(data.updated_at || data.updatedAt) || new Date().toISOString(),
    accessKeys: normalizeArray(data.access_keys || data.accessKeys, normalizeAccessKey),
    aiUsageRecords: normalizeArray(data.ai_usage_records || data.aiUsageRecords, normalizeAIUsageRecord),
    gameHistory: normalizeArray(data.game_history || data.gameHistory, normalizeGameHistory),
    keyUsageHistory: normalizeArray(data.key_usage_history || data.keyUsageHistory, normalizeKeyUsageHistory),
    currentAccessKey: data.current_access_key || data.currentAccessKey 
      ? normalizeAccessKey(data.current_access_key || data.currentAccessKey)
      : undefined
  }
  
  return normalized
}

/**
 * 日期比较函数（用于排序）
 * @param dateA 第一个日期
 * @param dateB 第二个日期
 * @param direction 排序方向
 * @returns 比较结果
 */
export function compareDates(
  dateA: string | null, 
  dateB: string | null, 
  direction: SortDirection = 'desc'
): number {
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

/**
 * 格式化为中文日期时间
 * @param dateString 日期字符串
 * @param includeTime 是否包含时间
 * @returns 格式化后的日期时间字符串
 */
export function formatChineseDateTime(dateString: string | null, includeTime: boolean = true): string {
  if (!dateString) return '无记录'
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '无效日期'
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    
    if (!includeTime) {
      return `${year}年${month}月${day}日`
    }
    
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}年${month}月${day}日 ${hours}:${minutes}`
  } catch {
    return '无效日期'
  }
}

/**
 * 检查用户是否是管理员
 * @param email 用户邮箱
 * @returns 是否是管理员
 */
export function isAdminUser(email: string): boolean {
  const adminEmails = [
    '2200691917@qq.com',
    // 可以添加更多管理员邮箱
  ]
  return adminEmails.includes(email)
}

// ============================================
// 5. 批量操作类型
// ============================================

/**
 * 批量操作类型
 */
export type BatchActionType = 'delete' | 'disable' | 'enable'

/**
 * 批量操作请求
 */
export interface BatchActionRequest {
  userIds: string[]
  action: BatchActionType
  reason?: string
}

/**
 * 批量操作响应
 */
export interface BatchActionResponse {
  success: boolean
  affectedCount: number
  failedCount: number
  failedUsers?: Array<{ userId: string; error: string }>
}

// ============================================
// 6. 导出所有类型
// ============================================

export type {
  // 从当前模块重新导出，确保一致性
  SortField,
  SortDirection,
  UserFilterType,
  KeyStatus,
  UserStatus,
  GenderDisplay,
  BatchActionType
}

// 默认导出（如果需要）
export default {
  // 类型
  User,
  UserDetail,
  AccessKey,
  AIUsageRecord,
  GameHistory,
  KeyUsageHistory,
  UserStats,
  GrowthData,
  PaginationInfo,
  SortInfo,
  ApiResponse,
  
  // 枚举类型
  SortField,
  SortDirection,
  UserFilterType,
  KeyStatus,
  UserStatus,
  GenderDisplay,
  BatchActionType,
  
  // 工具函数
  getGenderDisplay,
  isUserActive,
  getActiveStatusConfig,
  getKeyStatus,
  normalizeUserDetail,
  compareDates,
  formatChineseDateTime,
  isAdminUser
}