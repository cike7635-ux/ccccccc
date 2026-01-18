// /app/performance-test/page.tsx - 完整修复版
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface PerformanceMeasurement {
  id: number;
  from: string;
  to: string;
  urlDelay: number | null;
  totalDelay: number;
  startTime: string;
  timestamp: number;
}

export default function PerformanceTestPage() {
  const [measurements, setMeasurements] = useState<PerformanceMeasurement[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [targetPath, setTargetPath] = useState('/profile');
  const [isTesting, setIsTesting] = useState(false);
  const [status, setStatus] = useState('就绪');
  const [isClient, setIsClient] = useState(false);

  // 初始化
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
      loadMeasurements();
    }
  }, []);

  // 从 localStorage 加载数据
  const loadMeasurements = () => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('navPerformance');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // 按时间戳倒序排列，最新的在前面
          const sorted = parsed.sort((a, b) => b.timestamp - a.timestamp);
          setMeasurements(sorted);
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  // 添加模拟数据（用于测试表格显示）
  const addMockData = () => {
    if (typeof window === 'undefined') return;

    const mockData: PerformanceMeasurement = {
      id: Date.now(),
      from: '/performance-test',
      to: '/profile',
      urlDelay: 1234,
      totalDelay: 1567,
      startTime: new Date().toISOString(),
      timestamp: Date.now()
    };

    const stored = JSON.parse(localStorage.getItem('navPerformance') || '[]');
    stored.push(mockData);
    localStorage.setItem('navPerformance', JSON.stringify(stored));

    loadMeasurements();
    setStatus('已添加模拟数据');
    setTimeout(() => setStatus('就绪'), 2000);
  };

  // 运行手动测试
  const runManualTest = (customTargetPath?: string) => {
    if (typeof window === 'undefined') return;

    const finalTargetPath = customTargetPath || targetPath;

    if (!finalTargetPath.trim()) {
      setStatus('请输入目标路径');
      setTimeout(() => setStatus('就绪'), 2000);
      return;
    }

    setIsTesting(true);
    setStatus(`测试中: ${finalTargetPath}`);

    // 记录开始时间 - 使用 Date.now() 确保跨页面一致性
    const startTime = Date.now();
    const startDate = new Date().toISOString();
    const testId = startTime;

    // 保存测试开始信息
    const pendingTest = {
      id: testId,
      from: currentPath,
      to: finalTargetPath,
      startTime: startDate,
      startTimestamp: startTime
    };

    console.log('📝 保存测试开始:', {
      startTime: new Date(startTime).toISOString(),
      startTimestamp: startTime,
      path: finalTargetPath
    });

    localStorage.setItem('pendingTest', JSON.stringify(pendingTest));

    console.log(`🚀 开始测试: ${currentPath} -> ${finalTargetPath}`);

    // 跳转到目标页面
    setTimeout(() => {
      window.location.href = finalTargetPath;
    }, 100);
  };

  // 快速测试函数
  const quickTest = (path: string) => {
    setTargetPath(path);
    // 使用setTimeout确保状态更新后再执行测试
    setTimeout(() => runManualTest(path), 10);
  };

  // 处理来自其他页面的测量结果
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 检查是否有待处理的测试结果
    const checkForResults = () => {
      const pendingTest = localStorage.getItem('pendingTest');
      const result = localStorage.getItem('testResult');

      if (result) {
        try {
          const resultData = JSON.parse(result);
          const stored = JSON.parse(localStorage.getItem('navPerformance') || '[]');
          stored.push(resultData);
          localStorage.setItem('navPerformance', JSON.stringify(stored));
          localStorage.removeItem('testResult');
          loadMeasurements();
          console.log('✅ 已处理测试结果:', resultData);
        } catch (error) {
          console.error('处理结果失败:', error);
        }
      }
    };

    checkForResults();
  }, []);

  // 清理无效数据
  const cleanInvalidData = () => {
    if (typeof window === 'undefined') return;

    if (measurements.length === 0) {
      setStatus('没有数据可清理');
      setTimeout(() => setStatus('就绪'), 2000);
      return;
    }

    // 过滤有效数据（正数且合理的延迟）
    const validMeasurements = measurements.filter(m =>
      m.urlDelay !== null &&
      m.urlDelay > 0 &&
      m.urlDelay < 30000 && // 30秒内为合理值
      m.urlDelay !== undefined
    );

    if (validMeasurements.length === measurements.length) {
      setStatus('没有无效数据');
      setTimeout(() => setStatus('就绪'), 2000);
      return;
    }

    // 保存有效数据
    localStorage.setItem('navPerformance', JSON.stringify(validMeasurements));
    setMeasurements(validMeasurements);

    setStatus(`已清理 ${measurements.length - validMeasurements.length} 条无效数据`);
    setTimeout(() => setStatus('就绪'), 2000);
  };

  // 清空数据
  const clearData = () => {
    if (typeof window === 'undefined') return;

    if (confirm('确定要清空所有测试数据吗？')) {
      localStorage.removeItem('navPerformance');
      setMeasurements([]);
      setStatus('数据已清空');
      setTimeout(() => setStatus('就绪'), 2000);
    }
  };

  // 导出数据
  const exportData = () => {
    if (typeof window === 'undefined') return;

    if (measurements.length === 0) {
      setStatus('没有数据可导出');
      setTimeout(() => setStatus('就绪'), 2000);
      return;
    }

    // 过滤掉无效数据（负数或异常大的值）
    const validMeasurements = measurements.filter(m =>
      m.urlDelay !== null &&
      m.urlDelay > 0 &&
      m.urlDelay < 30000 && // 30秒内为合理值
      m.urlDelay !== undefined
    );

    if (validMeasurements.length === 0) {
      setStatus('没有有效数据可导出');
      setTimeout(() => setStatus('就绪'), 2000);
      return;
    }

    const validDelays = validMeasurements.map(m => m.urlDelay!);

    const data = {
      timestamp: new Date().toISOString(),
      environment: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        url: window.location.href
      },
      measurements: validMeasurements,
      stats: {
        count: validMeasurements.length,
        avgUrlDelay: Math.round(validDelays.reduce((sum, d) => sum + d, 0) / validDelays.length),
        maxUrlDelay: Math.max(...validDelays),
        minUrlDelay: Math.min(...validDelays),
        medianUrlDelay: validDelays.sort((a, b) => a - b)[Math.floor(validDelays.length / 2)],
        validDataCount: validMeasurements.length,
        totalDataCount: measurements.length
      },
      note: '负数延迟已被过滤，仅保留0-30000ms的有效数据'
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nav-performance-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus(`已导出 ${validMeasurements.length} 条有效数据`);
    setTimeout(() => setStatus('就绪'), 2000);
  };

  // 获取延迟颜色
  const getDelayColor = (delay: number | null) => {
    if (delay === null) return 'text-gray-400';
    if (delay < 300) return 'text-green-500';
    if (delay < 1000) return 'text-yellow-500';
    if (delay < 2000) return 'text-orange-500';
    return 'text-red-500 font-bold';
  };

  // 如果不在客户端，显示加载状态
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-gray-100 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-4">加载中...</div>
          <p className="text-gray-400">正在初始化性能测试工具</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-gray-100">
      {/* 顶部导航栏 */}
      <nav className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/" className="text-white font-bold text-lg hover:text-blue-400 transition-colors">
                🎮 LOVE LUDO
              </Link>
              <div className="hidden md:flex space-x-4">
                <Link href="/lobby" className="text-gray-300 hover:text-white transition-colors px-3 py-2 rounded hover:bg-gray-800">
                  游戏大厅
                </Link>
                <Link href="/profile" className="text-gray-300 hover:text-white transition-colors px-3 py-2 rounded hover:bg-gray-800">
                  个人资料
                </Link>
                <Link href="/feedback" className="text-gray-300 hover:text-white transition-colors px-3 py-2 rounded hover:bg-gray-800">
                  反馈中心
                </Link>
                <Link href="/themes" className="text-gray-300 hover:text-white transition-colors px-3 py-2 rounded hover:bg-gray-800">
                  主题设置
                </Link>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              性能测试中心
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <div className="p-4 md:p-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">🚀 导航性能测试系统</h1>
          <p className="text-gray-400">精确测量 Next.js 15 中间件导致的导航延迟问题</p>
        </div>

        {/* 状态栏 */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-sm ${status.includes('就绪') ? 'bg-green-900/30 text-green-400' :
              status.includes('完成') ? 'bg-blue-900/30 text-blue-400' :
                status.includes('失败') ? 'bg-red-900/30 text-red-400' :
                  'bg-yellow-900/30 text-yellow-400'
              }`}>
              {status}
            </div>
            <div className="text-sm text-gray-400">
              当前路径: <span className="font-mono bg-gray-800 px-2 py-1 rounded">{currentPath}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadMeasurements}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition-colors"
            >
              刷新数据
            </button>
            <button
              onClick={addMockData}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors"
            >
              添加模拟数据
            </button>
          </div>
        </div>

        {/* 控制面板 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-white">🔧 测试控制面板</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 测试配置 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">目标路径</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-blue-500"
                  placeholder="/profile"
                />
                <button
                  onClick={() => runManualTest()}
                  disabled={isTesting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded transition-colors"
                >
                  {isTesting ? '测试中...' : '开始测试'}
                </button>
              </div>
            </div>

            {/* 数据管理 */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">数据管理</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={cleanInvalidData}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded transition-colors"
                >
                  清理无效数据
                </button>
                <button
                  onClick={exportData}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition-colors"
                >
                  导出数据
                </button>
                <button
                  onClick={clearData}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
                >
                  清空数据
                </button>
              </div>
            </div>
          </div>

          {/* 快速测试按钮 */}
          <div className="mt-6">
            <div className="text-sm text-gray-400 mb-2">🚀 快速测试</div>
            <div className="flex flex-wrap gap-2">
              {[
                { path: '/profile', label: '个人资料' },
                { path: '/lobby', label: '游戏大厅' },
                { path: '/login', label: '登录页面' },
                { path: '/feedback', label: '反馈中心' },
                { path: '/themes', label: '主题设置' },
                { path: '/account', label: '账户设置' },
                { path: '/admin/users', label: '管理后台' },
                { path: '/', label: '首页' },
                { path: '/test-bare', label: '裸页面测试' },
                { path: '/test-data', label: '数据测试' }
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => quickTest(item.path)}
                  disabled={isTesting}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors flex flex-col items-center"
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-gray-400 mt-1">{item.path}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 测量数据表格 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">📊 测量记录</h2>
            <div className="text-sm text-gray-400">
              共 {measurements.length} 条记录 ({measurements.filter(m => m.urlDelay && m.urlDelay > 0).length} 条有效)
            </div>
          </div>

          {measurements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">路径</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">URL延迟</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">总延迟</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((measurement, index) => {
                    const isInvalid = measurement.urlDelay === null || measurement.urlDelay <= 0 || measurement.urlDelay > 30000;

                    return (
                      <tr
                        key={measurement.id || index}
                        className={`border-b border-gray-800 hover:bg-gray-800/50 ${isInvalid ? 'bg-red-900/20' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <div className="text-sm">
                            {new Date(measurement.startTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-sm">
                            <div className="text-gray-300">{measurement.from}</div>
                            <div className="text-gray-500">→ {measurement.to}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-sm font-medium ${getDelayColor(measurement.urlDelay)}`}>
                            {measurement.urlDelay ? `${measurement.urlDelay}ms` : 'N/A'}
                            {isInvalid && <span className="text-xs text-red-400 ml-2">(无效)</span>}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm">
                            {measurement.totalDelay}ms
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {measurement.urlDelay && measurement.urlDelay > 0 ? (
                            <span className={`inline-block px-2 py-1 rounded text-xs ${measurement.urlDelay < 300 ? 'bg-green-900/30 text-green-400' :
                              measurement.urlDelay < 1000 ? 'bg-yellow-900/30 text-yellow-400' :
                                measurement.urlDelay < 2000 ? 'bg-orange-900/30 text-orange-400' :
                                  'bg-red-900/30 text-red-400'
                              }`}>
                              {measurement.urlDelay < 300 ? '优秀' :
                                measurement.urlDelay < 1000 ? '良好' :
                                  measurement.urlDelay < 2000 ? '一般' : '较差'}
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-1 rounded text-xs bg-gray-700 text-gray-400">
                              无效数据
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4 text-lg">📭 暂无测量数据</div>
              <div className="text-sm text-gray-600 max-w-md mx-auto space-y-2">
                <p>• 点击"添加模拟数据"按钮添加测试数据</p>
                <p>• 使用"快速测试"按钮进行实际导航测试</p>
                <p>• 实际测试需要导航到目标页面，然后返回此页面查看结果</p>
                <p>• 数据保存在浏览器本地，刷新页面不会丢失</p>
              </div>
            </div>
          )}
        </div>

        {/* 说明区域 */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-500">
            <div>
              <div className="font-medium text-gray-400 mb-2">🎯 测试说明</div>
              <ul className="space-y-1">
                <li>• <span className="text-blue-400">URL延迟</span>: 点击到URL栏更新的时间</li>
                <li>• <span className="text-blue-400">总延迟</span>: 点击到页面开始加载的时间</li>
                <li>• <span className="text-red-400">红色行</span>: 无效数据（负数或异常值）</li>
                <li>• 使用"清理无效数据"按钮过滤异常值</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-gray-400 mb-2">📈 性能评级标准</div>
              <ul className="space-y-1">
                <li><span className="text-green-400">优秀</span>: &lt; 300ms</li>
                <li><span className="text-yellow-400">良好</span>: 300-1000ms</li>
                <li><span className="text-orange-400">一般</span>: 1000-2000ms</li>
                <li><span className="text-red-400">较差</span>: ≥ 2000ms</li>
                <li><span className="text-gray-400">无效</span>: 负数或 &gt; 30秒</li>
              </ul>
            </div>
            <div>
              <div className="font-medium text-gray-400 mb-2">💡 使用提示</div>
              <ul className="space-y-1">
                <li>• 数据存储在浏览器本地存储中</li>
                <li>• 支持JSON格式导出分析</li>
                <li>• 可批量测试多个页面</li>
                <li>• 自动过滤无效测量数据</li>
                <li>• 模拟数据用于测试表格显示</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 调试信息 */}
        <details className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
          <summary className="cursor-pointer text-sm text-gray-400">🔍 调试信息</summary>
          <div className="mt-2 space-y-2">
            <div className="text-xs text-gray-500">
              <div>当前时间: {new Date().toISOString()}</div>
              <div>页面路径: {currentPath}</div>
              <div>测量数量: {measurements.length}</div>
              <div>有效数据: {measurements.filter(m => m.urlDelay && m.urlDelay > 0).length}</div>
              <div>测试状态: {isTesting ? '测试中' : '就绪'}</div>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}