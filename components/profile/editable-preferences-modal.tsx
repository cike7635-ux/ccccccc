// /components/profile/editable-preferences-modal.tsx
"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePreferences } from "@/app/profile/actions";
import { X } from "lucide-react";
import { Gender, UserPreferences } from "@/types/preferences";

const SUGGESTED_KINKS: string[] = [
  // 核心身份 / 倾向
  "施虐倾向（S）",
  "受虐倾向（M）",
  "支配方（D）",
  "顺从方（s）",
  "切换者（Switch）",

  // 行为（方向区分）
  "打屁股-施加方（SP）",
  "打屁股-接受方（SP）",

  "捆绑-控制方（Bondage）",
  "捆绑-被控方（Bondage）",

  "调教-引导方（Training）",
  "调教-服从方（Training）",

  // 羞辱（强度清晰）
  "轻度羞辱-施加方",
  "轻度羞辱-接受方",
  "重度羞辱-施加方",
  "重度羞辱-接受方",

  // 疼痛取向（精简直观）
  "恋痛-施加方",
  "恋痛-接受方",

  // 惩罚 / 控制
  "惩罚-制定方",
  "惩罚-接受方",
  "规则控制",
  "许可等待",
  "拒绝与克制",
  "节奏掌控",

  // 关系 / 身份情境
  "主奴关系",
  "宠物扮演",
  "物品化",
  "权力交换",
  "角色扮演",

  // 暴露 / 风险
  "风险暴露-引导方",
  "风险暴露-接受方",

  // 偏好（方向区分，命名直白）
  "足控-支配方",
  "足控-服从方",

  // 感官 / 亲密（易理解）
  "感官刺激",
  "温柔爱抚",
  "挑逗",
  "亲吻强化",
  "敏感触碰",
  "肢体按摩",

  // 外观 / 装扮
  "制服诱惑",
  "情趣内衣",
  "Cosplay",

  // 道具
  "震动玩具",
  "约束道具",
  "遮眼与感官剥夺"
];

interface EditablePreferencesModalProps {
  /** 控制模态框显示 */
  open: boolean;
  /** 关闭模态框的回调 */
  onClose: () => void;
  /** 初始偏好数据 */
  initialPreferences?: UserPreferences;
  /** 保存成功后的回调 */
  onSaved?: (preferences: UserPreferences) => void;
}

export default function EditablePreferencesModal({ 
  open, 
  onClose, 
  initialPreferences = {},
  onSaved 
}: EditablePreferencesModalProps) {
  const [gender, setGender] = useState<Gender | null>(initialPreferences.gender ?? null);
  const [kinks, setKinks] = useState<Set<string>>(new Set(initialPreferences.kinks ?? []));
  const [newKink, setNewKink] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // 确保只在客户端渲染
  useState(() => {
    setMounted(true);
  });

  // 当modal打开或初始偏好变化时重置表单
  useState(() => {
    if (open) {
      setGender(initialPreferences.gender ?? null);
      setKinks(new Set(initialPreferences.kinks ?? []));
      setNewKink("");
      setMessage(null);
      setError(null);
    }
  });

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
        
        // 保存成功后回调
        if (onSaved) {
          onSaved({ gender, kinks: selected });
        }
        
        // 延迟关闭，让用户看到保存成功的消息
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        setError(res.error ?? "保存失败");
      }
    });
  };

  if (!mounted) return null;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="glass rounded-3xl p-6 max-w-md w-full glow-pink max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">编辑偏好设置</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-all"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-4">更新你的偏好设置，以获得更精准的AI生成结果。</p>

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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKink();
                  }
                }}
                placeholder="输入自定义关键词，按回车添加"
                className="flex-1"
              />
              <Button type="button" onClick={addKink} variant="secondary">
                添加
              </Button>
            </div>
            
            {/* 显示已添加的自定义关键词 */}
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
                        className="rounded-full px-2 py-1 text-xs bg-white/10 text-white hover:bg-white/20 transition-colors"
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

          <div className="pt-2 flex gap-3">
            <Button 
              onClick={onClose} 
              variant="outline" 
              className="flex-1 border-white/20 hover:bg-white/10"
            >
              取消
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
  );
}