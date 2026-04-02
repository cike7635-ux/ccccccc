// /app/admin/page.tsx - 优化尺寸版本
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Key, Eye, EyeOff, Shield, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/admin/dashboard';

  // 强制设置全屏样式
  useEffect(() => {
    const hideElements = () => {
      const selectors = [
        'nav',
        'footer',
        '[class*="nav"]',
        '[class*="Nav"]',
        '[class*="bottom"]',
        '[class*="Bottom"]',
        '[class*="footer"]',
        '[role="navigation"]',
        'header'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          (el as HTMLElement).style.display = 'none';
        });
      });
    };
    
    const setFullscreenStyles = () => {
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.bottom = '0';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
      document.body.style.backgroundColor = '#0a0a12';
      
      document.documentElement.style.height = '100%';
      document.documentElement.style.overflow = 'hidden';
      
      const root = document.getElementById('__next');
      if (root) {
        root.style.height = '100%';
      }
    };
    
    hideElements();
    setFullscreenStyles();
    
    // 清理函数
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.bottom = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.overflow = '';
      document.body.style.backgroundColor = '';
      
      document.documentElement.style.height = '';
      document.documentElement.style.overflow = '';
      
      const root = document.getElementById('__next');
      if (root) {
        root.style.height = '';
      }
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 验证管理员密钥
      if (adminKey !== process.env.NEXT_PUBLIC_ADMIN_KEY && 
          adminKey !== process.env.ADMIN_KEY) {
        throw new Error('管理员密钥错误');
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('请输入有效的邮箱地址');
      }

      // 模拟登录验证（实际项目中应该调用后端API）
      if (email && password) {
        // 这里只是模拟，实际项目应该调用真实的登录API
        const mockLoginSuccess = true;
        
        if (mockLoginSuccess) {
          // 修复安全漏洞：将cookie路径从'/admin'改为'/'，确保中间件能正确读取
          document.cookie = 'admin_key_verified=true; path=/; max-age=86400; SameSite=Strict';
          document.cookie = `admin_email=${email}; path=/; max-age=86400; SameSite=Strict`;
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
          router.push(redirectTo);
          router.refresh();
        } else {
          throw new Error('登录失败，请检查凭据');
        }
      } else {
        throw new Error('请填写所有字段');
      }

    } catch (err: any) {
      setError(err.message || '登录失败，请检查凭据');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex items-center justify-center w-full h-full min-h-screen p-4"
      style={{
        background: 'linear-gradient(180deg, #0a0a12 0%, #12101a 50%, #1a0f1f 100%)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        margin: 0,
        overflow: 'auto'
      }}
    >
      <div className="w-full max-w-md">
        {/* 标题区域 - 适当缩小 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-pink to-brand-rose rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">系统管理员登录</h1>
          <p className="text-gray-400 text-sm">仅限授权管理员访问后台系统</p>
        </div>

        {/* 表单区域 - 整体缩小 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50">
          <form onSubmit={handleLogin} className="space-y-4">
            {/* 邮箱输入 */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">管理员邮箱</label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="输入管理员邮箱"
                  className="w-full pl-10 pr-3 py-3 bg-gray-900/50 rounded-lg border border-gray-700 text-white placeholder-gray-500 text-base outline-none focus:border-brand-pink transition-colors"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">密码</label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                  className="w-full pl-10 pr-10 py-3 bg-gray-900/50 rounded-lg border border-gray-700 text-white placeholder-gray-500 text-base outline-none focus:border-brand-pink transition-colors"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute right-3 p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* 管理员密钥输入 */}
            <div>
              <label className="block text-sm text-gray-300 mb-2">管理员密钥</label>
              <div className="relative flex items-center">
                <Key className="absolute left-3 w-5 h-5 text-gray-400" />
                <input
                  type={showAdminKey ? "text" : "password"}
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="输入管理员密钥"
                  className="w-full pl-10 pr-10 py-3 bg-gray-900/50 rounded-lg border border-gray-700 text-white placeholder-gray-500 text-base outline-none focus:border-brand-pink transition-colors"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowAdminKey(!showAdminKey)}
                  disabled={loading}
                  className="absolute right-3 p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  aria-label={showAdminKey ? "隐藏密钥" : "显示密钥"}
                >
                  {showAdminKey ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                请联系系统管理员获取密钥
              </p>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center text-red-400">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-brand-pink to-brand-rose text-white py-3 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center hover:opacity-90 transition-opacity text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  验证中...
                </>
              ) : (
                '进入后台管理系统'
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-700 text-center">
            <p className="text-sm text-gray-500">
              不是管理员？{' '}
              <Link href="/"
                className="text-brand-pink hover:underline transition-colors"
              >
                返回首页
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 主组件
const AdminPage = () => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 mx-auto text-brand-pink animate-spin" />
          <p className="mt-4 text-gray-400">加载中...</p>
        </div>
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  );
};

export default AdminPage;