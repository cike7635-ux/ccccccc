// /app/admin/ai-usage/hooks/useAiStatistics.ts
import { useState, useEffect, useCallback } from 'react';
import { TimeRange, FilterOptions, StatisticsResponse } from '../types';

export function useAiStatistics(filters: FilterOptions) {
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams({
        timeRange: filters.timeRange,
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.gender && { gender: filters.gender.join(',') }),
        ...(filters.preferences && { preferences: filters.preferences.join(',') }),
        ...(filters.userTier && { userTier: filters.userTier.join(',') }),
        ...(filters.minUsage && { minUsage: filters.minUsage.toString() }),
        ...(filters.maxUsage && { maxUsage: filters.maxUsage.toString() }),
        ...(filters.keyStatus && { keyStatus: filters.keyStatus.join(',') }),
      });

      const response = await fetch(`/api/admin/ai-usage/statistics?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`获取数据失败: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
      return result;
    } catch (err: any) {
      setError(err.message);
      console.error('获取统计数据失败:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 实时更新数据
  useEffect(() => {
    fetchData();
    
    // 每5分钟自动刷新数据
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // 手动刷新
  const refresh = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  // 导出数据
  const exportData = useCallback((format: 'json' | 'csv' | 'excel') => {
    if (!data) return null;
    
    const exportData = {
      ...data,
      exportedAt: new Date().toISOString(),
      filters,
    };

    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;
      case 'csv':
        content = convertToCSV(exportData);
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      case 'excel':
        // 这里可以使用第三方库生成Excel
        content = JSON.stringify(exportData);
        mimeType = 'application/json';
        extension = 'json';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-statistics-export-${new Date().toISOString().split('T')[0]}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return url;
  }, [data, filters]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh,
    exportData,
  };
}

// 辅助函数：将数据转换为CSV格式
function convertToCSV(data: any): string {
  const lines: string[] = [];
  
  // 添加概览数据
  if (data.overview) {
    lines.push('概览统计');
    lines.push(Object.keys(data.overview).join(','));
    lines.push(Object.values(data.overview).join(','));
    lines.push('');
  }
  
  // 添加趋势数据
  if (data.trends && data.trends.length > 0) {
    lines.push('使用趋势');
    const trendHeaders = Object.keys(data.trends[0]);
    lines.push(trendHeaders.join(','));
    data.trends.forEach((trend: any) => {
      lines.push(Object.values(trend).join(','));
    });
    lines.push('');
  }
  
  // 添加用户数据
  if (data.userProfiles && data.userProfiles.length > 0) {
    lines.push('用户分析');
    const userHeaders = Object.keys(data.userProfiles[0]);
    lines.push(userHeaders.join(','));
    data.userProfiles.forEach((user: any) => {
      lines.push(Object.values(user).join(','));
    });
  }
  
  return lines.join('\n');
}