import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 生成AI密钥
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const body = await request.json();
    const {
      boostType = 'cycle',
      incrementAmount = 50,
      durationDays = 30,
      maxUses = 1,
      quantity = 1,
      prefix = 'AI',
      description = '',
      price,
      // 🔥 新增：临时密钥参数
      isTemporary = false,
      tempDurationDays = 7
    } = body;

    // 验证输入
    if (!boostType || !incrementAmount || incrementAmount <= 0) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数或参数无效' },
        { status: 400 }
      );
    }

    if (quantity < 1 || quantity > 100) {
      return NextResponse.json(
        { success: false, error: '生成数量必须在1-100之间' },
        { status: 400 }
      );
    }

    // 如果是临时密钥，验证有效期
    if (isTemporary && (!tempDurationDays || tempDurationDays <= 0)) {
      return NextResponse.json(
        { success: false, error: '临时密钥需要有效期天数' },
        { status: 400 }
      );
    }

    // 计算过期时间
    let expiresAt = null;
    if (durationDays && durationDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
    }

    // 生成密钥
    const generatedKeys = [];
    for (let i = 0; i < quantity; i++) {
      const keyCode = await generateUniqueKeyCode(supabase, prefix);
      
      generatedKeys.push({
        key_code: keyCode,
        boost_type: boostType,
        increment_amount: incrementAmount,
        duration_days: durationDays,
        max_uses: maxUses,
        expires_at: expiresAt?.toISOString() || null,
        description,
        price: price ? parseFloat(price) : null,
        created_at: new Date().toISOString(),
        is_active: true,
        // 🔥 新增：临时密钥字段
        is_temporary: isTemporary,
        temp_duration_days: isTemporary ? tempDurationDays : null
      });
    }

    // 批量插入数据库
    const { data: insertedKeys, error } = await supabase
      .from('ai_boost_keys')
      .insert(generatedKeys)
      .select('id, key_code, boost_type, increment_amount, expires_at, created_at, is_temporary, temp_duration_days');

    if (error) {
      console.error('插入密钥错误:', error);
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        keys: insertedKeys,
        total: insertedKeys.length,
        summary: {
          boostType,
          incrementAmount,
          durationDays,
          totalIncrement: incrementAmount * quantity,
          isTemporary,
          tempDurationDays: isTemporary ? tempDurationDays : null
        }
      },
      message: `成功生成 ${quantity} 个${isTemporary ? '临时' : '永久'}AI密钥`
    });

  } catch (error: any) {
    console.error('生成AI密钥错误:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || '服务器错误',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// 生成唯一的密钥代码
async function generateUniqueKeyCode(supabase: any, prefix: string = 'AI'): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉了易混淆的字符
  let keyCode: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    // 生成格式：AI-XXXX-XXXX
    let code = prefix + '-';
    
    for (let i = 0; i < 8; i++) {
      if (i === 4) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    keyCode = code;

    // 检查是否已存在
    const { data, error } = await supabase
      .from('ai_boost_keys')
      .select('key_code')
      .eq('key_code', keyCode)
      .single();

    if (error && error.code === 'PGRST116') { // 未找到记录，说明是唯一的
      isUnique = true;
    } else if (!error && !data) {
      isUnique = true;
    }
    
    attempts++;
  }

  if (!isUnique) {
    throw new Error('无法生成唯一的密钥代码，请重试');
  }

  return keyCode!;
}