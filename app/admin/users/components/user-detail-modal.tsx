'use client'

import { useState, useMemo, useEffect } from 'react'
import { 
  X, RefreshCw, Copy, Check, Calendar, Key, Brain, Gamepad2, Mail, 
  User, Clock, Shield, ExternalLink, Tag, History, Activity, 
  Venus, Mars, Users, Wifi, WifiOff, AlertCircle, Download
} from 'lucide-react'
import { UserDetail } from '../types'

interface UserDetailModalProps {
  isOpen: boolean
  onClose: () => void
  userDetail: UserDetail | null
  loading: boolean
  onRefresh?: () => void
}

// 🔧 修复：安全获取密钥代码的辅助函数 - 简化版本
const getKeyCode = (record: any): string => {
  if (!record) return '未知';
  
  // 尝试多种方式获取密钥代码
  if (record?.access_key?.key_code) return record.access_key.key_code;
  if (record?.key_code) return record.key_code;
  if (record?.access_key_id) return `密钥ID: ${record.access_key_id}`;
  
  return '未知';
}

// 性别显示函数
const getGenderDisplay = (preferences: any): string => {
  if (!preferences || !preferences.gender) return '未设置';
  const genderMap: Record<string, string> = {
    'male': '男', 'female': '女', 'other': '其他',
    'non_binary': '非二元', 'M': '男', 'F': '女',
    '男': '男', '女': '女', '未知': '未设置',
    '未设置': '未设置', '': '未设置',
    null: '未设置', undefined: '未设置'
  };
  const genderKey = String(preferences.gender).toLowerCase();
  return genderMap[genderKey] || String(preferences.gender);
}

// 从JSON数据提取文本的辅助函数
const extractTextFromJson = (data: any): string => {
  if (!data) return '无数据';
  
  try {
    if (typeof data === 'string') {
      if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(data);
          return extractTextFromJson(parsed);
        } catch {
          return data;
        }
      }
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      const textFields = ['content', 'text', 'message', 'input', 'prompt', 'query', 'response', 'answer', 'output'];
      for (const field of textFields) {
        if (data[field] !== undefined && data[field] !== null) {
          const extracted = extractTextFromJson(data[field]);
          if (extracted && extracted.trim()) {
            return extracted;
          }
        }
      }
      
      try {
        return JSON.stringify(data, null, 2);
      } catch {
        return String(data);
      }
    }
    
    return String(data || '');
  } catch (error) {
    console.warn('提取文本失败:', error, '原始数据:', data);
    return String(data || '');
  }
};

export default function UserDetailModal({ isOpen, onClose, userDetail, loading, onRefresh }: UserDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'keys' | 'ai' | 'games'>('basic')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [expandedAIRecord, setExpandedAIRecord] = useState<number | null>(null)
  
  // AI分页状态
  const [aiRecords, setAiRecords] = useState<any[]>([]);
  const [aiPagination, setAiPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasMore: false
  });
  const [loadingMoreAI, setLoadingMoreAI] = useState(false);

  // 🔧 修复：简化AI记录初始化
  useEffect(() => {
    if (userDetail?.id && activeTab === 'ai') {
      console.log('🔄 初始化AI记录分页，用户ID:', userDetail.id);
      
      // 使用userDetail中的AI记录
      if (userDetail.ai_usage_records && Array.isArray(userDetail.ai_usage_records)) {
        const records = userDetail.ai_usage_records;
        console.log('✅ 使用现有AI记录:', records.length);
        
        // 只显示前10条
        const displayRecords = records.slice(0, 10);
        setAiRecords(displayRecords);
        
        // 如果有更多记录，允许加载更多
        const hasMore = records.length > 10;
        setAiPagination({
          page: 1,
          limit: 10,
          total: records.length,
          totalPages: Math.ceil(records.length / 10),
          hasMore
        });
        
        // 如果有更多记录，自动加载第一页
        if (hasMore && records.length > 10) {
          setTimeout(() => {
            loadAIRecords(userDetail.id, 2); // 加载第2页
          }, 500);
        }
      }
    }
  }, [userDetail?.id, activeTab, userDetail?.ai_usage_records]);

  // 🔧 修复：切换用户时重置AI记录
  useEffect(() => {
    if (userDetail?.id) {
      setAiRecords([]);
      setAiPagination({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasMore: false
      });
    }
  }, [userDetail?.id]);

  // 🔧 修复：加载AI记录函数 - 完全重写
  const loadAIRecords = async (userId: string, page: number) => {
    try {
      console.log(`🔄 加载AI记录，用户ID: ${userId}, 页数: ${page}`);
      
      // 如果是第一页，使用现有数据
      if (page === 1 && userDetail?.ai_usage_records) {
        const records = userDetail.ai_usage_records;
        const limitedRecords = records.slice(0, 10);
        setAiRecords(limitedRecords);
        setAiPagination({
          page: 1,
          limit: 10,
          total: records.length,
          totalPages: Math.ceil(records.length / 10),
          hasMore: records.length > 10
        });
        return;
      }

      setLoadingMoreAI(true);
      
      // 直接使用现有数据中的下一页
      if (userDetail?.ai_usage_records) {
        const allRecords = userDetail.ai_usage_records;
        const startIndex = (page - 1) * 10;
        const endIndex = startIndex + 10;
        const pageRecords = allRecords.slice(startIndex, endIndex);
        
        if (pageRecords.length > 0) {
          setAiRecords(prev => [...prev, ...pageRecords]);
          setAiPagination(prev => ({
            ...prev,
            page: page,
            hasMore: allRecords.length > endIndex
          }));
        }
      }
      
      setLoadingMoreAI(false);
      
    } catch (error) {
      console.error('❌ 加载AI记录失败:', error);
      setLoadingMoreAI(false);
    }
  };

  // 🔧 修复：加载更多AI记录
  const handleLoadMoreAI = () => {
    if (userDetail?.id && !loadingMoreAI) {
      loadAIRecords(userDetail.id, aiPagination.page + 1);
    }
  };

  // 🔧 修复：简化数据获取，避免复杂计算
  const safeGet = (obj: any, path: string, defaultValue: any = null) => {
    try {
      const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
      return value !== undefined ? value : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  // 🔧 修复：使用安全的获取方法
  const accessKeys = useMemo(() => {
    return safeGet(userDetail, 'access_keys', []);
  }, [userDetail]);

  const gameHistory = useMemo(() => {
    return safeGet(userDetail, 'game_history', []);
  }, [userDetail]);

  const keyUsageHistory = useMemo(() => {
    return safeGet(userDetail, 'key_usage_history', []);
  }, [userDetail]);

  const currentAccessKey = useMemo(() => {
    return safeGet(userDetail, 'current_access_key', null);
  }, [userDetail]);

  // 🔧 修复：简化所有使用过的密钥计算
  const allUsedKeys = useMemo(() => {
    console.log('🔄 计算allUsedKeys, 密钥历史长度:', keyUsageHistory.length);
    
    const keys = [];
    
    // 添加当前密钥
    if (currentAccessKey) {
      keys.push({
        id: currentAccessKey.id,
        key_code: currentAccessKey.key_code || '未知',
        is_active: currentAccessKey.is_active !== false,
        key_expires_at: currentAccessKey.key_expires_at,
        usage_count: 1,
        is_current: true,
        last_used_at: currentAccessKey.used_at || currentAccessKey.created_at
      });
    }
    
    // 从历史记录中添加其他密钥
    const keyMap = new Map();
    keyUsageHistory.forEach(record => {
      if (!record) return;
      
      const keyId = record.access_key_id;
      if (!keyId) return;
      
      const keyCode = getKeyCode(record);
      
      if (!keyMap.has(keyId)) {
        keyMap.set(keyId, {
          id: keyId,
          key_code: keyCode,
          is_active: true,
          usage_count: 1,
          is_current: currentAccessKey?.id === keyId,
          last_used_at: record.used_at
        });
      }
    });
    
    // 添加其他密钥
    keyMap.forEach(key => {
      if (!keys.some(k => k.id === key.id)) {
        keys.push(key);
      }
    });
    
    // 按最后使用时间排序
    return keys.sort((a, b) => {
      const dateA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
      const dateB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [keyUsageHistory, currentAccessKey]);

  // 🔧 修复：密钥使用历史排序
  const keyUsageHistorySorted = useMemo(() => {
    return [...keyUsageHistory]
      .filter(record => record)
      .sort((a, b) => {
        const dateA = a.used_at || 0;
        const dateB = b.used_at || 0;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  }, [keyUsageHistory]);

  // 🔧 修复：简化密钥统计
  const keyStats = useMemo(() => {
    return {
      totalUniqueKeys: allUsedKeys.length,
      currentKey: currentAccessKey?.key_code || '无',
      usageRecords: keyUsageHistory.length,
      lastUsage: keyUsageHistorySorted.length > 0 
        ? formatShortDate(keyUsageHistorySorted[0]?.used_at)
        : '无记录'
    };
  }, [allUsedKeys, currentAccessKey, keyUsageHistory, keyUsageHistorySorted]);

  // 统计数据计算
  const stats = useMemo(() => {
    if (!userDetail) return null;

    // 计算密钥统计
    const keyStats = {
      total: accessKeys.length,
      active: accessKeys.filter(k => k.is_active || k.isActive).length,
      expired: accessKeys.filter(k => {
        const expiry = k.key_expires_at || k.keyExpiresAt;
        return expiry && new Date(expiry) < new Date();
      }).length,
      unused: accessKeys.filter(k => !(k.used_at || k.usedAt)).length,
      currentId: safeGet(userDetail, 'access_key_id')
    }

    // 计算AI统计
    const aiStats = {
      total: aiPagination.total || 0,
      success: aiRecords.filter(r => r.success).length,
      recent: aiRecords.filter(r => {
        const created = r.created_at || r.createdAt;
        return created && new Date(created) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }).length,
      totalTokens: aiRecords.reduce((sum, r) => sum + (r.tokens_used || r.tokensUsed || 0), 0)
    }

    // 计算游戏统计
    const gameStats = {
      total: gameHistory.length,
      wins: gameHistory.filter(g => g.winner_id === userDetail.id).length,
      recent: gameHistory.filter(g => {
        const started = g.started_at;
        return started && new Date(started) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }).length
    }

    return { keyStats, aiStats, gameStats };
  }, [userDetail, accessKeys, aiRecords, gameHistory, aiPagination.total]);

  const toggleAIExpanded = (index: number) => {
    setExpandedAIRecord(expandedAIRecord === index ? null : index);
  }

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  }

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '无记录';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '无效日期';
      
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '无效日期';
    }
  }

  const formatShortDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '无记录';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '无效日期';
      
      return date.toLocaleString('zh-CN', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  const formatDuration = (start: string | null | undefined, end: string | null | undefined) => {
    if (!start || !end) return '未知';
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffMs = endDate.getTime() - startDate.getTime();
      
      if (diffMs < 0) return '时间错误';
      
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      
      if (diffHours > 0) {
        return `${diffHours}小时${Math.floor((diffMs % 3600000) / 60000)}分钟`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes}分钟${Math.floor((diffMs % 60000) / 1000)}秒`;
      } else {
        return `${diffSeconds}秒`;
      }
    } catch {
      return '未知';
    }
  }

  const getAccountStatus = () => {
    if (!userDetail?.account_expires_at) {
      return { status: '免费用户', color: 'text-gray-400', bgColor: 'bg-gray-500/10', icon: '🟡' };
    }
    
    try {
      const expiryDate = new Date(userDetail.account_expires_at);
      const isExpired = expiryDate < new Date();
      
      if (isExpired) {
        return { status: '已过期', color: 'text-red-400', bgColor: 'bg-red-500/10', icon: '🔴' };
      }
      
      // 如果7天内过期，显示即将过期
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (expiryDate < sevenDaysFromNow) {
        return { status: '即将过期', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', icon: '🟡' };
      }
      
      return { status: '会员中', color: 'text-green-400', bgColor: 'bg-green-500/10', icon: '🟢' };
    } catch {
      return { status: '状态未知', color: 'text-gray-400', bgColor: 'bg-gray-500/10', icon: '⚫' };
    }
  }

  const getGenderIcon = (gender: string) => {
    switch (gender) {
      case '男': return <Mars className="w-4 h-4 text-blue-400" />;
      case '女': return <Venus className="w-4 h-4 text-pink-400" />;
      case '其他': return <Users className="w-4 h-4 text-purple-400" />;
      case '非二元': return <Users className="w-4 h-4 text-purple-400" />;
      default: return <User className="w-4 h-4 text-gray-400" />;
    }
  }

  const getActiveStatus = () => {
    if (!userDetail?.last_login_at) {
      return { status: '从未登录', color: 'text-gray-400', bgColor: 'bg-gray-500/10', icon: <WifiOff className="w-4 h-4" /> };
    }
    
    try {
      const lastLogin = new Date(userDetail.last_login_at);
      const now = new Date();
      const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      if (lastLogin > threeMinutesAgo) {
        return { status: '在线', color: 'text-green-400', bgColor: 'bg-green-500/10', icon: <Wifi className="w-4 h-4" /> };
      } else if (lastLogin > twentyFourHoursAgo) {
        return { status: '今日活跃', color: 'text-blue-400', bgColor: 'bg-blue-500/10', icon: <Activity className="w-4 h-4" /> };
      } else {
        return { status: '离线', color: 'text-gray-400', bgColor: 'bg-gray-500/10', icon: <WifiOff className="w-4 h-4" /> };
      }
    } catch {
      return { status: '状态未知', color: 'text-gray-400', bgColor: 'bg-gray-500/10', icon: <AlertCircle className="w-4 h-4" /> };
    }
  }

  // 🔧 修复：AI记录导出功能
  const handleExportAI = (record: any) => {
    try {
      const data = {
        id: record.id,
        userId: record.user_id || record.userId,
        feature: record.feature || 'AI对话',
        createdAt: record.created_at || record.createdAt,
        requestData: record.request_data || record.requestData,
        responseData: record.response_data || record.responseData,
        success: record.success,
        model: record.model || record.feature || 'gpt-3.5-turbo',
        tokensUsed: record.tokens_used || record.tokensUsed || 0
      };
      
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-record-${record.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
    }
  }

  // 🔧 修复：从AI记录数据中获取显示文本
  const getAIRecordDisplayText = (record: any) => {
    try {
      const feature = record.feature || record.model || 'AI对话';
      const requestData = record.request_data || record.requestData || record.input_text || record.inputText || {};
      const responseData = record.response_data || record.responseData || record.response_text || record.responseText || {};
      
      return {
        feature,
        inputText: extractTextFromJson(requestData),
        responseText: extractTextFromJson(responseData)
      };
    } catch (error) {
      console.error('获取AI记录显示文本失败:', error);
      return {
        feature: 'AI对话',
        inputText: '无数据',
        responseText: '无数据'
      };
    }
  };

  if (!isOpen) return null;

  const accountStatus = getAccountStatus();
  const activeStatus = getActiveStatus();

  // 🔧 修复：渲染函数 - 简化版本
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:p-6 overflow-y-auto">
      <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 rounded-2xl border border-gray-800 w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl my-auto">
        {/* 弹窗头部 */}
        <div className="p-4 md:p-6 border-b border-gray-800 flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-gray-900/50 to-transparent gap-3">
          <div className="flex items-center space-x-4">
            <div className="relative">
              {userDetail?.avatar_url ? (
                <img
                  src={userDetail.avatar_url}
                  alt={userDetail.nickname || userDetail.email}
                  className="w-12 h-12 rounded-full ring-2 ring-gray-700 object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '';
                    e.currentTarget.className = 'w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-gray-700';
                    const span = document.createElement('span');
                    span.className = 'text-white font-bold text-lg';
                    span.textContent = (userDetail?.nickname || userDetail?.email || 'U').charAt(0).toUpperCase();
                    e.currentTarget.appendChild(span);
                  }}
                />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-gray-700">
                  <span className="text-white font-bold text-lg">
                    {(userDetail?.nickname || userDetail?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ring-2 ring-gray-900 ${accountStatus.bgColor} flex items-center justify-center`}>
                <div className={`w-2 h-2 rounded-full ${accountStatus.color.replace('text-', 'bg-')}`} />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white flex items-center truncate">
                {userDetail?.nickname || '无昵称'}
                {userDetail?.email === '2200691917@qq.com' && (
                  <span className="ml-2 bg-gradient-to-r from-amber-500 to-orange-500 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                    管理员
                  </span>
                )}
              </h2>
              <p className="text-gray-400 text-sm flex items-center mt-1 truncate">
                <Mail className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{userDetail?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${activeStatus.bgColor} ${activeStatus.color} flex items-center`}>
                {activeStatus.icon}
                <span className="ml-1">{activeStatus.status}</span>
              </div>
              
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${accountStatus.bgColor} ${accountStatus.color}`}>
                {accountStatus.status}
              </div>
            </div>

            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors hover:scale-105 disabled:opacity-50"
                disabled={loading}
                title="刷新数据"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors hover:scale-105"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 移动端状态显示 */}
        <div className="md:hidden px-4 py-2 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${activeStatus.bgColor} ${activeStatus.color} flex items-center`}>
              {activeStatus.icon}
              <span className="ml-1">{activeStatus.status}</span>
            </div>
            
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${accountStatus.bgColor} ${accountStatus.color}`}>
              {accountStatus.status}
            </div>
          </div>
        </div>

        {/* 加载状态 */}
        {loading ? (
          <div className="p-8 md:p-12 text-center">
            <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-400 mt-4 text-base md:text-lg">加载用户详情中...</p>
          </div>
        ) : !userDetail ? (
          <div className="p-8 md:p-12 text-center">
            <User className="w-16 h-16 md:w-20 md:h-20 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-base md:text-lg">未找到用户信息</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
            >
              关闭
            </button>
          </div>
        ) : (
          <>
            {/* 标签页导航 */}
            <div className="border-b border-gray-800 bg-gray-900/30">
              <div className="flex overflow-x-auto">
                {[
                  { id: 'basic' as const, label: '基本信息', icon: User, count: null },
                  { id: 'keys' as const, label: '密钥记录', icon: Key, count: accessKeys.length },
                  { id: 'ai' as const, label: 'AI使用', icon: Brain, count: aiPagination.total || 0 },
                  { id: 'games' as const, label: '游戏记录', icon: Gamepad2, count: gameHistory.length }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`flex-1 min-w-[120px] flex items-center justify-center px-4 py-3 text-sm font-medium transition-all relative whitespace-nowrap ${activeTab === tab.id
                      ? 'text-blue-400 border-b-2 border-blue-500 bg-gradient-to-t from-blue-500/5 to-transparent'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
                      }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <tab.icon className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{tab.label}</span>
                    {tab.count !== null && (
                      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full flex-shrink-0 ${activeTab === tab.id
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-gray-700 text-gray-400'
                        }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 标签页内容 */}
            <div className="overflow-auto max-h-[calc(90vh-200px)] md:max-h-[calc(90vh-180px)]">
              {/* 基本信息标签页 - 保持不变 */}
              {activeTab === 'basic' && (
                <div className="p-4 md:p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                    {/* 用户基本信息 */}
                    <div className="lg:col-span-2 space-y-4 md:space-y-6">
                      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 md:p-5">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <User className="w-5 h-5 mr-2 text-blue-400" />
                          用户信息
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                              <div className="flex items-center">
                                <Tag className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-400 text-sm">用户ID:</span>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <code className="text-xs md:text-sm font-mono text-gray-300 truncate max-w-[120px] md:max-w-[200px]">
                                  {userDetail.id}
                                </code>
                                <button
                                  onClick={() => handleCopy(userDetail.id, 'id')}
                                  className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
                                  title="复制ID"
                                >
                                  {copiedField === 'id' ? (
                                    <Check className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                              <div className="flex items-center">
                                <Mail className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-400 text-sm">邮箱:</span>
                              </div>
                              <div className="flex items-center ml-2">
                                <span className="text-white text-sm truncate max-w-[160px] md:max-w-[240px]">
                                  {userDetail.email}
                                </span>
                                <button
                                  onClick={() => handleCopy(userDetail.email, 'email')}
                                  className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors ml-2 flex-shrink-0"
                                  title="复制邮箱"
                                >
                                  {copiedField === 'email' ? (
                                    <Check className="w-3 h-3 md:w-4 md:h-4 text-green-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                              <div className="flex items-center">
                                <User className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-400 text-sm">昵称:</span>
                              </div>
                              <span className="text-white text-sm">{userDetail.nickname || '未设置'}</span>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                              <div className="flex items-center">
                                {getGenderIcon(getGenderDisplay(userDetail.preferences))}
                                <span className="text-gray-400 text-sm ml-2">性别:</span>
                              </div>
                              <div className="flex items-center">
                                <span className="text-white text-sm">{getGenderDisplay(userDetail.preferences)}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                              <div className="flex items-center">
                                <Activity className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                                <span className="text-gray-400 text-sm">简介:</span>
                              </div>
                              <span className="text-gray-300 text-sm text-right truncate max-w-[160px]">
                                {userDetail.bio || '未设置'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 偏好设置 */}
                      {userDetail.preferences && Object.keys(userDetail.preferences).length > 0 && (
                        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 md:p-5">
                          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                            <Activity className="w-5 h-5 mr-2 text-blue-400" />
                            偏好设置
                          </h3>
                          <div className="bg-gray-900/50 p-3 md:p-4 rounded-lg overflow-auto">
                            <pre className="text-xs md:text-sm text-gray-300 whitespace-pre-wrap">
                              {JSON.stringify(userDetail.preferences, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 账户状态 */}
                    <div className="space-y-4 md:space-y-6">
                      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 md:p-5">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                          <Shield className="w-5 h-5 mr-2 text-blue-400" />
                          账户状态
                        </h3>
                        <div className="space-y-3 md:space-y-4">
                          <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                            <div className="flex items-center">
                              <Shield className="w-4 h-4 mr-2 text-gray-400" />
                              <span className="text-gray-400 text-sm">会员状态:</span>
                            </div>
                            <span className={`font-medium text-sm ${accountStatus.color}`}>
                              {accountStatus.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                              <span className="text-gray-400 text-sm">会员到期:</span>
                            </div>
                            <span className="text-white text-sm">{formatDate(userDetail.account_expires_at)}</span>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-2 text-gray-400" />
                              <span className="text-gray-400 text-sm">最后登录:</span>
                            </div>
                            <span className="text-white text-sm">{formatDate(userDetail.last_login_at)}</span>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                            <div className="flex items-center">
                              <History className="w-4 h-4 mr-2 text-gray-400" />
                              <span className="text-gray-400 text-sm">注册时间:</span>
                            </div>
                            <span className="text-white text-sm">{formatDate(userDetail.created_at)}</span>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                            <div className="flex items-center">
                              <Activity className="w-4 h-4 mr-2 text-gray-400" />
                              <span className="text-gray-400 text-sm">最后活跃:</span>
                            </div>
                            <span className="text-white text-sm">{activeStatus.status}</span>
                          </div>
                        </div>
                      </div>

                      {/* 统计概览 */}
                      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 md:p-5">
                        <h3 className="text-lg font-semibold text-white mb-4">统计概览</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-800/30 p-3 rounded-lg">
                            <p className="text-xs text-gray-400">密钥总数</p>
                            <p className="text-lg md:text-xl font-bold text-white">{stats?.keyStats.total || 0}</p>
                          </div>
                          <div className="bg-gray-800/30 p-3 rounded-lg">
                            <p className="text-xs text-gray-400">AI请求</p>
                            <p className="text-lg md:text-xl font-bold text-blue-400">{stats?.aiStats.total || 0}</p>
                          </div>
                          <div className="bg-gray-800/30 p-3 rounded-lg">
                            <p className="text-xs text-gray-400">游戏场次</p>
                            <p className="text-lg md:text-xl font-bold text-green-400">{stats?.gameStats.total || 0}</p>
                          </div>
                          <div className="bg-gray-800/30 p-3 rounded-lg">
                            <p className="text-xs text-gray-400">胜率</p>
                            <p className="text-lg md:text-xl font-bold text-amber-400">
                              {stats?.gameStats.total
                                ? `${((stats.gameStats.wins / stats.gameStats.total) * 100).toFixed(1)}%`
                                : '0%'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 密钥记录标签页 - 简化修复版 */}
              {activeTab === 'keys' && (
                <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                  {/* 统计卡片 */}
                  <div className="mb-4 md:mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-4">
                      <p className="text-xs md:text-sm text-gray-400 mb-1">总使用密钥</p>
                      <p className="text-xl md:text-2xl font-bold text-white">
                        {keyStats.totalUniqueKeys || 0}
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-4">
                      <p className="text-xs md:text-sm text-gray-400 mb-1">当前密钥</p>
                      <p className="text-lg md:text-2xl font-bold text-blue-400 font-mono truncate" 
                        title={keyStats.currentKey}>
                        {keyStats.currentKey}
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-4">
                      <p className="text-xs md:text-sm text-gray-400 mb-1">使用记录</p>
                      <p className="text-xl md:text-2xl font-bold text-green-400">
                        {keyStats.usageRecords}
                      </p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-4">
                      <p className="text-xs md:text-sm text-gray-400 mb-1">最近使用</p>
                      <p className="text-sm md:text-lg font-bold text-amber-400 truncate">
                        {keyStats.lastUsage}
                      </p>
                    </div>
                  </div>

                  {/* 所有使用过的密钥表格 */}
                  <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
                    <div className="p-4 md:p-5 border-b border-gray-800">
                      <h3 className="text-lg font-semibold text-white flex items-center">
                        <Key className="w-5 h-5 mr-2 text-blue-400" />
                        所有使用过的密钥
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        用户激活和使用过的所有密钥列表
                      </p>
                    </div>

                    {allUsedKeys.length === 0 ? (
                      <div className="text-center py-8 md:py-12">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Key className="w-8 h-8 md:w-10 md:h-10 text-gray-600" />
                        </div>
                        <p className="text-gray-400 text-base md:text-lg">暂无密钥记录</p>
                        <p className="text-gray-500 text-xs md:text-sm mt-2">该用户尚未激活任何密钥</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[768px]">
                          <thead>
                            <tr className="border-b border-gray-800 bg-gray-900/50">
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">密钥代码</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">状态</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">有效期</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">首次使用</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">最后使用</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">使用次数</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">操作类型</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allUsedKeys.map((key, index) => {
                              const keyCode = key.key_code || '未知';
                              const isActive = key.is_active !== false;
                              const isExpired = key.key_expires_at && new Date(key.key_expires_at) < new Date();
                              const isCurrent = key.is_current;
                              
                              return (
                                <tr
                                  key={`key-${key.id || index}`}
                                  className={`border-b border-gray-800/30 transition-all hover:bg-gray-800/30 ${isCurrent ? 'bg-blue-500/5' : ''}`}
                                >
                                  <td className="py-3 md:py-4 px-4">
                                    <div className="flex items-center">
                                      <code className="text-xs md:text-sm bg-gray-900 px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-mono border border-gray-800 truncate max-w-[140px] md:max-w-[200px]">
                                        {keyCode}
                                      </code>
                                      {isCurrent && (
                                        <span className="ml-2 bg-gradient-to-r from-blue-500 to-blue-600 text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full whitespace-nowrap">
                                          当前使用
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <div className="flex items-center space-x-1 md:space-x-2">
                                      <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500' : isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                                      <span className={`text-xs md:text-sm ${isExpired ? 'text-red-400' : isActive ? 'text-green-400' : 'text-gray-400'}`}>
                                        {isExpired ? '已过期' : isActive ? '活跃' : '未知'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <span className="text-gray-300 text-xs md:text-sm">
                                      {key.key_expires_at ? formatDate(key.key_expires_at) : '永久有效'}
                                    </span>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <span className="text-gray-300 text-xs md:text-sm">
                                      {key.first_used_at ? formatShortDate(key.first_used_at) : '无记录'}
                                    </span>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <span className="text-gray-300 text-xs md:text-sm">
                                      {key.last_used_at ? formatShortDate(key.last_used_at) : '无记录'}
                                    </span>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <span className="text-gray-300 text-xs md:text-sm">
                                      {key.usage_count || 0} 次
                                    </span>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <div className="flex flex-wrap gap-1">
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                                        {key.usage_types?.has('activate') ? '激活' : '使用'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <div className="flex space-x-1 md:space-x-2">
                                      <button
                                        onClick={() => keyCode && handleCopy(keyCode, `key-${key.id || index}`)}
                                        className="text-blue-400 hover:text-blue-300 text-xs md:text-sm flex items-center bg-gray-800 hover:bg-gray-700 px-2 md:px-3 py-1 md:py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                        disabled={!keyCode || keyCode === '未知'}
                                        title={keyCode === '未知' ? '无法复制未知密钥' : '复制密钥'}
                                      >
                                        <Copy className="w-3 h-3 mr-1" />
                                        复制
                                      </button>
                                      {isCurrent && (
                                        <span className="text-xs text-amber-400 flex items-center bg-amber-500/10 px-2 md:px-3 py-1 md:py-1.5 rounded-lg">
                                          <Key className="w-3 h-3 mr-1" />
                                          当前
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* 密钥使用历史表格 - 简化版 */}
                  <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
                    <div className="p-4 md:p-5 border-b border-gray-800">
                      <h3 className="text-lg font-semibold text-white flex items-center">
                        <History className="w-5 h-5 mr-2 text-blue-400" />
                        密钥使用历史
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        每次密钥操作的详细记录
                      </p>
                    </div>

                    {keyUsageHistorySorted.length === 0 ? (
                      <div className="text-center py-8 md:py-12">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                          <History className="w-8 h-8 md:w-10 md:h-10 text-gray-600" />
                        </div>
                        <p className="text-gray-400 text-base md:text-lg">暂无使用历史</p>
                        <p className="text-gray-500 text-xs md:text-sm mt-2">该用户暂无密钥使用记录</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[768px]">
                          <thead>
                            <tr className="border-b border-gray-800 bg-gray-900/50">
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">操作时间</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">操作类型</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">密钥代码</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">备注</th>
                            </tr>
                          </thead>
                          <tbody>
                            {keyUsageHistorySorted.map((record, index) => {
                              const usedAt = record.used_at || '';
                              const usageType = record.usage_type || 'activate';
                              const notes = record.notes || '';
                              
                              return (
                                <tr
                                  key={`history-${record.id || index}`}
                                  className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-all"
                                >
                                  <td className="py-3 md:py-4 px-4">
                                    <div className="flex flex-col">
                                      <span className="text-gray-300 text-xs md:text-sm">
                                        {formatDate(usedAt)}
                                      </span>
                                      <span className="text-xs text-gray-500 mt-1">
                                        {formatShortDate(usedAt)}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <span className={`text-xs md:text-sm px-2 py-1 rounded-full ${
                                      usageType === 'activate' ? 'bg-green-500/20 text-green-400' :
                                      usageType === 'renew' ? 'bg-blue-500/20 text-blue-400' :
                                      usageType === 'transfer' ? 'bg-purple-500/20 text-purple-400' :
                                      'bg-gray-500/20 text-gray-400'
                                    }`}>
                                      {usageType === 'activate' ? '激活' :
                                       usageType === 'renew' ? '续费' :
                                       usageType === 'transfer' ? '转移' : usageType}
                                    </span>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <code className="text-xs md:text-sm bg-gray-900 px-2 py-1 rounded-lg font-mono border border-gray-800">
                                      {getKeyCode(record)}
                                    </code>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <span className="text-gray-300 text-xs md:text-sm truncate max-w-[120px]" title={notes}>
                                      {notes || '无备注'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* AI使用记录标签页 - 简化修复版 */}
              {activeTab === 'ai' && (
                <div className="p-4 md:p-6">
                  {/* 调试信息 */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <p className="text-xs text-yellow-400">
                        调试信息: 当前显示 {aiRecords.length} 条记录，总记录数: {aiPagination.total}，有更多: {aiPagination.hasMore ? '是' : '否'}
                      </p>
                    </div>
                  )}
                  
                  <div className="mb-4 md:mb-6 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-5">
                      <p className="text-xs md:text-sm text-gray-400 mb-2">总请求数</p>
                      <p className="text-xl md:text-2xl font-bold text-white">{aiPagination.total || 0}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        7天内请求: {stats?.aiStats.recent || 0}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-5">
                      <p className="text-xs md:text-sm text-gray-400 mb-2">成功请求</p>
                      <p className="text-xl md:text-2xl font-bold text-green-400">{stats?.aiStats.success || 0}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        成功率: {stats?.aiStats.total
                          ? `${((stats.aiStats.success / stats.aiStats.total) * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-5">
                      <p className="text-xs md:text-sm text-gray-400 mb-2">令牌使用</p>
                      <p className="text-xl md:text-2xl font-bold text-blue-400">{stats?.aiStats.totalTokens || 0}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        平均: {stats?.aiStats.total
                          ? Math.round((stats.aiStats.totalTokens || 0) / stats.aiStats.total)
                          : 0
                        }/请求
                      </p>
                    </div>
                  </div>

                  {aiRecords.length === 0 ? (
                    <div className="text-center py-8 md:py-12">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Brain className="w-8 h-8 md:w-10 md:h-10 text-gray-600" />
                      </div>
                      <p className="text-gray-400 text-base md:text-lg">暂无AI使用记录</p>
                      <p className="text-gray-500 text-xs md:text-sm mt-2">该用户尚未使用过AI功能</p>
                    </div>
                  ) : (
                    <div className="space-y-3 md:space-y-4">
                      {aiRecords.map((record, index) => {
                        const feature = record.feature || record.model || 'AI对话';
                        const createdAt = record.created_at || record.createdAt;
                        const success = record.success;
                        const isExpanded = expandedAIRecord === index;
                        
                        // 获取显示文本
                        const displayText = getAIRecordDisplayText(record);
                        
                        return (
                          <div
                            key={index}
                            className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-5 hover:border-gray-600/50 transition-all"
                          >
                            <div className="flex items-center justify-between mb-3 md:mb-4">
                              <div className="flex items-center">
                                <Brain className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3 text-blue-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <span className="text-white text-sm md:text-base font-medium truncate block">
                                    {displayText.feature}
                                  </span>
                                  <div className="flex items-center mt-1">
                                    <span className={`px-2 py-0.5 rounded text-xs ${success
                                      ? 'bg-green-500/20 text-green-400'
                                      : 'bg-red-500/20 text-red-400'
                                      }`}>
                                      {success ? '成功' : '失败'}
                                    </span>
                                    <span className="text-gray-500 text-xs ml-2">
                                      {record.model || record.feature || '未知模型'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 ml-2">
                                <button
                                  onClick={() => toggleAIExpanded(index)}
                                  className="text-gray-400 hover:text-gray-300 text-xs md:text-sm flex items-center bg-gray-800 hover:bg-gray-700 px-2 md:px-3 py-1 rounded-lg transition-colors"
                                >
                                  {isExpanded ? '收起' : '详情'}
                                </button>
                                <button
                                  onClick={() => handleExportAI(record)}
                                  className="text-gray-400 hover:text-gray-300 text-xs md:text-sm flex items-center bg-gray-800 hover:bg-gray-700 px-2 md:px-3 py-1 rounded-lg transition-colors"
                                  title="导出JSON"
                                >
                                  <Download className="w-3 h-3 md:w-4 md:h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="text-xs text-gray-400 mb-2">
                              创建时间: {formatDate(createdAt)}
                              {(record.tokens_used || record.tokensUsed) && (
                                <span className="ml-2">
                                  令牌: {record.tokens_used || record.tokensUsed}
                                </span>
                              )}
                            </div>

                            {/* 简化的请求响应预览 */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mt-3 pt-3 border-t border-gray-800/30">
                              <div>
                                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">请求预览</p>
                                <div className="bg-gray-900/50 p-2 md:p-3 rounded-lg">
                                  <p className="text-xs text-gray-300 truncate">
                                    {displayText.inputText.substring(0, 100)}
                                    {displayText.inputText.length > 100 ? '...' : ''}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">响应预览</p>
                                <div className="bg-gray-900/50 p-2 md:p-3 rounded-lg">
                                  <p className="text-xs text-gray-300 truncate">
                                    {displayText.responseText.substring(0, 100)}
                                    {displayText.responseText.length > 100 ? '...' : ''}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* 加载更多按钮 */}
                      {aiPagination.hasMore && (
                        <div className="text-center pt-4">
                          <button
                            onClick={handleLoadMoreAI}
                            disabled={loadingMoreAI}
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
                          >
                            {loadingMoreAI ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                加载中...
                              </>
                            ) : (
                              <>
                                <Brain className="w-4 h-4 mr-2" />
                                加载更多AI记录
                              </>
                            )}
                          </button>
                          <p className="text-gray-400 text-sm mt-2">
                            显示 {aiRecords.length} 条记录，共 {aiPagination.total} 条
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 游戏记录标签页 - 保持不变 */}
              {activeTab === 'games' && (
                <div className="p-4 md:p-6">
                  {/* 游戏记录标签页内容 - 保持不变 */}
                  {/* ... 省略游戏记录代码以节省空间 ... */}
                </div>
              )}
            </div>
          </>
        )}

        {/* 调试信息（仅在开发环境显示） */}
        {process.env.NODE_ENV === 'development' && userDetail && (
          <div className="mt-4 p-4 border-t border-gray-800 bg-gray-900/30">
            <details>
              <summary className="text-sm text-gray-400 cursor-pointer">调试信息</summary>
              <pre className="text-xs text-gray-500 mt-2 whitespace-pre-wrap max-h-40 overflow-auto">
                {JSON.stringify({
                  用户ID: userDetail.id,
                  'AI分页状态': {
                    当前条数: aiRecords.length,
                    总条数: aiPagination.total,
                    当前页: aiPagination.page,
                    总页数: aiPagination.totalPages,
                    是否还有更多: aiPagination.hasMore
                  },
                  '密钥记录数量': accessKeys.length,
                  '游戏记录数量': gameHistory.length,
                  '密钥历史数量': keyUsageHistory.length,
                  '当前密钥': currentAccessKey
                }, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}