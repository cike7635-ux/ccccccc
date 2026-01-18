// /hooks/use-device-check.ts - 客户端设备检查钩子
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function useDeviceCheck() {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  
  useEffect(() => {
    // 只在受保护页面检查
    const protectedPaths = ['/lobby', '/game', '/profile', '/themes', '/feedback'];
    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
    
    if (!isProtectedPath) {
      setIsChecking(false);
      return;
    }
    
    const checkDevice = async () => {
      try {
        const response = await fetch('/api/device-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status === 403) {
          // 设备不匹配，重定向到结束会话页面
          const data = await response.json();
          console.log('❌ 设备检查失败:', data.reason);
          router.push('/login/expired?reason=device_kicked');
          return;
        }
        
        if (!response.ok) {
          console.error('设备检查请求失败:', response.status);
        }
      } catch (error) {
        console.error('设备检查异常:', error);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkDevice();
    
    // 每30秒检查一次设备状态
    const interval = setInterval(checkDevice, 30000);
    
    return () => clearInterval(interval);
  }, [pathname, router]);
  
  return { isChecking };
}