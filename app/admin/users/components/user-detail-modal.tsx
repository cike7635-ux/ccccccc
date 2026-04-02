'use client'

import { useState, useMemo, useEffect } from 'react'
import { 
  X, RefreshCw, Copy, Check, Calendar, Key, Brain, Gamepad2, Mail, 
  User, Clock, Shield, ExternalLink, Tag, History, Activity, 
  Venus, Mars, Users, Wifi, WifiOff, AlertCircle, Download,
  ChevronDown, ChevronUp
} from 'lucide-react'
import { UserDetail } from '../types'

interface UserDetailModalProps {
  isOpen: boolean
  onClose: () => void
  userDetail: UserDetail | null
  loading: boolean
  onRefresh?: () => void
}

// 🔧 修复：获取密钥代码的辅助函数 - 增强版
const getKeyCode = (record: any): string => {
  // 调试日志
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 getKeyCode 调试:', {
      recordId: record?.id,
      accessKeyId: record?.access_key_id,
      hasAccessKey: !!record?.access_key,
      accessKeyCode: record?.access_key?.key_code,
      hasAccessKeysArray: Array.isArray(record?.access_keys),
      accessKeysLength: record?.access_keys?.length,
      firstAccessKeyCode: record?.access_keys?.[0]?.key_code,
      accessKeysObject: record?.access_keys // 检查是否是对象
    })
  }

  // 情况1: 直接有access_key对象（修复后API返回格式）
  if (record?.access_key?.key_code) {
    return record.access_key.key_code
  }
  
  // 情况2: 有access_keys数组（关联查询返回格式）
  if (Array.isArray(record?.access_keys) && record.access_keys.length > 0) {
    const firstKey = record.access_keys[0]
    if (firstKey?.key_code) {
      return firstKey.key_code
    }
  }
  
  // 情况3: access_keys是对象（某些Supabase版本返回格式）
  if (record?.access_keys?.key_code) {
    return record.access_keys.key_code
  }
  
  // 情况4: 只有access_key_id
  if (record?.access_key_id) {
    return `密钥ID: ${record.access_key_id}`
  }
  
  return '未知'
}

// 🔧 修复：检查是否是当前密钥
const isCurrentKey = (keyId: number | null, currentKey: any): boolean => {
  if (!keyId || !currentKey) return false
  
  // 比较当前密钥的ID
  if (currentKey.id === keyId) return true
  
  // 如果当前密钥有access_key属性，也比较一下
  if (currentKey.access_key?.id === keyId) return true
  
  return false
}

// 性别显示函数 - 与types.ts保持一致
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
    // 如果已经是字符串
    if (typeof data === 'string') {
      // 尝试解析为JSON
      if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(data);
          return extractTextFromJson(parsed);
        } catch {
          // 解析失败，返回原始字符串
          return data;
        }
      }
      return data;
    }
    
    // 如果是对象
    if (typeof data === 'object' && data !== null) {
      // 优先尝试常见的文本字段
      const textFields = ['content', 'text', 'message', 'input', 'prompt', 'query', 'response', 'answer', 'output'];
      
      for (const field of textFields) {
        if (data[field] !== undefined && data[field] !== null) {
          const extracted = extractTextFromJson(data[field]);
          if (extracted && extracted.trim()) {
            return extracted;
          }
        }
      }
      
      // 如果没有找到常见字段，返回整个对象的JSON字符串
      try {
        return JSON.stringify(data, null, 2);
      } catch {
        return String(data);
      }
    }
    
    // 其他类型直接转为字符串
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
  
  // 🔧 新增：AI分页状态
  const [aiRecords, setAiRecords] = useState<any[]>([]);
  const [aiPagination, setAiPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasMore: false
  });
  const [loadingMoreAI, setLoadingMoreAI] = useState(false);

  // 🔧 修复：获取API返回的总记录数 - 增强版
  const getTotalRecords = () => {
    if (!userDetail) return { keyTotal: 0, aiTotal: 0, gameTotal: 0 };
    
    // 🔧 修复：添加详细的调试信息
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 获取总记录数，userDetail结构:', {
        userDetailKeys: Object.keys(userDetail),
        key_usage_history_total: userDetail.key_usage_history_total,
        ai_usage_records_total: userDetail.ai_usage_records_total,
        game_history_total: userDetail.game_history_total,
        keyUsageHistoryTotal: userDetail.keyUsageHistoryTotal,
        aiUsageRecordsTotal: userDetail.aiUsageRecordsTotal,
        gameHistoryTotal: userDetail.gameHistoryTotal,
        key_usage_history_length: userDetail.key_usage_history?.length,
        ai_usage_records_length: userDetail.ai_usage_records?.length,
        game_history_length: userDetail.game_history?.length
      });
    }
    
    // 🔧 修复：优先使用下划线格式，然后驼峰格式
    const keyTotal = userDetail.key_usage_history_total || userDetail.keyUsageHistoryTotal || 0;
    const aiTotal = userDetail.ai_usage_records_total || userDetail.aiUsageRecordsTotal || 0;
    const gameTotal = userDetail.game_history_total || userDetail.gameHistoryTotal || 0;
    
    // 🔧 修复：如果总数为0，但数组有数据，使用数组长度（后备方案）
    return {
      keyTotal: keyTotal > 0 ? keyTotal : (userDetail.key_usage_history?.length || 0),
      aiTotal: aiTotal > 0 ? aiTotal : (userDetail.ai_usage_records?.length || 0),
      gameTotal: gameTotal > 0 ? gameTotal : (userDetail.game_history?.length || 0)
    };
  };

  // 🔧 修复：调试日志 - 显示详细的密钥历史数据结构
  useEffect(() => {
    if (userDetail && isOpen && process.env.NODE_ENV === 'development') {
      console.log('🔍 UserDetailModal - 用户详情数据结构:', {
        hasUserDetail: !!userDetail,
        keys: Object.keys(userDetail),
        key_usage_history: userDetail.key_usage_history,
        key_usage_history_length: userDetail.key_usage_history?.length,
        key_usage_history_total: userDetail.key_usage_history_total,
        ai_usage_records_total: userDetail.ai_usage_records_total,
        game_history_total: userDetail.game_history_total,
        firstKeyHistory: userDetail.key_usage_history?.[0],
        firstKeyAccessKey: userDetail.key_usage_history?.[0]?.access_key,
        firstKeyAccessKeys: userDetail.key_usage_history?.[0]?.access_keys,
        currentAccessKey: userDetail.current_access_key
      });
      
      // 特别调试getKeyCode函数
      if (userDetail.key_usage_history?.[0]) {
        const testCode = getKeyCode(userDetail.key_usage_history[0]);
        console.log('🔍 getKeyCode测试结果:', testCode);
      }
      
      // 调试标签页计数
      const totals = getTotalRecords();
      console.log('🔍 标签页计数计算结果:', totals);
    }
  }, [userDetail, isOpen]);

  // 🔧 修复：初始化AI记录分页数据
  useEffect(() => {
    if (userDetail?.id && activeTab === 'ai') {
      loadAIRecords(userDetail.id, 1, true);
    }
  }, [userDetail?.id, activeTab]);

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

  // 🔧 修复：加载AI记录函数 - 改进版
  const loadAIRecords = async (userId: string, page: number, isInitial: boolean = false) => {
    try {
      console.log(`🔄 加载AI记录，用户ID: ${userId}, 页数: ${page}, 初始: ${isInitial}`);
      
      // 如果是初始加载，使用已有的数据
      if (isInitial && userDetail?.ai_usage_records) {
        const records = userDetail.ai_usage_records;
        // 🔧 修复：使用API返回的总数
        const total = getTotalRecords().aiTotal || records.length;
        
        console.log('✅ 使用现有AI记录:', {
          现有记录数: records.length,
          总记录数: total,
          还有更多: total > records.length
        });
        
        setAiRecords(records);
        setAiPagination({
          page: 1,
          limit: 10,
          total: total,
          totalPages: Math.ceil(total / 10),
          hasMore: total > records.length
        });
        
        // 🔧 修复：如果总记录数大于当前记录数，自动加载剩余记录
        if (total > records.length && !loadingMoreAI) {
          console.log(`📈 需要加载剩余${total - records.length}条记录`);
          // 立即加载第2页
          setTimeout(() => {
            loadAIRecords(userId, 2);
          }, 100);
        }
        return;
      }

      setLoadingMoreAI(true);
      
      // 使用分页API
      const apiUrl = `/api/admin/users/ai-records?userId=${userId}&page=${page}&limit=10`;
      console.log('📡 调用AI记录API:', apiUrl);
      
      const response = await fetch(apiUrl, { credentials: 'include' });
      
      console.log('📡 AI记录API响应状态:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          console.log(`✅ 获取到AI记录: ${result.data?.length || 0} 条`);
          
          if (page === 1) {
            // 第一页：直接设置数据
            setAiRecords(result.data || []);
          } else {
            // 后续页：追加数据
            setAiRecords(prev => [...prev, ...(result.data || [])]);
          }
          
          setAiPagination({
            page: result.pagination?.page || page,
            limit: result.pagination?.limit || 10,
            total: result.pagination?.total || (result.data?.length || 0),
            totalPages: result.pagination?.totalPages || 1,
            hasMore: result.pagination?.hasMore || false
          });
          
          console.log('📊 分页状态更新:', {
            当前记录数: aiRecords.length + (result.data?.length || 0),
            总记录数: result.pagination?.total,
            还有更多: result.pagination?.hasMore
          });
        }
      }
    } catch (error) {
      console.error('❌ 加载AI记录失败:', error);
    } finally {
      setLoadingMoreAI(false);
    }
  };

  // 🔧 修复：安全获取AI使用记录
  const aiUsageRecords = useMemo(() => {
    try {
      if (!userDetail) {
        return [];
      }

      // 使用下划线格式的数组
      let records = userDetail.ai_usage_records;
      
      // 确保是数组
      if (!Array.isArray(records)) {
        records = [];
      }
      
      return records;
    } catch (err) {
      console.error('❌ 获取aiUsageRecords出错:', err);
      return [];
    }
  }, [userDetail]);

  // 🔧 修复：安全获取访问密钥
  const accessKeys = useMemo(() => {
    try {
      if (!userDetail) return [];
      
      // 优先使用下划线格式，然后是驼峰格式
      const keys = userDetail.access_keys || userDetail.accessKeys || [];
      
      if (typeof keys === 'number') {
        console.warn('⚠️ accessKeys: 获取到数字而不是数组');
        return [];
      }
      
      return Array.isArray(keys) ? keys : [];
    } catch (err) {
      console.error('获取accessKeys出错:', err);
      return [];
    }
  }, [userDetail])

  // 🔧 修复：使用新的API获取游戏历史
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [gameLoading, setGameLoading] = useState(false);
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    if (userDetail?.id) {
      fetchGameRecords();
    }
  }, [userDetail?.id]);
  
  const fetchGameRecords = async () => {
    if (!userDetail?.id) return;
    
    try {
      setGameLoading(true);
      console.log(`🔍 获取用户游戏记录 ID: ${userDetail.id}`);
      const response = await fetch(`/api/admin/games?user_id=${userDetail.id}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`获取游戏记录失败 (${response.status})`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('✅ 游戏记录数据:', result.data);
        setGameHistory(result.data);
        // 重置展开状态
        setExpandedGames({});
      } else {
        throw new Error(result.error || '获取数据失败');
      }
    } catch (error: any) {
      console.error('❌ 获取游戏记录失败:', error);
      setGameHistory([]);
      setExpandedGames({});
    } finally {
      setGameLoading(false);
    }
  };
  
  const toggleGameExpanded = (gameId: string) => {
    setExpandedGames(prev => ({
      ...prev,
      [gameId]: !prev[gameId]
    }));
  };

  // 🔧 修复：安全获取密钥使用历史
  const keyUsageHistory = useMemo(() => {
    try {
      if (!userDetail) return [];
      const history = userDetail.key_usage_history || userDetail.keyUsageHistory || [];
      return Array.isArray(history) ? history : [];
    } catch (err) {
      console.error('获取keyUsageHistory出错:', err);
      return [];
    }
  }, [userDetail])

  // 🔧 修复：安全获取当前访问密钥
  const currentAccessKey = useMemo(() => {
    try {
      if (!userDetail) return null;
      return userDetail.current_access_key || userDetail.currentAccessKey || null;
    } catch (err) {
      console.error('获取currentAccessKey出错:', err);
      return null;
    }
  }, [userDetail])

  // 🔧 修复：使用API返回的总数
  const totals = useMemo(() => getTotalRecords(), [userDetail]);

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
      currentId: userDetail.access_key_id || userDetail.accessKeyId
    }

    // 计算AI统计
    const aiStats = {
      total: aiPagination.total || 0, // 使用分页的总数
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
  }, [userDetail, accessKeys, aiRecords, gameHistory, aiPagination.total])

  // 🔧 修复：提取所有使用过的密钥 - 修复使用次数问题
  const allUsedKeys = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 计算allUsedKeys, keyUsageHistory长度:', keyUsageHistory.length);
    }
    
    if (!keyUsageHistory || keyUsageHistory.length === 0) {
      // 如果没有密钥历史，但是有当前密钥，也显示当前密钥
      if (currentAccessKey) {
        return [{
          id: currentAccessKey.id,
          key_code: currentAccessKey.key_code || currentAccessKey.keyCode || '未知',
          is_active: currentAccessKey.is_active ?? currentAccessKey.isActive ?? true,
          key_expires_at: currentAccessKey.key_expires_at || currentAccessKey.keyExpiresAt,
          usage_count: currentAccessKey.used_count || 1, // 🔧 使用API返回的used_count
          is_current: true,
          last_used_at: currentAccessKey.used_at || currentAccessKey.usedAt
        }]
      }
      return [];
    }
    
    const uniqueKeys = new Map();
    
    keyUsageHistory.forEach(record => {
      // 🔧 修复：使用getKeyCode函数获取密钥代码
      const keyCode = getKeyCode(record);
      const keyId = record.access_key_id;
      
      if (!keyId) return; // 跳过没有access_key_id的记录
      
      const isCurrent = isCurrentKey(keyId, currentAccessKey);
      
      // 🔧 修复：从API返回的数据中获取使用次数
      // 优先使用 access_key.used_count，如果没有则使用默认值1
      const usageCount = record.access_key?.used_count || 1;
      
      if (!uniqueKeys.has(keyId)) {
        uniqueKeys.set(keyId, {
          id: keyId,
          key_code: keyCode,
          is_active: record.access_key?.is_active ?? true,
          key_expires_at: record.access_key?.key_expires_at,
          // 🔧 修复：使用API返回的使用次数，而不是自己统计
          usage_count: usageCount,
          is_current: isCurrent,
          last_used_at: record.used_at || record.usedAt,
          first_used_at: record.used_at || record.usedAt,
          usage_types: new Set([record.usage_type || 'activate'])
        })
      } else {
        const existing = uniqueKeys.get(keyId);
        // 🔧 修复：不再累加次数，而是使用API返回的次数
        // existing.usage_count++; // ❌ 删除这行
        
        // 保持已有的usage_count，或者使用更大的值
        existing.usage_count = Math.max(existing.usage_count, usageCount);
        
        if (record.usage_type) {
          existing.usage_types.add(record.usage_type);
        }
        // 更新最后使用时间
        const currentUsedAt = record.used_at || record.usedAt;
        if (currentUsedAt && new Date(currentUsedAt) > new Date(existing.last_used_at || 0)) {
          existing.last_used_at = currentUsedAt;
        }
      }
    })
    
    const keysArray = Array.from(uniqueKeys.values())
      .sort((a, b) => {
        const dateA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
        const dateB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
        return dateB - dateA;
      })
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ allUsedKeys计算完成，数量:', keysArray.length);
      console.log('🔍 每个密钥的使用次数:', keysArray.map(k => ({ key: k.key_code, count: k.usage_count })));
    }
    return keysArray;
  }, [keyUsageHistory, currentAccessKey])

  // 🔧 修复：密钥使用历史排序
  const keyUsageHistorySorted = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 排序keyUsageHistory, 原始长度:', keyUsageHistory.length);
    }
    
    if (!keyUsageHistory || !Array.isArray(keyUsageHistory)) return [];
    
    return [...keyUsageHistory]
      .filter(record => record) // 过滤掉null/undefined
      .sort((a, b) => {
        const dateA = a.used_at || a.usedAt || 0;
        const dateB = b.used_at || b.usedAt || 0;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  }, [keyUsageHistory])

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
      if (process.env.NODE_ENV === 'development') {
        console.log('📤 导出AI记录:', record);
      }
      
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

  // 🔧 修复：加载更多AI记录
  const handleLoadMoreAI = () => {
    if (userDetail?.id && !loadingMoreAI && aiPagination.hasMore) {
      loadAIRecords(userDetail.id, aiPagination.page + 1);
    }
  };

  if (!isOpen) return null;

  const accountStatus = getAccountStatus();
  const activeStatus = getActiveStatus();

  // 🔧 修复：准备密钥统计卡数据
  const keyStats = {
    totalUniqueKeys: allUsedKeys.length,
    currentKey: currentAccessKey?.key_code || 
                currentAccessKey?.keyCode || 
                '无',
    usageRecords: keyUsageHistory.length || 0,
    lastUsage: keyUsageHistorySorted.length > 0 
      ? formatShortDate(keyUsageHistorySorted[0]?.used_at || keyUsageHistorySorted[0]?.usedAt)
      : '无记录'
  };

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
            {/* 标签页导航 - 🔧 修复：使用API返回的总数 */}
            <div className="border-b border-gray-800 bg-gray-900/30">
              <div className="flex overflow-x-auto">
                {[
                  { id: 'basic' as const, label: '基本信息', icon: User, count: null },
                  { id: 'keys' as const, label: '密钥记录', icon: Key, count: totals.keyTotal },
                  { id: 'ai' as const, label: 'AI使用', icon: Brain, count: totals.aiTotal },
                  { id: 'games' as const, label: '游戏记录', icon: Gamepad2, count: totals.gameTotal }
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
              {/* 基本信息标签页 */}
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
                          <h3 className="text-lg font-semibold text-white flex items-center">
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
                            <p className="text-lg md:text-xl font-bold text-white">{totals.keyTotal}</p>
                          </div>
                          <div className="bg-gray-800/30 p-3 rounded-lg">
                            <p className="text-xs text-gray-400">AI请求</p>
                            <p className="text-lg md:text-xl font-bold text-blue-400">{totals.aiTotal}</p>
                          </div>
                          <div className="bg-gray-800/30 p-3 rounded-lg">
                            <p className="text-xs text-gray-400">游戏场次</p>
                            <p className="text-lg md:text-xl font-bold text-green-400">{totals.gameTotal}</p>
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

              {/* 密钥记录标签页 - 修复版 */}
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
                                      {key.usage_count || 1} 次
                                    </span>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <div className="flex flex-wrap gap-1">
                                      {Array.from(key.usage_types || new Set(['activate'])).map((type: any, idx) => (
                                        <span 
                                          key={`type-${idx}`}
                                          className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-300"
                                        >
                                          {type === 'activate' ? '激活' : 
                                           type === 'renew' ? '续费' : 
                                           type === 'transfer' ? '转移' : type}
                                        </span>
                                      ))}
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

                  {/* 密钥使用历史表格 */}
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
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">前一个密钥</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">后一个密钥</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">操作者</th>
                              <th className="text-left py-3 md:py-4 px-4 text-xs md:text-sm text-gray-400 font-medium">备注</th>
                            </tr>
                          </thead>
                          <tbody>
                            {keyUsageHistorySorted.map((record, index) => {
                              const usedAt = record.used_at || record.usedAt || '';
                              const usageType = record.usage_type || 'activate';
                              
                              // 🔧 修复：使用getKeyCode函数获取密钥代码
                              const keyCode = getKeyCode(record);
                              
                              const operator = record.operator || {};
                              const operatorEmail = operator.email || '系统';
                              const operatorNickname = operator.nickname || '';
                              const notes = record.notes || record.note || '';
                              
                              const previousKeyId = record.previous_key_id || null;
                              const nextKeyId = record.next_key_id || null;

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
                                      {keyCode}
                                    </code>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <span className="text-gray-300 text-xs md:text-sm">
                                      {previousKeyId ? `密钥ID: ${previousKeyId}` : '无'}
                                    </span>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <span className="text-gray-300 text-xs md:text-sm">
                                      {nextKeyId ? `密钥ID: ${nextKeyId}` : '无'}
                                    </span>
                                  </td>
                                  <td className="py-3 md:py-4 px-4">
                                    <div className="flex flex-col">
                                      <span className="text-gray-300 text-xs md:text-sm">
                                        {operatorNickname || operatorEmail}
                                      </span>
                                      {operatorNickname && (
                                        <span className="text-xs text-gray-500 mt-1">
                                          {operatorEmail}
                                        </span>
                                      )}
                                    </div>
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

                  {/* 数据说明 */}
                  <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 md:p-5">
                    <h4 className="text-sm font-medium text-white mb-2">数据说明</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-400">
                      <div className="flex items-start">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 mr-2"></div>
                        <div>
                          <span className="font-medium">当前密钥</span>
                          <p className="mt-1">用户当前正在使用的密钥，在表格中标记为"当前使用"</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-1 mr-2"></div>
                        <div>
                          <span className="font-medium">使用历史</span>
                          <p className="mt-1">用户每次激活、续费或转移密钥的记录</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="w-2 h-2 bg-amber-500 rounded-full mt-1 mr-2"></div>
                        <div>
                          <span className="font-medium">操作类型</span>
                          <p className="mt-1">激活: 首次使用密钥<br/>续费: 延长密钥有效期<br/>转移: 更换到新密钥</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI使用记录标签页 - 分页修复版 */}
              {activeTab === 'ai' && (
                <div className="p-4 md:p-6">
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
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="w-3 h-3 mr-1" />
                                      收起
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-3 h-3 mr-1" />
                                      详情
                                    </>
                                  )}
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

                            {isExpanded && (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mt-3 pt-3 border-t border-gray-800/30">
                                <div>
                                  <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">完整请求数据</p>
                                  <div className="bg-gray-900/50 p-2 md:p-3 rounded-lg overflow-auto max-h-48">
                                    <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                                      {(() => {
                                        const requestData = record.request_data || record.requestData;
                                        try {
                                          if (typeof requestData === 'string') {
                                            return JSON.stringify(JSON.parse(requestData), null, 2);
                                          } else if (typeof requestData === 'object') {
                                            return JSON.stringify(requestData, null, 2);
                                          }
                                          return String(requestData || '无数据');
                                        } catch {
                                          return String(requestData || '无数据');
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">完整响应数据</p>
                                  <div className="bg-gray-900/50 p-2 md:p-3 rounded-lg overflow-auto max-h-48">
                                    <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                                      {(() => {
                                        const responseData = record.response_data || record.responseData;
                                        try {
                                          if (typeof responseData === 'string') {
                                            return JSON.stringify(JSON.parse(responseData), null, 2);
                                          } else if (typeof responseData === 'object') {
                                            return JSON.stringify(responseData, null, 2);
                                          }
                                          return String(responseData || '无数据');
                                        } catch {
                                          return String(responseData || '无数据');
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* 🔧 加载更多按钮 */}
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

              {/* 游戏记录标签页 */}
              {activeTab === 'games' && (
                <div className="p-4 md:p-6">
                  <div className="mb-4 md:mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-5">
                      <p className="text-xs md:text-sm text-gray-400 mb-2">总场次</p>
                      <p className="text-xl md:text-2xl font-bold text-white">{gameHistory.length || 0}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        7天内场次: {gameHistory.filter(g => {
                          const endedAt = new Date(g.ended_at);
                          const sevenDaysAgo = new Date();
                          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                          return endedAt >= sevenDaysAgo;
                        }).length}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-5">
                      <p className="text-xs md:text-sm text-gray-400 mb-2">胜场</p>
                      <p className="text-xl md:text-2xl font-bold text-green-400">
                        {gameHistory.filter(g => g.winner_id === userDetail.id).length}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-5">
                      <p className="text-xs md:text-sm text-gray-400 mb-2">负场</p>
                      <p className="text-xl md:text-2xl font-bold text-red-400">
                        {gameHistory.filter(g => g.winner_id && g.winner_id !== userDetail.id).length}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-3 md:p-5">
                      <p className="text-xs md:text-sm text-gray-400 mb-2">胜率</p>
                      <p className="text-xl md:text-2xl font-bold text-blue-400">
                        {gameHistory.length > 0 ? 
                          ((gameHistory.filter(g => g.winner_id === userDetail.id).length / gameHistory.length) * 100).toFixed(1) + '%' : 
                          '0.0%'
                        }
                      </p>
                    </div>
                  </div>

                  {gameLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                      <span className="text-gray-400">加载游戏记录中...</span>
                    </div>
                  ) : gameHistory.length === 0 ? (
                    <div className="text-center py-8 md:py-12">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-gray-800 to-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Gamepad2 className="w-8 h-8 md:w-10 md:h-10 text-gray-600" />
                      </div>
                      <p className="text-gray-400 text-base md:text-lg">暂无游戏记录</p>
                      <p className="text-gray-500 text-xs md:text-sm mt-2">该用户尚未参与过游戏</p>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px]">
                          <thead>
                            <tr className="border-b border-gray-800 bg-gray-900/50">
                              <th className="text-left py-3 md:py-4 px-3 md:px-6 text-xs md:text-sm text-gray-400 font-medium">对局ID</th>
                              <th className="text-left py-3 md:py-4 px-3 md:px-6 text-xs md:text-sm text-gray-400 font-medium">对手</th>
                              <th className="text-left py-3 md:py-4 px-3 md:px-6 text-xs md:text-sm text-gray-400 font-medium">结果</th>
                              <th className="text-left py-3 md:py-4 px-3 md:px-6 text-xs md:text-sm text-gray-400 font-medium">时长</th>
                              <th className="text-left py-3 md:py-4 px-3 md:px-6 text-xs md:text-sm text-gray-400 font-medium">开始时间</th>
                            </tr>
                          </thead>
                          <tbody>
                            {gameHistory.map((game, index) => {
                              const gameId = game.id || `game-${index}`;
                              const isExpanded = expandedGames[gameId] || false;
                              const isWin = game.winner_id === userDetail.id;
                              const isDraw = !game.winner_id;
                              const startedAt = game.started_at;
                              const endedAt = game.ended_at;
                              const userRole = game.player1_id === userDetail.id ? 'player1' : 'player2';
                              
                              // 获取对手昵称
                              const getOpponentNickname = () => {
                                if (userRole === 'player1' && game.player2) {
                                  return game.player2.nickname || `玩家2`;
                                } else if (userRole === 'player2' && game.player1) {
                                  return game.player1.nickname || `玩家1`;
                                }
                                return `玩家${userRole === 'player1' ? '2' : '1'}`;
                              };

                              return (
                                <>
                                  <tr
                                    key={gameId}
                                    className="border-b border-gray-800/30 hover:bg-gray-800/30 transition-all cursor-pointer"
                                    onClick={() => toggleGameExpanded(gameId)}
                                  >
                                    <td className="py-3 md:py-4 px-3 md:px-6">
                                      <div className="flex items-center">
                                        <code className="text-xs bg-gray-900 px-2 md:px-3 py-1 md:py-1.5 rounded-lg font-mono border border-gray-800">
                                          {game.room_id?.substring(0, 8) || game.id?.substring(0, 8) || '未知'}
                                        </code>
                                        <ChevronDown className={`w-4 h-4 ml-2 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                      </div>
                                    </td>
                                    <td className="py-3 md:py-4 px-3 md:px-6">
                                      <div className="flex flex-col">
                                        <span className="text-gray-300 text-xs md:text-sm">
                                          {getOpponentNickname()}
                                        </span>
                                        <span className="text-xs text-gray-500 mt-1">
                                          你是{userRole === 'player1' ? '玩家1' : '玩家2'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-3 md:py-4 px-3 md:px-6">
                                      <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full mr-1 md:mr-2 ${isWin ? 'bg-green-500' : isDraw ? 'bg-yellow-500' : 'bg-red-500'
                                          }`} />
                                        <span className={`text-xs md:text-sm ${isWin ? 'text-green-400' : isDraw ? 'text-yellow-400' : 'text-red-400'
                                          }`}>
                                          {isWin ? '胜利' : isDraw ? '平局' : '失败'}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-3 md:py-4 px-3 md:px-6">
                                      <span className="text-gray-300 text-xs md:text-sm">
                                        {formatDuration(startedAt, endedAt)}
                                      </span>
                                    </td>
                                    <td className="py-3 md:py-4 px-3 md:px-6">
                                      <span className="text-gray-300 text-xs md:text-sm">
                                        {formatDate(startedAt)}
                                      </span>
                                    </td>
                                  </tr>
                                  
                                  {isExpanded && (
                                    <tr className="border-b border-gray-800/30 bg-gray-900/30">
                                      <td colSpan={5} className="py-4 px-3 md:px-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          {/* 玩家信息 */}
                                          <div>
                                            <h4 className="text-sm font-medium text-gray-300 mb-3">玩家信息</h4>
                                            <div className="space-y-2">
                                              <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
                                                <span className="text-xs text-gray-400">玩家1</span>
                                                <span className="text-xs text-gray-300">
                                                  {game.player1?.nickname || '未知'}
                                                </span>
                                              </div>
                                              <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
                                                <span className="text-xs text-gray-400">玩家2</span>
                                                <span className="text-xs text-gray-300">
                                                  {game.player2?.nickname || '未知'}
                                                </span>
                                              </div>
                                              <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
                                                <span className="text-xs text-gray-400">获胜者</span>
                                                <span className="text-xs text-gray-300">
                                                  {game.winner?.nickname || '平局'}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* 主题信息 */}
                                          <div>
                                            <h4 className="text-sm font-medium text-gray-300 mb-3">主题选择</h4>
                                            <div className="space-y-2">
                                              <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
                                                <span className="text-xs text-gray-400">玩家1主题</span>
                                                <span className="text-xs text-gray-300">
                                                  {game.player1_theme?.title || '未知'}
                                                </span>
                                              </div>
                                              <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
                                                <span className="text-xs text-gray-400">玩家2主题</span>
                                                <span className="text-xs text-gray-300">
                                                  {game.player2_theme?.title || '未知'}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* 任务信息 */}
                                          {game.task_results && game.task_results.length > 0 && (
                                            <div className="md:col-span-2">
                                              <h4 className="text-sm font-medium text-gray-300 mb-3">任务执行</h4>
                                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                                {game.task_results.map((task: any, taskIndex: number) => (
                                                  <div key={taskIndex} className="flex items-start gap-2 p-2 bg-gray-800/50 rounded-lg">
                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${task.completed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                      {task.completed ? (
                                                        <Check className="w-2 h-2" />
                                                      ) : (
                                                        <X className="w-2 h-2" />
                                                      )}
                                                    </div>
                                                    <div className="flex-1">
                                                      <div className="text-xs text-gray-300">
                                                        {task.task_text || '未知任务'}
                                                      </div>
                                                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                                        <span>执行者: {task.executor_id === userDetail.id ? '自己' : '对手'}</span>
                                                        {task.completed && task.timestamp && (
                                                          <span>完成时间: {formatShortDate(task.timestamp)}</span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
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
                  '标签页计数': totals,
                  'API返回总数': {
                    key_usage_history_total: userDetail.key_usage_history_total,
                    ai_usage_records_total: userDetail.ai_usage_records_total,
                    game_history_total: userDetail.game_history_total
                  },
                  '密钥历史数量': keyUsageHistory.length,
                  'AI记录数量': userDetail.ai_usage_records?.length,
                  '游戏记录数量': userDetail.game_history?.length,
                  '第一条密钥历史': keyUsageHistory[0],
                  '第一条密钥代码': getKeyCode(keyUsageHistory[0]),
                  '当前密钥': currentAccessKey,
                  '密钥代码调试': getKeyCode(keyUsageHistory[0]),
                  '密钥使用次数调试': {
                    '第一条记录access_key': keyUsageHistory[0]?.access_key,
                    '使用次数': keyUsageHistory[0]?.access_key?.used_count,
                    'allUsedKeys第一条': allUsedKeys[0]?.usage_count
                  }
                }, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}