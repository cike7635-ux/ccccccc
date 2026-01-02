import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// --- Configuration ---
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_URL = "https://api.deepseek.com/chat/completions";
const OPENROUTER_URL = process.env.OPENROUTER_URL || DEFAULT_URL;
const MODEL_NAME = process.env.MODEL_NAME || "deepseek-chat";

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

    // 使用自定义限制，如果为NULL或undefined则使用默认值10/120
    const DAILY_LIMIT = userData?.custom_daily_limit ?? 10;
    const CYCLE_LIMIT = userData?.custom_cycle_limit ?? 120;

    // 验证限制值的合理性
    const validatedDailyLimit = Math.max(1, Math.min(DAILY_LIMIT, 1000));
    const validatedCycleLimit = Math.max(10, Math.min(CYCLE_LIMIT, 10000));

    // ============ 第二步：计算时间窗口 ============
    const now = new Date();
    
    // 24小时滚动窗口（从现在往前推24小时）
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // 30天滚动窗口（从现在往前推30天）
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ============ 第三步：查询24小时滚动窗口使用次数 ============
    const { count: dailyCount, error: dailyError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('success', true)
      .eq('feature', 'generate_tasks')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .lt('created_at', now.toISOString());

    if (dailyError) {
      console.error('查询24小时使用次数失败:', dailyError);
      return {
        allowed: true,
        dailyUsed: 0,
        cycleUsed: 0,
        dailyLimit: validatedDailyLimit,
        cycleLimit: validatedCycleLimit,
        windowStartDate: twentyFourHoursAgo.toISOString(),
        cycleStartDate: thirtyDaysAgo.toISOString(),
        windowType: '24小时滚动窗口 + 30天滚动窗口',
        reason: undefined
      };
    }

    // ============ 第四步：查询30天滚动窗口使用次数 ============
    const { count: cycleCount, error: cycleError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('success', true)
      .eq('feature', 'generate_tasks')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .lt('created_at', now.toISOString());

    if (cycleError) {
      console.error('查询30天使用次数失败:', cycleError);
      return {
        allowed: true,
        dailyUsed: dailyCount || 0,
        cycleUsed: 0,
        dailyLimit: validatedDailyLimit,
        cycleLimit: validatedCycleLimit,
        windowStartDate: thirtyDaysAgo.toISOString(),
        cycleStartDate: thirtyDaysAgo.toISOString(),
        windowType: '24小时滚动窗口 + 30天滚动窗口',
        reason: undefined
      };
    }

    const dailyUsed = dailyCount || 0;
    const cycleUsed = cycleCount || 0;

    // ============ 第五步：检查限制 ============
    if (dailyUsed >= validatedDailyLimit) {
      const nextAvailableTime = new Date(twentyFourHoursAgo.getTime() + 24 * 60 * 60 * 1000);
      const timeUntilReset = Math.ceil((nextAvailableTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      
      return {
        allowed: false,
        dailyUsed,
        cycleUsed,
        dailyLimit: validatedDailyLimit,
        cycleLimit: validatedCycleLimit,
        windowStartDate: twentyFourHoursAgo.toISOString(),
        cycleStartDate: thirtyDaysAgo.toISOString(),
        windowType: '24小时滚动窗口 + 30天滚动窗口',
        reason: `过去24小时内AI使用次数已达上限（${validatedDailyLimit}次），约${timeUntilReset}小时后可以再次使用`
      };
    }

    if (cycleUsed >= validatedCycleLimit) {
      // 计算30天滚动窗口中最早的一条记录何时过期
      const { data: earliestInCycle, error: earliestError } = await supabase
        .from('ai_usage_records')
        .select('created_at')
        .eq('user_id', userId)
        .eq('success', true)
        .eq('feature', 'generate_tasks')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .lt('created_at', now.toISOString())
        .order('created_at', { ascending: true })
        .limit(1);

      if (!earliestError && earliestInCycle && earliestInCycle.length > 0) {
        const earliestDate = new Date(earliestInCycle[0].created_at);
        const nextAvailableTime = new Date(earliestDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const daysUntilReset = Math.ceil((nextAvailableTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          allowed: false,
          dailyUsed,
          cycleUsed,
          dailyLimit: validatedDailyLimit,
          cycleLimit: validatedCycleLimit,
          windowStartDate: twentyFourHoursAgo.toISOString(),
          cycleStartDate: thirtyDaysAgo.toISOString(),
          windowType: '24小时滚动窗口 + 30天滚动窗口',
          reason: `过去30天内AI使用次数已达上限（${validatedCycleLimit}次），约${daysUntilReset}天后可以再次使用`
        };
      } else {
        return {
          allowed: false,
          dailyUsed,
          cycleUsed,
          dailyLimit: validatedDailyLimit,
          cycleLimit: validatedCycleLimit,
          windowStartDate: twentyFourHoursAgo.toISOString(),
          cycleStartDate: thirtyDaysAgo.toISOString(),
          windowType: '24小时滚动窗口 + 30天滚动窗口',
          reason: `过去30天内AI使用次数已达上限（${validatedCycleLimit}次）`
        };
      }
    }

    // ============ 第六步：返回成功结果 ============
    return {
      allowed: true,
      dailyUsed,
      cycleUsed,
      dailyLimit: validatedDailyLimit,
      cycleLimit: validatedCycleLimit,
      windowStartDate: twentyFourHoursAgo.toISOString(),
      cycleStartDate: thirtyDaysAgo.toISOString(),
      windowType: '24小时滚动窗口 + 30天滚动窗口'
    };

  } catch (error) {
    console.error('检查AI使用次数失败:', error);
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    return {
      allowed: true,
      dailyUsed: 0,
      cycleUsed: 0,
      dailyLimit: 10,
      cycleLimit: 120,
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
    const usageCheck = await checkAIUsage(user.id);
    if (!usageCheck.allowed) {
      await recordAIUsage(
        user.id,
        'generate_tasks',
        null,
        null,
        false
      );

      // 返回详细的限制信息
      return NextResponse.json(
        {
          error: usageCheck.reason,
          details: {
            daily: { 
              used: usageCheck.dailyUsed, 
              limit: usageCheck.dailyLimit,
              remaining: Math.max(0, usageCheck.dailyLimit - usageCheck.dailyUsed),
              windowStart: usageCheck.windowStartDate,
              windowType: '24小时滚动窗口'
            },
            cycle: { 
              used: usageCheck.cycleUsed, 
              limit: usageCheck.cycleLimit,
              remaining: Math.max(0, usageCheck.cycleLimit - usageCheck.cycleUsed),
              windowStart: usageCheck.cycleStartDate,
              windowType: '30天滚动窗口'
            },
            windowInfo: usageCheck.windowType
          }
        },
        { status: 429 }
      );
    }

    // ============ 验证通过，继续处理AI生成 ============

    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: "缺少 OPENROUTER_API_KEY 环境变量" },
        { status: 500 }
      );
    }

    try {
      const result = await parseAndValidateRequest(req);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error.message },
          { status: result.error.status }
        );
      }

      const { sysPrompt, userPrompt } = buildPrompts(result.data, nickname);

      const aiContent = await callOpenRouter(sysPrompt, userPrompt);

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
      return NextResponse.json({
        tasks: formattedTasks,
        usage: {
          daily: {
            used: usageCheck.dailyUsed + 1,
            remaining: Math.max(0, usageCheck.dailyLimit - (usageCheck.dailyUsed + 1)),
            limit: usageCheck.dailyLimit,
            windowStart: usageCheck.windowStartDate,
            windowType: '24小时滚动窗口'
          },
          cycle: {
            used: usageCheck.cycleUsed + 1,
            remaining: Math.max(0, usageCheck.cycleLimit - (usageCheck.cycleUsed + 1)),
            limit: usageCheck.cycleLimit,
            windowStart: usageCheck.cycleStartDate,
            windowType: '30天滚动窗口'
          },
          windowInfo: usageCheck.windowType
        }
      });

    } catch (e: any) {
      console.error("生成任务时发生未捕获的错误:", e);

      try {
        const result = await parseAndValidateRequest(req).catch(() => ({ ok: false } as ParseResult));
        if (result.ok) {
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

  // --- 专业系统提示词 ---
  const sysPrompt = `你是一名专业、大胆、擅长制造控制感、服从感、羞耻感与心理张力的【情侣互动任务生成器】。

你的任务：
为情侣互动游戏（如飞行棋）生成【由对方执行的任务指令】。
任务将作为游戏格子事件出现，抽到的人必须照做。

━━━━━━━━━━━━━━━━━━
【核心定位（不可混淆）】
━━━━━━━━━━━━━━━━━━
- 这是【游戏任务指令】，不是剧情、不是小说
- 每一条都是直接给"执行者（对方 / 伴侣 / TA）"的命令
- ${nickname} 只是玩家在游戏中的昵称变量，用于被指向、被作用、被评价

━━━━━━━━━━━━━━━━━━
【昵称使用规则（极其重要）】
━━━━━━━━━━━━━━━━━━
- ${nickname} 是字符串占位符，不代表执行者
- 昵称只能作为：
  · 被服务对象
  · 被支配对象
  · 被控制对象
  · 被羞辱 / 被评价对象
- 严禁任何导致"好像是玩家在执行动作"的歧义句式

✅ 正确句式结构：
- "在 ${nickname} 面前……"
- "对 ${nickname} 下达命令……"
- "让 ${nickname} 清楚地看到……"

❌ 禁止句式：
- "让 ${nickname} 去做……"
- "要求 ${nickname} 配合……"
- "${nickname} 执行以下动作……"

━━━━━━━━━━━━━━━━━━
【执行者锁定（强制）】
━━━━━━━━━━━━━━━━━━
- 每条任务的执行者永远是：对方 / 伴侣 / TA
- 禁止要求玩家本人执行、准备、等待、操作任何动作
- 禁止双人协作式或主语不清的任务
- 所有动作必须单向、明确、可执行

━━━━━━━━━━━━━━━━━━
【兴趣偏好方向判定（生成前必须完成）】
━━━━━━━━━━━━━━━━━━
所有兴趣偏好均具有方向性。
必须先判断"快感属于谁"，再决定"谁施加、谁承受"。

━━━━━━━━━━━━━━━━━━
【快感来源判定规则（终版）】
━━━━━━━━━━━━━━━━━━

🔹 一、用户偏好为【施加 / 支配 / 控制】（S / D）

- 快感来源于：对方的服从、暴露、承受、被支配
- 行为结构必须为：
  · 对方 = 被作用者
  · 用户（${nickname}）= 支配与享受的一方
- 允许对方被命令、被限制、被惩罚、被羞辱

🔹 二、用户偏好为【接受 / 顺从 / 被控】（M / s）

- 快感来源于：被命令、被控制、被施加、被羞辱
- 行为结构必须为：
  · 对方 = 主动施加者
  · 用户（${nickname}）= 被作用对象
- 必须明确体现：对方正在"对 ${nickname} 做什么"
- ❌ 严禁通过"让对方当 M"来取悦用户

🔹 三、偏好为【Switch】

- 不同任务之间可切换方向
- 单条任务内方向必须唯一、清晰

━━━━━━━━━━━━━━━━━━
【明确示例（用于校准模型，不可照抄）】
━━━━━━━━━━━━━━━━━━

【示例 A｜用户是 M（接受 / 被控）】

示例 1：
- "站在 ${nickname} 面前，命令${nickname} 抬头直视你，明确告诉 ${nickname}：现在由你掌控节奏，${nickname}只能服从。"

示例 2：
- "靠近 ${nickname}，用语言对 ${nickname}进行羞辱，要求 ${nickname}在你的注视下保持指定姿势三分钟。"

→ 说明：  
执行者始终是「对方」，  
快感来自「${nickname} 被支配 / 被控制」。

【示例 B｜用户是 S（施加 / 支配）】

示例 1：
- "在 ${nickname} 面前跪下，双手放在身后，未经允许不得起身，用姿态明确你的服从关系。"

示例 2：
- "当着 ${nickname} 的面接受惩罚指令，完成指定动作后等待进一步命令。"

→ 说明：  
执行者是「对方」，  
承受者是「对方」，  
快感归属于「${nickname}」。

━━━━━━━━━━━━━━━━━━
【设计硬性要求】
━━━━━━━━━━━━━━━━━━
1. 偏好绝对优先  
- 每条任务必须至少命中 1 个用户兴趣偏好
- 禁止生成温和、中性、日常互动

2. 指令必须具体  
- 必须包含：动作 / 姿态 / 状态 / 场景 / 限制
- 执行者一看就知道"怎么做、做到什么程度"

3. 刺激来源必须多样  
- 整组任务需混合：
  · 身份关系（主从、宠物、物品化）
  · 规则与后果（许可、禁止、失败惩罚）
  · 场景（私密 / 日常 / 半公开）
  · 心理压力（被观察、被评判）

4. 表达尺度  
- 命令式、压迫式、羞耻导向
- 侧重心理与权力关系
- 结合剧情需要，不限制露骨性描写甚至支持配合剧情进行露骨、大尺度、激情、性描写

5. 数量与去重  
- 生成 12–13 条任务
- 禁止核心行为或场景重复

━━━━━━━━━━━━━━━━━━
【输出规则】
━━━━━━━━━━━━━━━━━━
- 只输出 JSON
- 仅包含 tasks 数组
- 每个对象只包含 description 字段
- 不输出任何解释、前言或结语
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

生成 15-17 条任务，只输出 JSON 格式。`;

  return { sysPrompt, userPrompt };
}

/**
 * 调用 OpenRouter API
 */
async function callOpenRouter(sysPrompt: string, userPrompt: string): Promise<string> {
  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 6000,
    }),
  });

  if (!resp.ok) {
    const errorBody = await resp.text();
    console.error("OpenRouter API 错误:", errorBody);
    throw new Error(`AI API 请求失败，状态码: ${resp.status}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("AI 返回了空或无效的内容");
  }

  return content;
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
    }))
    .slice(0, 12); // 增加限制到12条
}