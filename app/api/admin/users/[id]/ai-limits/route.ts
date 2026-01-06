// /app/api/admin/users/[id]/ai-limits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const { dailyLimit, cycleLimit } = await request.json();
    
    // 验证输入
    if (dailyLimit !== null && (dailyLimit < 1 || dailyLimit > 999)) {
      return NextResponse.json(
        { error: '每日限制必须在1-999之间' },
        { status: 400 }
      );
    }
    
    if (cycleLimit !== null && (cycleLimit < 1 || cycleLimit > 9999)) {
      return NextResponse.json(
        { error: '周期限制必须在1-9999之间' },
        { status: 400 }
      );
    }
    
    const supabase = createClient();
    
    // 更新用户限制
    const { error } = await supabase
      .from('profiles')
      .update({
        custom_daily_limit: dailyLimit,
        custom_cycle_limit: cycleLimit,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      message: 'AI使用限制已更新',
      data: {
        dailyLimit,
        cycleLimit
      }
    });
    
  } catch (error: any) {
    console.error('更新AI限制失败:', error);
    return NextResponse.json(
      { error: error.message || '更新失败' },
      { status: 500 }
    );
  }
}