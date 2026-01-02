// /app/admin/ai-usage/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  RefreshCw, 
  Filter, 
  Settings,
  Bell,
  Search,
  Calendar,
  Users,
  Key,
  BarChart3,
  TrendingUp,
  PieChart,
  LineChart,
  AlertTriangle,
  Zap,
  DollarSign,
  Clock,
  CheckCircle,
  Activity
} from 'lucide-react';

// 导入组件
import TimeRangeSelector from './components/Shared/TimeRangeSelector';
import LoadingSpinner from './components/Shared/LoadingSpinner';
import OverviewCards from './components/Dashboard/OverviewCards';
import UsageTrendChart from './components/Dashboard/UsageTrendChart';
import HourlyDistribution from './components/Dashboard/HourlyDistribution';
import CostAnalysis from './components/Dashboard/CostAnalysis';
import UserProfileStats from './components/UserAnalysis/UserProfileStats';
import PreferenceAnalysis from './components/UserAnalysis/PreferenceAnalysis';
import UserRankingTable from './components/UserAnalysis/UserRankingTable';
import KeyGenerator from './components/KeyManagement/KeyGenerator';
import KeyList from './components/KeyManagement/KeyList';
import KeyAnalytics from './components/KeyManagement/KeyAnalytics';
import TopicAnalysis from './components/ContentAnalysis/TopicAnalysis';
import QualityMetrics from './components/ContentAnalysis/QualityMetrics';
import UsageForecast from './components/PredictiveAnalysis/UsageForecast';
import OptimizationSuggestions from './components/PredictiveAnalysis/OptimizationSuggestions';

// 导入类型
import { 
  TimeRange, 
  FilterOptions, 
  StatisticsResponse 
} from './types';

export default function AIUsagePage() {
  // 状态管理
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [filters, setFilters] = useState<FilterOptions>({
    timeRange: '30d'
  });
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);

  // 获取数据
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const queryParams = new URLSearchParams({
        timeRange: filters.timeRange,
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.gender && { gender: filters.gender.join(',') }),
        ...(filters.preferences && { preferences: filters.preferences.join(',') }),
      });

      const response = await fetch(`/api/admin/ai-usage/statistics?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`获取数据失败: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
      console.error('获取统计数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    fetchData();
  }, [filters]);

  // 自动刷新
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 30000); // 每30秒刷新一次

    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  // 处理时间范围变化
  const handleTimeRangeChange = (newTimeRange: TimeRange) => {
    setTimeRange(newTimeRange);
    setFilters(prev => ({
      ...prev,
      timeRange: newTimeRange
    }));
  };

  // 处理过滤器变化
  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // 导出数据
  const handleExport = (format: 'json' | 'csv' | 'excel') => {
    if (!data) return;
    
    const exportData = {
      ...data,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: format === 'json' ? 'application/json' : 
             format === 'csv' ? 'text/csv' : 
             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-statistics-${timeRange}-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 快速操作按钮
  const QuickActions = () => (
    <div className="flex items-center gap-2 mb-4">
      <Button
        onClick={fetchData}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        刷新数据
      </Button>
      
      <Button
        onClick={() => handleExport('json')}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <Download className="h-4 w-4" />
        导出JSON
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setIsAutoRefresh(!isAutoRefresh)}
      >
        <Activity className="h-4 w-4" />
        {isAutoRefresh ? '关闭自动刷新' : '开启自动刷新'}
      </Button>
    </div>
  );

  // 加载状态
  if (loading && !data) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <LoadingSpinner message="加载AI统计数据中..." />
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                加载失败
              </CardTitle>
              <CardDescription>无法加载统计数据</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchData}>重试</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              AI使用统计
            </h1>
            {lastUpdated && (
              <span className="text-sm text-muted-foreground">
                最后更新: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <TimeRangeSelector
              value={timeRange}
              onChange={handleTimeRangeChange}
            />
            
            <QuickActions />
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              仪表盘
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              用户分析
            </TabsTrigger>
            <TabsTrigger value="keys" className="gap-2">
              <Key className="h-4 w-4" />
              密钥管理
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2">
              <PieChart className="h-4 w-4" />
              内容分析
            </TabsTrigger>
            <TabsTrigger value="predictions" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              预测建议
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              设置
            </TabsTrigger>
          </TabsList>

          {/* 仪表盘标签页 */}
          <TabsContent value="dashboard" className="space-y-6">
            <OverviewCards data={data?.overview} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5" />
                    使用趋势
                  </CardTitle>
                  <CardDescription>AI使用量随时间变化趋势</CardDescription>
                </CardHeader>
                <CardContent>
                  <UsageTrendChart data={data?.trends || []} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    小时分布
                  </CardTitle>
                  <CardDescription>24小时内使用情况分布</CardDescription>
                </CardHeader>
                <CardContent>
                  <HourlyDistribution data={data?.hourly || []} />
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  成本分析
                </CardTitle>
                <CardDescription>AI使用成本详细分析</CardDescription>
              </CardHeader>
              <CardContent>
                <CostAnalysis data={data} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 用户分析标签页 */}
          <TabsContent value="users" className="space-y-6">
            <UserProfileStats 
              profiles={data?.userProfiles || []}
              onFilterChange={handleFilterChange}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    用户偏好分析
                  </CardTitle>
                  <CardDescription>用户偏好分布与性别差异分析</CardDescription>
                </CardHeader>
                <CardContent>
                  <PreferenceAnalysis 
                    preferenceStats={data?.preferenceStats || []}
                    genderAnalysis={data?.genderAnalysis || []}
                  />
                </CardContent>
              </Card>
              
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    用户排名
                  </CardTitle>
                  <CardDescription>按使用量、Tokens消耗等指标排名</CardDescription>
                </CardHeader>
                <CardContent>
                  <UserRankingTable profiles={data?.userProfiles || []} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 密钥管理标签页 */}
          <TabsContent value="keys" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    AI密钥管理
                  </CardTitle>
                  <CardDescription>生成、查看和管理AI使用密钥</CardDescription>
                </CardHeader>
                <CardContent>
                  <KeyList keys={data?.keys || []} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    密钥生成器
                  </CardTitle>
                  <CardDescription>生成新的AI使用密钥</CardDescription>
                </CardHeader>
                <CardContent>
                  <KeyGenerator onKeyGenerated={fetchData} />
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  密钥分析
                </CardTitle>
                <CardDescription>密钥使用率、激活率等分析</CardDescription>
              </CardHeader>
              <CardContent>
                <KeyAnalytics analytics={data?.keyAnalytics} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 内容分析标签页 */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  主题分析
                </CardTitle>
                <CardDescription>用户偏好主题与内容趋势分析</CardDescription>
              </CardHeader>
              <CardContent>
                <TopicAnalysis topics={data?.topics || []} />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  质量指标
                </CardTitle>
                <CardDescription>AI生成内容的质量评估指标</CardDescription>
              </CardHeader>
              <CardContent>
                <QualityMetrics metrics={data?.quality} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 预测建议标签页 */}
          <TabsContent value="predictions" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    使用量预测
                  </CardTitle>
                  <CardDescription>基于历史数据的未来使用量预测</CardDescription>
                </CardHeader>
                <CardContent>
                  <UsageForecast forecasts={data?.forecast || []} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    优化建议
                  </CardTitle>
                  <CardDescription>系统优化与改进建议</CardDescription>
                </CardHeader>
                <CardContent>
                  <OptimizationSuggestions suggestions={data?.suggestions || []} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 设置标签页 */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  系统设置
                </CardTitle>
                <CardDescription>AI统计系统配置选项</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">数据保留策略</h3>
                  <p className="text-sm text-muted-foreground">
                    设置统计数据保留的时间长度
                  </p>
                  {/* 设置表单 */}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">通知设置</h3>
                  <p className="text-sm text-muted-foreground">
                    配置系统告警和通知
                  </p>
                  {/* 通知设置表单 */}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">导出配置</h3>
                  <p className="text-sm text-muted-foreground">
                    设置数据导出格式和选项
                  </p>
                  {/* 导出配置表单 */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}