// /app/api/admin/ai-usage/statistics/route.ts - 修复版
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.email) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 管理员验证
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    if (!adminEmails.includes(user.email)) {
      return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
    }

    // 获取AI使用数据
    const { data: usageData } = await supabase
      .from('ai_usage_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    // 计算统计数据
    const totalRequests = usageData?.length || 0;
    const successfulRequests = usageData?.filter(r => r.success).length || 0;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;
    
    let totalTokens = 0;
    let totalCost = 0;
    
    usageData?.forEach(record => {
      const tokensUsed = record.response_data?.tokens_used || 0;
      totalTokens += tokensUsed;
      totalCost += tokensUsed * 0.000002;
    });

    return NextResponse.json({
      success: true,
      data: {
        totalRequests,
        successfulRequests,
        successRate: parseFloat(successRate.toFixed(2)),
        totalTokens,
        totalCost: parseFloat(totalCost.toFixed(4)),
        avgCostPerRequest: totalRequests > 0 ? parseFloat((totalCost / totalRequests).toFixed(4)) : 0,
      },
      meta: {
        generatedAt: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    console.error('AI统计API错误:', error);
    return NextResponse.json(
      { error: error.message || '内部服务器错误' },
      { status: 500 }
    );
  }
}