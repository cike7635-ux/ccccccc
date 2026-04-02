// /components/generate-tasks.tsx - 完整缓存版本兼容版本
"use client";

import { useState, useTransition, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Sparkles, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  CalendarDays,
  Clock,
  Zap,
  Key,
  Loader2
} from "lucide-react";
import { bulkInsertTasks } from "@/app/themes/actions";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { debounce } from "lodash";

// 🔥 新增导入：偏好编辑组件和类型
import EditablePreferencesModal from "@/components/profile/editable-preferences-modal";
import { UserPreferences } from "@/types/preferences";

type Suggestion = { description: string; type?: string; order_index?: number };

interface UsageStats {
  daily: {
    used: number;
    remaining: number;
    limit: number;
  };
  cycle: {
    used: number;
    remaining: number;
    limit: number;
  };
  cycleInfo: {
    startDate: string;
    endDate: string;
    daysRemaining: number;
  };
}

interface AIGenerateResponse {
  tasks: Array<{ description: string }>;
  usage: UsageStats;
}

// 🔥 性能监控：只在开发环境记录
const devLog = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(message, data || '');
  }
};

const devWarn = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.warn(message, data || '');
  }
};

const devError = (message: string, data?: any) => {
  console.error(message, data || '');
};

export default function GenerateTasksSection({ 
  themeId, 
  themeTitle, 
  themeDescription, 
  inline = false 
}: { 
  themeId: string; 
  themeTitle: string; 
  themeDescription?: string | null; 
  inline?: boolean 
}) {
  const router = useRouter();
  
  // 🔥 优化：减少初始状态变量
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [customRequirement, setCustomRequirement] = useState("");
  const [preferences, setPreferences] = useState<{ gender?: string; kinks?: string[] }>({});
  const [mounted, setMounted] = useState(false);
  
  // 🔥 新增状态：偏好编辑相关
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(preferences || {});
  
  // 🔥 使用Memo化的使用统计状态
  const [usageStats, setUsageStats] = useState<UsageStats>({
    daily: { used: 0, remaining: 1, limit: 1 },
    cycle: { used: 0, remaining: 100, limit: 100 },
    cycleInfo: {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      daysRemaining: 30
    }
  });
  
  const [loadingStats, setLoadingStats] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemKeyCode, setRedeemKeyCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);
  const [redeemUsageInfo, setRedeemUsageInfo] = useState<any>(null);

  // 🔥 核心优化：使用useMemo缓存所有派生状态
  const {
    dailyRemaining,
    cycleRemaining,
    dailyLimit,
    cycleLimit,
    isOverDailyLimit,
    isNearDailyLimit,
    isOverCycleLimit,
    isNearCycleLimit,
    dailyPercentage,
    cyclePercentage
  } = useMemo(() => {
    const dailyRemaining = usageStats.daily.remaining;
    const cycleRemaining = usageStats.cycle.remaining;
    const dailyLimit = usageStats.daily.limit;
    const cycleLimit = usageStats.cycle.limit;
    
    return {
      dailyRemaining,
      cycleRemaining,
      dailyLimit,
      cycleLimit,
      isOverDailyLimit: dailyRemaining <= 0,
      isNearDailyLimit: dailyRemaining > 0 && dailyRemaining <= 2,
      isOverCycleLimit: cycleRemaining <= 0,
      isNearCycleLimit: cycleRemaining > 0 && cycleRemaining <= 10,
      dailyPercentage: dailyLimit > 0 ? Math.min(100, (usageStats.daily.used / dailyLimit) * 100) : 0,
      cyclePercentage: cycleLimit > 0 ? Math.min(100, (usageStats.cycle.used / cycleLimit) * 100) : 0,
    };
  }, [usageStats]);

  // 🔥 新增：用户偏好计算的Memo
  const { genderText, kinksText, hasGender, hasKinks, preferencesEmpty } = useMemo(() => {
    const genderText = userPreferences.gender === "male" ? "男性" : 
                      userPreferences.gender === "female" ? "女性" : 
                      userPreferences.gender === "non_binary" ? "非二元" : "未设置";
    const kinksText = (userPreferences.kinks && userPreferences.kinks.length > 0) ? 
                      userPreferences.kinks.join("、") : "未设置";
    const hasGender = !!userPreferences.gender;
    const hasKinks = Array.isArray(userPreferences.kinks) && userPreferences.kinks.length > 0;
    const preferencesEmpty = !hasGender || !hasKinks;
    
    return { genderText, kinksText, hasGender, hasKinks, preferencesEmpty };
  }, [userPreferences]);

  // 🔥 优化：减少useEffect依赖
  useEffect(() => {
    setMounted(true);
    
    const initializeData = async () => {
      try {
        devLog('🚀 初始化组件数据...');
        await fetchUsageStats();
        devLog('✅ 使用统计初始化完成');
        
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("preferences")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.preferences) {
            const pref = profile.preferences as any;
            setPreferences(pref);
            setUserPreferences(pref);
          }
        }
      } catch (error) {
        devError('❌ 数据初始化失败:', error);
      }
    };
    
    initializeData();
  }, []);

  // 🔥 优化：使用useCallback缓存函数
  const fetchUsageStats = useCallback(async () => {
    devLog('📡 开始获取使用统计...');
    setLoadingStats(true);
    try {
      const res = await fetch("/api/ai/usage-stats");
      devLog('📡 获取使用统计，状态:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        
        const dailyLimit = data.daily?.limit || 1;
        const cycleLimit = data.cycle?.limit || 100;
        
        const normalizedData = {
          daily: {
            used: data.daily?.used || 0,
            remaining: data.daily?.remaining || Math.max(0, dailyLimit - (data.daily?.used || 0)),
            limit: dailyLimit
          },
          cycle: {
            used: data.cycle?.used || 0,
            remaining: data.cycle?.remaining || Math.max(0, cycleLimit - (data.cycle?.used || 0)),
            limit: cycleLimit
          },
          cycleInfo: data.cycleInfo || {
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            daysRemaining: 30
          },
          _raw: data
        };
        
        devLog('🔄 标准化后的数据:', normalizedData);
        setUsageStats(normalizedData);
        return normalizedData;
        
      } else {
        devWarn("AI使用统计API不可用，使用默认值 1/100");
        const fallbackData = {
          daily: { used: 0, remaining: 1, limit: 1 },
          cycle: { used: 0, remaining: 100, limit: 100 },
          cycleInfo: {
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            daysRemaining: 30
          }
        };
        setUsageStats(fallbackData);
        return fallbackData;
      }
    } catch (error) {
      devError("获取使用统计失败:", error);
      const fallbackData = {
        daily: { used: 0, remaining: 1, limit: 1 },
        cycle: { used: 0, remaining: 100, limit: 100 },
        cycleInfo: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          daysRemaining: 30
        }
      };
      setUsageStats(fallbackData);
      return fallbackData;
    } finally {
      setLoadingStats(false);
      devLog('✅ 使用统计获取完成');
    }
  }, []);

  // 🔥 使用防抖优化兑换输入
  const debouncedRedeem = useCallback(
    debounce((keyCode: string) => {
      if (keyCode.trim() && showRedeemModal) {
        handleRedeem();
      }
    }, 300),
    [showRedeemModal]
  );

  const openModal = useCallback(async () => {
    devLog('🔄 开始加载使用统计...');
    
    const stats = await fetchUsageStats();
    devLog('✅ 使用统计加载完成:', stats);
    
    const isOverDailyLimit = stats.daily.remaining <= 0;
    const isOverCycleLimit = stats.cycle.remaining <= 0;
    
    devLog('📊 openModal检查:', {
      dailyRemaining: stats.daily.remaining,
      cycleRemaining: stats.cycle.remaining,
      isOverDailyLimit,
      isOverCycleLimit
    });
    
    if (isOverDailyLimit || isOverCycleLimit) {
      devLog('🚨 使用次数用完，显示兑换弹窗');
      setShowRedeemModal(true);
      setRedeemUsageInfo({
        daily: {
          used: stats.daily.used,
          limit: stats.daily.limit
        },
        cycle: {
          used: stats.cycle.used,
          limit: stats.cycle.limit
        }
      });
      return;
    }
    
    setShowModal(true);
    setError(null);
    setSuggestions([]);
    setSelected({});
  }, [fetchUsageStats]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setCustomRequirement("");
  }, []);

  const generate = useCallback(async () => {
    devLog('📱 前端generate函数被调用');
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: themeTitle,
          description: themeDescription ?? "",
          preferences: userPreferences, // 🔥 使用 userPreferences 而不是 preferences
          customRequirement,
        }),
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        if (res.status === 429) {
          if (json.errorType === 'INSUFFICIENT_AI_USAGE') {
            devLog('🚨 API返回次数不足错误，显示兑换弹窗');
            setShowRedeemModal(true);
            setRedeemUsageInfo(json.usage || {});
            setError(null);
            return;
          }
          
          setError(json?.error || "使用次数已用完");
          if (json.details) {
            const dailyLimit = json.details.daily?.limit || 1;
            const cycleLimit = json.details.cycle?.limit || 100;
            
            setUsageStats({
              daily: {
                used: json.details.daily?.used || 0,
                remaining: Math.max(0, dailyLimit - (json.details.daily?.used || 0)),
                limit: dailyLimit
              },
              cycle: {
                used: json.details.cycle?.used || 0,
                remaining: Math.max(0, cycleLimit - (json.details.cycle?.used || 0)),
                limit: cycleLimit
              },
              cycleInfo: json.details.cycleInfo || usageStats.cycleInfo
            });
          }
          return;
        }
        throw new Error(json?.error || "生成失败");
      }
      
      const aiResponse = json as AIGenerateResponse;
      
      setSuggestions(aiResponse.tasks || []);
      const initialSelection = Object.fromEntries(
        (aiResponse.tasks || []).map((_: any, i: number) => [i, true])
      );
      setSelected(initialSelection);
      
      if (aiResponse.usage) {
        setUsageStats(aiResponse.usage);
      }
      
    } catch (e: any) {
      setError(e?.message || "生成失败");
    } finally {
      setLoading(false);
    }
  }, [themeTitle, themeDescription, userPreferences, customRequirement]);

  const handleRedeem = useCallback(async () => {
    if (!redeemKeyCode.trim()) {
      setRedeemResult({ success: false, message: '请输入AI密钥' });
      return;
    }

    setRedeemLoading(true);
    setRedeemResult(null);

    try {
      devLog('🔑 兑换密钥:', redeemKeyCode);
      const response = await fetch('/api/admin/ai-keys/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyCode: redeemKeyCode }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '兑换失败');
      }

      setRedeemResult({
        success: true,
        message: data.message || '兑换成功！',
        data: data.data
      });

      devLog('🔄 立即刷新使用统计...');
      await fetchUsageStats();
      devLog('✅ 使用统计刷新完成');
      
      setRedeemKeyCode('');
      
      setTimeout(() => {
        setShowRedeemModal(false);
        setRedeemResult(null);
        setRedeemUsageInfo(null);
      }, 3000);

    } catch (error: any) {
      devError('❌ 兑换失败:', error);
      setRedeemResult({ 
        success: false, 
        message: error.message || '兑换失败，请检查密钥是否正确' 
      });
    } finally {
      setRedeemLoading(false);
    }
  }, [redeemKeyCode, fetchUsageStats]);

  const toggle = useCallback((idx: number) => {
    setSelected(prev => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const selectAll = useCallback(() => {
    setSelected(Object.fromEntries(suggestions.map((_, i) => [i, true])));
  }, [suggestions]);

  const deselectAll = useCallback(() => {
    setSelected({});
  }, []);

  // 🔥 核心修改：保存选中的任务 - 使用 router.refresh() 而不是硬刷新
  const saveSelected = useCallback(async () => {
    const tasks = suggestions
      .map((t, i) => ({ 
        description: t.description, 
        type: "interaction", 
        order_index: i 
      }))
      .filter((_, i) => selected[i]);
      
    if (tasks.length === 0) {
      setError("请先选择至少一条任务");
      return;
    }
    
    setError(null);
    startTransition(async () => {
      try {
        // 确保任务数据格式正确，只包含必要字段
        const formattedTasks = tasks.map(task => ({
          description: task.description,
          type: "interaction",
          order_index: task.order_index
        }));
        
        const formData = new FormData();
        formData.append('theme_id', themeId);
        formData.append('tasks', JSON.stringify(formattedTasks));
        
        const { error } = await bulkInsertTasks(formData);
        if (error) {
          setError(error);
        } else {
          setSuggestions([]);
          setSelected({});
          closeModal();
          
          // 🔥 核心修改：使用 router.refresh() 而不是硬刷新
          // 缓存版本号已更新，页面会自动获取最新数据
          router.refresh();
          
          // 可选：添加成功提示
          setTimeout(() => {
            // 可以在这里添加 toast 通知
            console.log('✅ 任务保存成功，主题列表已刷新');
          }, 500);
        }
      } catch (err: any) {
        setError(err.message || "保存失败");
      }
    });
  }, [suggestions, selected, themeId, closeModal, router]);

  // 🔥 偏好保存回调函数
  const handlePreferencesSaved = useCallback((newPrefs: UserPreferences) => {
    setUserPreferences(newPrefs);
    setPreferences(newPrefs);
    devLog('✅ 偏好已更新:', newPrefs);
  }, []);

  // 🔥 使用统计组件
  const renderUsageStats = useMemo(() => (
    <div className="mb-4 glass backdrop-blur-lg bg-gradient-to-br from-white/10 to-purple-500/10 rounded-2xl p-4 border border-white/20 shadow-lg">
      {/* 标题区域 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-gradient-to-br from-brand-pink to-purple-600 rounded-lg">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">AI使用统计</h4>
            <p className="text-xs text-gray-300">30天滚动周期</p>
          </div>
        </div>
        <button
          onClick={fetchUsageStats}
          disabled={loadingStats}
          className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 group button-press-optimized"
          title="刷新统计"
        >
          {loadingStats ? (
            <Loader2 className="w-4 h-4 text-brand-pink animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 text-gray-400 group-hover:text-brand-pink transition-colors" />
          )}
        </button>
      </div>
      
      {/* 🔥 响应式网格布局 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
        {/* 今日使用统计 */}
        <div className="glass bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <div>
                <div className="text-xs font-medium text-gray-300">今日使用</div>
                <div className="text-xs text-gray-400">
                  {usageStats.daily.used}/{dailyLimit}次
                </div>
              </div>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-bold ${
              isOverDailyLimit ? 'bg-red-500/20 text-red-300' :
              isNearDailyLimit ? 'bg-yellow-500/20 text-yellow-300' : 
              'bg-blue-500/20 text-blue-300'
            }`}>
              {dailyRemaining}次剩余
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-300">进度</span>
              <span className="text-xs font-semibold text-white">
                {Math.round(dailyPercentage)}%
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                style={{ width: `${dailyPercentage}%` }}
                className={`h-full progress-bar-optimized ${
                  isOverDailyLimit ? 'bg-gradient-to-r from-red-500 to-red-400' :
                  isNearDailyLimit ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' : 
                  'bg-gradient-to-r from-blue-500 to-blue-400'
                }`}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-1 text-xs pt-1">
              <div className="text-gray-400">已用</div>
              <div className="text-right text-white">{usageStats.daily.used}次</div>
              <div className="text-gray-400">剩余</div>
              <div className={`text-right font-medium ${
                dailyRemaining <= 2 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {dailyRemaining}次
              </div>
            </div>
          </div>
        </div>

        {/* 周期使用统计 */}
        <div className="glass bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <CalendarDays className="w-4 h-4 text-purple-400" />
              <div>
                <div className="text-xs font-medium text-gray-300">周期使用</div>
                <div className="text-xs text-gray-400">
                  {usageStats.cycle.used}/{cycleLimit}次
                </div>
              </div>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-bold ${
              isOverCycleLimit ? 'bg-red-500/20 text-red-300' :
              isNearCycleLimit ? 'bg-yellow-500/20 text-yellow-300' : 
              'bg-purple-500/20 text-purple-300'
            }`}>
              {cycleRemaining}次剩余
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-300">进度</span>
              <span className="text-xs font-semibold text-white">
                {Math.round(cyclePercentage)}%
              </span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                style={{ width: `${cyclePercentage}%` }}
                className={`h-full progress-bar-optimized ${
                  isOverCycleLimit ? 'bg-gradient-to-r from-red-500 to-red-400' :
                  isNearCycleLimit ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' : 
                  'bg-gradient-to-r from-purple-500 to-purple-400'
                }`}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-1 text-xs pt-1">
              <div className="text-gray-400">已用</div>
              <div className="text-right text-white">{usageStats.cycle.used}次</div>
              <div className="text-gray-400">剩余</div>
              <div className={`text-right font-medium ${
                cycleRemaining <= 10 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {cycleRemaining}次
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass bg-gradient-to-r from-gray-900/50 to-purple-900/30 rounded-xl p-3 border border-white/10">
        <div className="flex items-center space-x-2 mb-2">
          <Clock className="w-4 h-4 text-green-400" />
          <div>
            <span className="text-xs font-medium text-gray-300">周期信息</span>
            <div className="text-xs text-gray-400">
              {new Date(usageStats.cycleInfo.startDate).toLocaleDateString('zh-CN')} - 
              {new Date(usageStats.cycleInfo.endDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="text-xs">
            <div className="text-gray-400">剩余天数</div>
            <div className={`text-lg font-bold ${
              usageStats.cycleInfo.daysRemaining <= 5 ? 'text-yellow-400' :
              usageStats.cycleInfo.daysRemaining <= 10 ? 'text-orange-400' : 'text-green-400'
            }`}>
              {usageStats.cycleInfo.daysRemaining}
            </div>
          </div>
          <div className="text-xs text-right">
            <div className="text-gray-400">结束时间</div>
            <div className="text-gray-300 font-medium">
              {new Date(usageStats.cycleInfo.endDate).toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
      </div>

      {(isNearDailyLimit || isNearCycleLimit) && (
        <div className={`mt-3 p-3 rounded-lg flex items-start space-x-2 ${
          isOverDailyLimit || isOverCycleLimit ? 
          'bg-gradient-to-r from-red-900/30 to-red-800/20 border border-red-500/20' :
          'bg-gradient-to-r from-yellow-900/30 to-yellow-800/20 border border-yellow-500/20'
        }`}>
          <AlertTriangle className={`w-4 h-4 mt-0.5 ${
            isOverDailyLimit || isOverCycleLimit ? 'text-red-400' : 'text-yellow-400'
          }`} />
          <div className="flex-1">
            <p className={`text-xs ${
              isOverDailyLimit || isOverCycleLimit ? 'text-red-300' : 'text-yellow-300'
            }`}>
              {isOverDailyLimit ? '今日次数已用完' : 
               isOverCycleLimit ? '周期次数已用完' :
               isNearDailyLimit ? `今日仅剩${dailyRemaining}次` : `周期仅剩${cycleRemaining}次`}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {isOverDailyLimit ? '请兑换AI密钥或等待24小时' :
               isOverCycleLimit ? '请兑换AI密钥或等待周期重置' :
               isNearDailyLimit ? '请合理安排使用或兑换更多次数' : '请合理安排使用'}
            </p>
          </div>
        </div>
      )}
    </div>
  ), [usageStats, loadingStats, fetchUsageStats, dailyRemaining, cycleRemaining, dailyLimit, cycleLimit, isOverDailyLimit, isNearDailyLimit, isOverCycleLimit, isNearCycleLimit, dailyPercentage, cyclePercentage]);

  const renderModalContent = useCallback(() => {
    if (suggestions.length === 0) {
      return (
        <>
          {renderUsageStats}
          
          <div className="space-y-4 mb-6">
            <div className="glass bg-gradient-to-r from-gray-900/50 to-blue-900/30 rounded-xl p-4 border border-white/10">
              <div className="flex items-center space-x-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-semibold">当前主题</p>
              </div>
              <p className="text-gray-200 font-medium">{themeTitle}</p>
              {themeDescription && (
                <p className="text-sm text-gray-400 mt-1">{themeDescription}</p>
              )}
            </div>

            <div className="glass bg-gradient-to-r from-gray-900/50 to-pink-900/30 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-semibold">个人偏好</p>
                </div>
                <button
                  onClick={() => setShowPreferencesModal(true)}
                  className="text-xs text-brand-pink hover:text-pink-300 transition-colors px-2 py-1 hover:bg-white/5 rounded"
                >
                  编辑
                </button>
              </div>
              <div className="text-sm space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400 min-w-12">性别:</span>
                  <span className="px-2 py-1 bg-white/10 rounded text-gray-200">{genderText}</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-gray-400 min-w-12">兴趣标签:</span>
                  <div className="flex flex-wrap gap-1 flex-1">
                    {(!userPreferences.kinks || userPreferences.kinks.length === 0) ? (
                      <span className="px-2 py-1 bg-white/10 rounded text-gray-200">未设置</span>
                    ) : (
                      userPreferences.kinks.map((kink, index) => (
                        <span 
                          key={index}
                          className="px-2 py-1 bg-gradient-to-r from-brand-pink/20 to-purple-500/20 rounded text-brand-pink border border-brand-pink/30 text-xs"
                        >
                          {kink}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
              {mounted && preferencesEmpty && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <Link 
                    href="/profile" 
                    className="inline-flex items-center space-x-1 text-brand-pink hover:text-pink-300 text-xs font-medium transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>去设置偏好和昵称以获得更精准的生成</span>
                  </Link>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-gradient-to-br from-green-500 to-green-600 rounded-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <Label htmlFor="customRequirement" className="text-sm font-semibold">
                  特别需求（推荐）
                </Label>
              </div>
              <textarea
                id="customRequirement"
                value={customRequirement}
                onChange={(e) => setCustomRequirement(e.target.value)}
                rows={4}
                className="w-full glass bg-white/5 rounded-xl border border-white/20 px-3 py-3 text-sm outline-none focus:border-brand-pink focus:ring-1 focus:ring-brand-pink/30 transition-all placeholder-gray-500"
                placeholder="(需求越详细，生成的任务越符合预期）例如：我们现在正在图书馆，我希望可以有一些刺激的内容，比如适当的露出..."
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-gradient-to-r from-red-900/30 to-red-800/20 border border-red-500/20 rounded-xl">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              onClick={closeModal}
              variant="outline"
              className="flex-1 border-white/20 hover:bg-white/10 hover:text-white transition-all button-press-optimized"
            >
              取消
            </Button>
            <Button
              onClick={generate}
              disabled={loading}
              className="flex-1 gradient-primary glow-pink-optimized hover:shadow-lg hover:shadow-brand-pink/30 transition-all duration-300 flex items-center justify-center space-x-2 button-press-optimized"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>生成任务</span>
                </>
              )}
            </Button>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">
                已生成 {suggestions.length} 条任务
              </p>
              <p className="text-xs text-gray-400">
                选择需要保存的任务（已选 {Object.values(selected).filter(Boolean).length} 条）
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={selectAll}
                size="sm"
                variant="outline"
                className="border-white/20 hover:bg-white/10 hover:text-white transition-all button-press-optimized"
              >
                全选
              </Button>
              <Button
                onClick={deselectAll}
                size="sm"
                variant="outline"
                className="border-white/20 hover:bg-white/10 hover:text-white transition-all button-press-optimized"
              >
                取消全选
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1 modal-touch-scroll">
            {suggestions.map((s, idx) => (
              <label
                key={idx}
                className={`flex items-start space-x-3 glass rounded-xl p-4 border transition-all duration-200 cursor-pointer task-item-optimized ${
                  selected[idx]
                    ? "bg-gradient-to-r from-brand-pink/20 to-purple-500/20 border-brand-pink/40 shadow-lg shadow-brand-pink/10"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex-shrink-0 pt-0.5">
                  <Checkbox
                    checked={!!selected[idx]}
                    onCheckedChange={() => toggle(idx)}
                    className={`checkbox-checked-optimized ${
                      selected[idx] 
                        ? "border-brand-pink bg-brand-pink text-white" 
                        : "border-white/30"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="px-1.5 py-0.5 bg-white/10 rounded text-xs text-gray-400">
                      {idx + 1}
                    </div>
                    <div className="text-xs text-gray-400">
                      {s.type || '互动任务'}
                    </div>
                  </div>
                  <p className="text-sm text-gray-200">{s.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-gradient-to-r from-red-900/30 to-red-800/20 border border-red-500/20 rounded-xl">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}

        <div className="flex space-x-3">
          <Button
            onClick={closeModal}
            variant="outline"
            className="flex-1 border-white/20 hover:bg-white/10 hover:text-white transition-all button-press-optimized"
          >
            取消
          </Button>
          <Button
            onClick={saveSelected}
            disabled={isPending || Object.values(selected).filter(Boolean).length === 0}
            className="flex-1 gradient-primary glow-pink-optimized hover:shadow-lg hover:shadow-brand-pink/30 transition-all duration-300 flex items-center justify-center space-x-2 button-press-optimized"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>
              {isPending ? "保存中..." : `保存 (${Object.values(selected).filter(Boolean).length})`}
            </span>
          </Button>
        </div>
      </>
    );
  }, [suggestions, selected, error, loading, isPending, themeTitle, themeDescription, genderText, userPreferences, kinksText, preferencesEmpty, mounted, renderUsageStats, closeModal, generate, toggle, selectAll, deselectAll, saveSelected]);

  return (
    <>
      {inline ? (
        <Button
          type="button"
          onClick={openModal}
          className="gradient-primary glow-pink-optimized text-white flex items-center space-x-2 hover:shadow-lg hover:shadow-brand-pink/30 transition-all duration-300 button-press-optimized"
        >
          {loadingStats ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isOverDailyLimit ? (
            <Key className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>
            {loadingStats ? '加载中...' : isOverDailyLimit ? '兑换AI次数' : 'AI 生成任务'}
          </span>
          {!loadingStats && isNearDailyLimit && !isOverDailyLimit && (
            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
              仅剩{dailyRemaining}次
            </span>
          )}
          {!loadingStats && isOverDailyLimit && (
            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
              今日已用完
            </span>
          )}
        </Button>
      ) : (
        <div className="glass backdrop-blur-xl bg-gradient-to-br from-gray-900/50 to-purple-900/20 rounded-2xl p-6 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-brand-pink to-purple-600 rounded-xl">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">AI 生成任务</h3>
                <p className="text-sm text-gray-400">智能生成情侣互动任务</p>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-gray-300 mb-4">
            基于主题和个人偏好，使用专业AI模型快速生成符合情侣互动的任务列表
          </p>
          
          {renderUsageStats}
          
          <Button
            onClick={openModal}
            className="w-full gradient-primary glow-pink-optimized hover:shadow-lg hover:shadow-brand-pink/30 transition-all duration-300 flex items-center justify-center space-x-2 group button-press-optimized"
            disabled={loadingStats}
          >
            {loadingStats ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isOverDailyLimit ? (
              <Key className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            ) : (
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            )}
            <span>
              {loadingStats ? '加载中...' : isOverDailyLimit ? '兑换AI次数' : '开始生成'}
            </span>
            {!loadingStats && isOverDailyLimit && (
              <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full ml-2">
                今日已用完，点击兑换
              </span>
            )}
            {!loadingStats && isNearDailyLimit && !isOverDailyLimit && (
              <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full ml-2">
                仅剩{dailyRemaining}次
              </span>
            )}
          </Button>
        </div>
      )}

      {/* 🔥 优化后的模态框渲染 */}
      {showModal && mounted && createPortal(
        <div className="fixed-modal-container bg-black/80 backdrop-blur-lg flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass backdrop-blur-2xl bg-gradient-to-br from-gray-900/70 to-purple-900/40 rounded-3xl p-6 max-w-lg w-full glow-pink-optimized border border-white/20 shadow-2xl animate-slideUp flex-col-fixed mobile-modal-height">
            
            {/* 固定标题区域 */}
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-brand-pink to-purple-600 rounded-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">AI 任务生成器</h3>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all duration-200 hover:rotate-90 button-press-optimized"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>

            <div className="modal-content-scrollable modal-touch-scroll">
              {renderModalContent()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🔥 优化后的兑换弹窗 */}
      {showRedeemModal && mounted && createPortal(
        <div className="fixed-modal-container bg-black/80 backdrop-blur-lg flex items-center justify-center p-6">
          <div className="glass backdrop-blur-2xl bg-gradient-to-br from-gray-900/70 to-purple-900/40 rounded-3xl p-8 max-w-md w-full glow-pink-optimized border border-white/20 shadow-2xl flex-col-fixed mobile-modal-height">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="text-xl font-bold text-white">AI次数已用尽</h3>
              <button
                onClick={() => {
                  setShowRedeemModal(false);
                  setRedeemKeyCode('');
                  setRedeemResult(null);
                  setRedeemUsageInfo(null);
                }}
                className="w-8 h-8 rounded-lg hover:bg-white/10 button-press-optimized"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto modal-touch-scroll">
              <div className="space-y-6">
                <div className="text-gray-300">
                  <p>您的AI使用次数已用完，兑换密钥可以立即获得更多次数。</p>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-gray-900/50 to-purple-900/30 rounded-xl border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">今日使用：</span>
                    <span className="text-white font-medium">
                      {(redeemUsageInfo?.daily?.used || 0)}/
                      <span className="text-blue-400">
                        {redeemUsageInfo?.daily?.limit || 1}
                      </span>次
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">周期使用：</span>
                    <span className="text-white font-medium">
                      {(redeemUsageInfo?.cycle?.used || 0)}/
                      <span className="text-purple-400">
                        {redeemUsageInfo?.cycle?.limit || 100}
                      </span>次
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-white">输入AI密钥</Label>
                  <Input
                    placeholder="AI-XXXX-XXXX"
                    value={redeemKeyCode}
                    onChange={(e) => {
                      setRedeemKeyCode(e.target.value.toUpperCase());
                      debouncedRedeem(e.target.value.toUpperCase());
                    }}
                    className="bg-white/10 border-white/20 text-white"
                    disabled={redeemLoading}
                  />
                </div>
                
                {redeemResult && (
                  <div className={`p-4 rounded-xl ${
                    redeemResult.success 
                      ? 'bg-gradient-to-r from-green-900/30 to-green-800/20 border border-green-500/20' 
                      : 'bg-gradient-to-r from-red-900/30 to-red-800/20 border border-red-500/20'
                  }`}>
                    <p className={redeemResult.success ? 'text-green-300' : 'text-red-300'}>
                      {redeemResult.message}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-shrink-0 mt-6">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20 button-press-optimized"
                  onClick={() => {
                    setShowRedeemModal(false);
                    setRedeemKeyCode('');
                    setRedeemResult(null);
                    setRedeemUsageInfo(null);
                  }}
                  disabled={redeemLoading}
                >
                  取消
                </Button>
                <Button
                  className="flex-1 gradient-primary glow-pink-optimized button-press-optimized"
                  disabled={redeemLoading || !redeemKeyCode.trim()}
                  onClick={handleRedeem}
                >
                  {redeemLoading ? '兑换中...' : '立即兑换'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 🔥 偏好编辑模态框 */}
      {showPreferencesModal && mounted && createPortal(
        <EditablePreferencesModal
          open={showPreferencesModal}
          onClose={() => setShowPreferencesModal(false)}
          initialPreferences={{
            gender: userPreferences.gender,
            kinks: userPreferences.kinks || []
          }}
          onSaved={handlePreferencesSaved}
        />,
        document.body
      )}
    </>
  );
}