// /app/layout.tsx - 修复版（基于正确布局文件）
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PerformanceMeasurement from '@/components/performance-measurement';
import { BottomNav } from "@/components/ui/bottom-nav";
import { DeviceCheckGuard } from '@/components/device-check-guard';
import { MembershipGuard } from '@/components/membership-guard';
import { ClientOnly } from '@/components/ui/client-only';
import { HeartbeatProvider } from '@/components/heartbeat-provider';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LOVE LUDO",
  description: "情侣互动平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 安全地获取环境变量（避免服务器端错误）
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <meta name="robots" content="noindex, nofollow" />
        <meta httpEquiv="x-ua-compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={`${inter.className} bg-background text-foreground touch-optimized`}>
        {/* 使用客户端包装器包装动态内容 */}
        <ClientOnly>
          {/* 心跳提供者 - 确保心跳机制正常工作 */}
          <HeartbeatProvider />
          
          {/* 设备检查守卫 */}
          <DeviceCheckGuard />
          
          {/* 会员过期检查守卫 */}
          <MembershipGuard />
          
          {/* 导航性能测量组件 */}
          <PerformanceMeasurement />
          
          {/* 主内容区域 */}
          <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 pb-16">
            {children}
          </div>
          
          {/* 底部导航栏 */}
          <BottomNav />
          
          {/* 开发环境调试工具 */}
          {/* {isDevelopment && (
            <div className="fixed bottom-20 right-4 flex flex-col gap-2 z-50">
              <a 
                href="/performance-test" 
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm font-medium"
              >
                <span className="text-lg">🚀</span>
                <span>性能测试</span>
              </a>
            </div>
          )} */}
          
          {/* 生产环境快速访问 */}
          {/* {!isDevelopment && (
            <a 
              href="/performance-test" 
              className="fixed bottom-20 right-4 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm font-medium z-50"
            >
              <span className="text-lg">⚡</span>
              <span>性能</span>
            </a>
          )} */}
        </ClientOnly>
      </body>
    </html>
  );
}