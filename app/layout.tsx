// /app/layout.tsx - 修复版（基于正确布局文件）
import type { Metadata } from "next";
import "./globals.css";
import PerformanceMeasurement from '@/components/performance-measurement';
import { ConditionalBottomNav } from "@/components/conditional-bottom-nav";
import { MainContentWrapper } from "@/components/main-content-wrapper";
import { DeviceCheckGuard } from '@/components/device-check-guard';
import { MembershipGuard } from '@/components/membership-guard';
import { ClientOnly } from '@/components/ui/client-only';
import { HeartbeatProvider } from '@/components/heartbeat-provider';

export const metadata: Metadata = {
  title
    : "希夷书斋 - 让每一次互动都充满爱意",
  description
    : "异地情侣专属飞行棋互动平台，通过创意游戏增进感情，记录甜蜜时刻。希夷书斋，专注于为情侣创造浪漫的互动体验",
  keywords
    : [
      "希夷书斋",
      "情侣飞行棋",
      "情侣互动",
      "异地恋双人游戏",
      "浪漫约会",
      "增进感情",
      "情侣游戏平台",
      "恋爱互动"
    ],
  authors
    : [{ name: "希夷书斋" }],
  creator
    : "希夷书斋",
  publisher
    : "希夷书斋",
  formatDetection
    : {
    email
      : false,
    address
      : false,
    telephone
      : false,
  },
  icons: {
    // 浏览器标签图标（使用PNG文件）
    icon: [
      {
        url: '/favicon-16x16.png',
        type: 'image/png',
        sizes: '16x16'
      },
      {
        url: '/favicon-32x32.png',
        type: 'image/png',
        sizes: '32x32'
      },
      {
        url: '/favicon.ico',
        type: 'image/x-icon',
        sizes: 'any'
      }
    ],

    // 苹果设备图标
    apple: [
      {
        url: '/apple-touch-icon.png',
        type: 'image/png',
        sizes: '180x180'
      }
    ],

    // 快捷方式图标
    shortcut: [
      {
        url: '/favicon.ico',
        type: 'image/x-icon'
      }
    ]
  },
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
      <body className="bg-background text-foreground touch-optimized">
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
          <MainContentWrapper>
            {children}
          </MainContentWrapper>

          {/* 底部导航栏 */}
          <ConditionalBottomNav />

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