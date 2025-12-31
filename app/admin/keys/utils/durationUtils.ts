// /app/admin/keys/utils/durationUtils.ts

/**
 * 时长工具函数集合
 */

/**
 * 格式化时长显示
 * @param hours 小时数
 * @returns 格式化后的字符串
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes}分钟`
  } else if (hours < 24) {
    const displayHours = Math.floor(hours)
    const displayMinutes = Math.round((hours - displayHours) * 60)
    
    if (displayMinutes === 0) {
      return `${displayHours}小时`
    } else if (displayHours === 0) {
      return `${displayMinutes}分钟`
    } else {
      return `${displayHours}小时${displayMinutes}分钟`
    }
  } else if (hours < 24 * 30) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    
    if (remainingHours === 0) {
      return `${days}天`
    } else {
      return `${days}天${Math.round(remainingHours)}小时`
    }
  } else if (hours < 24 * 365) {
    const months = Math.floor(hours / (24 * 30))
    const remainingDays = Math.floor((hours % (24 * 30)) / 24)
    
    if (remainingDays === 0) {
      return `${months}个月`
    } else {
      return `${months}个月${remainingDays}天`
    }
  } else {
    const years = Math.floor(hours / (24 * 365))
    const remainingMonths = Math.floor((hours % (24 * 365)) / (24 * 30))
    
    if (remainingMonths === 0) {
      return `${years}年`
    } else {
      return `${years}年${remainingMonths}个月`
    }
  }
}

/**
 * 生成时长代码（用于密钥格式）
 * @param hours 小时数
 * @returns 时长代码（如：1H, 30D, 3M, 1Y）
 */
export function getDurationCode(hours: number): string {
  if (hours < 24) {
    // 小时级别
    return `${hours}H`
  } else if (hours < 24 * 30) {
    // 天数级别
    const days = Math.floor(hours / 24)
    return `${days}D`
  } else if (hours < 24 * 365) {
    // 月数级别
    const months = Math.round(hours / (24 * 30))
    return `${months}M`
  } else {
    // 年数级别
    const years = Math.round(hours / (24 * 365))
    return `${years}Y`
  }
}

/**
 * 解析时长代码为小时数
 * @param durationCode 时长代码（如：1H, 30D, 3M, 1Y）
 * @returns 小时数
 */
export function parseDurationCode(durationCode: string): number {
  const unit = durationCode.slice(-1)
  const value = parseFloat(durationCode.slice(0, -1))
  
  switch (unit.toUpperCase()) {
    case 'H': // 小时
      return value
    case 'D': // 天
      return value * 24
    case 'M': // 月（按30天计算）
      return value * 24 * 30
    case 'Y': // 年（按365天计算）
      return value * 24 * 365
    default:
      return 0
  }
}

/**
 * 计算剩余有效时间
 * @param startTime 开始时间（ISO字符串）
 * @param durationHours 时长（小时）
 * @returns 剩余时间对象
 */
export function calculateRemainingTime(startTime: string, durationHours: number): {
  expired: boolean
  remainingHours: number
  remainingDays: number
  formatted: string
} {
  const start = new Date(startTime)
  const expiry = new Date(start.getTime() + durationHours * 60 * 60 * 1000)
  const now = new Date()
  
  const remainingMs = expiry.getTime() - now.getTime()
  const remainingHours = Math.max(0, remainingMs / (1000 * 60 * 60))
  const remainingDays = Math.floor(remainingHours / 24)
  
  const expired = remainingMs <= 0
  
  // 格式化剩余时间
  let formatted = ''
  if (expired) {
    formatted = '已过期'
  } else if (remainingHours < 1) {
    const minutes = Math.floor(remainingHours * 60)
    formatted = `${minutes}分钟后过期`
  } else if (remainingHours < 24) {
    formatted = `${Math.floor(remainingHours)}小时后过期`
  } else if (remainingDays < 7) {
    formatted = `${remainingDays}天${Math.floor(remainingHours % 24)}小时后过期`
  } else if (remainingDays < 30) {
    formatted = `${remainingDays}天后过期`
  } else if (remainingDays < 365) {
    const months = Math.floor(remainingDays / 30)
    const days = remainingDays % 30
    formatted = `${months}个月${days > 0 ? `${days}天` : ''}后过期`
  } else {
    const years = Math.floor(remainingDays / 365)
    const months = Math.floor((remainingDays % 365) / 30)
    formatted = `${years}年${months > 0 ? `${months}个月` : ''}后过期`
  }
  
  return {
    expired,
    remainingHours,
    remainingDays,
    formatted
  }
}

/**
 * 检查密钥是否已过期（激活截止时间）
 * @param keyExpiresAt 密钥过期时间（ISO字符串）
 * @returns 是否已过期
 */
export function isKeyExpired(keyExpiresAt: string | null): boolean {
  if (!keyExpiresAt) return false // 没有设置过期时间，永不过期
  
  const expiry = new Date(keyExpiresAt)
  const now = new Date()
  return now > expiry
}

/**
 * 计算密钥状态
 * @param key 密钥对象
 * @returns 状态字符串
 */
export function calculateKeyStatus(key: {
  is_active: boolean
  key_expires_at: string | null
  used_at: string | null
  user_id: string | null
  used_count: number
  max_uses: number | null
}): 'unused' | 'used' | 'expired' | 'disabled' {
  // 1. 已禁用
  if (!key.is_active) {
    return 'disabled'
  }
  
  // 2. 已过期（激活截止时间）
  if (key.key_expires_at && isKeyExpired(key.key_expires_at)) {
    return 'expired'
  }
  
  // 3. 已使用
  if (key.used_at || key.user_id) {
    return 'used'
  }
  
  // 4. 使用次数已满
  if (key.max_uses && key.used_count >= key.max_uses) {
    return 'used'
  }
  
  // 5. 未使用
  return 'unused'
}

/**
 * 生成友好的时间范围字符串
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 友好的时间范围字符串
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const sameYear = start.getFullYear() === end.getFullYear()
  const sameMonth = start.getMonth() === end.getMonth()
  const sameDay = start.getDate() === end.getDate()
  
  if (sameYear && sameMonth && sameDay) {
    // 同一天
    return start.toLocaleDateString('zh-CN')
  } else if (sameYear && sameMonth) {
    // 同月不同日
    return `${start.getMonth() + 1}月${start.getDate()}日-${end.getDate()}日`
  } else if (sameYear) {
    // 同年不同月
    return `${start.getMonth() + 1}月${start.getDate()}日-${end.getMonth() + 1}月${end.getDate()}日`
  } else {
    // 不同年
    return `${start.toLocaleDateString('zh-CN')}-${end.toLocaleDateString('zh-CN')}`
  }
}