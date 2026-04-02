import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '2200691917@qq.com')
  .split(',')
  .map(email => email.trim().toLowerCase());

function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}

export async function validateAdminSession(request: NextRequest): Promise<{
  isValid: boolean;
  adminEmail?: string;
  error?: string;
  status: number;
}> {
  try {
    const supabaseAdmin = createAdminClient();

    const adminKeyVerified = request.cookies.get('admin_key_verified')?.value;
    const adminEmailCookie = request.cookies.get('admin_email')?.value;

    if (!adminKeyVerified || adminKeyVerified !== 'true') {
      return {
        isValid: false,
        error: '未授权访问：管理员验证缺失',
        status: 403
      };
    }

    if (!adminEmailCookie) {
      return {
        isValid: false,
        error: '未授权访问：管理员邮箱缺失',
        status: 403
      };
    }

    const isValidAdmin = isAdminEmail(adminEmailCookie);

    if (!isValidAdmin) {
      return {
        isValid: false,
        error: '未授权访问：非管理员账号',
        status: 403
      };
    }

    return {
      isValid: true,
      adminEmail: adminEmailCookie
    };

  } catch (error: any) {
    console.error('[validateAdminSession] 验证失败:', error);
    return {
      isValid: false,
      error: error.message || '验证过程出错',
      status: 500
    };
  }
}

export function createAdminResponse(error: string, status: number = 403): NextResponse {
  return NextResponse.json({ error }, { status });
}

export { createAdminClient, isAdminEmail };
