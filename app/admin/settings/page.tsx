// /app/admin/settings/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, Save, RefreshCw, Shield, Key, Users,
  Zap, Calendar, DollarSign, Bell, Globe, Lock,
  CheckCircle, AlertCircle, Database, Server,
  Mail, Clock, ShieldCheck, Activity, CreditCard,
  TrendingUp, BarChart, Package, Key as KeyIcon,
  ChevronRight, Search, Filter, Edit, Trash2,
  Plus, Eye, EyeOff, Copy, Check, X
} from 'lucide-react';

interface SystemConfig {
  ai_default_daily_limit: number;
  ai_default_cycle_limit: number;
  ai_cost_per_token: number;
  ai_cost_per_request: number;
  admin_emails: string[];
  system_mode: 'production' | 'maintenance';
  maintenance_message: string;
  enable_api_logging: boolean;
  enable_error_alerts: boolean;
  alert_email: string;
}

interface GlobalLimits {
  defaultDailyLimit: number;
  defaultCycleLimit: number;
  costPerToken: number;
  costPerRequest: number;
}

interface UserLimit {
  id: string;
  email: string;
  nickname: string;
  custom_daily_limit: number | null;
  custom_cycle_limit: number | null;
  created_at: string;
  ai_usage_count: number;
}

export default function SystemSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // 全局配置
  const [globalLimits, setGlobalLimits] = useState<GlobalLimits>({
    defaultDailyLimit: 10,
    defaultCycleLimit: 120,
    costPerToken: 0.000001405,
    costPerRequest: 0.00307465
  });
  
  // 用户自定义限制
  const [users, setUsers] = useState<UserLimit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingLimits, setEditingLimits] = useState<{ daily: number | null, cycle: number | null }>({ daily: null, cycle: null });

  // 系统配置
  const [systemConfig, setSystemConfig] = useState({
    adminEmails: ['2200691917@qq.com'],
    systemMode: 'production' as 'production' | 'maintenance',
    maintenanceMessage: '系统维护中，请稍后再试',
    enableApiLogging: true,
    enableErrorAlerts: true,
    alertEmail: '2200691917@qq.com'
  });

  // 加载数据
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadGlobalLimits(),
        loadUserLimits(),
        loadSystemConfig()
      ]);
    } catch (error) {
      console.error('加载数据失败:', error);
      showMessage('error', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const loadGlobalLimits = async () => {
    try {
      // 这里可以从数据库加载，暂时使用硬编码
      // const response = await fetch('/api/admin/settings/ai-limits');
      // const data = await response.json();
      // setGlobalLimits(data);
    } catch (error) {
      console.error('加载全局限制失败:', error);
    }
  };

  const loadUserLimits = async () => {
    try {
      const response = await fetch('/api/admin/users/ai-limits?limit=50');
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setUsers(result.data.users || []);
        }
      }
    } catch (error) {
      console.error('加载用户限制失败:', error);
    }
  };

  const loadSystemConfig = async () => {
    try {
      // 这里可以从数据库加载系统配置
      // const response = await fetch('/api/admin/settings/config');
      // const data = await response.json();
      // setSystemConfig(data);
    } catch (error) {
      console.error('加载系统配置失败:', error);
    }
  };

  const saveGlobalLimits = async () => {
    try {
      setSaving(true);
      // 保存到数据库
      const response = await fetch('/api/admin/settings/ai-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalLimits)
      });
      
      if (response.ok) {
        showMessage('success', '全局限制已保存');
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('保存全局限制失败:', error);
      showMessage('error', '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const saveUserLimits = async (userId: string) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      const response = await fetch(`/api/admin/users/${userId}/ai-limits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyLimit: editingLimits.daily,
          cycleLimit: editingLimits.cycle
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 更新本地状态
          setUsers(users.map(u => 
            u.id === userId ? {
              ...u,
              custom_daily_limit: editingLimits.daily,
              custom_cycle_limit: editingLimits.cycle
            } : u
          ));
          setEditingUser(null);
          showMessage('success', '用户限制已更新');
        }
      }
    } catch (error) {
      console.error('保存用户限制失败:', error);
      showMessage('error', '保存失败');
    }
  };

  const resetUserLimits = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/ai-limits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyLimit: null,
          cycleLimit: null
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 更新本地状态
          setUsers(users.map(u => 
            u.id === userId ? {
              ...u,
              custom_daily_limit: null,
              custom_cycle_limit: null
            } : u
          ));
          showMessage('success', '用户限制已重置为默认值');
        }
      }
    } catch (error) {
      console.error('重置用户限制失败:', error);
      showMessage('error', '重置失败');
    }
  };

  const saveSystemConfig = async () => {
    try {
      setSaving(true);
      // 保存到数据库
      const response = await fetch('/api/admin/settings/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemConfig)
      });
      
      if (response.ok) {
        showMessage('success', '系统配置已保存');
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      console.error('保存系统配置失败:', error);
      showMessage('error', '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 格式化时间
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  // 过滤用户
  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.nickname && user.nickname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-white/10 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="h-40 bg-white/10 rounded-2xl"></div>
              <div className="h-40 bg-white/10 rounded-2xl"></div>
              <div className="h-40 bg-white/10 rounded-2xl"></div>
            </div>
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
            <h1 className="text-3xl font-bold text-white mb-2">系统设置</h1>
            <p className="text-gray-400">管理系统配置和AI使用限制</p>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 md:mt-0">
            <button
              onClick={loadAllData}
              className="glass apple-button px-3 py-2 text-white hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl ${
            message.type === 'success' 
              ? 'bg-green-500/20 border border-green-500/30 text-green-400'
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            <div className="flex items-center">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-2" />
              )}
              <span>{message.text}</span>
            </div>
          </div>
        )}

        {/* 标签导航 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab('general')}
            className={`apple-button px-4 py-2 rounded-xl ${
              activeTab === 'general' 
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' 
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 mr-2 inline" />
            通用设置
          </button>
          <button
            onClick={() => setActiveTab('ai-limits')}
            className={`apple-button px-4 py-2 rounded-xl ${
              activeTab === 'ai-limits' 
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' 
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 mr-2 inline" />
            AI限制管理
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
            用户限制
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`apple-button px-4 py-2 rounded-xl ${
              activeTab === 'security' 
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' 
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 mr-2 inline" />
            安全设置
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`apple-button px-4 py-2 rounded-xl ${
              activeTab === 'monitoring' 
                ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white' 
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 mr-2 inline" />
            监控设置
          </button>
        </div>

        {/* 通用设置标签页 */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="glass apple-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">系统状态</h2>
                  <p className="text-sm text-gray-400 mt-1">管理系统运行模式</p>
                </div>
                <Server className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-3">
                    系统模式
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSystemConfig({ ...systemConfig, systemMode: 'production' })}
                      className={`p-4 rounded-xl border transition-all ${
                        systemConfig.systemMode === 'production'
                          ? 'border-green-500 bg-gradient-to-r from-green-500/20 to-emerald-500/20'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <CheckCircle className={`w-5 h-5 ${systemConfig.systemMode === 'production' ? 'text-green-400' : 'text-gray-400'}`} />
                          <div className="ml-3">
                            <div className={`font-medium ${systemConfig.systemMode === 'production' ? 'text-white' : 'text-gray-300'}`}>
                              生产模式
                            </div>
                            <div className="text-xs text-gray-400">正常服务用户</div>
                          </div>
                        </div>
                        {systemConfig.systemMode === 'production' && (
                          <Check className="w-4 h-4 text-green-400" />
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSystemConfig({ ...systemConfig, systemMode: 'maintenance' })}
                      className={`p-4 rounded-xl border transition-all ${
                        systemConfig.systemMode === 'maintenance'
                          ? 'border-yellow-500 bg-gradient-to-r from-yellow-500/20 to-orange-500/20'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <AlertCircle className={`w-5 h-5 ${systemConfig.systemMode === 'maintenance' ? 'text-yellow-400' : 'text-gray-400'}`} />
                          <div className="ml-3">
                            <div className={`font-medium ${systemConfig.systemMode === 'maintenance' ? 'text-white' : 'text-gray-300'}`}>
                              维护模式
                            </div>
                            <div className="text-xs text-gray-400">暂停服务维护</div>
                          </div>
                        </div>
                        {systemConfig.systemMode === 'maintenance' && (
                          <Check className="w-4 h-4 text-yellow-400" />
                        )}
                      </div>
                    </button>
                  </div>
                </div>
                
                {systemConfig.systemMode === 'maintenance' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      维护提示信息
                    </label>
                    <textarea
                      value={systemConfig.maintenanceMessage}
                      onChange={(e) => setSystemConfig({ ...systemConfig, maintenanceMessage: e.target.value })}
                      rows={3}
                      className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                      placeholder="请输入维护提示信息..."
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="glass apple-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">管理员邮箱</h2>
                  <p className="text-sm text-gray-400 mt-1">具有后台管理权限的邮箱地址</p>
                </div>
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="space-y-4">
                {systemConfig.adminEmails.map((email, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 text-gray-400 mr-3" />
                      <span className="text-white">{email}</span>
                    </div>
                    {index > 0 && (
                      <button
                        onClick={() => {
                          const newEmails = [...systemConfig.adminEmails];
                          newEmails.splice(index, 1);
                          setSystemConfig({ ...systemConfig, adminEmails: newEmails });
                        }}
                        className="p-1 hover:bg-white/10 rounded"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                ))}
                
                <div className="flex items-center space-x-3">
                  <input
                    type="email"
                    placeholder="输入新管理员邮箱"
                    className="flex-1 p-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        const newEmail = e.currentTarget.value.trim();
                        if (!systemConfig.adminEmails.includes(newEmail)) {
                          setSystemConfig({
                            ...systemConfig,
                            adminEmails: [...systemConfig.adminEmails, newEmail]
                          });
                        }
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <button className="glass apple-button px-3 py-2 text-white">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={saveSystemConfig}
                disabled={saving}
                className="apple-button px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2 inline" />
                    保存系统配置
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* AI限制管理标签页 */}
        {activeTab === 'ai-limits' && (
          <div className="space-y-6">
            {/* 全局默认限制 */}
            <div className="glass apple-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">全局AI使用限制</h2>
                  <p className="text-sm text-gray-400 mt-1">设置所有用户的默认限制值</p>
                </div>
                <Globe className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* 每日限制 */}
                <div className="bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-white">每日限制</h3>
                      <p className="text-sm text-pink-300">24小时滚动窗口</p>
                    </div>
                    <Clock className="w-5 h-5 text-pink-400" />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">默认值</span>
                      <div className="flex items-center space-x-3">
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={globalLimits.defaultDailyLimit}
                          onChange={(e) => setGlobalLimits({ ...globalLimits, defaultDailyLimit: parseInt(e.target.value) || 10 })}
                          className="w-24 p-2 bg-white/5 border border-white/10 rounded-lg text-white text-center"
                        />
                        <span className="text-sm text-gray-400">次/24小时</span>
                      </div>
                    </div>
                    
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                        style={{ width: `${(globalLimits.defaultDailyLimit / 100) * 100}%` }}
                      ></div>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      当用户没有自定义限制时，将使用此默认值
                    </div>
                  </div>
                </div>
                
                {/* 周期限制 */}
                <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-white">周期限制</h3>
                      <p className="text-sm text-blue-300">30天滚动窗口</p>
                    </div>
                    <Calendar className="w-5 h-5 text-blue-400" />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">默认值</span>
                      <div className="flex items-center space-x-3">
                        <input
                          type="number"
                          min="1"
                          max="9999"
                          value={globalLimits.defaultCycleLimit}
                          onChange={(e) => setGlobalLimits({ ...globalLimits, defaultCycleLimit: parseInt(e.target.value) || 120 })}
                          className="w-24 p-2 bg-white/5 border border-white/10 rounded-lg text-white text-center"
                        />
                        <span className="text-sm text-gray-400">次/30天</span>
                      </div>
                    </div>
                    
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                        style={{ width: `${(globalLimits.defaultCycleLimit / 1000) * 100}%` }}
                      ></div>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      当用户没有自定义限制时，将使用此默认值
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 成本设置 */}
              <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-white">成本配置</h3>
                    <p className="text-sm text-green-300">基于账单数据的成本估算</p>
                  </div>
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">每Token成本 (¥)</label>
                    <input
                      type="number"
                      step="0.000000001"
                      value={globalLimits.costPerToken}
                      onChange={(e) => setGlobalLimits({ ...globalLimits, costPerToken: parseFloat(e.target.value) })}
                      className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                    <div className="text-xs text-gray-500 mt-1">约 0.000001405 元/token</div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">每次请求平均成本 (¥)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={globalLimits.costPerRequest}
                      onChange={(e) => setGlobalLimits({ ...globalLimits, costPerRequest: parseFloat(e.target.value) })}
                      className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white"
                    />
                    <div className="text-xs text-gray-500 mt-1">约 0.00307465 元/次</div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={saveGlobalLimits}
                  disabled={saving}
                  className="apple-button px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2 inline" />
                      保存全局限制
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* 使用说明 */}
            <div className="glass apple-card p-6 border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent">
              <div className="flex items-start">
                <Info className="w-5 h-5 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <h3 className="font-medium text-blue-300 mb-2">使用说明</h3>
                  <ul className="space-y-2 text-blue-200 text-sm">
                    <li>• <span className="text-white">全局限制</span>：所有用户的默认限制，当用户没有自定义限制时生效</li>
                    <li>• <span className="text-white">用户自定义限制</span>：在"用户限制"标签页中可以覆盖全局限制</li>
                    <li>• <span className="text-white">重置为默认</span>：将用户自定义限制设置为null即可恢复使用全局默认值</li>
                    <li>• <span className="text-white">成本计算</span>：基于实际账单数据调整，确保成本估算准确</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 用户限制标签页 */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* 搜索筛选 */}
            <div className="glass apple-card p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="搜索用户邮箱或昵称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>

            {/* 用户表格 */}
            <div className="glass apple-card overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">用户AI限制管理</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      共 {users.length} 个用户 • {users.filter(u => u.custom_daily_limit !== null || u.custom_cycle_limit !== null).length} 个设置了自定义限制
                    </p>
                  </div>
                  <Users className="w-5 h-5 text-gray-400" />
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        用户信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        每日限制
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        周期限制
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        使用统计
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-500">暂无用户数据</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <div className="font-medium text-white">{user.nickname || '未设置昵称'}</div>
                                <div className="text-sm text-gray-400">{user.email}</div>
                                <div className="text-xs text-gray-500">注册: {formatDate(user.created_at)}</div>
                              </div>
                            </div>
                          </td>
                          
                          <td className="px-6 py-4">
                            {editingUser === user.id ? (
                              <input
                                type="number"
                                min="1"
                                max="999"
                                value={editingLimits.daily || ''}
                                onChange={(e) => setEditingLimits({ ...editingLimits, daily: e.target.value ? parseInt(e.target.value) : null })}
                                className="w-20 p-2 bg-white/5 border border-white/10 rounded-lg text-white text-center"
                                placeholder="默认"
                              />
                            ) : (
                              <div className="flex items-center space-x-2">
                                <div className={`text-lg font-bold ${
                                  user.custom_daily_limit !== null ? 'text-pink-400' : 'text-gray-400'
                                }`}>
                                  {user.custom_daily_limit || globalLimits.defaultDailyLimit}
                                </div>
                                <span className="text-sm text-gray-500">次</span>
                                {user.custom_daily_limit !== null && (
                                  <span className="text-xs text-pink-500">(自定义)</span>
                                )}
                              </div>
                            )}
                          </td>
                          
                          <td className="px-6 py-4">
                            {editingUser === user.id ? (
                              <input
                                type="number"
                                min="1"
                                max="9999"
                                value={editingLimits.cycle || ''}
                                onChange={(e) => setEditingLimits({ ...editingLimits, cycle: e.target.value ? parseInt(e.target.value) : null })}
                                className="w-24 p-2 bg-white/5 border border-white/10 rounded-lg text-white text-center"
                                placeholder="默认"
                              />
                            ) : (
                              <div className="flex items-center space-x-2">
                                <div className={`text-lg font-bold ${
                                  user.custom_cycle_limit !== null ? 'text-blue-400' : 'text-gray-400'
                                }`}>
                                  {user.custom_cycle_limit || globalLimits.defaultCycleLimit}
                                </div>
                                <span className="text-sm text-gray-500">次</span>
                                {user.custom_cycle_limit !== null && (
                                  <span className="text-xs text-blue-500">(自定义)</span>
                                )}
                              </div>
                            )}
                          </td>
                          
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-300">
                              已使用 {user.ai_usage_count || 0} 次
                            </div>
                            <div className="text-xs text-gray-500">
                              未设置自定义限制
                            </div>
                          </td>
                          
                          <td className="px-6 py-4">
                            {editingUser === user.id ? (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => saveUserLimits(user.id)}
                                  className="apple-button px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingUser(null);
                                    setEditingLimits({ daily: null, cycle: null });
                                  }}
                                  className="apple-button px-3 py-1 glass text-gray-400"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingUser(user.id);
                                    setEditingLimits({
                                      daily: user.custom_daily_limit,
                                      cycle: user.custom_cycle_limit
                                    });
                                  }}
                                  className="apple-button px-3 py-1 glass text-gray-400 hover:text-white"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {(user.custom_daily_limit !== null || user.custom_cycle_limit !== null) && (
                                  <button
                                    onClick={() => resetUserLimits(user.id)}
                                    className="apple-button px-3 py-1 bg-gradient-to-r from-gray-500 to-gray-700 text-white"
                                    title="重置为默认值"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* 批量操作 */}
            <div className="glass apple-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">批量操作</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    // 批量设置为50/500
                    const updatedUsers = users.map(u => ({
                      ...u,
                      custom_daily_limit: 50,
                      custom_cycle_limit: 500
                    }));
                    setUsers(updatedUsers);
                  }}
                  className="glass apple-button p-4 text-center hover:bg-white/10"
                >
                  <div className="text-lg font-bold text-white">50/500</div>
                  <div className="text-sm text-gray-400">设为VIP限制</div>
                </button>
                
                <button
                  onClick={() => {
                    // 批量设置为20/200
                    const updatedUsers = users.map(u => ({
                      ...u,
                      custom_daily_limit: 20,
                      custom_cycle_limit: 200
                    }));
                    setUsers(updatedUsers);
                  }}
                  className="glass apple-button p-4 text-center hover:bg-white/10"
                >
                  <div className="text-lg font-bold text-white">20/200</div>
                  <div className="text-sm text-gray-400">设为高级限制</div>
                </button>
                
                <button
                  onClick={() => {
                    // 批量重置
                    const updatedUsers = users.map(u => ({
                      ...u,
                      custom_daily_limit: null,
                      custom_cycle_limit: null
                    }));
                    setUsers(updatedUsers);
                  }}
                  className="glass apple-button p-4 text-center hover:bg-white/10"
                >
                  <div className="text-lg font-bold text-white">重置</div>
                  <div className="text-sm text-gray-400">全部恢复默认</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 安全设置标签页 */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="glass apple-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">API安全设置</h2>
                  <p className="text-sm text-gray-400 mt-1">配置系统API的安全参数</p>
                </div>
                <ShieldCheck className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={systemConfig.enableApiLogging}
                        onChange={(e) => setSystemConfig({ ...systemConfig, enableApiLogging: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors ${
                        systemConfig.enableApiLogging ? 'bg-green-500' : 'bg-gray-700'
                      }`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          systemConfig.enableApiLogging ? 'transform translate-x-6' : ''
                        }`}></div>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-white">API日志记录</div>
                      <div className="text-sm text-gray-400">记录所有API请求和响应</div>
                    </div>
                  </label>
                </div>
                
                <div>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={systemConfig.enableErrorAlerts}
                        onChange={(e) => setSystemConfig({ ...systemConfig, enableErrorAlerts: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors ${
                        systemConfig.enableErrorAlerts ? 'bg-green-500' : 'bg-gray-700'
                      }`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          systemConfig.enableErrorAlerts ? 'transform translate-x-6' : ''
                        }`}></div>
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-white">错误告警</div>
                      <div className="text-sm text-gray-400">系统错误时发送邮件通知</div>
                    </div>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    告警邮箱
                  </label>
                  <input
                    type="email"
                    value={systemConfig.alertEmail}
                    onChange={(e) => setSystemConfig({ ...systemConfig, alertEmail: e.target.value })}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                    placeholder="接收错误通知的邮箱"
                  />
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">密钥轮换</h3>
                    <p className="text-sm text-gray-400 mt-1">定期更新API密钥增强安全性</p>
                  </div>
                  <button className="apple-button px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white">
                    <KeyIcon className="w-4 h-4 mr-2 inline" />
                    立即轮换密钥
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={saveSystemConfig}
                disabled={saving}
                className="apple-button px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2 inline" />
                    保存安全设置
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 监控设置标签页 */}
        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <div className="glass apple-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">系统监控</h2>
                  <p className="text-sm text-gray-400 mt-1">配置系统性能监控和告警</p>
                </div>
                <Activity className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-white">性能指标</h3>
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">API响应时间</span>
                      <span className="text-sm text-white">&lt; 500ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">数据库连接</span>
                      <span className="text-sm text-green-400">正常</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">系统负载</span>
                      <span className="text-sm text-white">24%</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-white">使用统计</h3>
                    <BarChart className="w-5 h-5 text-blue-400" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">今日AI请求</span>
                      <span className="text-sm text-white">1,234次</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">活跃用户</span>
                      <span className="text-sm text-white">89人</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-400">成功率</span>
                      <span className="text-sm text-green-400">99.2%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">监控面板</h3>
                    <p className="text-sm text-gray-400 mt-1">访问详细监控数据</p>
                  </div>
                  <a 
                    href="/admin/ai-usage" 
                    className="apple-button px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white"
                  >
                    前往AI统计
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}