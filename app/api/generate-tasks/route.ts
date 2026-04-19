import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAIDefaultLimits } from '@/lib/config/system-config';

// --- Configuration ---
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// 从数据库获取模型配置的函数
async function getAIModels() {
  console.log('🔍 开始获取 AI 模型配置...');
  
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } }
      }
    );

    console.log('🔍 查询数据库中的 AI 模型...');
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (error) {
      console.error('❌ 获取 AI 模型配置失败:', error);
      return null;
    }

    console.log(`📊 查询结果: 找到 ${data?.length || 0} 个启用的模型`);
    if (data && data.length > 0) {
      console.log('📋 模型列表:', data.map(m => `${m.display_name} (${m.provider})`).join(', '));
    }

    return data;
  } catch (error) {
    console.error('❌ getAIModels 函数异常:', error);
    return null;
  }
}

// 获取 API 密钥的函数
function getApiKey(provider: string): string | null {
  switch (provider) {
    case 'openrouter':
      return OPENROUTER_API_KEY || null;
    case 'deepseek':
      return DEEPSEEK_API_KEY || null;
    default:
      return null;
  }
}

// --- Type Definitions ---
interface Preferences {
  gender: "male" | "female" | "non_binary" | string;
  kinks: string[];
}

interface ApiPayload {
  title: string;
  description?: string;
  preferences?: Partial<Preferences>;
  customRequirement?: string;
}

type ParseResult =
  | {
    ok: true;
    data: {
      title: string;
      description: string;
      customRequirement: string;
      gender: string;
      kinks: string[];
    };
  }
  | {
    ok: false;
    error: { message: string; status: number };
  };

interface Task {
  description: string;
}

// ============ AI使用次数验证函数（24小时滚动窗口 + 30天滚动窗口） ============
async function checkAIUsage(userId: string): Promise<{
  allowed: boolean;
  dailyUsed: number;         // 过去24小时使用次数（保持字段名不变）
  cycleUsed: number;         // 过去30天使用次数
  dailyLimit: number;        // 24小时滚动窗口限制
  cycleLimit: number;        // 30天滚动窗口限制
  windowStartDate: string;   // 24小时前时间
  cycleStartDate: string;    // 30天前时间
  windowType: string;
  reason?: string;
}> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  );

  try {
    // ============ 第一步：查询用户自定义限制 ============
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('custom_daily_limit, custom_cycle_limit')
      .eq('id', userId)
      .single();

    // 错误处理：查询失败时使用默认值
    if (userError) {
      console.warn(`查询用户${userId}的自定义限制失败，使用默认值:`, userError);
    }

    // ============ 第二步：获取系统默认限制 ============
    const { daily: defaultDailyLimit, cycle: defaultCycleLimit } = await getAIDefaultLimits();
    
    // 使用自定义限制，如果为NULL或undefined则使用系统默认值
    const DAILY_LIMIT = userData?.custom_daily_limit ?? defaultDailyLimit;
    const CYCLE_LIMIT = userData?.custom_cycle_limit ?? defaultCycleLimit;

    // 验证限制值的合理性
    const validatedDailyLimit = Math.max(1, Math.min(DAILY_LIMIT, 1000));
    const validatedCycleLimit = Math.max(10, Math.min(CYCLE_LIMIT, 10000));

    // ============ 第三步：查询有效临时加成 ============
    const now = new Date().toISOString();
    const { data: tempBoosts, error: tempBoostError } = await supabase
      .from('temporary_ai_boosts')
      .select('boost_type, increment_amount')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lte('valid_from', now)
      .gte('valid_to', now);

    if (tempBoostError) {
      console.error('获取临时加成失败:', tempBoostError);
    }

    // ============ 第四步：计算总限制（永久限制 + 临时加成） ============
    let totalDailyLimit = validatedDailyLimit;
    let totalCycleLimit = validatedCycleLimit;

    // 添加临时加成
    if (tempBoosts && tempBoosts.length > 0) {
      console.log('📊 用户临时加成:', tempBoosts);
      tempBoosts.forEach(boost => {
        if (boost.boost_type === 'daily') {
          totalDailyLimit += boost.increment_amount;
        } else if (boost.boost_type === 'cycle') {
          totalCycleLimit += boost.increment_amount;
        }
      });
    }

    console.log('🎯 最终限制计算:', {
      永久每日限制: validatedDailyLimit,
      永久周期限制: validatedCycleLimit,
      临时每日加成: tempBoosts?.filter(b => b.boost_type === 'daily').reduce((sum, b) => sum + b.increment_amount, 0) || 0,
      临时周期加成: tempBoosts?.filter(b => b.boost_type === 'cycle').reduce((sum, b) => sum + b.increment_amount, 0) || 0,
      总每日限制: totalDailyLimit,
      总周期限制: totalCycleLimit
    });

    // ============ 第五步：计算时间窗口 ============
    const currentTime = new Date();
    
    // 24小时滚动窗口（从现在往前推24小时）
    const twentyFourHoursAgo = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);
    
    // 30天滚动窗口（从现在往前推30天）
    const thirtyDaysAgo = new Date(currentTime.getTime() - 30 * 24 * 60 * 60 * 1000);

    console.log('🔍 AI使用次数检查 - 调试信息：');
    console.log('  当前时间:', currentTime.toISOString());
    console.log('  24小时前:', twentyFourHoursAgo.toISOString());
    console.log('  30天前:', thirtyDaysAgo.toISOString());
    console.log('  用户ID:', userId);
    console.log('  每日限制:', totalDailyLimit, '(永久:', validatedDailyLimit, ', 临时加成:', totalDailyLimit - validatedDailyLimit, ')');
    console.log('  周期限制:', totalCycleLimit, '(永久:', validatedCycleLimit, ', 临时加成:', totalCycleLimit - validatedCycleLimit, ')');

    // ============ 第六步：查询24小时滚动窗口使用次数 ============
    const { count: dailyCount, error: dailyError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('success', true)
      .eq('feature', 'generate_tasks')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .lt('created_at', currentTime.toISOString());

    if (dailyError) {
      console.error('查询24小时使用次数失败:', dailyError);
      return {
        allowed: true,
        dailyUsed: 0,
        cycleUsed: 0,
        dailyLimit: totalDailyLimit,
        cycleLimit: totalCycleLimit,
        windowStartDate: twentyFourHoursAgo.toISOString(),
        cycleStartDate: thirtyDaysAgo.toISOString(),
        windowType: '24小时滚动窗口 + 30天滚动窗口',
        reason: undefined
      };
    }

    console.log('  24小时查询结果:', dailyCount || 0, '条记录');
    console.log('  24小时查询条件:', twentyFourHoursAgo.toISOString(), '到', currentTime.toISOString());

    // ============ 第七步：查询30天滚动窗口使用次数 ============
    const { count: cycleCount, error: cycleError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('success', true)
      .eq('feature', 'generate_tasks')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .lt('created_at', currentTime.toISOString());

    if (cycleError) {
      console.error('查询30天使用次数失败:', cycleError);
      return {
        allowed: true,
        dailyUsed: dailyCount || 0,
        cycleUsed: 0,
        dailyLimit: totalDailyLimit,
        cycleLimit: totalCycleLimit,
        windowStartDate: twentyFourHoursAgo.toISOString(),
        cycleStartDate: thirtyDaysAgo.toISOString(),
        windowType: '24小时滚动窗口 + 30天滚动窗口',
        reason: undefined
      };
    }

    console.log('  30天查询结果:', cycleCount || 0, '条记录');
    console.log('  30天查询条件:', thirtyDaysAgo.toISOString(), '到', currentTime.toISOString());

    const dailyUsed = dailyCount || 0;
    const cycleUsed = cycleCount || 0;

    console.log('  最终统计：');
    console.log('    24小时内使用:', dailyUsed, '次 (限制:', totalDailyLimit, ')');
    console.log('    30天内使用:', cycleUsed, '次 (限制:', totalCycleLimit, ')');

    // ============ 第八步：检查限制 ============
    if (dailyUsed >= totalDailyLimit) {
      const nextAvailableTime = new Date(twentyFourHoursAgo.getTime() + 24 * 60 * 60 * 1000);
      const timeUntilReset = Math.ceil((nextAvailableTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60));
      
      console.log('❌ 24小时限制已达上限，剩余时间:', timeUntilReset, '小时');
      
      return {
        allowed: false,
        dailyUsed,
        cycleUsed,
        dailyLimit: totalDailyLimit,
        cycleLimit: totalCycleLimit,
        windowStartDate: twentyFourHoursAgo.toISOString(),
        cycleStartDate: thirtyDaysAgo.toISOString(),
        windowType: '24小时滚动窗口 + 30天滚动窗口',
        reason: `过去24小时内AI使用次数已达上限（${totalDailyLimit}次），约${timeUntilReset}小时后可以再次使用`
      };
    }

    if (cycleUsed >= totalCycleLimit) {
      // 计算30天滚动窗口中最早的一条记录何时过期
      const { data: earliestInCycle, error: earliestError } = await supabase
        .from('ai_usage_records')
        .select('created_at')
        .eq('user_id', userId)
        .eq('success', true)
        .eq('feature', 'generate_tasks')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .lt('created_at', currentTime.toISOString())
        .order('created_at', { ascending: true })
        .limit(1);

      if (!earliestError && earliestInCycle && earliestInCycle.length > 0) {
        const earliestDate = new Date(earliestInCycle[0].created_at);
        const nextAvailableTime = new Date(earliestDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const daysUntilReset = Math.ceil((nextAvailableTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log('❌ 30天限制已达上限，最早记录:', earliestDate.toISOString(), '剩余天数:', daysUntilReset);
        
        return {
          allowed: false,
          dailyUsed,
          cycleUsed,
          dailyLimit: totalDailyLimit,
          cycleLimit: totalCycleLimit,
          windowStartDate: twentyFourHoursAgo.toISOString(),
          cycleStartDate: thirtyDaysAgo.toISOString(),
          windowType: '24小时滚动窗口 + 30天滚动窗口',
          reason: `过去30天内AI使用次数已达上限（${totalCycleLimit}次），约${daysUntilReset}天后可以再次使用`
        };
      } else {
        console.log('❌ 30天限制已达上限，无法计算重置时间');
        
        return {
          allowed: false,
          dailyUsed,
          cycleUsed,
          dailyLimit: totalDailyLimit,
          cycleLimit: totalCycleLimit,
          windowStartDate: twentyFourHoursAgo.toISOString(),
          cycleStartDate: thirtyDaysAgo.toISOString(),
          windowType: '24小时滚动窗口 + 30天滚动窗口',
          reason: `过去30天内AI使用次数已达上限（${totalCycleLimit}次）`
        };
      }
    }

    // ============ 第九步：返回成功结果 ============
    console.log('✅ AI使用次数检查通过');
    
    return {
      allowed: true,
      dailyUsed,
      cycleUsed,
      dailyLimit: totalDailyLimit,
      cycleLimit: totalCycleLimit,
      windowStartDate: twentyFourHoursAgo.toISOString(),
      cycleStartDate: thirtyDaysAgo.toISOString(),
      windowType: '24小时滚动窗口 + 30天滚动窗口'
    };

  } catch (error) {
    console.error('检查AI使用次数失败:', error);
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // 错误时使用默认值
    const { daily: defaultDaily, cycle: defaultCycle } = await getAIDefaultLimits();
    
    return {
      allowed: true,
      dailyUsed: 0,
      cycleUsed: 0,
      dailyLimit: defaultDaily,
      cycleLimit: defaultCycle,
      windowStartDate: twentyFourHoursAgo.toISOString(),
      cycleStartDate: thirtyDaysAgo.toISOString(),
      windowType: '24小时滚动窗口 + 30天滚动窗口'
    };
  }
}

// ============ 记录AI使用函数 ============
async function recordAIUsage(
  userId: string,
  feature: string,
  requestData?: any,
  responseData?: any,
  success: boolean = true
) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  );

  const { error } = await supabase
    .from('ai_usage_records')
    .insert({
      user_id: userId,
      feature,
      request_data: requestData,
      response_data: responseData,
      success
    });

  if (error) {
    console.error('记录AI使用失败:', error);
  }
}

/**
 * 主 API 路由处理函数
 */
export async function POST(req: NextRequest) {
  console.log('🚀 generate-tasks API 被调用');
  
  // ============ 第一步：用户验证 ============
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              console.error('设置cookie失败:', error);
            }
          }
        }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '请先登录' },
        { status: 401 }
      );
    }

    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: '会话无效，请重新登录' },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_expires_at, nickname, email')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: '用户资料不存在' },
        { status: 401 }
      );
    }

    const isExpired = !profile?.account_expires_at ||
      new Date(profile.account_expires_at) < new Date();
    if (isExpired) {
      return NextResponse.json(
        { error: '会员已过期，请续费后再使用AI功能' },
        { status: 403 }
      );
    }

    const nickname = profile?.nickname || 
                     profile?.email?.split('@')[0] || 
                     '用户';

    // 检查AI使用限制
    console.log('📊 开始检查AI使用限制，用户:', nickname, 'ID:', user.id);
    const usageCheck = await checkAIUsage(user.id);
    
    if (!usageCheck.allowed) {
      console.log('🚫 AI使用限制触发，原因:', usageCheck.reason);
      
      await recordAIUsage(
        user.id,
        'generate_tasks',
        { userId: user.id, nickname },
        null,
        false
      );

      // 🔥 修复：返回匹配前端期望的错误响应格式
      const now = new Date();
      const cycleEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.ceil((cycleEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const errorResponse = {
        error: 'AI使用次数已用尽',
        errorType: 'INSUFFICIENT_AI_USAGE',
        message: usageCheck.reason,
        usage: {
          daily: { 
            used: usageCheck.dailyUsed, 
            limit: usageCheck.dailyLimit,
            remaining: Math.max(0, usageCheck.dailyLimit - usageCheck.dailyUsed)
          },
          cycle: { 
            used: usageCheck.cycleUsed, 
            limit: usageCheck.cycleLimit,
            remaining: Math.max(0, usageCheck.cycleLimit - usageCheck.cycleUsed)
          },
          cycleInfo: {
            startDate: now.toISOString(),
            endDate: cycleEndDate.toISOString(),
            daysRemaining: 0 // 用完了，所以剩余0天
          }
        },
        // 🔥 新增：为了兼容前端的非兑换弹窗错误处理
        details: {
          daily: {
            used: usageCheck.dailyUsed,
            limit: usageCheck.dailyLimit
          },
          cycle: {
            used: usageCheck.cycleUsed,
            limit: usageCheck.cycleLimit
          },
          cycleInfo: {
            startDate: now.toISOString(),
            endDate: cycleEndDate.toISOString(),
            daysRemaining: 0
          }
        },
        suggestion: '兑换AI密钥获取更多次数',
        action: 'redeem'
      };

      console.log('🚨 AI次数不足，返回错误响应:', errorResponse);

      return NextResponse.json(errorResponse, { status: 429 });
    }

    // ============ 验证通过，继续处理AI生成 ============

    // 检查是否有任何可用的 API 密钥
    const hasApiKey = OPENROUTER_API_KEY || DEEPSEEK_API_KEY;
    if (!hasApiKey) {
      return NextResponse.json(
        { error: "缺少 AI API 密钥环境变量" },
        { status: 500 }
      );
    }

    let result;
    try {
      result = await parseAndValidateRequest(req);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error.message },
          { status: result.error.status }
        );
      }

      const { sysPrompt, userPrompt } = buildPrompts(result.data, nickname);

      console.log('📝 准备调用 AI API...');
      const aiContent = await callOpenRouter(sysPrompt, userPrompt);
      console.log('✅ AI API 调用完成');

      const tasks = parseAIResponse(aiContent);

      const formattedTasks = formatTasks(tasks);

      if (formattedTasks.length === 0) {
        await recordAIUsage(
          user.id,
          'generate_tasks',
          { ...result.data, nickname },
          null,
          false
        );

        return NextResponse.json(
          { error: "AI 生成失败，未返回有效任务" },
          { status: 500 }
        );
      }

      // 记录成功使用
      await recordAIUsage(
        user.id,
        'generate_tasks',
        { ...result.data, nickname },
        { tasks: formattedTasks },
        true
      );

      // 返回成功响应，包含详细的限制信息
      const now = new Date();
      const cycleEndDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const daysRemaining = Math.ceil((cycleEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const response = NextResponse.json({
        tasks: formattedTasks,
        usage: {
          daily: {
            used: usageCheck.dailyUsed + 1,
            remaining: Math.max(0, usageCheck.dailyLimit - (usageCheck.dailyUsed + 1)),
            limit: usageCheck.dailyLimit
          },
          cycle: {
            used: usageCheck.cycleUsed + 1,
            remaining: Math.max(0, usageCheck.cycleLimit - (usageCheck.cycleUsed + 1)),
            limit: usageCheck.cycleLimit
          },
          cycleInfo: {
            startDate: now.toISOString(),
            endDate: cycleEndDate.toISOString(),
            daysRemaining: daysRemaining
          }
        }
      });
      
      console.log('✅ AI生成成功，用户:', nickname, '任务数:', formattedTasks.length);
      return response;

    } catch (e: any) {
      console.error("生成任务时发生未捕获的错误:", e);

      try {
        if (result && result.ok) {
          await recordAIUsage(
            user.id,
            'generate_tasks',
            { ...result.data, nickname },
            null,
            false
          );
        }
      } catch (recordError) {
        console.error('记录失败使用失败:', recordError);
      }

      return NextResponse.json(
        { error: e?.message || "生成任务失败" },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('用户验证过程发生错误:', error);

    if (error.message?.includes('JSON')) {
      return NextResponse.json(
        { error: '请求数据格式不正确' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || '系统错误' },
      { status: 500 }
    );
  }
}

/**
 * 解析并验证 NextRequest 的 JSON body
 */
async function parseAndValidateRequest(req: NextRequest): Promise<ParseResult> {
  let payload: ApiPayload;
  try {
    payload = await req.json();
  } catch {
    return { ok: false, error: { message: "请求体必须为 JSON", status: 400 } };
  }

  const title = String(payload?.title ?? "").trim();
  if (!title) {
    return { ok: false, error: { message: "缺少主题标题", status: 400 } };
  }

  const description = String(payload?.description ?? "").trim();
  const customRequirement = String(payload?.customRequirement ?? "").trim();

  const gender = payload?.preferences?.gender || "unspecified";
  const kinks = Array.isArray(payload?.preferences?.kinks)
    ? payload.preferences.kinks.filter(k => typeof k === 'string' && k.trim() !== '')
    : [];

  return {
    ok: true,
    data: { title, description, customRequirement, gender, kinks },
  };
}

/**
 * 根据用户数据构建 System 和 User Prompts
 */
function buildPrompts(payload: {
  title: string;
  description: string;
  customRequirement: string;
  gender: string;
  kinks: string[];
}, nickname: string) {
  const { title, description, customRequirement, gender, kinks } = payload;

  const genderMap: Record<string, string> = {
    male: "男性",
    female: "女性",
    non_binary: "非二元性别",
  };
  const genderText = genderMap[gender] || "未指定";
  const kinksText = kinks.length > 0 ? kinks.join("、") : "未指定";

// --- 专业系统提示词（最终简洁版）---
const sysPrompt = `你是一名专业、大胆、擅长制造控制感、服从感、羞耻感与心理张力的【情侣互动任务生成器】。

你的任务：
为情侣互动游戏（如飞行棋）生成【由对方执行的任务指令】。
任务作为游戏格子事件出现，抽到的人必须立刻执行。

━━━━━━━━━━━━━━━━━━
【核心定位（不可混淆）】
━━━━━━━━━━━━━━━━━━
- 这是【游戏任务指令】，不是剧情、不是小说
- 每一条都是直接给"执行者（对方 / 伴侣 / TA）"的命令
- "${nickname}" 是玩家昵称，在任务中代表玩家本人

━━━━━━━━━━━━━━━━━━
【执行者锁定（绝对规则）】
━━━━━━━━━━━━━━━━━━
- 每条任务的执行者永远是：对方 / 伴侣 / TA
- 禁止要求玩家本人执行、准备、等待、操作任何动作
- 禁止双人协作式或主语不清的任务
- 所有动作必须单向、明确、可执行

━━━━━━━━━━━━━━━━━━
【昵称使用规则（防错核心）】
━━━━━━━━━━━━━━━━━━
"${nickname}" 只能作为：
- 被服务对象（当玩家是支配方时）
- 被支配对象（当玩家是服从方时）
- 被评价 / 被羞辱对象

✅ 正确句式：
- "在 ${nickname} 面前……"
- "向 ${nickname} 报告……"
- "等待 ${nickname} 的指示……"

❌ 禁止句式：
- "让 ${nickname} 去做……"
- "要求 ${nickname} 配合……"
- "${nickname} 应该……"

━━━━━━━━━━━━━━━━━━
【方向判定规则（基于偏好后缀）】
━━━━━━━━━━━━━━━━━━
玩家兴趣标签：${kinksText}

根据偏好后缀判断玩家方向：

🔴 支配方（玩家享受支配权）：
- 偏好包含：施加方、支配方、控制方、制定方、引导方、施虐倾向（S）、支配方（dom）
- 任务结构：对方服从${nickname}，${nickname}享受支配

🔵 服从方（玩家享受被支配）：
- 偏好包含：接受方、服从方、被控方、顺从方、受虐倾向（M）、顺从方（sub）
- 任务结构：对方支配${nickname}，${nickname}享受被支配

🟡 切换者：
- 偏好包含：切换者（Switch）
- 不同任务可切换方向，单条任务方向必须明确

━━━━━━━━━━━━━━━━━━
【当前玩家方向判断】
━━━━━━━━━━━━━━━━━━
${(() => {
  const kinks = kinksText;
  const isDominant = kinks.includes('施加方') || kinks.includes('支配方') || kinks.includes('控制方') || 
                    kinks.includes('施虐倾向（S）') || kinks.includes('支配方（dom）');
  const isSubmissive = kinks.includes('接受方') || kinks.includes('服从方') || kinks.includes('被控方') ||
                      kinks.includes('受虐倾向（M）') || kinks.includes('顺从方（sub）');
  const isSwitch = kinks.includes('切换者（Switch）') || kinks.includes('Switch');
  
  if (isDominant) {
    return `✅ 检测结果：玩家 "${nickname}" 是支配方
- 所有任务必须是对方服从${nickname}、取悦${nickname}
- ${nickname}享受支配权，对方是被支配者`;
  } else if (isSubmissive) {
    return `✅ 检测结果：玩家 "${nickname}" 是服从方
- 所有任务必须是对方支配${nickname}、命令${nickname}
- ${nickname}享受被支配，对方是支配者`;
  } else if (isSwitch) {
    return `✅ 检测结果：玩家 "${nickname}" 是切换者
- 不同任务可切换支配/服从方向
- 单条任务内方向必须明确`;
  } else {
    return `⚠️ 无法明确判断方向，请根据偏好后缀生成任务`;
  }
})()}

━━━━━━━━━━━━━━━━━━
【性别特征结合】
━━━━━━━━━━━━━━━━━━
玩家性别：${genderText}
伴侣性别：${genderText === '男性' ? '女性' : genderText === '女性' ? '男性' : '中性'}

结合性别特征但不决定权力方向：
- 身体描述符合生理特征
- 动作姿势考虑性别特点
- 服饰装扮结合性别
- 心理、生理反应考虑性别差异

━━━━━━━━━━━━━━━━━━
【正确示例（不可照抄）】
━━━━━━━━━━━━━━━━━━

${
  (() => {
    const kinks = kinksText;
    const isDominant = kinks.includes('施加方') || kinks.includes('支配方') || kinks.includes('控制方') || 
                      kinks.includes('施虐倾向（S）') || kinks.includes('支配方（dom）');
    const isSubmissive = kinks.includes('接受方') || kinks.includes('服从方') || kinks.includes('被控方') ||
                        kinks.includes('受虐倾向（M）') || kinks.includes('顺从方（sub）');
    
    if (isDominant) {
      return `玩家是支配方，对方服从${nickname}：
1. "跪在${nickname}面前，详细描述你此刻最羞耻的身体反应，等待${nickname}的评判。"
2. "在${nickname}注视下，慢慢脱去上衣，保持这个姿势30秒，等待${nickname}的下一步指示。"
3. "面向${nickname}趴下，双手背后，用最臣服的姿态保持两分钟。"`;
    } else if (isSubmissive) {
      return `玩家是服从方，对方支配${nickname}：
1. "站在${nickname}面前，命令${nickname}抬头直视你，明确告诉${nickname}现在由你掌控。"
2. "靠近${nickname}，用语言羞辱${nickname}，要求${nickname}在你的注视下保持指定姿势三分钟。"
3. "用手指抬起${nickname}的下巴，命令${nickname}重复你说的每一句羞辱性话语。"`;
    } else {
      return `请根据玩家方向生成对应示例。`;
    }
  })()
}

━━━━━━━━━━━━━━━━━━
【错误示例（绝对禁止）】
━━━━━━━━━━━━━━━━━━

${
  (() => {
    const kinks = kinksText;
    const isDominant = kinks.includes('施加方') || kinks.includes('支配方') || kinks.includes('控制方') || 
                      kinks.includes('施虐倾向（S）') || kinks.includes('支配方（dom）');
    
    if (isDominant) {
      return `玩家是支配方时，禁止生成：
❌ "命令${nickname}描述此刻的穿着。"
❌ "让${nickname}为你表演节目。"
❌ "要求${nickname}配合你的指令。"
→ 这些都是让${nickname}被命令，方向错误！`;
    } else {
      return `玩家是服从方时，禁止生成：
❌ "在${nickname}面前跪下服从。"
❌ "向${nickname}请求惩罚。"
→ 这些都是让${nickname}被服从，方向错误！`;
    }
  })()
}

━━━━━━━━━━━━━━━━━━
【设计要求】
━━━━━━━━━━━━━━━━━━
1. 方向正确优先
   - 每条任务必须符合玩家方向
   - 禁止方向错误的任务

2. 性别特征结合
   - 任务描述要体现性别特征
   - 避免性别中立的模糊描述

3. 指令具体可执行
   - 包含：动作/姿势/时长/限制
   - 执行者明确知道怎么做

4. 多样性
   - 混合不同场景和元素
   - 避免重复的核心行为
   - 结合${kinksText}所需，可以有适当的大尺度露骨描写，比如性行为、性爱姿势、性器官等

5. 表达风格
   - 命令式、压迫式、羞耻导向
   - 服务于权力关系

6. 数量要求
   - 生成12-13条任务
   
7. 严禁行为
   - 任务中不能包含任何自残、自伤、自毁等危险行为

━━━━━━━━━━━━━━━━━━
【输出格式】
━━━━━━━━━━━━━━━━━━
{
  "tasks": [
    {"description": "任务指令1"},
    {"description": "任务指令2"},
    // ... 共12-13条
  ]
}

只输出JSON，不输出任何解释。
`;

// --- 用户提示词 ---
const userPrompt = `
我需要为情侣互动游戏生成任务指令。

玩家信息：
- 玩家昵称：${nickname}
- 玩家性别：${genderText}
- 玩家兴趣标签：${kinksText}

游戏主题：
- 主题：「${title}」
${description ? `- 主题描述：${description}` : ""}
${customRequirement ? `- 特别要求：${customRequirement}` : ""}

重要要求：
1. 任务方向必须正确：
   ${(() => {
     const kinks = kinksText;
     if (kinks.includes('施加方') || kinks.includes('支配方') || kinks.includes('控制方') || 
         kinks.includes('施虐倾向（S）') || kinks.includes('支配方（dom）')) {
       return `玩家是支配方，所有任务必须是对方服从${nickname}、取悦${nickname}。`;
     } else if (kinks.includes('接受方') || kinks.includes('服从方') || kinks.includes('被控方') ||
                kinks.includes('受虐倾向（M）') || kinks.includes('顺从方（sub）')) {
       return `玩家是服从方，所有任务必须是对方支配${nickname}、命令${nickname}。`;
     } else if (kinks.includes('切换者（Switch）') || kinks.includes('Switch')) {
       return `玩家是切换者，任务方向可在不同任务间切换，每条任务内方向必须明确。`;
     } else {
       return '请根据偏好方向生成任务。';
     }
   })()}

2. 结合性别特征：玩家${genderText}，伴侣${genderText === '男性' ? '女性' : genderText === '女性' ? '男性' : '中性'}

3. 每条任务都要具体可执行

生成12-13条任务，只输出JSON格式。
`;

return { sysPrompt, userPrompt };

}

/**
 * 调用 AI API（支持多模型自动切换）
 */
async function callOpenRouter(sysPrompt: string, userPrompt: string): Promise<string> {
  console.log('🚀 callOpenRouter 函数被调用');
  
  try {
    // 从数据库获取启用的模型配置
    const models = await getAIModels();
    
    if (!models || models.length === 0) {
      console.error('❌ 没有可用的 AI 模型配置');
      throw new Error('没有可用的 AI 模型配置');
    }

    console.log(`📡 获取到 ${models.length} 个可用模型，按优先级尝试...`);

    // 依次尝试每个模型
    for (const model of models) {
      const apiKey = getApiKey(model.provider);
      
      if (!apiKey) {
        console.warn(`⚠️ 模型 ${model.display_name} (${model.provider}) 缺少 API 密钥，跳过`);
        continue;
      }

      console.log(`📡 尝试使用模型: ${model.display_name} (${model.provider})...`);
      console.log(`📊 模型信息: ${model.name} (${model.provider})`);
      console.log(`🌐 API 地址: ${model.api_url}`);
      console.log(`⚙️ 配置: temperature=${model.temperature}, max_tokens=${model.max_tokens}`);
      
      // 修复模型 ID
      let modelId = model.name;
      if (model.provider === 'openrouter') {
        // OpenRouter 需要完整的模型 ID
        if (model.name === 'deepseek-chat') {
          // 使用标准模型 ID，避免使用可能不存在的后缀
          modelId = 'deepseek/deepseek-chat';
        } else if (model.name === 'qwen/qwen3.6-plus') {
          modelId = 'qwen/qwen3.6-plus';
        }
      } else if (model.provider === 'deepseek') {
        // DeepSeek 直接 API 需要正确的模型 ID
        if (model.name === 'deepseek-chat-direct') {
          modelId = 'deepseek-chat';
        }
      }
      console.log(`🔧 使用修复后的模型 ID: ${modelId}`);
      
      console.log(`📡 开始调用 API: ${model.api_url}`);
      console.log(`📋 请求模型 ID: ${modelId}`);
      
      try {
        // 构建请求体
        const requestBody: any = {
          model: modelId,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: model.temperature,
          max_tokens: model.max_tokens
        };

        // 对于OpenRouter，添加provider配置，强制使用DeepSeek官方，禁止回退
        if (model.provider === 'openrouter') {
          requestBody.provider = {
            order: ["DeepSeek"],
            allow_fallbacks: false
          };
          requestBody.zdr = false;
          requestBody.data_collection = "allow";
        }

        const resp = await fetch(model.api_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        console.log(`📡 API 响应状态: ${resp.status} ${resp.statusText}`);

        if (resp.ok) {
          const data = await resp.json();
          console.log(`📡 API 响应数据:`, JSON.stringify(data, null, 2));
          
          const content = data?.choices?.[0]?.message?.content;

          if (typeof content === "string" && content.trim() !== "") {
            console.log(`✅ 模型 ${model.display_name} 调用成功`);
            console.log(`📊 实际使用模型: ${model.name} (${model.provider})`);
            console.log(`🌐 API 地址: ${model.api_url}`);
            
            // 更新成功计数
            await updateModelStats(model.id, true);
            
            return content;
          } else {
            console.warn(`⚠️ 模型 ${model.display_name} 返回内容为空或格式不正确`);
          }
        } else {
          const errorBody = await resp.text();
          console.warn(`⚠️ 模型 ${model.display_name} 调用失败:`, errorBody);
        }
        
        // 更新失败计数
        await updateModelStats(model.id, false);
      } catch (error) {
        console.error(`❌ 模型 ${model.display_name} 调用出错:`, error);
        
        // 更新失败计数
        await updateModelStats(model.id, false);
      }
    }

    throw new Error("所有 AI 模型调用失败");
  } catch (error) {
    console.error(`❌ callOpenRouter 函数异常:`, error);
    throw error;
  }
}

/**
 * 更新模型统计信息
 */
async function updateModelStats(modelId: string, success: boolean) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } }
      }
    );

    const field = success ? 'success_count' : 'fail_count';
    
    // 先获取当前模型的统计数据
    const { data: model } = await supabase
      .from('ai_models')
      .select('success_count, fail_count')
      .eq('id', modelId)
      .single();

    if (model) {
      // 更新计数器和最后使用时间
      await supabase
        .from('ai_models')
        .update({
          [field]: (model[field] || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', modelId);
    }
  } catch (error) {
    console.error('更新模型统计失败:', error);
  }
}

/**
 * 解析 AI 返回的（可能是 JSON 或纯文本）内容
 */
function parseAIResponse(content: string): Partial<Task>[] {
  try {
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed?.tasks)) {
      return parsed.tasks;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (Array.isArray(parsed?.task_list)) {
      return parsed.task_list;
    }
    console.warn("AI 返回了 JSON，但结构未知", parsed);
  } catch (e) {
    console.warn("AI 未返回标准 JSON，降级到纯文本列表解析");
  }

  return content
    .split("\n")
    .map((l: string) => l.trim())
    .filter(Boolean)
    .map((l: string) => {
      const cleaned = l.replace(/^[-*\d]+[.、:：)]\s*/, "");
      return { description: cleaned };
    });
}

/**
 * 过滤、清理并格式化最终的任务数组
 */
function formatTasks(tasks: Partial<Task>[]): Task[] {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks
    .filter((t): t is Task =>
      typeof t?.description === "string" && t.description.trim().length > 0
    )
    .map((t: Task) => ({
      description: t.description.trim(),
      // 只保留description字段，移除其他可能的字段
    }))
    .slice(0, 12); // 增加限制到12条
}