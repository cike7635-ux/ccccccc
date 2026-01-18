// /hooks/use-heartbeat.ts - 心跳钩子（50秒间隔）
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// 心跳间隔（50秒）
const HEARTBEAT_INTERVAL = 50000;

export function useHeartbeat() {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(0);
  const pathname = usePathname();
  
  // 判断当前页面是否需要心跳
  const shouldSendHeartbeat = () => {
    // 只在游戏相关页面启用心跳
    const gamePaths = ['/lobby', '/game', '/profile', '/themes', '/game-history'];
    const isGamePath = gamePaths.some(path => pathname.startsWith(path));
    
    // 页面可见时才发送心跳
    const isVisible = document.visibilityState === 'visible';
    
    return isGamePath && isVisible;
  };
  
  useEffect(() => {
    // 心跳函数
    const sendHeartbeat = async () => {
      if (!shouldSendHeartbeat()) return;
      
      const now = Date.now();
      
      // 防抖：确保至少间隔45秒
      if (now - lastHeartbeatRef.current < 45000) {
        return;
      }
      
      try {
        console.log('❤️ 发送心跳请求');
        
        const response = await fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp: now,
            page: pathname,
            userAgent: navigator.userAgent.slice(0, 100)
          })
        });
        
        if (response.ok) {
          lastHeartbeatRef.current = now;
          console.log('✅ 心跳成功');
        } else {
          console.warn('⚠️ 心跳请求失败:', response.status);
        }
      } catch (error) {
        console.error('❌ 心跳请求异常:', error);
      }
    };
    
    // 立即发送第一次心跳
    sendHeartbeat();
    
    // 设置定时器
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    
    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面变为可见时，立即发送心跳
        sendHeartbeat();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 清理函数
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname]);
}