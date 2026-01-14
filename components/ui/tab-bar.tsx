// components\ui\tab-bar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
};

const tabs: TabItem[] = [
  { href: "/", label: "首页" },
  { href: "/themes", label: "主题库" },
  { href: "/profile", label: "我的" },
];

export default function TabBar() {
  const pathname = usePathname();

  // 在登录、认证和游戏页面隐藏底部导航
  const hiddenOnRoutes = ["/login", "/auth", "/game"];
  const shouldHide = hiddenOnRoutes.some((r) => pathname.startsWith(r));
  if (shouldHide) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-900/70 backdrop-blur supports-[backdrop-filter]:bg-slate-900/50">
      <ul className="mx-auto flex max-w-md items-center justify-between px-4 py-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={
                  "flex h-10 w-24 flex-col items-center justify-center rounded-md text-xs transition-colors " +
                  (active ? "text-white" : "text-slate-300 hover:text-white")
                }
                aria-current={active ? "page" : undefined}
              >
                {/* 简洁的内联图标，占位 */}
                <span
                  className={
                    "mb-1 inline-block h-5 w-5 rounded " +
                    (active ? "bg-indigo-400" : "bg-slate-500")
                  }
                />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}