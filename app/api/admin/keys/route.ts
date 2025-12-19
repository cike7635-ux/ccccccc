// /app/api/admin/keys/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { customAlphabet } from 'nanoid';

// 生成易读的密钥格式：CPFLY-XXXX-XXXX
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉了容易混淆的字符
const generateKeyCode = customAlphabet(alphabet, 8); // 生成8位字符

export async function GET(request: NextRequest) {
  // 简单身份验证：检查是否是管理员（这里假设你的用户ID是已知的）
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  
  // 这里可以添加更严格的管理员检查
  
  // 获取所有密钥
  const { data, error } = await supabase
    .from('access_keys')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }
  
  const body = await request.json();
  
  // 生成密钥代码：CPFLY-XXXX-XXXX 格式
  const keyCode = `CPFLY-${generateKeyCode().match(/.{1,4}/g)?.join('-')}`;
  
  // 计算密钥过期时间（如果指定了有效期）
  const keyExpiresAt = body.keyExpiresDays 
    ? new Date(Date.now() + body.keyExpiresDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  
  // 插入数据库
  const { data, error } = await supabase
    .from('access_keys')
    .insert({
      key_code: keyCode,
      description: body.description,
      max_uses: body.maxUses,
      used_count: 0,
      key_expires_at: keyExpiresAt,
      account_valid_for_days: body.validDays,
      created_by: user.id,
      is_active: true,
    })
    .select()
    .single();
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ key: keyCode, ...data });
}
