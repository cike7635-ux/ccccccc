// /components/device-check-guard.tsx - 设备检查守卫组件（简化版）
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function DeviceCheckGuard() {
  const pathname = usePathname();
  
  useEffect(() => {
    // 只在受保护页面检查
    const protectedPaths = ['/lobby', '/game', '/profile', '/themes', '/feedback'];
    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
    
    if (!isProtectedPath) return;
    
    // 创建一个全局的检查函数
    const checkDevice = async () => {
      try {
        const response = await fetch('/api/device-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        
        if (response.status === 403) {
          // 设备不匹配，立即重定向
          const data = await response.json();
          console.log('🔒 设备检查失败:', data.reason);
          window.location.href = `/login/expired?reason=device_kicked&email=${encodeURIComponent(data.email || '')}`;
          return;
        }
      } catch (error) {
        console.error('设备检查失败:', error);
      }
    };
    
    // 页面加载时检查
    checkDevice();
    
    // 监听页面可见性变化（用户切换回标签页时检查）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkDevice();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 每15秒检查一次
    const interval = setInterval(checkDevice, 15000);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname]);
  
  return null;
}