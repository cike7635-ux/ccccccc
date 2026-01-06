// /app/api/admin/settings/ai-limits/route.ts
import { NextRequest, NextResponse } from 'next/server';

// 临时存储（生产环境应该使用数据库）
let aiLimits = {
  defaultDailyLimit: 10,
  defaultCycleLimit: 120,
  costPerToken: 0.000001405,
  costPerRequest: 0.00307465
};

export async function GET() {
  return NextResponse.json({
    success: true,
    data: aiLimits
  });
}

export async function PUT(request: NextRequest) {
  try {
    const newLimits = await request.json();
    aiLimits = { ...aiLimits, ...newLimits };
    
    // 注意：还需要更新AI生成API中的默认值逻辑
    // /app/api/generate-tasks/route.ts 中的 checkAIUsage 函数
    
    return NextResponse.json({
      success: true,
      message: 'AI限制配置已更新',
      data: aiLimits
    });
    
  } catch (error: any) {
    console.error('更新AI限制配置失败:', error);
    return NextResponse.json(
      { error: error.message || '更新失败' },
      { status: 500 }
    );
  }
}