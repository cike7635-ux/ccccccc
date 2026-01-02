// /app/admin/ai-usage/layout.tsx
import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from './components/Shared/AdminSidebar';
import { AdminHeader } from './components/Shared/AdminHeader';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI使用统计管理系统',
  description: 'LOVE LUDO AI功能使用统计与分析管理系统',
  keywords: ['AI统计', '数据分析', '用户分析', '密钥管理', '后台管理'],
};

export default function AIUsageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SidebarProvider>
            <div className="flex min-h-screen">
              <AdminSidebar />
              <div className="flex-1">
                <AdminHeader />
                <main className="p-6">
                  {children}
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster 
            position="top-right"
            toastOptions={{
              className: 'font-sans',
              duration: 4000,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}