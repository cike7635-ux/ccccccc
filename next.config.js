/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 启用现代图片格式支持
    formats: ['image/avif', 'image/webp'],
    // 设备尺寸优化
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 禁用不必要的图片优化警告
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // 优化构建输出
  poweredByHeader: false,
  
  // 启用静态资源优化
  trailingSlash: false,
  
  // 优化生产构建
  productionBrowserSourceMaps: false,
  
  // 优化静态生成
  staticPageGenerationTimeout: 60,
  
  // 服务器外部包配置 - 添加 Supabase 相关包
  serverExternalPackages: ['@supabase/supabase-js', '@supabase/realtime-js'],
  
  // 忽略构建期间的ESLint错误
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // 忽略构建期间的TypeScript错误
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;