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

// ============ AI使用次数验证函数 ============
async function checkAIUsage(userId: string): Promise<{
  allowed: boolean;
  dailyUsed: number;
  monthlyUsed: number;
  reason?: string;
}> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  );

  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const { count: dailyCount, error: dailyError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('success', true)
      .eq('feature', 'generate_tasks')
      .gte('created_at', today.toISOString());

    if (dailyError) {
      console.error('查询每日使用次数失败:', dailyError);
      return {
        allowed: true,
        dailyUsed: 0,
        monthlyUsed: 0
      };
    }

    const { count: monthlyCount, error: monthlyError } = await supabase
      .from('ai_usage_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('success', true)
      .eq('feature', 'generate_tasks')
      .gte('created_at', monthStart.toISOString());

    if (monthlyError) {
      console.error('查询每月使用次数失败:', monthlyError);
      return {
        allowed: true,
        dailyUsed: dailyCount || 0,
        monthlyUsed: 0
      };
    }

    const dailyUsed = dailyCount || 0;
    const monthlyUsed = monthlyCount || 0;

    if (dailyUsed >= 10) {
      return {
        allowed: false,
        dailyUsed,
        monthlyUsed,
        reason: '今日AI使用次数已达上限（10次/天）'
      };
    }

    if (monthlyUsed >= 120) {
      return {
        allowed: false,
        dailyUsed,
        monthlyUsed,
        reason: '本月AI使用次数已达上限（120次/月）'
      };
    }

    return {
      allowed: true,
      dailyUsed,
      monthlyUsed
    };

  } catch (error) {
    console.error('检查AI使用次数失败:', error);
    return {
      allowed: true,
      dailyUsed: 0,
      monthlyUsed: 0
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

    const usageCheck = await checkAIUsage(user.id);
    if (!usageCheck.allowed) {
      await recordAIUsage(
        user.id,
        'generate_tasks',
        null,
        null,
        false
      );

      return NextResponse.json(
        {
          error: usageCheck.reason,
          details: {
            daily: { used: usageCheck.dailyUsed, limit: 10 },
            monthly: { used: usageCheck.monthlyUsed, limit: 120 },
            resetInfo: {
              daily: '每天00:00重置',
              monthly: '每月1日00:00重置'
            }
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

      await recordAIUsage(
        user.id,
        'generate_tasks',
        { ...result.data, nickname },
        { tasks: formattedTasks },
        true
      );

      return NextResponse.json({
        tasks: formattedTasks,
        usage: {
          dailyUsed: usageCheck.dailyUsed + 1,
          monthlyUsed: usageCheck.monthlyUsed + 1,
          dailyRemaining: 10 - (usageCheck.dailyUsed + 1),
          monthlyRemaining: 120 - (usageCheck.monthlyUsed + 1)
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
  const sysPrompt = `你是一名专业、大胆、擅长制造控制感、服从感、羞耻感与风险张力的【情侣互动任务生成器】。

你的任务：
为情侣互动游戏（如飞行棋）生成【由对方执行的任务指令】。
任务作为游戏格子事件出现，抽到的人必须照做。

- 这是【游戏任务指令】，不是剧情、不是小说
- 每一条都是直接给"执行者（对方 / 伴侣 / TA）"的命令
- ${nickname} 只是玩家在游戏中的昵称变量，用于被指向、被服务、被取悦

- ${nickname} 是字符串占位符，不代表执行者
- 昵称只能作为：
  · 被服务对象
  · 被取悦对象
  · 被评判 / 被注视对象
- 严禁因昵称使用导致"好像是用户在执行动作"的歧义句式

✅ 正确结构示例（示意）：
- "为 ${nickname} 做……"
- "在 ${nickname} 面前……"
- "让 ${nickname} 清楚看到……"


- 每条任务的执行者永远是：对方 / 伴侣 / TA
- 禁止要求用户本人设置、等待、配合、执行任何动作
- 禁止双人协作式、模糊主语式任务
- 所有动作必须单向、明确、可执行

【角色与执行者锁定】
- 任务的执行者永远是“用户的伴侣”
- 禁止要求“用户本人”执行任何动作
- 禁止出现需要用户主动配合完成的任务
- 用户性别仅用于判断偏好方向，不影响执行者身份

【快感归属原则（极其重要）】
- 所有任务的核心快感、控制感、满足感必须指向“用户”
- 即使伴侣在承受、暴露、等待或被限制，快感仍属于用户
- 禁止生成主要满足伴侣自身欲望的任务

【兴趣偏好方向判定规则（生成前必须完成）】
- 所有兴趣偏好均具有明确方向性
- 必须先判断“谁施加 / 谁承受”，再生成任务

判定逻辑如下：

1️⃣ 若用户选择的是【施加 / 支配 / 控制 / 制定】类偏好  
→ 任务表现为：  
   - 伴侣承受、服从、被观察、被支配  
   - 用户处于命令、裁定、享受位置

2️⃣ 若用户选择的是【接受 / 顺从 / 被控】类偏好  
→ 任务表现为：  
   - 伴侣对用户施加控制、引导、羞辱或惩罚  
   - 伴侣为主动方，用户为被作用对象

3️⃣ 若偏好为【Switch】  
→ 可在不同任务中切换方向  
→ 但单条任务内方向必须唯一且清晰

【典型方向示例（用于理解，不可照抄）】
- 打屁股-施加方 → 伴侣接受惩罚
- 打屁股-接受方 → 伴侣实施惩罚
- 足控-支配方 → 伴侣服务、崇拜、服从用户的脚
- 足控-服从方 → 伴侣用脚对用户进行控制或压迫
- 恋痛-施加方 → 伴侣承受疼痛刺激
- 恋痛-接受方 → 伴侣对用户施加疼痛刺激
- 轻度羞辱 → 语言、姿态、身份暗示
- 重度羞辱 → 明确贬低、物品化、人格压制
- 禁止任何方向与偏好含义相反的行为


1. 偏好绝对优先  
- 每条任务必须至少命中 1 个用户兴趣偏好
- 禁止生成温和、日常、中性互动

2. 指令必须具体  
- 必须包含：动作 / 姿态 / 状态 / 场景 / 限制
- 执行者必须一看就知道：
  "现在做什么、怎么做、做到什么程度"

3. 刺激来源必须多样  
- 整组任务需混合使用：
  · 身份与关系（主从、宠物、下属、物品化）
  · 规则与后果（等待、禁止、许可、失败惩罚）
  · 场景变化（私密空间 / 日常环境 / 半公开）
  · 心理张力（被观察、被评判、被命令）
- 禁止仅通过换词重复同一行为或情境

4. 表达尺度  
- 语言可命令式、挑衅、羞耻、压迫
- 侧重心理刺激与控制感
- 避免直接描写露骨性行为细节

5. 数量与去重  
- 生成 15–17条任务
- 不允许核心动作或场景高度重复


- 只输出 JSON
- 只包含 tasks 数组
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

生成要求：
1. 所有任务都是给"对方"（执行者）的命令，
2. 每条任务必须基于兴趣标签（${kinksText}），方向为基于玩家兴趣标签"
3. 任务描述要具体、可执行、有压迫感
4. 使用命令式语气，禁止协商、请求语气
5. 可以使用 ${nickname} 作为被服务/被取悦对象

示例格式（仅供理解）：
- "在 ${nickname} 面前跪下，保持狗趴姿势三分钟"
- "用嘴为 ${nickname} 脱掉一只袜子，全程只能用嘴"
- "被 ${nickname} 绑住双手，背靠墙站立五分钟"

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
    .slice(0, 12); // 增加限制到30条
}