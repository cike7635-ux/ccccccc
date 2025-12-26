// /lib/performance.ts - 新增性能监控
interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private enabled = process.env.NODE_ENV === 'production' ? false : true; // 生产环境默认关闭

  private constructor() {}

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  start(name: string, metadata?: Record<string, any>): string {
    if (!this.enabled) return '';
    
    const metricId = Math.random().toString(36).substring(7);
    this.metrics.push({
      name,
      startTime: Date.now(),
      success: true,
      metadata
    });
    
    console.time(`⏱️ ${name}`);
    return metricId;
  }

  end(name: string, success: boolean = true, error?: string) {
    if (!this.enabled) return;
    
    const metric = this.metrics.find(m => m.name === name && !m.endTime);
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      metric.success = success;
      metric.error = error;
      
      if (success) {
        console.timeEnd(`⏱️ ${name}`);
        console.log(`✅ ${name} 完成: ${metric.duration}ms`);
      } else {
        console.timeEnd(`⏱️ ${name}`);
        console.error(`❌ ${name} 失败: ${error}`);
      }
    }
  }

  getMetrics(): PerformanceMetric[] {
    return this.metrics.slice(-100); // 返回最近100条记录
  }

  clear() {
    this.metrics = [];
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }
}

// 导出单例实例
export const performanceMonitor = PerformanceMonitor.getInstance();

// 便捷包装函数
export function withPerformance<T>(
  name: string,
  fn: () => Promise<T> | T,
  metadata?: Record<string, any>
): Promise<T> | T {
  const monitor = PerformanceMonitor.getInstance();
  const metricId = monitor.start(name, metadata);
  
  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result
        .then(res => {
          monitor.end(name, true);
          return res;
        })
        .catch(error => {
          monitor.end(name, false, error.message);
          throw error;
        });
    } else {
      monitor.end(name, true);
      return result;
    }
  } catch (error: any) {
    monitor.end(name, false, error.message);
    throw error;
  }
}

// 特定场景的监控
export function monitorAuth<T>(fn: () => Promise<T>): Promise<T> {
  return withPerformance('用户认证', fn) as Promise<T>;
}

export function monitorDatabase<T>(queryName: string, fn: () => Promise<T>): Promise<T> {
  return withPerformance(`数据库查询: ${queryName}`, fn) as Promise<T>;
}

export function monitorMiddleware<T>(path: string, fn: () => Promise<T>): Promise<T> {
  return withPerformance(`中间件处理: ${path}`, fn) as Promise<T>;
}