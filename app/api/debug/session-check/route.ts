// /app/api/debug/session-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    
    // 获取当前会话
    const { data: { session } } = await supabase.auth.getSession();
    
    // 生成会话标识
    const currentSessionId = session ? `sess_${user.id}_${session.access_token.substring(0, 12)}` : '无会话';
    
    // 获取数据库中的会话
    const { data: profile } = await supabase
      .from('profiles')
      .select('last_login_session, last_login_at')
      .eq('id', user.id)
      .single();
    
    // 检查匹配
    const sessionMatches = profile?.last_login_session === currentSessionId;
    
    return NextResponse.json({
      用户: user.email,
      当前会话标识: currentSessionId,
      存储的会话标识: profile?.last_login_session || '空',
      最后活动时间: profile?.last_login_at || '空',
      会话是否匹配: sessionMatches,
      匹配详情: {
        存储长度: profile?.last_login_session?.length || 0,
        当前长度: currentSessionId.length,
        存储内容: profile?.last_login_session,
        当前内容: currentSessionId
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}