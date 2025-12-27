"use client";

import { useState, useTransition } from "react";
import { updatePreferences } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Gender = "male" | "female" | "non_binary";

type Props = {
  initialGender?: Gender | null;
  initialKinks?: string[] | null;
};

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

  "轻度羞辱-施加方（Humiliation）",
  "轻度羞辱-接受方（Humiliation）",

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

export default function PreferencesSection({ initialGender, initialKinks }: Props) {
  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState<Gender | null>(initialGender ?? null);
  const [kinks, setKinks] = useState<Set<string>>(new Set(initialKinks ?? []));
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newKink, setNewKink] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const toggleKink = (k: string) => {
    setKinks((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
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
      } else {
        setError(res.error ?? "保存失败");
      }
    });
  };

  const addCustomKink = () => {
    setAddError(null);
    const trimmed = newKink.trim();
    if (!trimmed) {
      setAddError("关键词不能为空");
      return;
    }
    if (trimmed.length > 30) {
      setAddError("关键词不超过30个字符");
      return;
    }
    setKinks((prev) => {
      const next = new Set(prev);
      if (next.has(trimmed)) {
        setAddError("该关键词已存在");
        return prev;
      }
      if (next.size >= 24) {
        setAddError("最多选择24个关键词");
        return prev;
      }
      next.add(trimmed);
      return next;
    });
    setNewKink("");
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 hover:bg-white/10 transition-all duration-200"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <span className="font-semibold text-white">偏好设置</span>
        </div>
        <svg className={`w-5 h-5 text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/10 p-5 space-y-5">
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomKink();
                  }
                }}
                placeholder="输入自定义关键词，按回车添加"
                className="flex-1"
              />
              <Button type="button" onClick={addCustomKink} variant="secondary">添加</Button>
            </div>
            {addError && <p className="mt-2 text-xs text-red-400">{addError}</p>}

            {Array.from(kinks).filter((k) => !SUGGESTED_KINKS.includes(k)).length > 0 && (
              <div className="mt-3">
                <div className="mb-2 text-xs text-white/70">已添加的自定义关键词</div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(kinks)
                    .filter((k) => !SUGGESTED_KINKS.includes(k))
                    .map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggleKink(k)}
                        className="rounded-full px-2 py-1 text-xs bg-white/10 text-white hover:bg-white/20"
                        aria-label={`移除 ${k}`}
                        title="点击移除"
                      >
                        {k} <span className="ml-1">×</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400 font-medium">{error}</p>}
          {message && <p className="text-sm text-emerald-400 font-medium">{message}</p>}

          <div className="pt-2">
            <Button 
              onClick={onSave} 
              disabled={isPending} 
              className="w-full h-12 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98]"
            >
              {isPending ? "保存中..." : "保存偏好"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}