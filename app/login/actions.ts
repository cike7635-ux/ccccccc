// 在登录成功后添加预加载
export async function loginUser(formData: FormData) {
  try {
    // ... 原有登录逻辑
    
    // 🔥 登录成功后智能预加载主题数据
    if (user) {
      // 使用更智能的预加载策略
      const preloadThemes = async () => {
        try {
          console.log('🎯 开始预加载主题数据...');
          
          // 使用GET请求预加载（更符合REST规范）
          const response = await fetch('/api/themes/preload', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`🎯 主题预加载成功: ${result.themesCount} 个主题`);
          } else {
            console.warn('主题预加载失败，状态码:', response.status);
          }
        } catch (error) {
          // 静默失败，不影响主流程
          console.warn('主题预加载异常:', error);
        }
      };
      
      // 智能延迟预加载策略
      if (typeof window !== 'undefined') {
        // 客户端环境：使用requestIdleCallback优化性能
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => {
            setTimeout(preloadThemes, 500); // 空闲时延迟500ms执行
          });
        } else {
          // 降级方案：延迟1秒执行
          setTimeout(preloadThemes, 1000);
        }
      } else {
        // 服务端环境：立即执行
        preloadThemes();
      }
    }
    
    return { data: user, error: null };
  } catch (error) {
    return { data: null, error: error.message };
  }
}