// /components/generate-tasks.tsx
"use client";

import { useState, useTransition, useEffect } from "react";
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

type Suggestion = { description: string; type?: string; order_index?: number };

// 新的使用统计类型
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
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [customRequirement, setCustomRequirement] = useState("");
  const [preferences, setPreferences] = useState<{ gender?: string; kinks?: string[] }>({});
  const [mounted, setMounted] = useState(false);
  
  // 新的使用统计状态
  const [usageStats, setUsageStats] = useState<UsageStats>({
    daily: {
      used: 0,
      remaining: 10,
      limit: 10
    },
    cycle: {
      used: 0,
      remaining: 120,
      limit: 120
    },
    cycleInfo: {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      daysRemaining: 30
    }
  });
  const [loadingStats, setLoadingStats] = useState(false);

  // 🔥 新增：兑换弹窗相关状态
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemKeyCode, setRedeemKeyCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemResult, setRedeemResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);
  const [redeemUsageInfo, setRedeemUsageInfo] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    const fetchPreferences = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("preferences")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.preferences) {
            setPreferences(profile.preferences as any);
          }
        }
      } catch (error) {
        console.error("获取偏好设置失败:", error);
      }
    };
    fetchPreferences();
  }, []);

  // 获取使用统计 - 🔥 修复版
  const fetchUsageStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch("/api/ai/usage-stats");
      console.log('📡 获取使用统计，状态:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('📊 API返回数据:', data);
        
        // 🔥 修复：统一处理数据格式
        const normalizedData = {
          daily: {
            used: data.daily?.used || data.dailyUsed || 0,
            remaining: data.daily?.remaining || Math.max(0, (data.daily?.limit || 10) - (data.daily?.used || data.dailyUsed || 0)),
            limit: data.daily?.limit || 10
          },
          cycle: {
            used: data.cycle?.used || data.monthlyUsed || 0,
            remaining: data.cycle?.remaining || Math.max(0, (data.cycle?.limit || 120) - (data.cycle?.used || data.monthlyUsed || 0)),
            limit: data.cycle?.limit || 120
          },
          cycleInfo: data.cycleInfo || {
            startDate: data.cycleStartDate || new Date().toISOString(),
            endDate: data.cycleEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            daysRemaining: data.daysRemaining || 30
          }
        };
        
        console.log('🔄 标准化后的数据:', normalizedData);
        setUsageStats(normalizedData);
        
      } else {
        console.warn("AI使用统计API不可用，使用默认值");
        setUsageStats({
          daily: {
            used: 0,
            remaining: 10,
            limit: 10
          },
          cycle: {
            used: 0,
            remaining: 120,
            limit: 120
          },
          cycleInfo: {
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            daysRemaining: 30
          }
        });
      }
    } catch (error) {
      console.error("获取使用统计失败:", error);
      // 失败时使用默认值
      setUsageStats({
        daily: {
          used: 0,
          remaining: 10,
          limit: 10
        },
        cycle: {
          used: 0,
          remaining: 120,
          limit: 120
        },
        cycleInfo: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          daysRemaining: 30
        }
      });
    } finally {
      setLoadingStats(false);
    }
  };

  const openModal = async () => {
    console.log('🔄 开始加载使用统计...');
    await fetchUsageStats();
    console.log('✅ 使用统计加载完成:', usageStats);
    
    // 🔥 修复：检查是否超过限制
    const isOverDailyLimit = usageStats.daily.remaining <= 0;
    const isOverCycleLimit = usageStats.cycle.remaining <= 0;
    
    console.log('📊 openModal检查:', {
      dailyRemaining: usageStats.daily.remaining,
      cycleRemaining: usageStats.cycle.remaining,
      isOverDailyLimit,
      isOverCycleLimit
    });
    
    // 如果次数用完，直接显示兑换弹窗
    if (isOverDailyLimit || isOverCycleLimit) {
      console.log('🚨 使用次数用完，直接显示兑换弹窗');
      setShowRedeemModal(true);
      setRedeemUsageInfo(usageStats);
      return;
    }
    
    // 次数未用完，正常打开生成模态框
    setShowModal(true);
    setError(null);
    setSuggestions([]);
    setSelected({});
  };

  const closeModal = () => {
    setShowModal(false);
    setCustomRequirement("");
  };

  const generate = async () => {
    console.log('📱 前端generate函数被调用');
    
    // 🔥 移除本地状态检查，直接调用API
    
    console.log('✅ 次数未用完，继续调用API');
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: themeTitle,
          description: themeDescription ?? "",
          preferences,
          customRequirement,
        }),
      });
      
      const json = await res.json();
      
      // 🔥 修改点：捕获AI次数不足的错误并显示兑换弹窗
      if (!res.ok) {
        if (res.status === 429) {
          // 检查是否是AI次数不足的错误
          if (json.errorType === 'INSUFFICIENT_AI_USAGE') {
            // 显示兑换弹窗
            console.log('🚨 API返回次数不足错误，显示兑换弹窗');
            setShowRedeemModal(true);
            setRedeemUsageInfo(json.usage || {});
            setError(null); // 清除错误提示
            return;
          }
          
          // 其他429错误
          setError(json?.error || "使用次数已用完");
          if (json.details) {
            // 更新使用统计
            setUsageStats({
              daily: {
                used: json.details.daily.used,
                remaining: Math.max(0, 10 - json.details.daily.used),
                limit: 10
              },
              cycle: {
                used: json.details.cycle.used,
                remaining: Math.max(0, 120 - json.details.cycle.used),
                limit: 120
              },
              cycleInfo: json.details.cycleInfo || usageStats.cycleInfo
            });
          }
          return;
        }
        throw new Error(json?.error || "生成失败");
      }
      
      // 类型断言
      const aiResponse = json as AIGenerateResponse;
      
      setSuggestions(aiResponse.tasks || []);
      const initialSelection = Object.fromEntries(
        (aiResponse.tasks || []).map((_: any, i: number) => [i, true])
      );
      setSelected(initialSelection);
      
      // 更新使用统计
      if (aiResponse.usage) {
        setUsageStats(aiResponse.usage);
      }
      
    } catch (e: any) {
      setError(e?.message || "生成失败");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 新增：兑换函数
  const handleRedeem = async () => {
    if (!redeemKeyCode.trim()) {
      setRedeemResult({ success: false, message: '请输入AI密钥' });
      return;
    }

    setRedeemLoading(true);
    setRedeemResult(null);

    try {
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
        message: data.message,
        data: data.data
      });

      // 兑换成功，刷新使用统计
      setTimeout(() => {
        fetchUsageStats(); // 重新获取使用统计
        setRedeemKeyCode('');
        // 3秒后关闭弹窗
        setTimeout(() => {
          setShowRedeemModal(false);
          setRedeemResult(null);
          setRedeemUsageInfo(null);
        }, 3000);
      }, 1500);

    } catch (error: any) {
      setRedeemResult({
        success: false,
        message: error.message
      });
    } finally {
      setRedeemLoading(false);
    }
  };

  const toggle = (idx: number) => {
    setSelected((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const selectAll = () => {
    setSelected(Object.fromEntries(suggestions.map((_, i) => [i, true])));
  };

  const deselectAll = () => {
    setSelected({});
  };

  const saveSelected = async () => {
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
        // 修复：使用 FormData 格式调用 bulkInsertTasks
        const formData = new FormData();
        formData.append('theme_id', themeId);
        formData.append('tasks', JSON.stringify(tasks));
        
        const { error } = await bulkInsertTasks(formData);
        if (error) {
          setError(error);
        } else {
          setSuggestions([]);
          setSelected({});
          closeModal();
          // 可选：刷新页面显示新任务
          window.location.reload();
        }
      } catch (err: any) {
        setError(err.message || "保存失败");
      }
    });
  };

  const genderText = preferences.gender === "male" ? "男性" : 
                    preferences.gender === "female" ? "女性" : 
                    preferences.gender === "non_binary" ? "非二元" : "未设置";
  const kinksText = (preferences.kinks && preferences.kinks.length > 0) ? 
                    preferences.kinks.join("、") : "未设置";
  const hasGender = !!preferences.gender;
  const hasKinks = Array.isArray(preferences.kinks) && preferences.kinks.length > 0;
  const preferencesEmpty = !hasGender || !hasKinks;
  
  const dailyPercentage = Math.min(100, (usageStats.daily.used / usageStats.daily.limit) * 100);
  const cyclePercentage = Math.min(100, (usageStats.cycle.used / usageStats.cycle.limit) * 100);
  
  const isNearDailyLimit = usageStats.daily.remaining <= 2;
  const isNearCycleLimit = usageStats.cycle.remaining <= 10;
  const isOverDailyLimit = usageStats.daily.remaining <= 0;
  const isOverCycleLimit = usageStats.cycle.remaining <= 0;
  // 🔥 移除 canGenerate 变量，因为它会导致按钮被禁用

  console.log('🔄 组件渲染，使用统计:', {
    dailyRemaining: usageStats.daily.remaining,
    cycleRemaining: usageStats.cycle.remaining,
    isOverDailyLimit,
    isOverCycleLimit
  });

  // 🔥 精美使用统计组件
  const renderUsageStats = () => (
    <div className="mb-4 glass backdrop-blur-lg bg-gradient-to-br from-white/10 to-purple-500/10 rounded-2xl p-4 border border-white/20 shadow-lg">
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
          className="p-2 hover:bg-white/10 rounded-lg transition-all duration-200 group"
          title="刷新统计"
        >
          {loadingStats ? (
            <Loader2 className="w-4 h-4 text-brand-pink animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 text-gray-400 group-hover:text-brand-pink transition-colors" />
          )}
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-3">
        {/* 今日使用 */}
        <div className="glass bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-blue-400" />
              <span className="text-xs font-medium text-gray-300">今日</span>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              isOverDailyLimit ? 'bg-red-500/20 text-red-300' :
              isNearDailyLimit ? 'bg-yellow-500/20 text-yellow-300' : 
              'bg-blue-500/20 text-blue-300'
            }`}>
              {usageStats.daily.remaining}/{usageStats.daily.limit}
            </div>
          </div>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block text-white">
                  {Math.round(dailyPercentage)}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-1 text-xs flex rounded-full bg-gray-700">
              <div 
                style={{ width: `${dailyPercentage}%` }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap justify-center transition-all duration-500 ${
                  isOverDailyLimit ? 'bg-gradient-to-r from-red-500 to-red-400' :
                  isNearDailyLimit ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' : 
                  'bg-gradient-to-r from-blue-500 to-blue-400'
                }`}
              />
            </div>
          </div>
          <div className="text-xs text-gray-400 flex justify-between">
            <span>已用: {usageStats.daily.used}次</span>
            <span>剩余: {usageStats.daily.remaining}次</span>
          </div>
        </div>

        {/* 周期使用 */}
        <div className="glass bg-white/5 rounded-xl p-3 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-1">
              <CalendarDays className="w-3 h-3 text-purple-400" />
              <span className="text-xs font-medium text-gray-300">周期</span>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              isOverCycleLimit ? 'bg-red-500/20 text-red-300' :
              isNearCycleLimit ? 'bg-yellow-500/20 text-yellow-300' : 
              'bg-purple-500/20 text-purple-300'
            }`}>
              {usageStats.cycle.remaining}/{usageStats.cycle.limit}
            </div>
          </div>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block text-white">
                  {Math.round(cyclePercentage)}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-1 text-xs flex rounded-full bg-gray-700">
              <div 
                style={{ width: `${cyclePercentage}%` }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap justify-center transition-all duration-500 ${
                  isOverCycleLimit ? 'bg-gradient-to-r from-red-500 to-red-400' :
                  isNearCycleLimit ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' : 
                  'bg-gradient-to-r from-purple-500 to-purple-400'
                }`}
              />
            </div>
          </div>
          <div className="text-xs text-gray-400 flex justify-between">
            <span>已用: {usageStats.cycle.used}次</span>
            <span>剩余: {usageStats.cycle.remaining}次</span>
          </div>
        </div>
      </div>

      {/* 周期信息 */}
      <div className="glass bg-gradient-to-r from-gray-900/50 to-purple-900/30 rounded-xl p-3 border border-white/10">
        <div className="flex items-center space-x-2 mb-1">
          <Clock className="w-3 h-3 text-green-400" />
          <span className="text-xs font-medium text-gray-300">周期信息</span>
        </div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">剩余天数:</span>
            <span className={`font-bold ${
              usageStats.cycleInfo.daysRemaining <= 5 ? 'text-yellow-400' :
              usageStats.cycleInfo.daysRemaining <= 10 ? 'text-orange-400' : 'text-green-400'
            }`}>
              {usageStats.cycleInfo.daysRemaining}天
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">结束时间:</span>
            <span className="text-gray-300">
              {new Date(usageStats.cycleInfo.endDate).toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </div>
        </div>
      </div>

      {/* 警告提示 */}
      {(isNearDailyLimit || isNearCycleLimit) && (
        <div className={`mt-3 p-2 rounded-lg flex items-center space-x-2 ${
          isOverDailyLimit || isOverCycleLimit ? 
          'bg-gradient-to-r from-red-900/30 to-red-800/20 border border-red-500/20' :
          'bg-gradient-to-r from-yellow-900/30 to-yellow-800/20 border border-yellow-500/20'
        }`}>
          <AlertTriangle className={`w-4 h-4 ${
            isOverDailyLimit || isOverCycleLimit ? 'text-red-400' : 'text-yellow-400'
          }`} />
          <p className={`text-xs ${
            isOverDailyLimit || isOverCycleLimit ? 'text-red-300' : 'text-yellow-300'
          }`}>
            {isOverDailyLimit ? '今日次数已用完' : 
             isOverCycleLimit ? '周期次数已用完' :
             isNearDailyLimit ? '今日剩余次数较少，请合理安排使用' : '周期剩余次数较少'}
          </p>
        </div>
      )}
    </div>
  );

  const renderModalContent = () => {
    if (suggestions.length === 0) {
      return (
        <>
          {/* 🔥 关键修复：在模态框内显示AI使用统计 */}
          {renderUsageStats()}
          
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
              <div className="flex items-center space-x-2 mb-2">
                <div className="p-2 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <p className="text-sm font-semibold">个人偏好</p>
              </div>
              <div className="text-sm space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400 min-w-12">性别:</span>
                  <span className="px-2 py-1 bg-white/10 rounded text-gray-200">{genderText}</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-gray-400 min-w-12">兴趣标签:</span>
                  <div className="flex flex-wrap gap-1">
                    {kinksText === "未设置" ? (
                      <span className="px-2 py-1 bg-white/10 rounded text-gray-200">{kinksText}</span>
                    ) : (
                      kinksText.split('、').map((kink, index) => (
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
                    <span>去设置偏好以获得更精准的生成</span>
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
                  特别需求（可选）
                </Label>
              </div>
              <textarea
                id="customRequirement"
                value={customRequirement}
                onChange={(e) => setCustomRequirement(e.target.value)}
                rows={4}
                className="w-full glass bg-white/5 rounded-xl border border-white/20 px-3 py-3 text-sm outline-none focus:border-brand-pink focus:ring-1 focus:ring-brand-pink/30 transition-all placeholder-gray-500"
                placeholder="例如：增加户外活动、避免需要高消费的任务、希望有更多情感交流类的内容..."
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
              className="flex-1 border-white/20 hover:bg-white/10 hover:text-white transition-all"
            >
              取消
            </Button>
            <Button
              onClick={generate}
              disabled={loading}
              className="flex-1 gradient-primary glow-pink hover:shadow-lg hover:shadow-brand-pink/30 transition-all duration-300 flex items-center justify-center space-x-2"
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
                className="border-white/20 hover:bg-white/10 hover:text-white transition-all"
              >
                全选
              </Button>
              <Button
                onClick={deselectAll}
                size="sm"
                variant="outline"
                className="border-white/20 hover:bg-white/10 hover:text-white transition-all"
              >
                取消全选
              </Button>
            </div>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {suggestions.map((s, idx) => (
              <label
                key={idx}
                className={`flex items-start space-x-3 glass rounded-xl p-4 border transition-all duration-200 cursor-pointer transform hover:scale-[1.01] ${
                  selected[idx]
                    ? "bg-gradient-to-r from-brand-pink/20 to-purple-500/20 border-brand-pink/40 shadow-lg shadow-brand-pink/10"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex-shrink-0 pt-0.5">
                  <Checkbox
                    checked={!!selected[idx]}
                    onCheckedChange={() => toggle(idx)}
                    className={`${
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
            className="flex-1 border-white/20 hover:bg-white/10 hover:text-white transition-all"
          >
            取消
          </Button>
          <Button
            onClick={saveSelected}
            disabled={isPending || Object.values(selected).filter(Boolean).length === 0}
            className="flex-1 gradient-primary glow-pink hover:shadow-lg hover:shadow-brand-pink/30 transition-all duration-300 flex items-center justify-center space-x-2"
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
  };

  return (
    <>
      {inline ? (
        <Button
          type="button"
          onClick={openModal}
          className="gradient-primary glow-pink text-white flex items-center space-x-2 hover:shadow-lg hover:shadow-brand-pink/30 transition-all duration-300"
          // 🔥 修复：移除 disabled={!canGenerate}
        >
          {isOverDailyLimit ? (
            <Key className="w-4 h-4" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span>{isOverDailyLimit ? '兑换AI次数' : 'AI 生成任务'}</span>
          {isNearDailyLimit && !isOverDailyLimit && (
            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
              仅剩{usageStats.daily.remaining}次
            </span>
          )}
          {isOverDailyLimit && (
            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">
              今日已用完
            </span>
          )}
        </Button>
      ) : (
        // 🔥 修复：恢复毛玻璃背景
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
          
          {/* 非内联模式：在模态框外显示AI计次 */}
          {renderUsageStats()}
          
          <Button
            onClick={openModal}
            className="w-full gradient-primary glow-pink hover:shadow-lg hover:shadow-brand-pink/30 transition-all duration-300 flex items-center justify-center space-x-2 group"
            // 🔥 修复：移除 disabled={!canGenerate}
          >
            {isOverDailyLimit ? (
              <Key className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            ) : (
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            )}
            <span>{isOverDailyLimit ? '兑换AI次数' : '开始生成'}</span>
            {isOverDailyLimit && (
              <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full ml-2">
                今日已用完，点击兑换
              </span>
            )}
            {isNearDailyLimit && !isOverDailyLimit && (
              <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full ml-2">
                仅剩{usageStats.daily.remaining}次
              </span>
            )}
          </Button>
        </div>
      )}

      {showModal && mounted && createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-lg flex items-center justify-center p-6 animate-fadeIn">
          <div className="glass backdrop-blur-2xl bg-gradient-to-br from-gray-900/70 to-purple-900/40 rounded-3xl p-8 max-w-lg w-full glow-pink border border-white/20 shadow-2xl animate-slideUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-brand-pink to-purple-600 rounded-lg">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">AI 任务生成器</h3>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all duration-200 hover:rotate-90"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>

            {renderModalContent()}
          </div>
        </div>,
        document.body
      )}

      {/* 🔥 新增：兑换弹窗 */}
      {showRedeemModal && mounted && createPortal(
        <div className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-lg flex items-center justify-center p-6">
          <div className="glass backdrop-blur-2xl bg-gradient-to-br from-gray-900/70 to-purple-900/40 rounded-3xl p-8 max-w-md w-full glow-pink border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">AI次数已用尽</h3>
              <button
                onClick={() => {
                  setShowRedeemModal(false);
                  setRedeemKeyCode('');
                  setRedeemResult(null);
                  setRedeemUsageInfo(null);
                }}
                className="w-8 h-8 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="text-gray-300">
                <p>您的AI使用次数已用完，兑换密钥可以立即获得更多次数。</p>
              </div>
              
              {/* 显示使用统计 */}
              {redeemUsageInfo && (
                <div className="p-4 bg-gradient-to-r from-gray-900/50 to-purple-900/30 rounded-xl border border-white/10">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">今日使用：</span>
                    <span className="text-white font-medium">
                      {redeemUsageInfo.daily?.used || 0}/{redeemUsageInfo.daily?.limit || 10}次
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">周期使用：</span>
                    <span className="text-white font-medium">
                      {redeemUsageInfo.cycle?.used || 0}/{redeemUsageInfo.cycle?.limit || 120}次
                    </span>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <Label className="text-white">输入AI密钥</Label>
                <Input
                  placeholder="AI-XXXX-XXXX"
                  value={redeemKeyCode}
                  onChange={(e) => setRedeemKeyCode(e.target.value.toUpperCase())}
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
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20"
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
                  className="flex-1 gradient-primary glow-pink"
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
    </>
  );
}