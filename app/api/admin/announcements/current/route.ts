import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 创建Supabase客户端（使用匿名密钥）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(request: NextRequest) {
  try {
    const now = new Date().toISOString();

    // 查询当前生效的公告，按优先级排序
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .lte('show_from', now)
      .or(`show_until.is.null,show_until.gte.${now}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    // 如果没有生效的公告，返回空数组
    if (!announcements || announcements.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasAnnouncement: false,
          announcements: []
        }
      });
    }

    // 返回生效的公告
    return NextResponse.json({
      success: true,
      data: {
        hasAnnouncement: true,
        announcements: announcements.map(announcement => ({
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          type: announcement.type,
          priority: announcement.priority,
          showFrom: announcement.show_from,
          showUntil: announcement.show_until
        }))
      }
    });

  } catch (error: any) {
    console.error('获取当前公告失败:', error);
    
    // 出错时返回空数据，避免影响用户体验
    return NextResponse.json({
      success: false,
      data: {
        hasAnnouncement: false,
        announcements: []
      },
      error: error.message || '获取公告失败'
    }, { status: 500 });
  }
}