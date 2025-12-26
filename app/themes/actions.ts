"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ThemeRecord = {
  id: string;
  title: string;
  description: string | null;
  task_count: number;
  created_at: string;
};

type TaskRecord = {
  id: string;
  theme_id: string;
  description: string;
  type: string;
  order_index: number;
  is_ai_generated: boolean;
  created_at: string;
};

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("未登录，无法执行该操作");
  }
  return { supabase, userId: data.user.id } as const;
}

export async function listMyThemes(): Promise<{ data: ThemeRecord[]; error?: string }> {
  const { supabase, userId } = await requireUser();
  
  // 1. 首先查询用户是否有主题
  const { data, error } = await supabase
    .from("themes")
    .select("id,title,description,task_count,created_at")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("[listMyThemes] 查询主题失败:", error.message);
    return { data: [], error: error.message };
  }
  
  // 2. 🔥 关键修复：如果用户没有主题，初始化默认主题
  if ((data?.length || 0) === 0) {
    console.log(`[listMyThemes] 用户 ${userId} 没有主题，开始初始化...`);
    
    try {
      // 确保用户资料存在
      const { ensureProfile } = await import("@/lib/profile");
      await ensureProfile();
      console.log(`[listMyThemes] 用户资料已确认`);
      
      // 读取默认主题模板
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const filePath = path.join(process.cwd(), "lib", "tasks.json");
      console.log(`[listMyThemes] 尝试读取文件: ${filePath}`);
      
      const content = await fs.readFile(filePath, "utf-8");
      const templates = JSON.parse(content);
      console.log(`[listMyThemes] 读取到 ${templates.length} 个主题模板`);
      
      // 为每个模板创建主题
      const createdThemes: any[] = [];
      
      for (const tpl of templates) {
        try {
          // 检查是否已存在同名主题
          const { data: existing } = await supabase
            .from("themes")
            .select("id")
            .eq("creator_id", userId)
            .eq("title", tpl.title)
            .maybeSingle();
          
          if (existing?.id) {
            console.log(`[listMyThemes] 主题 "${tpl.title}" 已存在，跳过`);
            continue;
          }
          
          // 创建主题
          const { data: created, error: insertError } = await supabase
            .from("themes")
            .insert({
              title: tpl.title,
              description: tpl.description || null,
              creator_id: userId,
              is_public: false,
              task_count: (tpl.tasks?.length || 0),
            })
            .select("id, title")
            .single();
          
          if (insertError) {
            console.error(`[listMyThemes] 创建主题 "${tpl.title}" 失败:`, insertError.message);
            continue;
          }
          
          console.log(`[listMyThemes] 创建主题 "${tpl.title}" 成功，ID: ${created.id}`);
          
          // 为这个主题创建任务
          if (tpl.tasks && tpl.tasks.length > 0) {
            const rows = tpl.tasks.map((desc: string, idx: number) => ({
              theme_id: created.id,
              description: desc,
              type: "interaction",
              order_index: idx,
              is_ai_generated: false,
            }));
            
            const { error: taskError } = await supabase.from("tasks").insert(rows);
            
            if (taskError) {
              console.error(`[listMyThemes] 为主题 "${tpl.title}" 创建任务失败:`, taskError.message);
            } else {
              console.log(`[listMyThemes] 为主题 "${tpl.title}" 创建了 ${rows.length} 个任务`);
            }
          }
          
          createdThemes.push(created);
          
        } catch (themeError) {
          console.error(`[listMyThemes] 处理主题 "${tpl.title}" 时出错:`, themeError);
        }
      }
      
      // 3. 初始化完成后，重新查询主题
      console.log(`[listMyThemes] 初始化完成，共创建 ${createdThemes.length} 个主题，重新查询...`);
      
      const { data: newData, error: newError } = await supabase
        .from("themes")
        .select("id,title,description,task_count,created_at")
        .eq("creator_id", userId)
        .order("created_at", { ascending: false });
      
      if (newError) {
        console.error("[listMyThemes] 重新查询主题失败:", newError.message);
        return { data: [], error: newError.message };
      }
      
      console.log(`[listMyThemes] 初始化后查询到 ${newData?.length || 0} 个主题`);
      return { data: (newData || []) as ThemeRecord[] };
      
    } catch (initError: any) {
      console.error("[listMyThemes] 初始化默认主题失败:", initError.message || initError);
      // 即使初始化失败，返回空数组（保持原有行为）
      return { data: [] };
    }
  }
  
  // 4. 用户已有主题，直接返回
  console.log(`[listMyThemes] 用户已有 ${data.length} 个主题`);
  return { data: (data || []) as ThemeRecord[] };
}

export async function getThemeById(id: string): Promise<{ data: ThemeRecord | null; error?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("themes")
    .select("id,title,description,task_count,created_at")
    .eq("id", id)
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as ThemeRecord };
}

export async function createTheme(formData: FormData): Promise<void> {
  const { supabase, userId } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) throw new Error("主题标题为必填");

  const { data, error } = await supabase
    .from("themes")
    .insert({ title, description: description || null, creator_id: userId, is_public: false })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/themes");
  redirect(`/themes/${data.id}`);
}

export async function updateTheme(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!id) throw new Error("缺少主题 ID");
  if (!title) throw new Error("主题标题为必填");

  const { error } = await supabase
    .from("themes")
    .update({ title, description: description || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/themes");
  revalidatePath(`/themes/${id}`);
}

export async function deleteTheme(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("缺少主题 ID");

  const { error } = await supabase.from("themes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/themes");
}

export async function listTasksByTheme(themeId: string): Promise<{ data: TaskRecord[]; error?: string }> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("tasks")
    .select("id,theme_id,description,type,order_index,is_ai_generated,created_at")
    .eq("theme_id", themeId)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as TaskRecord[] };
}

async function syncThemeTaskCount(supabase: Awaited<ReturnType<typeof createClient>>, themeId: string) {
  const { count } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("theme_id", themeId);
  if (typeof count === "number") {
    await supabase.from("themes").update({ task_count: count }).eq("id", themeId);
  }
}

export async function createTask(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const themeId = String(formData.get("theme_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "interaction");
  const orderIndexRaw = String(formData.get("order_index") ?? "");
  const order_index = Number.isFinite(Number(orderIndexRaw)) ? Number(orderIndexRaw) : 0;

  if (!themeId) throw new Error("缺少主题 ID");
  if (!description) throw new Error("任务内容为必填");

  const { error } = await supabase
    .from("tasks")
    .insert({ theme_id: themeId, description, type, order_index, is_ai_generated: false });
  if (error) throw new Error(error.message);

  await syncThemeTaskCount(supabase, themeId);
  revalidatePath(`/themes/${themeId}`);
}

export async function updateTask(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "interaction");
  const orderIndexRaw = String(formData.get("order_index") ?? "");
  const order_index = Number.isFinite(Number(orderIndexRaw)) ? Number(orderIndexRaw) : undefined;

  if (!id) throw new Error("缺少任务 ID");
  if (!description) throw new Error("任务内容为必填");

  const payload: Partial<Pick<TaskRecord, "description" | "type" | "order_index" >> = {
    description,
    type,
  };
  if (order_index !== undefined) payload.order_index = order_index;

  const { error } = await supabase.from("tasks").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(formData: FormData): Promise<void> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const themeId = String(formData.get("theme_id") ?? "");
  if (!id) throw new Error("缺少任务 ID");
  if (!themeId) throw new Error("缺少主题 ID");

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await syncThemeTaskCount(supabase, themeId);
  revalidatePath(`/themes/${themeId}`);
}

export async function bulkInsertTasks(themeId: string, tasks: Array<{ description: string; type?: string; order_index?: number; is_ai_generated?: boolean }>): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  if (!themeId) return { error: "缺少主题 ID" };
  const rows = tasks.map(t => ({
    theme_id: themeId,
    description: t.description,
    type: t.type ?? "interaction",
    order_index: typeof t.order_index === "number" ? t.order_index : 0,
    is_ai_generated: t.is_ai_generated ?? true,
  }));

  const { error } = await supabase.from("tasks").insert(rows);
  if (error) return { error: error.message };
  await syncThemeTaskCount(supabase, themeId);
  revalidatePath(`/themes/${themeId}`);
  return {};
}
