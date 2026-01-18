// /components/performance-measurement.tsx
'use client';

import { useEffect } from 'react';

export default function PerformanceMeasurement() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 检查是否有待处理的测试
    const pendingTest = localStorage.getItem('pendingTest');
    if (!pendingTest) return;

    try {
      const testData = JSON.parse(pendingTest);
      
      // 使用 Date.now() 确保跨页面时间一致性
      const endTime = Date.now();
      const startTime = testData.startTimestamp;
      
      // 计算延迟 - 确保是正数
      const urlDelay = Math.max(0, Math.round(endTime - startTime));
      
      // 创建测量结果
      const result = {
        id: testData.id,
        from: testData.from,
        to: window.location.pathname,
        urlDelay: urlDelay,
        totalDelay: urlDelay, // 简化处理，这里与URL延迟相同
        startTime: testData.startTime,
        timestamp: Date.now()
      };

      console.log('✅ 导航性能测量完成:', {
        from: result.from,
        to: result.to,
        urlDelay: result.urlDelay,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration: urlDelay + 'ms'
      });

      // 保存结果
      localStorage.setItem('testResult', JSON.stringify(result));
      localStorage.removeItem('pendingTest');
      
    } catch (error) {
      console.error('测量处理失败:', error);
      // 清理无效的待处理测试
      localStorage.removeItem('pendingTest');
    }
  }, []);

  return null;
}