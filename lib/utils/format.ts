// /lib/utils/format.ts
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export function formatCost(cost: number): string {
  return `¥${cost.toFixed(6)}`;
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN');
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('zh-CN');
}