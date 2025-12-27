"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePreferences } from "@/app/profile/actions";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";

type Gender = "male" | "female" | "non_binary";

const SUGGESTED_KINKS: string[] = [
   // 身份 / 倾向
  "施虐倾向（S）",
  "受虐倾向（M）",
  "支配方（D）",
  "顺从方（s）",
  "切换者（Switch）",

  // 行为（需要区分方向）
  "打屁股-施加方（SP）",
  "打屁股-接受方（SP）",

  "捆绑-控制方（Bondage）",
  "捆绑-被控方（Bondage）",

  "调教-引导方（Training）",
  "调教-服从方（Training）",

  "羞辱-施加方（Humiliation）",
  "羞辱-接受方（Humiliation）",

  "惩罚-制定方（Punishment）",
  "惩罚-接受方（Punishment）",

  // 关系 / 情境
  "主奴关系（Master/Slave）",
  "角色扮演（Roleplay）",
  "制服诱惑（Uniform）",
  "情趣内衣（Lingerie）",
  "Cosplay（角色装扮）",
  "风险暴露（Exposure）",

  // 亲密 / 感官（不分方向）
  "温柔爱抚",
  "挑逗（Teasing）",
  "亲吻增强",
  "敏感触碰",
  "肢体按摩",
  "足部偏好（Foot Fetish）",

  // 控制机制 / 玩法
  "规则控制",
  "许可等待",
  "拒绝与克制",
  "节奏掌控",

  // 道具
  "震动玩具"
];

function shouldShowByLocalStorage(): boolean {
  if (typeof window === "undefined") return false;
  // 如果用户选择稍后设置，则不再弹出
  return !window.localStorage.getItem("prefModalDismissed");
}

export default function PreferencesModal() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [kinks, setKinks] = useState<Set<string>>(new Set());
  const [newKink, setNewKink] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!active || !user) {
          setMounted(true);
          return;
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", user.id)
          .maybeSingle();

        const pref = (profile?.preferences ?? {}) as { gender?: Gender; kinks?: string[] };
        const hasGender = !!pref?.gender;
        const hasKinks = Array.isArray(pref?.kinks) && pref!.kinks!.length > 0;

        if (hasGender) setGender(pref.gender!);
        if (hasKinks) setKinks(new Set(pref.kinks!));

        const needPrompt = !hasGender || !hasKinks;
        if (needPrompt && shouldShowByLocalStorage()) {
          setShow(true);
        }
      } catch {
        // 忽略错误，避免阻塞页面
      } finally {
        if (active) setMounted(true);
      }
    };
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const closeModal = () => setShow(false);

  const toggleKink = (k: string) => {
    setKinks((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const addKink = () => {
    setError(null);
    const trimmed = newKink.trim();
    if (!trimmed) return;
    if (kinks.size >= 24) {
      setError("最多添加 24 个兴趣标签");
      return;
    }
    setKinks((prev) => new Set([...prev, trimmed]));
    setNewKink("");
  };

  const onSave = () => {
    setMessage(null);
    setError(null);
    if (!gender) {
      setError("请先选择性别");
      return;
    }
    const selected = Array.from(kinks);
    startTransition(async () => {
      const res = await updatePreferences({ gender, kinks: selected });
      if (res.ok) {
        setMessage("已保存偏好设置");
        // 保存成功后关闭弹窗，并清除“不再提示”标记（下次仅在偏好为空时才提示）
        try {
          window.localStorage.removeItem("prefModalDismissed");
        } catch {}
        setTimeout(() => setShow(false), 600);
      } else {
        setError(res.error ?? "保存失败");
      }
    });
  };

  const onLater = () => {
    try {
      window.localStorage.setItem("prefModalDismissed", "true");
    } catch {}
    closeModal();
  };

  const genderText = gender === "male" ? "男性" : gender === "female" ? "女性" : gender === "non_binary" ? "非二元" : "未选择";
  const kinksText = Array.from(kinks).join("、") || "未设置";

  if (!mounted) return null;

  return show
    ? createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass rounded-3xl p-6 max-w-md w-full glow-pink max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">偏好设置</h3>
              <button
                onClick={onLater}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all"
                aria-label="稍后设置"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">为了更精准地进行 AI 生成任务，请先完善你的偏好设置。你也可以选择稍后在「我的」中设置。</p>

            <div className="space-y-5">
              <div>
                <div className="mb-3 text-sm font-medium text-white/80">性别（必选）</div>
                <div className="flex gap-2">
                  {[
                    { label: "男", value: "male" as Gender },
                    { label: "女", value: "female" as Gender },
                    { label: "非二元", value: "non_binary" as Gender },
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => setGender(opt.value)}
                      className={
                        "flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 " +
                        (gender === opt.value
                          ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg"
                          : "bg-white/10 text-white hover:bg-white/15 active:scale-[0.98]")
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium text-white/80">偏好关键词（可选）</div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_KINKS.map((k) => {
                    const active = kinks.has(k);
                    return (
                      <button
                        type="button"
                        key={k}
                        onClick={() => toggleKink(k)}
                        className={
                          "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-[0.95] " +
                          (active
                            ? "bg-purple-600 text-white shadow-md"
                            : "bg-white/10 text-white/80 hover:bg-white/15 hover:text-white")
                        }
                        aria-pressed={active}
                      >
                        {k}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={newKink}
                    onChange={(e) => setNewKink(e.target.value)}
                    placeholder="自定义关键词，如：温柔、挑逗、足控..."
                  />
                  <Button variant="outline" onClick={addKink} className="border-white/20 hover:bg-white/10">
                    添加
                  </Button>
                </div>
              </div>

              {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
              {message && <p className="text-sm text-emerald-400 font-medium">{message}</p>}

              <div className="pt-2 flex gap-3">
                <Button onClick={onLater} variant="outline" className="flex-1 border-white/20 hover:bg-white/10">
                  稍后设置
                </Button>
                <Button 
                  onClick={onSave} 
                  disabled={isPending} 
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98]"
                >
                  {isPending ? "保存中..." : "保存偏好"}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;
}