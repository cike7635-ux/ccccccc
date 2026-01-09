// /app/api/admin/settings/clear-cache/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSystemConfig } from '@/lib/config/system-config';

export async function POST(request: NextRequest) {
  try {
    const systemConfig = getSystemConfig();
    
    // 清理配置缓存
    systemConfig.clearCache();
    
    console.log('🧹 配置缓存已清理');
    
    return NextResponse.json({
      success: true,
      message: '配置缓存已清理',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('清理配置缓存失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '清理缓存失败',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}