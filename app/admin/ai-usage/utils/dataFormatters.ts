// /app/admin/ai-usage/utils/dataFormatters.ts
import { TimeRange } from '../types';

// 格式化数字
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// 格式化时间
export function formatDate(date: Date | string, format: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: format === 'short' ? 'short' : 'long',
    day: 'numeric',
    hour: format === 'long' ? '2-digit' : undefined,
    minute: format === 'long' ? '2-digit' : undefined,
  };
  
  return d.toLocaleDateString('zh-CN', options);
}

// 格式化货币
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// 计算百分比变化
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// 获取时间范围显示文本
export function getTimeRangeDisplay(timeRange: TimeRange): string {
  const map: Record<TimeRange, string> = {
    today: '今天',
    yesterday: '昨天',
    '7d': '过去7天',
    '30d': '过去30天',
    '90d': '过去90天',
    custom: '自定义',
    all: '全部时间',
  };
  return map[timeRange];
}

// 计算趋势数据
export function calculateTrendData(data: number[]): {
  trend: 'up' | 'down' | 'stable';
  percentage: number;
} {
  if (data.length < 2) {
    return { trend: 'stable', percentage: 0 };
  }
  
  const current = data[data.length - 1];
  const previous = data[data.length - 2];
  const percentage = ((current - previous) / previous) * 100;
  
  if (Math.abs(percentage) < 0.5) {
    return { trend: 'stable', percentage };
  }
  
  return {
    trend: percentage > 0 ? 'up' : 'down',
    percentage: Math.abs(percentage),
  };
}

// 分组统计数据
export function groupDataByInterval<T>(
  data: T[],
  dateKey: keyof T,
  interval: 'day' | 'week' | 'month' | 'hour'
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  
  data.forEach(item => {
    const date = new Date(item[dateKey] as any);
    let key: string;
    
    switch (interval) {
      case 'hour':
        key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:00`;
        break;
      case 'day':
        key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
        break;
      case 'month':
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        break;
      default:
        key = date.toISOString();
    }
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  });
  
  return groups;
}