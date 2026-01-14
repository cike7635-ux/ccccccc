
// components\ui\bottom-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Layers, UserCircle } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  // 在登录、认证和游戏页面隐藏底部导航
  const hiddenOnRoutes = ["/login", "/auth", "/game"];
  const shouldHide = hiddenOnRoutes.some((r) => pathname.startsWith(r));
  if (shouldHide) return null;

  const isActive = (path: string) => {
    if (path === "/lobby") return pathname === "/lobby" || pathname.startsWith("/lobby/");
    if (path === "/themes") return pathname === "/themes" || pathname.startsWith("/themes/");
    if (path === "/profile") return pathname === "/profile";
    return false;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/5 backdrop-blur-2xl border-t border-white/10 z-40 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]">
      <div className="max-w-md mx-auto px-8 py-3 flex justify-around">
        <Link
          href="/lobby"
          className={`flex flex-col items-center space-y-1.5 transition-all duration-200 active:scale-95 ${
            isActive("/lobby") ? "text-brand-pink" : "text-white/50 hover:text-white/70"
          }`}
        >
          <div className={`transition-all duration-200 ${isActive("/lobby") ? "scale-110" : ""}`}>
            <LayoutGrid className="w-6 h-6" strokeWidth={isActive("/lobby") ? 2.5 : 2} />
          </div>
          <span className={`text-[11px] ${isActive("/lobby") ? "font-semibold" : "font-medium"}`}>首页</span>
        </Link>
        <Link
          href="/themes"
          className={`flex flex-col items-center space-y-1.5 transition-all duration-200 active:scale-95 ${
            isActive("/themes") ? "text-brand-pink" : "text-white/50 hover:text-white/70"
          }`}
        >
          <div className={`transition-all duration-200 ${isActive("/themes") ? "scale-110" : ""}`}>
            <Layers className="w-6 h-6" strokeWidth={isActive("/themes") ? 2.5 : 2} />
          </div>
          <span className={`text-[11px] ${isActive("/themes") ? "font-semibold" : "font-medium"}`}>主题库</span>
        </Link>
        <Link
          href="/profile"
          className={`flex flex-col items-center space-y-1.5 transition-all duration-200 active:scale-95 ${
            isActive("/profile") ? "text-brand-pink" : "text-white/50 hover:text-white/70"
          }`}
        >
          <div className={`transition-all duration-200 ${isActive("/profile") ? "scale-110" : ""}`}>
            <UserCircle className="w-6 h-6" strokeWidth={isActive("/profile") ? 2.5 : 2} />
          </div>
          <span className={`text-[11px] ${isActive("/profile") ? "font-semibold" : "font-medium"}`}>我的</span>
        </Link>
      </div>
    </div>
  );
}
