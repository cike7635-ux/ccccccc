import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSystemConfig } from '@/lib/config/system-config';

export async function GET() {
  try {
    const systemConfig = getSystemConfig();
    const [aiLimits, costConfig] = await Promise.all([
      systemConfig.getAIDefaultLimits(),
      systemConfig.getAICostConfig()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        defaultDailyLimit: aiLimits.daily,
        defaultCycleLimit: aiLimits.cycle,
        costPerToken: costConfig.perToken,
        costPerRequest: costConfig.perRequest
      }
    });
    
  } catch (error: any) {
    console.error('获取AI限制配置失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取配置失败' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const systemConfig = getSystemConfig();
    
    // 验证必填字段
    if (body.defaultDailyLimit === undefined || body.defaultCycleLimit === undefined) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 更新配置
    const updates = [
      systemConfig.updateConfig('ai_default_daily_limit', body.defaultDailyLimit, '默认每日AI使用次数限制'),
      systemConfig.updateConfig('ai_default_cycle_limit', body.defaultCycleLimit, '默认30天AI使用次数限制')
    ];

    // 可选更新成本参数
    if (body.costPerToken !== undefined) {
      updates.push(systemConfig.updateConfig('ai_cost_per_token', body.costPerToken, '每个token的成本(元)'));
    }
    
    if (body.costPerRequest !== undefined) {
      updates.push(systemConfig.updateConfig('ai_cost_per_request', body.costPerRequest, '每次AI请求的平均成本(元)'));
    }

    const results = await Promise.all(updates);
    const allSuccess = results.every(result => result === true);

    if (!allSuccess) {
      throw new Error('部分配置更新失败');
    }

    // 获取更新后的配置
    const [aiLimits, costConfig] = await Promise.all([
      systemConfig.getAIDefaultLimits(),
      systemConfig.getAICostConfig()
    ]);

    return NextResponse.json({
      success: true,
      message: 'AI限制配置已更新',
      data: {
        defaultDailyLimit: aiLimits.daily,
        defaultCycleLimit: aiLimits.cycle,
        costPerToken: costConfig.perToken,
        costPerRequest: costConfig.perRequest
      }
    });
    
  } catch (error: any) {
    console.error('更新AI限制配置失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '更新失败' },
      { status: 500 }
    );
  }
}