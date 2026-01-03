// // /app/api/admin/ai-usage/keys/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { createClient } from '@/lib/supabase/server';

// // 生成密钥
// export async function POST(request: NextRequest) {
//   try {
//     const supabase = createClient();
//     const { data: { user }, error: authError } = await supabase.auth.getUser();
    
//     if (authError || !user) {
//       return NextResponse.json({ error: '未授权' }, { status: 401 });
//     }

//     // 验证管理员权限
//     const { data: profile } = await supabase
//       .from('profiles')
//       .select('email')
//       .eq('id', user.id)
//       .single();
      
//     const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
//     if (!profile || !adminEmails.includes(profile.email)) {
//       return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
//     }

//     const body = await request.json();
    
//     // 验证输入
//     const { keyCode, keyType, incrementAmount, durationDays, maxUses = 1, isActive = true, description } = body;
    
//     if (!keyCode || !keyType || !incrementAmount) {
//       return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
//     }

//     // 插入密钥
//     const { data, error } = await supabase
//       .from('ai_boost_keys')
//       .insert({
//         key_code: keyCode,
//         boost_type: keyType,
//         increment_amount: incrementAmount,
//         duration_days: durationDays,
//         max_uses: maxUses,
//         is_active: isActive,
//         description,
//         created_by: user.id,
//       })
//       .select()
//       .single();

//     if (error) {
//       console.error('插入密钥失败:', error);
//       return NextResponse.json({ error: '创建密钥失败' }, { status: 500 });
//     }

//     return NextResponse.json(data);
//   } catch (error: any) {
//     console.error('生成密钥失败:', error);
//     return NextResponse.json(
//       { error: error.message || '生成密钥失败' },
//       { status: 500 }
//     );
//   }
// }

// // 获取密钥列表
// export async function GET(request: NextRequest) {
//   try {
//     const supabase = createClient();
//     const { data: { user }, error: authError } = await supabase.auth.getUser();
    
//     if (authError || !user) {
//       return NextResponse.json({ error: '未授权' }, { status: 401 });
//     }

//     // 验证管理员权限
//     const { data: profile } = await supabase
//       .from('profiles')
//       .select('email')
//       .eq('id', user.id)
//       .single();
      
//     const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
//     if (!profile || !adminEmails.includes(profile.email)) {
//       return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
//     }

//     const { searchParams } = new URL(request.url);
//     const status = searchParams.get('status');
//     const keyType = searchParams.get('keyType');
//     const limit = parseInt(searchParams.get('limit') || '50');
//     const offset = parseInt(searchParams.get('offset') || '0');

//     let query = supabase
//       .from('ai_boost_keys')
//       .select(`
//         *,
//         profiles:used_by_user_id(email, nickname),
//         creator:created_by(email, nickname)
//       `)
//       .order('created_at', { ascending: false })
//       .range(offset, offset + limit - 1);

//     // 应用筛选条件
//     if (status === 'active') {
//       query = query.eq('is_active', true);
//     } else if (status === 'used') {
//       query = query.not('used_at', 'is', null);
//     } else if (status === 'expired') {
//       query = query.lt('expires_at', new Date().toISOString());
//     }

//     if (keyType) {
//       query = query.eq('boost_type', keyType);
//     }

//     const { data, error } = await query;

//     if (error) {
//       console.error('获取密钥列表失败:', error);
//       return NextResponse.json({ error: '获取密钥列表失败' }, { status: 500 });
//     }

//     // 获取总数用于分页
//     const { count } = await supabase
//       .from('ai_boost_keys')
//       .select('*', { count: 'exact', head: true });

//     return NextResponse.json({
//       keys: data,
//       pagination: {
//         total: count || 0,
//         limit,
//         offset,
//         hasMore: (offset + limit) < (count || 0),
//       }
//     });
//   } catch (error: any) {
//     console.error('获取密钥列表失败:', error);
//     return NextResponse.json(
//       { error: error.message || '获取密钥列表失败' },
//       { status: 500 }
//     );
//   }
// }