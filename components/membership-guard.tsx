// /components/membership-guard.tsx - 会员过期检查守卫组件
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function MembershipGuard() {
  const pathname = usePathname();
  
  useEffect(() => {
    // 只在受保护页面检查（排除登录、过期页面等）
    const excludedPaths = ['/login', '/account-expired', '/renew', '/'];
    const isExcludedPath = excludedPaths.some(path => pathname.startsWith(path));
    
    if (isExcludedPath) return;
    
    // 创建一个全局的会员状态检查函数
    const checkMembershipStatus = async () => {
      try {
        const response = await fetch('/api/auth/check-login-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            isLoginPage: false,
            redirectPath: pathname
          })
        });
        
        if (response.redirected) {
          // API返回了重定向到会员过期页面
          console.log('🔒 会员已过期，重定向到过期页面');
          window.location.href = response.url;
          return;
        }
        
        const result = await response.json();
        
        if (!result.loggedIn) {
          // 用户未登录，重定向到登录页
          console.log('🔒 用户未登录，重定向到登录页');
          window.location.href = '/login';
          return;
        }
        
        console.log('✅ 会员状态正常');
        
      } catch (error) {
        console.error('会员状态检查失败:', error);
        // 出错时不做处理，避免影响用户体验
      }
    };
    
    // 页面加载时检查
    checkMembershipStatus();
    
    // 监听页面可见性变化（用户切换回标签页时检查）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkMembershipStatus();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 每30秒检查一次会员状态
    const interval = setInterval(checkMembershipStatus, 30000);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname]);
  
  return null;
}