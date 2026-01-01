// LOVE LUDO 后台管理系统 - 密钥管理类型定义
// 版本: 2.0 (支持多用户显示)
// 更新日期: 2024-12-24

// ==============================
// 用户相关类型
// ==============================

/**
 * 用户基本信息接口
 */
export interface UserProfile {
  id?: string
  email: string
  nickname: string | null
  avatar_url?: string | null
  last_login_at?: string | null
  created_at?: string
  updated_at?: string
  access_key_id?: number | null
  account_expires_at?: string | null
  full_name?: string | null
  bio?: string | null
  preferences?: Record<string, any> | null
}

/**
 * 最近使用者信息（简版，用于列表显示）
 */
export interface RecentUser {
  email: string
  nickname?: string | null
  user_id?: string
  last_used?: string | null
}

/**
 * 密钥使用历史记录
 */
export interface KeyUsageHistory {
  id: number
  user_id: string
  access_key_id: number
  used_at: string
  usage_type: 'activate' | 'renew' | 'transfer' | 'admin_extend' | 'upgrade' | 'downgrade' | 'reset' | string
  previous_key_id: number | null
  next_key_id: number | null
  operation_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  profiles?: UserProfile | null
  
  // 计算字段
  usage_type_display?: string
  formatted_date?: string
}

// ==============================
// 密钥相关类型
// ==============================

/**
 * 密钥状态类型
 */
export type KeyStatus = 'unused' | 'used' | 'expired' | 'disabled' | 'unknown'

/**
 * 剩余时间显示配置
 */
export interface RemainingTime {
  text: string
  color: string
  isExpired: boolean
}

/**
 * 密钥基础信息接口（API返回格式）
 */
export interface AccessKey {
  // 数据库基础字段
  id: number
  key_code: string
  description: string | null
  is_active: boolean
  used_count: number | null
  max_uses: number | null
  key_expires_at: string | null
  account_valid_for_days: number | null
  user_id: string | null
  used_at: string | null
  created_at: string
  updated_at: string
  original_duration_hours: number | null
  duration_unit: string | null
  
  // 关联字段
  profiles?: UserProfile | null  // 当前使用者（单个，保持兼容）
  
  // 新增字段：多用户支持
  recent_users: RecentUser[]     // 最近的两个使用者（数组）
  total_users: number            // 总使用者数量
  
  // 计算字段（API处理后添加）
  key_status: KeyStatus
  remaining_time: RemainingTime
  duration_display: string
  created_at_formatted: string
  
  // 统计信息
  usage_count: number
  last_used_at: string | null
  first_used_at: string | null
  
  // 额外字段（可选）
  usage_history?: KeyUsageHistory[]
  all_users?: Array<{
    user_id: string
    email: string
    nickname?: string | null
    avatar_url?: string | null
    first_used: string
    last_used: string
    usage_count: number
  }>
}

// ==============================
// 密钥详情相关类型
// ==============================

/**
 * 密钥详情数据接口
 */
export interface KeyDetailData {
  key_info: AccessKey & {
    profiles?: UserProfile & {
      last_login_at?: string | null
      last_login_session?: string | null
      access_key_id?: number | null
      account_expires_at?: string | null
    }
  }
  
  usage_history: KeyUsageHistory[]
  
  all_users: Array<{
    user_id: string
    email: string
    nickname?: string | null
    avatar_url?: string | null
    first_used: string
    last_used: string
    usage_count: number
    last_login_at?: string | null
  }>
  
  statistics: {
    total_uses: number
    unique_users: number
    usage_by_type: Record<string, number>
    first_use: string | null
    last_use: string | null
    average_use_interval?: string | null
    usage_trend?: 'increasing' | 'decreasing' | 'stable'
  }
}

// ==============================
// 操作相关类型
// ==============================

/**
 * 批量操作接口
 */
export interface BulkOperation {
  action: 'enable' | 'disable' | 'delete' | 'extend' | 'regenerate'
  keyIds: number[]
  reason?: string
  days?: number
  hours?: number
}

/**
 * 单个密钥操作接口
 */
export interface KeyOperation {
  action: 'enable' | 'disable' | 'delete' | 'copy' | 'view'
  keyId: number
  reason?: string
}

/**
 * 密钥生成配置
 */
export interface KeyGenerationConfig {
  count: number
  prefix: string
  duration: number  // 单位：小时
  max_uses?: number
  activation_deadline_days?: number
  activation_deadline_type?: 'relative' | 'absolute'
  key_expires_at?: string
  description?: string
  duration_unit?: string
}

// ==============================
// 筛选和排序类型
// ==============================

/**
 * 密钥筛选选项
 */
export interface KeyFilterOptions {
  search?: string
  status?: KeyStatus | 'all'
  created_after?: string
  created_before?: string
  expires_after?: string
  expires_before?: string
  min_uses?: number
  max_uses?: number
  has_user?: boolean
}

/**
 * 排序选项
 */
export interface SortOptions {
  field: 'created_at' | 'key_code' | 'used_count' | 'key_expires_at' | 'updated_at'
  order: 'asc' | 'desc'
}

// ==============================
// 导出相关类型
// ==============================

/**
 * 导出格式
 */
export type ExportFormat = 'csv' | 'json' | 'txt'

/**
 * 导出配置
 */
export interface ExportConfig {
  format: ExportFormat
  selected_ids?: number[]
  filters?: KeyFilterOptions
  columns?: string[]
  include_history?: boolean
}

// ==============================
// 统计和报表类型
// ==============================

/**
 * 密钥统计信息
 */
export interface KeyStatistics {
  total: number
  active: number
  used: number
  unused: number
  expired: number
  inactive: number
  todayExpiring: number
  nearExpiring: number
  
  // 用户统计
  total_users: number
  active_users: number
  expired_users: number
  
  // 使用统计
  total_uses: number
  avg_uses_per_key: number
  most_used_key?: {
    id: number
    key_code: string
    uses: number
  }
}

/**
 * 时间段统计
 */
export interface TimePeriodStats {
  period: 'day' | 'week' | 'month' | 'year'
  start_date: string
  end_date: string
  keys_generated: number
  keys_used: number
  new_users: number
  active_users: number
}

// ==============================
// 表格列配置类型
// ==============================

/**
 * 表格列定义
 */
export interface TableColumn {
  id: string
  header: string
  accessorKey: string
  width?: number | string
  sortable?: boolean
  filterable?: boolean
  visible?: boolean
  cell?: (props: any) => React.ReactNode
}

/**
 * 密钥列表表格列
 */
export const KEY_TABLE_COLUMNS: TableColumn[] = [
  {
    id: 'selection',
    header: '',
    accessorKey: 'selection',
    width: 40
  },
  {
    id: 'key_code',
    header: '密钥代码',
    accessorKey: 'key_code',
    width: 200,
    sortable: true,
    filterable: true
  },
  {
    id: 'description',
    header: '描述',
    accessorKey: 'description',
    width: 150,
    filterable: true
  },
  {
    id: 'duration',
    header: '有效期',
    accessorKey: 'duration_display',
    width: 100,
    sortable: true
  },
  {
    id: 'status',
    header: '状态',
    accessorKey: 'key_status',
    width: 100,
    sortable: true,
    filterable: true
  },
  {
    id: 'users',
    header: '使用者',
    accessorKey: 'users',
    width: 180,
    filterable: true
  },
  {
    id: 'used_count',
    header: '使用次数',
    accessorKey: 'used_count',
    width: 100,
    sortable: true
  },
  {
    id: 'remaining_time',
    header: '剩余有效期',
    accessorKey: 'remaining_time.text',
    width: 150,
    sortable: true
  },
  {
    id: 'created_at',
    header: '创建时间',
    accessorKey: 'created_at_formatted',
    width: 180,
    sortable: true
  },
  {
    id: 'actions',
    header: '操作',
    accessorKey: 'actions',
    width: 120
  }
]

// ==============================
// 状态配置
// ==============================

/**
 * 密钥状态配置
 */
export const KEY_STATUS_CONFIG: Record<KeyStatus, {
  label: string
  color: string
  bgColor: string
  icon: any  // 实际应该导入Lucide图标类型
}> = {
  unused: {
    label: '未使用',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    icon: 'Clock'  // 实际应该从'lucide-react'导入
  },
  used: {
    label: '已使用',
    color: 'text-green-400',
    bgColor: 'bg-green-500/15',
    icon: 'Check'
  },
  expired: {
    label: '已过期',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    icon: 'AlertCircle'
  },
  disabled: {
    label: '已禁用',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/15',
    icon: 'Ban'
  },
  unknown: {
    label: '未知',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/15',
    icon: 'AlertCircle'
  }
}

// ==============================
// API响应类型
// ==============================

/**
 * 标准API响应接口
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  meta?: {
    total?: number
    page?: number
    limit?: number
    timestamp?: string
    [key: string]: any
  }
}

/**
 * 密钥列表API响应
 */
export interface KeysListResponse extends ApiResponse<AccessKey[]> {
  meta?: {
    total: number
    timestamp: string
    has_usage_data: boolean
  }
}

/**
 * 密钥详情API响应
 */
export interface KeyDetailResponse extends ApiResponse<KeyDetailData> {
  meta?: {
    key_id: number
    timestamp: string
    has_usage_history: boolean
    user_count: number
  }
}

// ==============================
// 表单相关类型
// ==============================

/**
 * 密钥编辑表单数据
 */
export interface KeyEditFormData {
  description?: string
  max_uses?: number
  key_expires_at?: string
  original_duration_hours?: number
  account_valid_for_days?: number
  is_active?: boolean
}

/**
 * 密钥延长表单数据
 */
export interface KeyExtendFormData {
  days?: number
  hours?: number
  reason?: string
  new_expiry?: string
}

/**
 * 用户延长表单数据
 */
export interface UserExtendFormData {
  days?: number
  hours?: number
  reason?: string
  user_id: string
}

// ==============================
// 工具函数类型
// ==============================

/**
 * 密钥状态计算函数
 */
export type GetKeyStatusFn = (key: AccessKey) => KeyStatus

/**
 * 剩余时间计算函数
 */
export type GetRemainingTimeFn = (key: AccessKey) => RemainingTime

/**
 * 时长显示计算函数
 */
export type GetDurationDisplayFn = (key: AccessKey) => string

// ==============================
// 默认值和常量
// ==============================

/**
 * 默认密钥生成配置
 */
export const DEFAULT_KEY_GENERATION_CONFIG: KeyGenerationConfig = {
  count: 1,
  prefix: 'XY',
  duration: 24, // 默认24小时（1天）
  max_uses: 1,
  activation_deadline_days: 365,
  activation_deadline_type: 'relative',
  description: '',
  duration_unit: 'hours'
}

/**
 * 时长选项
 */
export const DURATION_OPTIONS = [
  { value: 1/24, label: '1小时' },
  { value: 2/24, label: '2小时' },
  { value: 4/24, label: '4小时' },
  { value: 12/24, label: '12小时' },
  { value: 1, label: '1天' },
  { value: 7, label: '7天' },
  { value: 30, label: '30天' },
  { value: 90, label: '90天' },
  { value: 180, label: '180天' },
  { value: 365, label: '365天' }
]

/**
 * 分页选项
 */
export const PAGINATION_OPTIONS = [
  { value: 10, label: '10 条/页' },
  { value: 20, label: '20 条/页' },
  { value: 50, label: '50 条/页' },
  { value: 100, label: '100 条/页' }
]

// ==============================
// 导出所有类型
// ==============================

export type {
  UserProfile as Profile,
  RecentUser as UserInfo,
  KeyUsageHistory as UsageHistory,
  KeyFilterOptions as FilterOptions,
  SortOptions as SortConfig
}

export default {
  // 基础类型
  UserProfile,
  RecentUser,
  AccessKey,
  KeyDetailData,
  
  // 操作类型
  BulkOperation,
  KeyOperation,
  KeyGenerationConfig,
  
  // 配置
  KEY_TABLE_COLUMNS,
  KEY_STATUS_CONFIG,
  DEFAULT_KEY_GENERATION_CONFIG,
  DURATION_OPTIONS,
  PAGINATION_OPTIONS,
  
  // 工具类型
  KeyStatus,
  RemainingTime,
  ExportFormat
}