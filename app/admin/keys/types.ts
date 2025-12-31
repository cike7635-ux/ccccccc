// /app/admin/keys/types.ts
import { LucideIcon } from 'lucide-react'

// 从lucide-react导入需要的图标
import { Clock, Check, AlertCircle, Ban } from 'lucide-react'

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
  
  // 时间信息 - 关键修复：区分两种有效期
  account_valid_for_days: number // 相对日期：用户激活后可使用天数
  original_duration_hours: number | null // 相对日期：用户激活后可使用小时数（精确）
  duration_unit: string // 显示单位：hours/days/months/years
  key_expires_at: string | null // 绝对日期：激活截止时间
  created_at: string
  updated_at: string
  used_at: string | null // 首次使用时间
  last_used_at: string | null
  
  // 关联信息
  user_id: string | null
  current_user: {
    email: string
    nickname: string | null
  } | null
  profiles?: {
    email: string
    nickname: string | null
  }
}

// 生成密钥请求参数
export interface GenerateKeysRequest {
  count: number // 生成数量 (1-100)
  prefix: string // 密钥前缀 (2-6字符)
  duration: number // 使用时长 (小时数)
  max_uses: number | null // 最大使用次数 (null为无限)
  description?: string // 描述 (可选)
  activation_deadline_days?: number // 激活截止天数 (相对)
  activation_deadline_type?: 'relative' | 'absolute' // 截止时间类型
  activation_deadline_date?: string // 激活截止日期 (绝对，ISO字符串)
}

// 生成密钥响应
export interface GenerateKeysResponse {
  success: boolean
  data?: {
    generated_count: number
    keys: Array<{
      id: number
      key_code: string
      account_valid_for_days: number
      original_duration_hours: number
      duration_unit: string
      key_expires_at: string
      max_uses: number | null
      description: string | null
    }>
    summary: {
      prefix: string
      duration_hours: number
      duration_unit: string
      activation_deadline: string
      max_uses: string
    }
  }
  message?: string
  download_url?: string
  error?: string
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

// 时长选项
export interface DurationOption {
  hours: number // 小时数
  label: string // 显示标签
  display: string // 显示文本
  key: string // 唯一键
}

// 激活截止选项
export interface ActivationDeadlineOption {
  days: number // 天数
  label: string // 显示标签
}

// 导出选项
export interface ExportOptions {
  export_type: 'current_page' | 'filtered' | 'selected'
  filters?: any
  selected_ids?: number[]
  page?: number
  limit?: number
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