// app\layout.tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { BottomNav } from "@/components/ui/bottom-nav";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "情侣飞行棋 | Love Game",
  description: "情侣互动游戏：双主题任务、实时对战、AI任务生成",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${GeistSans.className} antialiased bg-background text-foreground`}>
  <ThemeProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
  >
    <div className="pb-16">{children}</div>
    <BottomNav />
  </ThemeProvider>
</body>
    </html>
  );
}
