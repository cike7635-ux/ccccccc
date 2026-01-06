// /app/api/admin/users/ai-limits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 获取所有用户的AI限制
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        nickname,
        custom_daily_limit,
        custom_cycle_limit,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // 获取每个用户的AI使用次数
    const usersWithUsage = await Promise.all(
      (users || []).map(async (user) => {
        const { count } = await supabase
          .from('ai_usage_records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        return {
          ...user,
          ai_usage_count: count || 0
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        users: usersWithUsage
      }
    });

  } catch (error: any) {
    console.error('获取用户AI限制失败:', error);
    return NextResponse.json(
      { error: error.message || '获取失败' },
      { status: 500 }
    );
  }
}