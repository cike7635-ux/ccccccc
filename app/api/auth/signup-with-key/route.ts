// /app/api/auth/signup-with-key/route.ts (临时诊断版)
import { NextRequest, NextResponse } from 'next/server';

// 处理GET请求：用于诊断
export async function GET(request: NextRequest) {
  // 安全地诊断环境变量（不暴露完整密钥）
  const envStatus = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseUrlPreview: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 16), // 看前16位
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    anonKeyPreview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) + '...', // 看前10位
    note: '此端点仅用于诊断。请检查supabaseUrl是否以https://开头，anonKey是否以eyJ开头。'
  };

  console.log('诊断结果:', envStatus);
  return NextResponse.json(envStatus);
}

// 处理POST请求：保持您原有的注册逻辑，但开头加入诊断信息
export async function POST(request: NextRequest) {
  // 先运行同样的诊断
  const envStatus = {
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  console.log('注册请求 - 环境变量状态:', envStatus);

  // 如果环境变量缺失，直接返回错误，不再执行后续逻辑
  if (!envStatus.hasSupabaseUrl || !envStatus.hasSupabaseAnonKey) {
    return NextResponse.json(
      { 
        error: '服务器配置错误',
        message: 'API服务缺少必要的Supabase连接配置。',
        diagnostic: {
          ...envStatus,
          help: '请检查Vercel项目Settings中的Environment Variables，确保NEXT_PUBLIC_SUPABASE_URL和NEXT_PUBLIC_SUPABASE_ANON_KEY已正确设置并关联到Production环境。'
        }
      },
      { status: 500 }
    );
  }

  // 如果环境变量存在，则返回一个简单的成功响应（此版本不执行真实注册）
  try {
    const { email, password, keyCode } = await request.json();
    return NextResponse.json({
      success: true,
      message: '[诊断模式] 环境变量检查通过，API准备就绪。',
      diagnostic: {
        ...envStatus,
        receivedData: { email: email ? '已收到' : '未收到', keyCode: keyCode ? '已收到' : '未收到' }
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: '请求格式有误',
      diagnostic: envStatus
    }, { status: 400 });
  }
}
