// /app/admin/keys/types.ts - 向后兼容版本
import { LucideIcon } from 'lucide-react'
import { Clock, Check, AlertCircle, Ban } from 'lucide-react'

// 密钥状态类型
export type KeyStatus = 'unused' | 'used' | 'expired' | 'disabled'

// 用户信息接口
export interface UserProfile {
  email: string
  nickname: string | null
  id?: string
  created_at?: string
  last_login_at?: string | null
  // ... 其他可能的字段
}

// 向后兼容：为现有代码保留 current_user 类型
export interface CurrentUser {
  email: string
  nickname: string | null
}

// 密钥基础类型（向后兼容）
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
  
  // 关联信息 - 完全向后兼容
  user_id: string | null
  
  // ✅ 新字段：符合API实际返回
  profiles?: UserProfile | null
  
  // ✅ 向后兼容：保留旧字段（标记为可选）
  current_user?: CurrentUser | null
}

// 生成密钥请求参数 - 未修改
export interface GenerateKeysRequest {
  count: number
  prefix: string
  duration: number
  max_uses: number | null
  description?: string
  activation_deadline_days?: number
  activation_deadline_type?: 'relative' | 'absolute'
  activation_deadline_date?: string
}

// 生成密钥响应 - 未修改
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

// 状态配置 - 未修改
export interface StatusConfig {
  label: string
  color: string
  bgColor: string
  icon: LucideIcon
}

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

// 时长选项 - 未修改
export interface DurationOption {
  hours: number
  label: string
  display: string
  key: string
}

// 激活截止选项 - 未修改
export interface ActivationDeadlineOption {
  days: number
  label: string
}

// 导出选项 - 未修改
export interface ExportOptions {
  export_type: 'current_page' | 'filtered' | 'selected'
  filters?: any
  selected_ids?: number[]
  page?: number
  limit?: number
}

// 筛选参数 - 未修改
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