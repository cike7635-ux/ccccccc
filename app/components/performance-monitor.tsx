'use client';

import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
}

export default function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // 监听性能指标
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          console.log(`🎯 ${entry.name}: ${entry.startTime}ms`);
        });
      });

      // 观察关键性能指标
      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift'] });

      // 页面加载完成后的性能数据
      const loadTime = performance.timing?.loadEventEnd - performance.timing?.navigationStart;
      
      // 获取关键性能指标
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
      
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lcp = lcpEntries[lcpEntries.length - 1]?.startTime || 0;
      
      const clsEntries = performance.getEntriesByType('layout-shift');
      const cls = clsEntries.reduce((total, entry) => total + (entry as any).value, 0);

      setMetrics({
        loadTime: loadTime || 0,
        firstContentfulPaint: fcp,
        largestContentfulPaint: lcp,
        cumulativeLayoutShift: cls
      });

      // 开发环境下显示性能面板
      setVisible(true);

      return () => observer.disconnect();
    }
  }, []);

  if (!visible || !metrics) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 backdrop-blur-xl border border-white/20 rounded-lg p-4 text-xs text-white z-50 max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold">性能监控</span>
        <button 
          onClick={() => setVisible(false)}
          className="text-white/60 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>页面加载:</span>
          <span className={metrics.loadTime > 2000 ? 'text-red-400' : metrics.loadTime > 1000 ? 'text-yellow-400' : 'text-green-400'}>
            {metrics.loadTime}ms
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>首次绘制:</span>
          <span className={metrics.firstContentfulPaint > 1000 ? 'text-yellow-400' : 'text-green-400'}>
            {metrics.firstContentfulPaint}ms
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>最大绘制:</span>
          <span className={metrics.largestContentfulPaint > 2500 ? 'text-red-400' : metrics.largestContentfulPaint > 1500 ? 'text-yellow-400' : 'text-green-400'}>
            {metrics.largestContentfulPaint}ms
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>布局稳定性:</span>
          <span className={metrics.cumulativeLayoutShift > 0.1 ? 'text-red-400' : metrics.cumulativeLayoutShift > 0.05 ? 'text-yellow-400' : 'text-green-400'}>
            {metrics.cumulativeLayoutShift.toFixed(3)}
          </span>
        </div>
      </div>
      
      <div className="mt-2 pt-2 border-t border-white/10">
        <button 
          onClick={() => window.location.reload()}
          className="w-full bg-white/10 hover:bg-white/20 rounded px-2 py-1 text-xs transition-colors"
        >
          重新测试
        </button>
      </div>
    </div>
  );
}