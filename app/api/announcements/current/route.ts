import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 使用匿名密钥，不需要管理员权限
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  console.log('📢 公告API被调用');
  
  try {
    const now = new Date().toISOString();
    console.log('📢 当前时间:', now);

    // 查询当前生效的公告
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('id, title, content, type, priority, show_from, show_until, updated_at, is_active')
      .eq('is_active', true)
      .lte('show_from', now)
      .or(`show_until.is.null,show_until.gte.${now}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('📢 数据库查询错误:', error);
      throw error;
    }

    console.log('📢 数据库查询结果:', {
      count: announcements?.length || 0,
      announcements: announcements
    });

    // 如果没有生效公告，返回空数组
    if (!announcements || announcements.length === 0) {
      console.log('📢 没有生效的公告');
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // 返回公告数据
    return NextResponse.json({
      success: true,
      data: announcements,
      count: announcements.length,
      timestamp: now
    });

  } catch (error: any) {
    console.error('📢 获取公告失败:', error);
    
    // 错误时返回空数组，不影响用户体验
    return NextResponse.json({
      success: false,
      data: [],
      error: error.message || '获取公告失败',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// 设置动态渲染
export const dynamic = 'force-dynamic';