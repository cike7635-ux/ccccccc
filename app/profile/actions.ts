// app\profile\actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/profile";

type UpdatePreferencesPayload = {
  gender: "male" | "female" | "non_binary";
  kinks: string[];
};

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("未登录");
  }
  return { supabase, userId: data.user.id } as const;
}

export async function updateNickname(nickname: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();

    const trimmed = nickname.trim();
    if (!trimmed) {
      return { ok: false, error: "昵称不能为空" };
    }
    if (trimmed.length > 100) {
      return { ok: false, error: "昵称不能超过100个字符" };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ nickname: trimmed, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return { ok: false, error: msg };
  }
}

export async function updatePreferences(payload: UpdatePreferencesPayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    // 确保存在个人档案记录，避免更新 0 行导致 single() 报错
    await ensureProfile();

    const allowed = ["male", "female", "non_binary"] as const;
    if (!allowed.includes(payload.gender)) {
      return { ok: false, error: "性别选择无效" };
    }

    // 规范化关键词：去重、限制长度、防止空值
    const kinks = Array.from(new Set((payload.kinks ?? []).map((k) => String(k).trim()).filter(Boolean))).slice(0, 24);

    const preferences = { gender: payload.gender, kinks };
    const { error } = await supabase
      .from("profiles")
      .update({ preferences, updated_at: new Date().toISOString() })
      .eq("id", userId)
      // 通过 select 返回代表性记录，避免 PostgREST 的 JSON 单对象强制转换错误
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    revalidatePath("/profile");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return { ok: false, error: msg };
  }
}