// /app/admin/page.tsx - 修复构建错误版本
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Key, Eye, EyeOff, Shield, AlertCircle, Loader2 } from 'lucide-react';

// 创建内部组件，用于在Suspense中使用useSearchParams
function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/admin/dashboard';

  // 页面初始化 - 移除所有导航栏和底部元素
  useEffect(() => {
    console.log('🔍 管理员登录页面加载');
    
    // 强制设置页面样式
    const style = document.createElement('style');
    style.textContent = `
      /* 全局强制样式 */
      * {
        box-sizing: border-box;
      }
      
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
        background: linear-gradient(180deg, #0a0a12 0%, #12101a 50%, #1a0f1f 100%) !important;
        background-attachment: fixed !important;
      }
      
      /* 隐藏所有导航相关元素 */
      nav, footer, [class*="nav"], [class*="Nav"], [class*="bottom"], [class*="Bottom"], 
      [role="navigation"], [class*="menu"], [class*="Menu"], [class*="tabbar"], [class*="tab-bar"],
      [class*="tab"], [class*="Tab"] {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: absolute !important;
        z-index: -9999 !important;
      }
      
      /* 确保没有滚动条 */
      ::-webkit-scrollbar {
        display: none !important;
      }
      
      /* 隐藏任何固定定位的元素 */
      .fixed, .sticky, [style*="fixed"], [style*="sticky"] {
        display: none !important;
      }
      
      /* 旋转动画 */
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      /* 脉冲动画 */
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
    
    document.documentElement.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    
    // 设置背景
    document.body.style.background = 'linear-gradient(180deg, #0a0a12 0%, #12101a 50%, #1a0f1f 100%)';
    document.body.style.backgroundAttachment = 'fixed';
    
    // 隐藏所有导航元素
    const hideNavigationElements = () => {
      // 隐藏所有可能的导航栏
      const elementsToHide = [
        ...document.querySelectorAll('nav'),
        ...document.querySelectorAll('footer'),
        ...document.querySelectorAll('[class*="nav"]'),
        ...document.querySelectorAll('[class*="Nav"]'),
        ...document.querySelectorAll('[class*="bottom"]'),
        ...document.querySelectorAll('[class*="Bottom"]'),
        ...document.querySelectorAll('[role="navigation"]'),
        ...document.querySelectorAll('[class*="menu"]'),
        ...document.querySelectorAll('[class*="Menu"]'),
        ...document.querySelectorAll('[class*="tab"]'),
        ...document.querySelectorAll('[class*="Tab"]'),
      ];
      
      elementsToHide.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.position = 'absolute';
          el.style.opacity = '0';
        }
      });
      
      // 隐藏任何带有特定类名的元素
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        const className = el.className;
        if (typeof className === 'string') {
          const lowerClassName = className.toLowerCase();
          if (lowerClassName.includes('nav') || 
              lowerClassName.includes('bottom') || 
              lowerClassName.includes('tabbar') ||
              lowerClassName.includes('tab-bar') ||
              lowerClassName.includes('menu')) {
            (el as HTMLElement).style.display = 'none';
          }
        }
      });
    };
    
    // 立即执行一次
    hideNavigationElements();
    
    // 设置多个定时器确保导航栏被隐藏
    const timers = [
      setTimeout(hideNavigationElements, 50),
      setTimeout(hideNavigationElements, 200),
      setTimeout(hideNavigationElements, 500),
      setTimeout(hideNavigationElements, 1000),
    ];
    
    // 监听DOM变化
    const observer = new MutationObserver(() => {
      hideNavigationElements();
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    
    // 清理函数
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      observer.disconnect();
      document.head.removeChild(style);
      
      // 恢复滚动
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. 验证管理员密钥
      const requiredAdminKey = process.env.NEXT_PUBLIC_ADMIN_KEY;
      
      if (!requiredAdminKey) {
        throw new Error('系统配置错误：管理员密钥未设置');
      }
      
      if (adminKey !== requiredAdminKey) {
        throw new Error('管理员密钥错误');
      }

      // 2. 验证管理员邮箱
      const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['2200691917@qq.com'];
      const emailLower = email.trim().toLowerCase();
      const isAdmin = adminEmails.some(adminEmail => 
        adminEmail.trim().toLowerCase() === emailLower
      );
      
      if (!isAdmin) {
        throw new Error('非管理员邮箱');
      }

      // 3. 登录 Supabase
      const { createBrowserClient } = await import('@supabase/ssr');
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) throw signInError;

      // 设置管理员密钥验证标记cookie
      document.cookie = 'admin_key_verified=true; path=/admin; max-age=86400; SameSite=Strict';
      
      // 等待cookie设置完成
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('✅ 管理员登录成功，跳转到仪表板');
      router.push(redirectTo);
      router.refresh();

    } catch (err: any) {
      console.error('❌ 管理员登录失败:', err);
      setError(err.message || '登录失败，请检查凭据');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="admin-login-container"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'linear-gradient(180deg, #0a0a12 0%, #12101a 50%, #1a0f1f 100%)',
        backgroundAttachment: 'fixed',
        overflow: 'hidden',
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '9999'
      }}
    >
      <div 
        className="login-form-container"
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            background: 'linear-gradient(135deg, #ff6b9d, #ff4d8d)',
            borderRadius: '16px',
            marginBottom: '16px',
            boxShadow: '0 4px 20px rgba(255, 107, 157, 0.2)'
          }}>
            <Shield style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '8px',
            background: 'linear-gradient(90deg, #ff6b9d, #ff4d8d, #ff6b9d)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent'
          }}>
            系统管理员登录
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            仅限授权管理员访问后台系统
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 邮箱输入 */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '8px'
            }}>
              管理员邮箱
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              padding: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Mail style={{ width: '18px', height: '18px', color: 'rgba(255, 255, 255, 0.4)', marginRight: '10px' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="输入管理员邮箱"
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: '14px'
                }}
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* 密码输入 */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '8px'
            }}>
              密码
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              padding: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Lock style={{ width: '18px', height: '18px', color: 'rgba(255, 255, 255, 0.4)', marginRight: '10px' }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码"
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: '14px'
                }}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.4)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  opacity: loading ? 0.5 : 1
                }}
              >
                {showPassword ? (
                  <EyeOff style={{ width: '18px', height: '18px' }} />
                ) : (
                  <Eye style={{ width: '18px', height: '18px' }} />
                )}
              </button>
            </div>
          </div>

          {/* 管理员密钥输入 */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '8px'
            }}>
              管理员密钥
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginLeft: '4px' }}>
                （必须输入正确的密钥）
              </span>
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              padding: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <Key style={{ width: '18px', height: '18px', color: 'rgba(255, 255, 255, 0.4)', marginRight: '10px' }} />
              <input
                type={showAdminKey ? "text" : "password"}
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="输入管理员密钥"
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'white',
                  fontSize: '14px'
                }}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowAdminKey(!showAdminKey)}
                disabled={loading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.4)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  padding: '4px',
                  opacity: loading ? 0.5 : 1
                }}
              >
                {showAdminKey ? (
                  <EyeOff style={{ width: '18px', height: '18px' }} />
                ) : (
                  <Eye style={{ width: '18px', height: '18px' }} />
                )}
              </button>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '8px',
              fontSize: '12px'
            }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                联系系统管理员获取密钥
              </span>
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '500',
                backgroundColor: process.env.NEXT_PUBLIC_ADMIN_KEY 
                  ? 'rgba(34, 197, 94, 0.2)' 
                  : 'rgba(239, 68, 68, 0.2)',
                color: process.env.NEXT_PUBLIC_ADMIN_KEY 
                  ? 'rgb(74, 222, 128)' 
                  : 'rgb(248, 113, 113)'
              }}>
                {process.env.NEXT_PUBLIC_ADMIN_KEY ? '密钥已配置' : '密钥未配置'}
              </span>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '12px',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', color: 'rgb(248, 113, 113)' }}>
                <AlertCircle style={{ width: '16px', height: '16px', marginRight: '8px', flexShrink: 0 }} />
                <span style={{ fontSize: '14px' }}>{error}</span>
              </div>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(90deg, #ff6b9d, #ff4d8d)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 8px 24px rgba(255, 107, 157, 0.2)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseOut={(e) => {
              if (!loading) e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseDown={(e) => {
              if (!loading) e.currentTarget.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              if (!loading) e.currentTarget.style.transform = 'scale(1.02)';
            }}
          >
            {loading ? (
              <>
                <div style={{ 
                  width: '18px', 
                  height: '18px', 
                  marginRight: '8px', 
                  border: '2px solid white',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                验证中...
              </>
            ) : (
              '进入后台管理系统'
            )}
          </button>
        </form>

        {/* 底部链接 */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center'
        }}>
          <a
            href="/login"
            style={{
              fontSize: '14px',
              color: '#ff6b9d',
              textDecoration: 'none',
              transition: 'color 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#ff4d8d'}
            onMouseOut={(e) => e.currentTarget.style.color = '#ff6b9d'}
          >
            返回普通用户登录
          </a>
        </div>

        {/* 版本信息 */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>
            Love Ludo 后台管理系统 v1.0 · 希夷游戏
          </p>
        </div>
      </div>
    </div>
  );
}

// 主组件
export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #0a0a12 0%, #12101a 50%, #1a0f1f 100%)',
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '9999'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            background: 'linear-gradient(135deg, #ff6b9d, #ff4d8d)',
            borderRadius: '16px',
            marginBottom: '16px'
          }}>
            <Shield style={{ 
              width: '28px', 
              height: '28px', 
              color: 'white',
              animation: 'pulse 1.5s infinite'
            }} />
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '8px',
            background: 'linear-gradient(90deg, #ff6b9d, #ff4d8d, #ff6b9d)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent'
          }}>
            系统管理员登录
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            加载中...
          </p>
        </div>
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  );
}
