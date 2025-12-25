// /app/admin/keys/types.ts - 完整版
import { LucideIcon } from 'lucide-react'

// 密钥状态类型
export type KeyStatus = 'unused' | 'used' | 'expired' | 'disabled'

// 密钥基础类型（对应 access_keys 表）
export interface AccessKey {
  // 基础信息
  id: number
  key_code: string
  description: string | null
  
  // 状态信息
  is_active: boolean
  status: KeyStatus
  
  // 使用限制
  used_count: number
  max_uses: number | null
  usage_count: number
  
  // 时间信息
  account_valid_for_days: number
  original_duration_hours: number | null
  duration_unit: string
  key_expires_at: string | null
  created_at: string
  updated_at: string
  used_at: string | null
  last_used_at: string | null
  
  // 关联信息
  user_id: string | null
  current_user: {
    email: string
    nickname: string | null
  } | null
}

// 使用历史记录（对应 key_usage_history 表）
export interface KeyUsageHistory {
  id: number
  user_id: string
  access_key_id: number
  used_at: string
  usage_type: string
  previous_key_id: number | null
  next_key_id: number | null
  operation_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
  
  // 关联信息
  user?: {
    email: string
    nickname: string | null
  }
  operator?: {
    email: string
    nickname: string | null
  }
}

// 密钥详情
export interface KeyDetail {
  key_info: AccessKey
  current_usage: {
    user: {
      id: string
      email: string
      nickname: string | null
    }
    used_at: string
    notes: string | null
  } | null
  usage_history: KeyUsageHistory[]
  statistics: {
    total_uses: number
    unique_users: number
    average_duration_hours: number
    first_use: string | null
    last_use: string | null
    usage_by_type: Record<string, number>
  }
  related_keys: {
    previous_keys: number[]
    next_keys: number[]
  }
}

// 列表响应类型
export interface KeysListResponse {
  success: boolean
  data: {
    keys: AccessKey[]
    pagination: {
      page: number
      limit: number
      total: number
      total_pages: number
      has_next: boolean
      has_prev: boolean
      next_page: number | null
      prev_page: number | null
    }
    filters: {
      applied: any
      available_counts: {
        total: number
        unused: number
        used: number
        expired: number
        disabled: number
      }
    }
  }
  timestamp: string
}

// 筛选参数
export interface FilterParams {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  status?: string
  user_email?: string
  key_code?: string
  created_at_start?: string
  created_at_end?: string
  duration_min?: number
  duration_max?: number
  is_active?: boolean
}

// 统计信息
export interface KeyStatistics {
  overview: {
    total_keys: number
    active_keys: number
    used_keys: number
    unused_keys: number
    expired_keys: number
    disabled_keys: number
    today_expiring: number
    near_expiring: number
  }
  growth: {
    today: number
    yesterday: number
    week: number
    month: number
    daily_growth: number
  }
  usage: {
    total_uses: number
    unique_users: number
    today: number
    yesterday: number
    week: number
    month: number
    avg_uses_per_key: number
    usage_rate: number
  }
  distribution: {
    duration: Record<string, number>
    usage_type: Record<string, number>
  }
  top_keys: Array<{
    key_id: string
    key_code: string | null
    usage_count: number
    last_used: string | null
  }>
  trends: {
    daily_usage: {
      today: number
      yesterday: number
      change: number
    }
    daily_new_keys: {
      today: number
      yesterday: number
      change: number
    }
  }
}

// 批量操作请求
export interface BatchOperationRequest {
  action: 'disable' | 'enable' | 'delete'
  keyIds: number[]
  reason?: string
}

// 导出选项
export interface ExportOptions {
  export_type: 'current_page' | 'filtered' | 'selected'
  filters?: FilterParams
  selected_ids?: number[]
  page?: number
  limit?: number
}

// 生成密钥请求
export interface GenerateKeysRequest {
  count: number
  prefix: string
  duration: number
  max_uses: number | null
  description?: string
  absolute_expiry_days?: number
}

// 状态配置
export interface StatusConfig {
  label: string
  color: string
  bgColor: string
  icon: LucideIcon
}

// 状态配置映射
export const statusConfig: Record<KeyStatus, StatusConfig> = {
  unused: {
    label: '未使用',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    icon: Clock
  },
  used: {
    label: '已使用',
    color: 'text-green-400',
    bgColor: 'bg-green-500/15',
    icon: Check
  },
  expired: {
    label: '已过期',
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    icon: AlertCircle
  },
  disabled: {
    label: '已禁用',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/15',
    icon: Ban
  }
}

// 排序选项
export interface SortOption {
  value: string
  label: string
}

// 每页数量选项
export interface PageSizeOption {
  value: number
  label: string
}

// 密钥操作结果
export interface KeyOperationResult {
  success: boolean
  data?: any
  error?: string
  message?: string
}

// 导出结果
export interface ExportResult {
  filename: string
  content: string
  count: number
}

// 分页信息
export interface PaginationInfo {
  current: number
  total: number
  pageSize: number
  totalPages: number
  startItem: number
  endItem: number
}

// 表格列配置
export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  width?: string
  align?: 'left' | 'center' | 'right'
}

// 筛选选项
export interface FilterOption {
  key: string
  label: string
  type: 'select' | 'date' | 'number' | 'text' | 'boolean'
  options?: Array<{ value: string; label: string }>
  placeholder?: string
}

// 密钥状态统计
export interface KeyStatusStats {
  total: number
  unused: number
  used: number
  expired: number
  disabled: number
  active: number
}

// 使用统计
export interface UsageStats {
  total_uses: number
  unique_users: number
  avg_uses_per_day: number
  usage_rate: number
}

// 增长统计
export interface GrowthStats {
  today: number
  yesterday: number
  week: number
  month: number
  growth_rate: number
}

// 时长分布
export interface DurationDistribution {
  '1小时': number
  '2小时': number
  '4小时': number
  '12小时': number
  '1天': number
  '7天': number
  '30天': number
  '90天': number
  '180天': number
  '365天': number
  '其他': number
}

// 使用类型分布
export interface UsageTypeDistribution {
  activate: number
  renew: number
  transfer: number
  other: number
}

// 趋势数据
export interface TrendData {
  date: string
  value: number
}

// 时间段
export interface TimeRange {
  start: string
  end: string
  label: string
}

// 批量操作状态
export interface BatchOperationState {
  selectedKeys: number[]
  operation: 'disable' | 'enable' | 'delete' | null
  loading: boolean
  error: string | null
}

// 导出状态
export interface ExportState {
  type: 'current_page' | 'filtered' | 'selected'
  loading: boolean
  error: string | null
  progress: number
}

// 页面状态
export interface PageState {
  loading: boolean
  error: string | null
  initialized: boolean
}

// 需要导入的图标（如果需要）
import { Clock, Check, AlertCircle, Ban } from 'lucide-react'