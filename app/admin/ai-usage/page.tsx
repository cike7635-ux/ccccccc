// /app/admin/ai-usage/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Users, DollarSign, CheckCircle, 
  BarChart3, TrendingUp, RefreshCw, Calendar,
  Download, Filter, Clock, User, PieChart,
  BarChart2, LineChart, AlertCircle, Info,
  MessageSquare, Sparkles, Eye, ChevronRight,
  Search, X, ExternalLink, ChevronLeft, ChevronRight as ChevronRightIcon,
  Zap, Brain, Target, BarChart, Key, Plus,
  Copy, Check, Lock, Unlock, Infinity,
  Hash, Clock as ClockIcon, Shield, Package,
  Trash2, Edit, EyeOff, Mail, CreditCard
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
  response_data: {
    tokens_used?: number;
    response_time_ms?: number;
    [key: string]: any;
  };
  request_data?: {
    prompt?: string;
    model?: string;
    [key: string]: any;
  };
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

interface AIBoostKey {
  id: number;
  key_code: string;
  boost_type: 'cycle' | 'daily' | 'total';
  increment_amount: number;
  duration_days: number | null;
  max_uses: number;
  used_count: number;
  used_by_user_id: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
  is_active: boolean;
  description: string | null;
  price: number | null;
  status: 'active' | 'used' | 'expired' | 'inactive';
  is_expired: boolean;
  creator?: {
    nickname: string;
    email: string;
    avatar_url?: string;
  };
  user?: {
    nickname: string;
    email: string;
    avatar_url?: string;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 安全访问函数
function getSafeProfile(record: any) {
  if (!record.profiles) {
    return {
      nickname: record.user_id ? `用户_${record.user_id.substring(0, 8)}` : '匿名用户',
      email: '未知邮箱',
      preferences: {},
      created_at: record.created_at || new Date().toISOString(),
      avatar_url: null
    };
  }
  return record.profiles;
}

// AI密钥生成组件
const AIKeyGenerator = ({ onGenerated }: { onGenerated: () => void }) => {
  const [form, setForm] = useState({
    boostType: 'cycle' as 'cycle' | 'daily' | 'total',
    incrementAmount: 50,
    durationDays: 30,
    maxUses: 1,
    quantity: 1,
    prefix: 'AI',
    description: '',
    price: ''
  });

  const [generating, setGenerating] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const [copiedKeys, setCopiedKeys] = useState<Record<string, boolean>>({});

  const handleCopy = async (keyCode: string) => {
    try {
      await navigator.clipboard.writeText(keyCode);
      setCopiedKeys(prev => ({ ...prev, [keyCode]: true }));
      setTimeout(() => {
        setCopiedKeys(prev => ({ ...prev, [keyCode]: false }));
      }, 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const response = await fetch('/api/admin/ai-keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const result = await response.json();
      
      if (result.success) {
        const newKeys = result.data.keys.map((k: any) => k.key_code);
        setGeneratedKeys(newKeys);
        alert(`✅ 成功生成 ${form.quantity} 个AI密钥`);
        onGenerated();
      } else {
        alert(`❌ 生成失败: ${result.error}`);
      }
    } catch (error: any) {
      console.error('生成密钥错误:', error);
      alert('生成失败，请检查控制台');
    } finally {
      setGenerating(false);
    }
  };

  const incrementAmounts = [10, 20, 50, 100, 200, 500];
  const durationOptions = [7, 30, 90, 180, 365];

  return (
    <div className="glass apple-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">生成AI密钥</h2>
          <p className="text-sm text-gray-400 mt-1">创建用于增加AI使用次数的密钥</p>
        </div>
        <Key className="w-5 h-5 text-gray-400" />
      </div>

      <div className="space-y-6">
        {/* 密钥类型 */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-3">
            密钥类型
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, boostType: 'cycle' })}
              className={`p-4 rounded-xl border transition-all ${
                form.boostType === 'cycle'
                  ? 'border-pink-500 bg-gradient-to-r from-pink-500/20 to-purple-500/20'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Calendar className={`w-5 h-5 ${form.boostType === 'cycle' ? 'text-pink-400' : 'text-gray-400'}`} />
                  <div className="ml-3">
                    <div className={`font-medium ${form.boostType === 'cycle' ? 'text-white' : 'text-gray-300'}`}>
                      周期密钥
                    </div>
                    <div className="text-xs text-gray-400">增加30天窗口次数</div>
                  </div>
                </div>
                {form.boostType === 'cycle' && (
                  <Check className="w-4 h-4 text-pink-400" />
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setForm({ ...form, boostType: 'daily' })}
              className={`p-4 rounded-xl border transition-all ${
                form.boostType === 'daily'
                  ? 'border-blue-500 bg-gradient-to-r from-blue-500/20 to-cyan-500/20'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <ClockIcon className={`w-5 h-5 ${form.boostType === 'daily' ? 'text-blue-400' : 'text-gray-400'}`} />
                  <div className="ml-3">
                    <div className={`font-medium ${form.boostType === 'daily' ? 'text-white' : 'text-gray-300'}`}>
                      每日密钥
                    </div>
                    <div className="text-xs text-gray-400">增加24小时窗口次数</div>
                  </div>
                </div>
                {form.boostType === 'daily' && (
                  <Check className="w-4 h-4 text-blue-400" />
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setForm({ ...form, boostType: 'total' })}
              className={`p-4 rounded-xl border transition-all ${
                form.boostType === 'total'
                  ? 'border-green-500 bg-gradient-to-r from-green-500/20 to-emerald-500/20'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Infinity className={`w-5 h-5 ${form.boostType === 'total' ? 'text-green-400' : 'text-gray-400'}`} />
                  <div className="ml-3">
                    <div className={`font-medium ${form.boostType === 'total' ? 'text-white' : 'text-gray-300'}`}>
                      永久密钥
                    </div>
                    <div className="text-xs text-gray-400">永久增加总次数</div>
                  </div>
                </div>
                {form.boostType === 'total' && (
                  <Check className="w-4 h-4 text-green-400" />
                )}
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 增加次数 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              增加次数
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {incrementAmounts.map(amount => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setForm({ ...form, incrementAmount: amount })}
                  className={`p-2 rounded-lg ${
                    form.incrementAmount === amount
                      ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  +{amount}次
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              max="10000"
              value={form.incrementAmount}
              onChange={(e) => setForm({ ...form, incrementAmount: parseInt(e.target.value) || 0 })}
              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white"
              placeholder="自定义次数"
            />
          </div>

          {/* 有效期 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              有效期（天）
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {durationOptions.map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setForm({ ...form, durationDays: days })}
                  className={`p-2 rounded-lg ${
                    form.durationDays === days
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  {days}天
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="1"
                max="3650"
                value={form.durationDays || ''}
                onChange={(e) => setForm({ ...form, durationDays: parseInt(e.target.value) || null })}
                className="flex-1 p-2 bg-white/5 border border-white/10 rounded-lg text-white"
                placeholder="自定义天数"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, durationDays: null })}
                className={`px-3 py-2 rounded-lg ${
                  form.durationDays === null
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-white/5 text-gray-400'
                }`}
              >
                永久
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 生成数量 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              生成数量
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-2">
              <span>1个</span>
              <span className="font-medium text-white">{form.quantity}个</span>
              <span>100个</span>
            </div>
          </div>

          {/* 最大使用次数 */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              最大使用次数
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: parseInt(e.target.value) || 1 })}
              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white"
            />
            <p className="text-xs text-gray-400 mt-1">每个密钥可被使用的次数</p>
          </div>
        </div>

        {/* 描述和价格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              描述（可选）
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white"
              placeholder="例如：活动赠送、用户购买"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              价格（元，可选）
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* 生成结果 */}
        {generatedKeys.length > 0 && (
          <div className="mt-6 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                <span className="font-medium text-white">密钥生成成功</span>
              </div>
              <button
                onClick={() => {
                  const allKeys = generatedKeys.join('\n');
                  navigator.clipboard.writeText(allKeys);
                  alert('已复制所有密钥');
                }}
                className="text-sm text-green-400 hover:text-green-300"
              >
                复制全部
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {generatedKeys.map(key => (
                <div key={key} className="flex items-center justify-between p-2 bg-black/30 rounded-lg">
                  <code className="font-mono text-sm text-green-300">{key}</code>
                  <button
                    onClick={() => handleCopy(key)}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    {copiedKeys[key] ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 生成按钮 */}
        <div className="pt-4">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full apple-button py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                生成中...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2 inline" />
                生成AI密钥
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// AI密钥管理组件
const AIKeysManager = () => {
  const [keys, setKeys] = useState<AIBoostKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState({
    boostType: 'all',
    status: 'all',
    search: ''
  });
  const [stats, setStats] = useState({
    totalGenerated: 0,
    totalUsed: 0,
    totalIncrement: 0,
    totalUsedIncrement: 0,
    usageRate: 0
  });

  const fetchKeys = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.boostType !== 'all' && { boostType: filters.boostType }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`/api/admin/ai-keys/list?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setKeys(result.data.keys);
        setPagination(result.data.pagination);
        setStats(result.data.stats);
      } else {
        console.error('获取密钥列表失败:', result.error);
      }
    } catch (error) {
      console.error('获取密钥列表错误:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit]);

  useEffect(() => {
    fetchKeys(1);
  }, [fetchKeys]);

  const handleRefresh = () => {
    fetchKeys(pagination.page);
  };

  const handleToggleActive = async (keyId: number, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/ai-keys/${keyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive })
      });

      const result = await response.json();
      if (result.success) {
        alert(`密钥已${!currentActive ? '启用' : '禁用'}`);
        fetchKeys(pagination.page);
      } else {
        alert(`操作失败: ${result.error}`);
      }
    } catch (error) {
      console.error('切换密钥状态错误:', error);
    }
  };

  const handleDelete = async (keyId: number, keyCode: string) => {
    if (!confirm(`确定要删除密钥 ${keyCode} 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/ai-keys/${keyId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        alert('密钥已删除');
        fetchKeys(pagination.page);
      } else {
        alert(`删除失败: ${result.error}`);
      }
    } catch (error) {
      console.error('删除密钥错误:', error);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'used': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'expired': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'inactive': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getBoostTypeText = (type: string) => {
    switch (type) {
      case 'cycle': return '周期';
      case 'daily': return '每日';
      case 'total': return '永久';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass apple-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">生成总数</p>
              <p className="text-2xl font-bold text-white">{stats.totalGenerated}</p>
            </div>
            <Package className="w-5 h-5 text-pink-400" />
          </div>
          <p className="text-xs text-gray-400 mt-2">已生成AI密钥数量</p>
        </div>

        <div className="glass apple-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">使用率</p>
              <p className="text-2xl font-bold text-white">{stats.usageRate}%</p>
            </div>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-xs text-gray-400 mt-2">{stats.totalUsed}/{stats.totalGenerated} 个已使用</p>
        </div>

        <div className="glass apple-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">总次数</p>
              <p className="text-2xl font-bold text-white">{stats.totalIncrement}</p>
            </div>
            <Hash className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-xs text-gray-400 mt-2">可增加的总AI次数</p>
        </div>

        <div className="glass apple-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">已使用次数</p>
              <p className="text-2xl font-bold text-white">{stats.totalUsedIncrement}</p>
            </div>
            <CheckCircle className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-xs text-gray-400 mt-2">已被兑换的AI次数</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="glass apple-card p-4">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="搜索密钥代码或描述..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={filters.boostType}
              onChange={(e) => setFilters({ ...filters, boostType: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
            >
              <option value="all">所有类型</option>
              <option value="cycle">周期密钥</option>
              <option value="daily">每日密钥</option>
              <option value="total">永久密钥</option>
            </select>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
            >
              <option value="all">所有状态</option>
              <option value="active">未使用</option>
              <option value="used">已使用</option>
              <option value="expired">已过期</option>
              <option value="inactive">已禁用</option>
            </select>
            
            <button
              onClick={handleRefresh}
              className="apple-button px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 密钥表格 */}
      <div className="glass apple-card overflow-hidden">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">AI密钥列表</h2>
              <p className="text-sm text-gray-400 mt-1">
                共 {pagination.total} 个密钥 • 第 {pagination.page} 页，共 {pagination.totalPages} 页
              </p>
            </div>
            <Shield className="w-5 h-5 text-gray-400" />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  密钥代码
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  增加次数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  使用者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  有效期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="animate-pulse">
                      <div className="h-4 bg-white/10 rounded mx-auto w-1/4"></div>
                    </div>
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Key className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">暂无AI密钥</p>
                    <p className="text-gray-400 text-sm mt-1">点击上方"生成AI密钥"按钮创建</p>
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="font-mono text-sm text-white bg-black/30 px-3 py-1 rounded-lg">
                          {key.key_code}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(key.key_code);
                            alert('已复制密钥');
                          }}
                          className="p-1 hover:bg-white/10 rounded"
                        >
                          <Copy className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                      {key.description && (
                        <div className="text-xs text-gray-500 mt-1">{key.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">
                        {getBoostTypeText(key.boost_type)}
                      </div>
                      <div className="text-xs text-gray-500">
                        最多使用 {key.max_uses} 次
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-lg font-bold text-white">
                        +{key.increment_amount}次
                      </div>
                      {key.price && (
                        <div className="text-xs text-green-400">
                          ¥{key.price}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium border inline-block ${getStatusColor(key.status)}`}>
                        {key.status === 'active' && '未使用'}
                        {key.status === 'used' && `已使用 ${key.used_count}/${key.max_uses}`}
                        {key.status === 'expired' && '已过期'}
                        {key.status === 'inactive' && '已禁用'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {key.user ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                            <User className="w-3 h-3 text-white" />
                          </div>
                          <div>
                            <div className="text-sm text-white">{key.user.nickname}</div>
                            <div className="text-xs text-gray-400">{key.user.email}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                      {key.used_at && (
                        <div className="text-xs text-gray-500 mt-1">
                          使用时间: {formatDateTime(key.used_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-300">
                        {key.expires_at ? formatDateTime(key.expires_at) : '永久有效'}
                      </div>
                      <div className="text-xs text-gray-500">
                        创建: {formatDateTime(key.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleToggleActive(key.id, key.is_active)}
                          className={`p-2 rounded-lg ${key.is_active ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}
                          title={key.is_active ? '禁用密钥' : '启用密钥'}
                        >
                          {key.is_active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(key.id, key.key_code)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400"
                          title="删除密钥"
                          disabled={key.used_count > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
                onClick={() => fetchKeys(pagination.page - 1)}
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
                      onClick={() => fetchKeys(pageNum)}
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
                onClick={() => fetchKeys(pagination.page + 1)}
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
  );
};

// 原来的 RecordDetailModal 组件保持原样...
// [保持原有的 RecordDetailModal 组件代码，这里省略以节省空间]

export default function AIUsagePage() {
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  
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
      console.log('📊 请求概览数据...');
      
      const response = await fetch('/api/admin/ai-usage/overview');
      
      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ 概览API响应:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'API返回错误');
      }
      
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
      console.log(`📡 请求第${page}页记录数据...`);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (statusFilter !== 'all') {
        params.append('success', statusFilter === 'success' ? 'true' : 'false');
      }
      
      const url = `/api/admin/ai-usage/records?${params}`;
      console.log('请求URL:', url);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ 记录API响应:', result);
      
      if (!result.success) {
        throw new Error(result.error || 'API返回错误');
      }
      
      // 确保有数据
      if (!result.data || !result.data.records) {
        console.warn('⚠️ API返回数据格式异常:', result);
        setRecords([]);
        setPagination({
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        });
        return;
      }
      
      setRecords(result.data.records);
      setPagination(result.data.pagination || {
        page,
        limit: pagination.limit,
        total: result.data.records.length,
        totalPages: Math.ceil(result.data.records.length / pagination.limit)
      });
      
      console.log(`✅ 加载了 ${result.data.records.length} 条记录`);
    } catch (err: any) {
      console.error('获取记录失败:', err);
      setError(err.message || '无法加载记录数据');
    } finally {
      setLoadingRecords(false);
    }
  }, [pagination.limit, statusFilter]);

  // 获取记录详情
  const fetchRecordDetail = useCallback(async (id: number) => {
    try {
      console.log(`🔍 获取记录详情 ID: ${id}`);
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
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 计算有效的总页数
  const getEffectiveTotalPages = () => {
    if (pagination.totalPages > 0) return pagination.totalPages;
    if (records.length > 0) return Math.ceil(records.length / pagination.limit);
    return 0;
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
              onClick={() => {
                fetchOverview();
                fetchRecords(1);
              }}
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
                setRefreshKey(prev => prev + 1);
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
        <div className="flex flex-wrap gap-2 mb-6">
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
            onClick={() => setActiveTab('keys')}
            className={`apple-button px-4 py-2 rounded-xl ${
              activeTab === 'keys' 
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' 
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4 mr-2 inline" />
            AI密钥管理
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
                      <p className="text-sm text-pink-300">{new Date().toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric'
                      })}</p>
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
                      共 {pagination.total > 0 ? pagination.total : records.length} 条记录 • 
                      第 {pagination.page} 页，共 {getEffectiveTotalPages()} 页
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
                          const profile = getSafeProfile(record);
                          return (
                            profile.nickname?.toLowerCase().includes(search) ||
                            profile.email?.toLowerCase().includes(search)
                          );
                        })
                        .map((record) => {
                          const profile = getSafeProfile(record);
                          return (
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
                                    <div className="font-medium text-white">{profile.nickname}</div>
                                    <div className="text-sm text-gray-400">{profile.email}</div>
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
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* 分页 */}
              {getEffectiveTotalPages() > 1 && (
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    显示第 {(pagination.page - 1) * pagination.limit + 1} -{' '}
                    {Math.min(pagination.page * pagination.limit, records.length)} 条，
                    {pagination.total > 0 ? `共 ${pagination.total} 条` : '总数未知'}
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
                      {Array.from({ length: Math.min(5, getEffectiveTotalPages()) }, (_, i) => {
                        let pageNum;
                        if (getEffectiveTotalPages() <= 5) {
                          pageNum = i + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = i + 1;
                        } else if (pagination.page >= getEffectiveTotalPages() - 2) {
                          pageNum = getEffectiveTotalPages() - 4 + i;
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
                      disabled={pagination.page >= getEffectiveTotalPages()}
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

        {/* AI密钥管理标签页 */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            <AIKeyGenerator onGenerated={() => setRefreshKey(prev => prev + 1)} />
            <AIKeysManager key={refreshKey} />
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