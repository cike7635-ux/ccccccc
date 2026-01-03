// /app/admin/ai-usage/page.tsx - 完整重制版
'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Users, DollarSign, CheckCircle, 
  BarChart3, TrendingUp, RefreshCw, Calendar,
  Download, Filter, Clock, User, PieChart,
  BarChart2, LineChart, AlertCircle, Info,
  MessageSquare, Sparkles, Eye, ChevronRight,
  Search, X, ExternalLink, ChevronLeft, ChevronRight as ChevronRightIcon,
  Zap, Brain, Target, BarChart
} from 'lucide-react';

// 类型定义
interface UsageStats {
  today: { count: number; tokens: number; cost: number };
  thirtyDays: { count: number; tokens: number; cost: number };
  total: { count: number; tokens: number; cost: number };
}

interface UserStats {
  totalProfiles: number;
  aiUsersCount: number;
  activeUsers: number;
  activeRate: number;
}

interface PreferenceStats {
  genderDistribution: {
    male: number;
    female: number;
    nonBinary: number;
    total: number;
  };
  preferenceRanking: Array<{ name: string; count: number }>;
}

interface UsageRecord {
  id: number;
  user_id: string;
  feature: string;
  success: boolean;
  created_at: string;
  response_data: any;
  profiles: {
    nickname: string;
    email: string;
    preferences: any;
    created_at: string;
  };
  user_stats: {
    today: number;
    thirtyDays: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 记录详情弹窗组件
const RecordDetailModal = ({ record, onClose }: { 
  record: UsageRecord & { request_data?: any; detailed?: any }; 
  onClose: () => void 
}) => {
  if (!record) return null;

  const getGenderText = (gender: string) => {
    switch (gender) {
      case 'male': return '男性';
      case 'female': return '女性';
      case 'non_binary': return '非二元';
      default: return '未知';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="glass apple-card max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">AI使用记录详情</h2>
            <p className="text-sm text-gray-400 mt-1">
              ID: {record.id} • {new Date(record.created_at).toLocaleString('zh-CN')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* 用户信息 */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">用户信息</h3>
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-white">{record.profiles.nickname || '匿名用户'}</div>
                      <div className="text-sm text-gray-400">{record.profiles.email || '无邮箱'}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500">注册时间</div>
                      <div className="text-sm text-white">
                        {new Date(record.profiles.created_at).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">性别</div>
                      <div className="text-sm text-white">
                        {getGenderText(record.profiles.preferences?.gender)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="text-xs text-gray-500 mb-2">用户使用统计</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-500/10 p-3 rounded-lg">
                        <div className="text-xs text-blue-400">今日使用</div>
                        <div className="text-lg font-bold text-white">{record.user_stats.today} 次</div>
                      </div>
                      <div className="bg-purple-500/10 p-3 rounded-lg">
                        <div className="text-xs text-purple-400">30天使用</div>
                        <div className="text-lg font-bold text-white">{record.user_stats.thirtyDays} 次</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 偏好信息 */}
              {record.profiles.preferences && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">用户偏好</h3>
                  <div className="glass rounded-xl p-4">
                    <div className="flex flex-wrap gap-2">
                      {record.profiles.preferences.kinks?.map((kink: string, index: number) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 rounded-full text-xs"
                        >
                          {kink}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 请求详情 */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">请求信息</h3>
                <div className="glass rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">功能</div>
                      <div className="text-sm text-white">{record.feature || '未知'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">状态</div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium inline-block ${
                        record.success 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {record.success ? '✓ 成功' : '✗ 失败'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">响应时间</div>
                      <div className="text-sm text-white">
                        {record.detailed?.response_time_ms ? `${record.detailed.response_time_ms}ms` : '未知'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Tokens消耗</div>
                      <div className="text-sm text-white">
                        {record.detailed?.tokens_used || record.response_data?.tokens_used || '未知'}
                      </div>
                    </div>
                  </div>

                  {/* 请求内容 */}
                  <div className="mt-4">
                    <div className="text-xs text-gray-500 mb-2">请求内容</div>
                    <div className="bg-black/30 rounded-lg p-3 overflow-x-auto">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                        {JSON.stringify(record.request_data || { type: 'AI生成任务' }, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* 响应内容 */}
                  <div className="mt-4">
                    <div className="text-xs text-gray-500 mb-2">响应内容</div>
                    <div className="bg-black/30 rounded-lg p-3 overflow-x-auto max-h-40">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                        {JSON.stringify(record.response_data || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 成本估算 */}
          <div className="glass rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">成本估算</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gradient-to-br from-blue-500/10 to-transparent rounded-lg">
                <div className="text-xs text-blue-400">Tokens消耗</div>
                <div className="text-lg font-bold text-white">
                  {record.detailed?.tokens_used || record.response_data?.tokens_used || 0}
                </div>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-purple-500/10 to-transparent rounded-lg">
                <div className="text-xs text-purple-400">单次成本</div>
                <div className="text-lg font-bold text-white">
                  ¥{((record.detailed?.tokens_used || 0) * 0.000002).toFixed(6)}
                </div>
              </div>
              <div className="text-center p-3 bg-gradient-to-br from-green-500/10 to-transparent rounded-lg">
                <div className="text-xs text-green-400">用户累计</div>
                <div className="text-lg font-bold text-white">
                  ¥{(record.user_stats.thirtyDays * 2188.125 * 0.000002).toFixed(4)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            关闭
          </button>
          <button
            onClick={() => {
              // 导出功能
              alert('导出功能待实现');
            }}
            className="apple-button px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white"
          >
            <Download className="w-4 h-4 mr-2 inline" />
            导出记录
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AIUsagePage() {
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // 概览数据
  const [overviewData, setOverviewData] = useState<{
    usageStats: UsageStats;
    userStats: UserStats;
    preferenceStats: PreferenceStats;
  } | null>(null);
  
  // 记录数据
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  
  // 详情弹窗
  const [selectedRecord, setSelectedRecord] = useState<UsageRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  
  // 筛选
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 获取概览数据
  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/ai-usage/overview');
      
      if (!response.ok) throw new Error(`请求失败: ${response.status}`);
      
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      setOverviewData(result.data);
      setError(null);
    } catch (err: any) {
      console.error('获取概览失败:', err);
      setError(err.message || '无法加载数据');
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取记录数据
  const fetchRecords = useCallback(async (page: number = 1) => {
    try {
      setLoadingRecords(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (statusFilter !== 'all') {
        params.append('success', statusFilter === 'success' ? 'true' : 'false');
      }
      
      const response = await fetch(`/api/admin/ai-usage/records?${params}`);
      
      if (!response.ok) throw new Error(`请求失败: ${response.status}`);
      
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      setRecords(result.data.records);
      setPagination(result.data.pagination);
    } catch (err: any) {
      console.error('获取记录失败:', err);
    } finally {
      setLoadingRecords(false);
    }
  }, [pagination.limit, statusFilter]);

  // 获取记录详情
  const fetchRecordDetail = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/admin/ai-usage/records/${id}`);
      
      if (!response.ok) throw new Error(`请求失败: ${response.status}`);
      
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      setSelectedRecord(result.data.record);
      setShowDetail(true);
    } catch (err: any) {
      console.error('获取详情失败:', err);
      alert('无法加载记录详情');
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchOverview();
    fetchRecords(1);
  }, [fetchOverview, fetchRecords]);

  // 格式化函数
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCost = (cost: number): string => {
    return `¥${cost.toFixed(6)}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 卡片数据
  const cardData = [
    {
      title: '今日使用',
      icon: Zap,
      value: overviewData?.usageStats.today.count || 0,
      description: '今天AI调用次数',
      unit: '次',
      color: 'pink',
      subValue: formatCost(overviewData?.usageStats.today.cost || 0)
    },
    {
      title: '30天使用',
      icon: Calendar,
      value: overviewData?.usageStats.thirtyDays.count || 0,
      description: '最近30天调用次数',
      unit: '次',
      color: 'purple',
      subValue: formatCost(overviewData?.usageStats.thirtyDays.cost || 0)
    },
    {
      title: '累计使用',
      icon: Activity,
      value: overviewData?.usageStats.total.count || 0,
      description: '总调用次数',
      unit: '次',
      color: 'blue',
      subValue: formatCost(overviewData?.usageStats.total.cost || 0)
    },
    {
      title: 'AI用户数',
      icon: Users,
      value: overviewData?.userStats.aiUsersCount || 0,
      description: '使用过AI的用户',
      unit: '人',
      color: 'green',
      subValue: `${overviewData?.userStats.activeRate || 0}%活跃率`
    },
    {
      title: '总注册用户',
      icon: User,
      value: overviewData?.userStats.totalProfiles || 0,
      description: '平台总注册用户',
      unit: '人',
      color: 'orange',
      subValue: `${overviewData?.userStats.activeUsers || 0}人活跃`
    },
    {
      title: '总成本估算',
      icon: DollarSign,
      value: formatCost(overviewData?.usageStats.total.cost || 0),
      description: '基于账单数据估算',
      unit: '元',
      color: 'rose',
      subValue: `${formatNumber(overviewData?.usageStats.total.tokens || 0)} tokens`
    }
  ];

  // 加载状态
  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-white/10 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error && !overviewData) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-2xl p-6 border border-red-500/30">
            <div className="flex items-center mb-3">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
              <h2 className="text-lg font-semibold text-white">加载失败</h2>
            </div>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={fetchOverview}
              className="apple-button px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2 inline" />
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">AI使用统计</h1>
            <p className="text-gray-400">监控AI功能使用情况和成本</p>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 md:mt-0">
            <button
              onClick={() => {
                fetchOverview();
                fetchRecords(1);
              }}
              className="glass apple-button px-3 py-2 text-white hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 数据说明 */}
        <div className="mb-6">
          <div className="glass rounded-2xl p-4 border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-blue-300 mb-1">数据说明</h3>
                <p className="text-blue-200 text-sm">
                  💡 成本数据为基于账单的估算值（平均 2,188 tokens/次，¥0.003075/次）
                </p>
                <p className="text-blue-300 text-sm mt-1">
                  📊 点击使用记录可以查看详细信息，包括用户偏好和AI响应内容
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 标签导航 */}
        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`apple-button px-4 py-2 rounded-xl ${
              activeTab === 'overview' 
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' 
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <BarChart className="w-4 h-4 mr-2 inline" />
            数据概览
          </button>
          <button
            onClick={() => setActiveTab('usage')}
            className={`apple-button px-4 py-2 rounded-xl ${
              activeTab === 'usage' 
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' 
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4 mr-2 inline" />
            使用记录
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`apple-button px-4 py-2 rounded-xl ${
              activeTab === 'users' 
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' 
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 mr-2 inline" />
            用户分析
          </button>
        </div>

        {/* 数据概览标签页 */}
        {activeTab === 'overview' && overviewData && (
          <>
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {cardData.map((card, index) => (
                <div 
                  key={index} 
                  className="glass apple-card p-5 hover:scale-[1.02] transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-400 mb-1">{card.title}</p>
                      <p className="text-2xl font-bold text-white">{card.value}</p>
                      <p className="text-xs text-gray-400 mt-1">{card.description}</p>
                    </div>
                    <div className={`p-2 rounded-xl bg-${card.color}-500/20`}>
                      <card.icon className={`w-5 h-5 text-${card.color}-400`} />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{card.unit}</span>
                    <span className="text-sm text-gray-400">{card.subValue}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 使用趋势 */}
            <div className="glass apple-card p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">使用趋势</h2>
                  <p className="text-sm text-gray-400 mt-1">今日与30天使用对比</p>
                </div>
                <TrendingUp className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 今日统计 */}
                <div className="bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-white">今日统计</h3>
                      <p className="text-sm text-pink-300">{new Date().toLocaleDateString('zh-CN')}</p>
                    </div>
                    <Zap className="w-5 h-5 text-pink-400" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">使用次数</span>
                      <span className="text-lg font-bold text-white">{overviewData.usageStats.today.count} 次</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Tokens消耗</span>
                      <span className="text-lg font-bold text-white">{formatNumber(overviewData.usageStats.today.tokens)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">成本估算</span>
                      <span className="text-lg font-bold text-white">{formatCost(overviewData.usageStats.today.cost)}</span>
                    </div>
                  </div>
                </div>
                
                {/* 30天统计 */}
                <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-white">30天统计</h3>
                      <p className="text-sm text-purple-300">最近30天汇总</p>
                    </div>
                    <Calendar className="w-5 h-5 text-purple-400" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">使用次数</span>
                      <span className="text-lg font-bold text-white">{overviewData.usageStats.thirtyDays.count} 次</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Tokens消耗</span>
                      <span className="text-lg font-bold text-white">{formatNumber(overviewData.usageStats.thirtyDays.tokens)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">成本估算</span>
                      <span className="text-lg font-bold text-white">{formatCost(overviewData.usageStats.thirtyDays.cost)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 使用记录标签页 */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            {/* 筛选栏 */}
            <div className="glass apple-card p-4">
              <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      placeholder="搜索用户昵称或邮箱..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
                  >
                    <option value="all" className="bg-gray-900">所有状态</option>
                    <option value="success" className="bg-gray-900">✓ 成功</option>
                    <option value="failed" className="bg-gray-900">✗ 失败</option>
                  </select>
                  
                  <button
                    onClick={() => fetchRecords(1)}
                    className="apple-button px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white"
                  >
                    <Filter className="w-4 h-4 mr-2 inline" />
                    筛选
                  </button>
                </div>
              </div>
            </div>

            {/* 记录表格 */}
            <div className="glass apple-card overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">AI使用记录</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      共 {pagination.total} 条记录 • 第 {pagination.page} 页，共 {pagination.totalPages} 页
                    </p>
                  </div>
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        时间
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        用户信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        使用统计
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loadingRecords ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="animate-pulse">
                            <div className="h-4 bg-white/10 rounded mx-auto w-1/4"></div>
                          </div>
                        </td>
                      </tr>
                    ) : records.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-500">暂无使用记录</p>
                        </td>
                      </tr>
                    ) : (
                      records
                        .filter(record => {
                          if (!searchTerm) return true;
                          const search = searchTerm.toLowerCase();
                          return (
                            record.profiles.nickname?.toLowerCase().includes(search) ||
                            record.profiles.email?.toLowerCase().includes(search)
                          );
                        })
                        .map((record) => (
                          <tr key={record.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-300">{formatDateTime(record.created_at)}</div>
                              <div className="text-xs text-gray-500">ID: {record.id}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                  <div className="font-medium text-white">{record.profiles.nickname || '匿名用户'}</div>
                                  <div className="text-sm text-gray-400">{record.profiles.email || '无邮箱'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex space-x-3">
                                <div className="text-center">
                                  <div className="text-xs text-blue-400">今日</div>
                                  <div className="text-sm font-medium text-white">{record.user_stats.today}次</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-purple-400">30天</div>
                                  <div className="text-sm font-medium text-white">{record.user_stats.thirtyDays}次</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  record.success 
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}>
                                  {record.success ? '✓ 成功' : '✗ 失败'}
                                </div>
                                <div className="ml-3 text-sm text-gray-400">{record.feature}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => fetchRecordDetail(record.id)}
                                className="apple-button px-3 py-1 text-white hover:bg-white/10"
                              >
                                <Eye className="w-4 h-4 mr-2 inline" />
                                查看详情
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    显示第 {(pagination.page - 1) * pagination.limit + 1} -{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} 条，
                    共 {pagination.total} 条
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => fetchRecords(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="glass apple-button px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = pagination.page - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => fetchRecords(pageNum)}
                            className={`w-8 h-8 rounded-lg ${
                              pagination.page === pageNum
                                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                                : 'glass text-gray-400 hover:text-white'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => fetchRecords(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="glass apple-button px-3 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 用户分析标签页 */}
        {activeTab === 'users' && overviewData?.preferenceStats && (
          <div className="space-y-6">
            {/* 性别分布 */}
            <div className="glass apple-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">用户性别分布</h2>
                  <p className="text-sm text-gray-400 mt-1">基于填写了性别的用户</p>
                </div>
                <PieChart className="w-5 h-5 text-gray-400" />
              </div>
              
              {overviewData.preferenceStats.genderDistribution.total > 0 ? (
                <div className="flex flex-col md:flex-row items-center">
                  <div className="md:w-1/3 flex justify-center mb-6 md:mb-0">
                    <div className="relative w-40 h-40">
                      <div 
                        className="absolute top-0 left-0 w-full h-full rounded-full"
                        style={{
                          background: `conic-gradient(
                            #ec4899 0% ${(overviewData.preferenceStats.genderDistribution.male / overviewData.preferenceStats.genderDistribution.total) * 100}%,
                            #8b5cf6 ${(overviewData.preferenceStats.genderDistribution.male / overviewData.preferenceStats.genderDistribution.total) * 100}% ${((overviewData.preferenceStats.genderDistribution.male + overviewData.preferenceStats.genderDistribution.female) / overviewData.preferenceStats.genderDistribution.total) * 100}%,
                            #10b981 ${((overviewData.preferenceStats.genderDistribution.male + overviewData.preferenceStats.genderDistribution.female) / overviewData.preferenceStats.genderDistribution.total) * 100}% 100%
                          )`
                        }}
                      ></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-white">
                            {overviewData.preferenceStats.genderDistribution.total}
                          </div>
                          <div className="text-xs text-gray-400">样本用户</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="md:w-2/3 md:pl-8">
                    <div className="space-y-4">
                      {[
                        { label: '男性', count: overviewData.preferenceStats.genderDistribution.male, color: 'bg-pink-500' },
                        { label: '女性', count: overviewData.preferenceStats.genderDistribution.female, color: 'bg-purple-500' },
                        { label: '非二元', count: overviewData.preferenceStats.genderDistribution.nonBinary, color: 'bg-green-500' },
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 ${item.color} rounded-full`}></div>
                            <span className="text-sm text-gray-300">{item.label}</span>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm font-medium text-white">{item.count}人</span>
                            <span className="text-sm text-gray-500">
                              {overviewData.preferenceStats.genderDistribution.total > 0
                                ? `${((item.count / overviewData.preferenceStats.genderDistribution.total) * 100).toFixed(1)}%`
                                : '0%'
                              }
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <PieChart className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500">暂无用户性别数据</p>
                </div>
              )}
            </div>

            {/* 偏好热度排行 */}
            {overviewData.preferenceStats.preferenceRanking.length > 0 && (
              <div className="glass apple-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white">偏好热度排行</h2>
                    <p className="text-sm text-gray-400 mt-1">用户最常选择的偏好</p>
                  </div>
                  <BarChart2 className="w-5 h-5 text-gray-400" />
                </div>
                
                <div className="space-y-4">
                  {overviewData.preferenceStats.preferenceRanking.map((pref, index) => (
                    <div key={pref.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 flex items-center justify-center bg-white/10 rounded-lg text-xs font-medium text-gray-300">
                            {index + 1}
                          </div>
                          <span className="text-sm text-gray-300">{pref.name}</span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm font-medium text-white">{pref.count}人选择</span>
                          <span className="text-sm text-gray-500">
                            {overviewData.preferenceStats.genderDistribution.total > 0
                              ? `${((pref.count / overviewData.preferenceStats.genderDistribution.total) * 100).toFixed(1)}%`
                              : '0%'
                            }
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full"
                          style={{
                            width: `${(pref.count / Math.max(...overviewData.preferenceStats.preferenceRanking.map(p => p.count))) * 100}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 底部状态 */}
        <div className="pt-6 border-t border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center text-sm text-gray-500">
            <div>
              <p>最后更新: {new Date().toLocaleString('zh-CN')}</p>
              <p className="mt-1">系统基于生产环境实时统计，仅管理员可见</p>
            </div>
            
            <div className="mt-4 md:mt-0">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  数据正常
                </span>
                <span>
                  总记录: {overviewData?.usageStats.total.count || 0} 条
                </span>
                <span>
                  AI用户: {overviewData?.userStats.aiUsersCount || 0} 人
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 记录详情弹窗 */}
      {showDetail && selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          onClose={() => {
            setShowDetail(false);
            setSelectedRecord(null);
          }}
        />
      )}
    </div>
  );
}