// /app/api/admin/settings/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 临时存储配置（生产环境应该使用数据库）
let systemConfig = {
  adminEmails: ['2200691917@qq.com'],
  systemMode: 'production',
  maintenanceMessage: '系统维护中，请稍后再试',
  enableApiLogging: true,
  enableErrorAlerts: true,
  alertEmail: '2200691917@qq.com'
};

export async function GET() {
  return NextResponse.json({
    success: true,
    data: systemConfig
  });
}

export async function PUT(request: NextRequest) {
  try {
    const newConfig = await request.json();
    systemConfig = { ...systemConfig, ...newConfig };
    
    return NextResponse.json({
      success: true,
      message: '系统配置已更新',
      data: systemConfig
    });
    
  } catch (error: any) {
    console.error('更新系统配置失败:', error);
    return NextResponse.json(
      { error: error.message || '更新失败' },
      { status: 500 }
    );
  }
}