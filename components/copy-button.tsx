"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function CopyButton({ value, label = "复制" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      // 尝试使用现代 API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        // 降级方案：使用 textarea 确保移动端兼容
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!success) {
          throw new Error('复制失败');
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error('复制失败:', e);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} aria-live="polite">
      {copied ? "已复制" : label}
    </Button>
  );
}