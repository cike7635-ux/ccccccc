// /app/api/heartbeat/route.ts - 心跳API
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch (error) {
              // 静默处理
            }
          },
        },
      }
    );
    
    // 验证用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: '未认证' }, { status: 401 });
    }
    
    // 解析心跳数据
    const heartbeatData = await request.json();
    const { timestamp, page, userAgent } = heartbeatData;
    
    console.log(`❤️ 心跳接收 - 用户: ${user.email}, 页面: ${page}`);
    
    // ✅ 简单更新profiles表（更新last_login_at保持兼容）
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        last_login_at: now,      // 更新最后活跃时间
        updated_at: now          // 更新时间戳
      })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('❌ 心跳更新失败:', updateError);
      return NextResponse.json(
        { error: '更新失败', details: updateError.message },
        { status: 500 }
      );
    }
    
    // ✅ 返回成功响应
    return NextResponse.json({
      success: true,
      timestamp: now,
      nextHeartbeat: Date.now() + 50000 // 告诉客户端下次心跳时间
    });
    
  } catch (error) {
    console.error('❌ 心跳API异常:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}