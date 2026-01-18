// /lib/server/auth.ts - 修改版本
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

// 🔥 内存缓存
const userDataCache = new Map<string, { 
  data: any; 
  expiresAt: number; 
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5分钟

/**
 * 创建服务端Supabase客户端
 */
function createClient() {
  const cookieStore = cookies();

  return createServerClient(
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
}

/**
 * 提取设备ID
 */
function extractDeviceIdFromSession(session: string): string {
  const parts = session.split('_');
  if (parts.length >= 4) {
    if (parts[2] === 'dev' && parts.length > 4) {
      return parts.slice(2, parts.length - 1).join('_');
    }
    return parts[2];
  }
  return 'unknown';
}

/**
 * 生成会话标识
 */
function generateSessionId(userId: string, accessToken: string, deviceId: string = 'unknown'): string {
  const tokenPart = accessToken.substring(0, 12);
  return `sess_${userId}_${deviceId}_${tokenPart}`;
}

/**
 * 更新数据库中的会话标识
 */
async function updateSessionInDatabase(supabase: any, userId: string, sessionId: string) {
  const now = new Date().toISOString();
  return await supabase
    .from('profiles')
    .update({
      last_login_session: sessionId,
      last_login_at: now,
      updated_at: now
    })
    .eq('id', userId);
}

/**
 * 更新最后登录时间
 */
async function updateLastLoginAt(supabase: any, userId: string) {
  const now = new Date().toISOString();
  return await supabase
    .from('profiles')
    .update({
      last_login_at: now,
      updated_at: now
    })
    .eq('id', userId);
}

/**
 * 🔥 检查设备ID是否匹配，并更新为新设备
 */
async function checkAndUpdateDeviceId(
  supabase: any, 
  user: any, 
  profile: any, 
  currentDeviceId: string,
  isLoginPage: boolean = false
) {
  if (!profile.last_login_session) {
    // 新用户/首次登录：设置初始设备ID
    console.log(`🆕 新用户，设置初始设备ID: ${currentDeviceId}`);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const currentSessionId = generateSessionId(user.id, session.access_token, currentDeviceId);
      await updateSessionInDatabase(supabase, user.id, currentSessionId);
      profile.last_login_session = currentSessionId;
    }
    return true; // 允许继续
  }

  const storedDeviceId = extractDeviceIdFromSession(profile.last_login_session);
  
  if (storedDeviceId !== currentDeviceId) {
    // 🔥 设备ID不匹配
    if (isLoginPage) {
      // 🔥 场景1：登录页调用 - 新设备登录
      console.log(`🆕 新设备登录：${currentDeviceId}，踢出旧设备：${storedDeviceId}`);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const currentSessionId = generateSessionId(user.id, session.access_token, currentDeviceId);
        await updateSessionInDatabase(supabase, user.id, currentSessionId);
        profile.last_login_session = currentSessionId;
      }
      
      // 清除缓存，因为用户数据已变更
      clearUserCache(user.id);
      console.log(`✅ 新设备登录成功，旧设备将被踢出`);
      return true; // 允许继续
    } else {
      // 🔥 场景2：非登录页调用 - 旧设备访问
      console.log(`🔴 设备ID不匹配！当前设备：${currentDeviceId}，存储设备：${storedDeviceId}`);
      console.log(`🔴 旧设备访问，重定向到 /login/expired`);
      redirect('/login/expired');
    }
  } else {
    // 🔥 设备ID匹配：同一设备，更新活动时间
    console.log(`✅ 设备ID匹配：${currentDeviceId}，更新活动时间`);
    await updateLastLoginAt(supabase, user.id);
    return true; // 允许继续
  }
}

/**
 * 获取用户数据（并行查询 + 缓存）- 严格单设备登录
 */
export async function getUserData(isLoginPage: boolean = false): Promise<{
  user: any;
  profile: any;
  cacheHit: boolean;
}> {
  try {
    const supabase = createClient();
    
    // 1. 尝试从缓存获取
    const { data: { user: cachedUser } } = await supabase.auth.getUser();
    if (!cachedUser) {
      console.log('❌ 用户未登录，重定向到登录页');
      redirect('/login');
    }
    
    const cacheKey = `user_${cachedUser.id}`;
    const cached = userDataCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      console.log('✅ 用户数据缓存命中');
      return { ...cached.data, cacheHit: true };
    }
    
    console.log('🔄 查询用户数据（缓存未命中）');
    
    // 2. 并行查询用户信息和profile
    const startTime = Date.now();
    
    const [userResult, profileResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('profiles')
        .select('id, email, account_expires_at, last_login_at, last_login_session, nickname, preferences, avatar_url, custom_daily_limit, custom_cycle_limit')
        .eq('id', cachedUser.id)
        .single()
    ]);
    
    const queryTime = Date.now() - startTime;
    console.log(`⏱️ 并行查询耗时: ${queryTime}ms`);
    
    // 3. 错误处理
    if (userResult.error || !userResult.data?.user) {
      console.log('❌ 用户未登录，重定向到登录页');
      redirect('/login');
    }
    
    if (profileResult.error) {
      console.error('❌ 查询用户资料失败:', profileResult.error);
      redirect('/login');
    }
    
    const user = userResult.data.user;
    const profile = profileResult.data;
    
    if (!profile) {
      console.log('❌ 用户资料不存在');
      redirect('/login');
    }
    
    // 4. 会员过期检查
    const now = new Date();
    if (!profile.account_expires_at) {
      console.log('❌ 用户未设置会员有效期');
      redirect('/account-expired');
    } else {
      const expiryDate = new Date(profile.account_expires_at);
      const isExpired = expiryDate < now;
      
      if (isExpired) {
        console.log('❌ 会员已过期');
        redirect('/account-expired');
      }
    }
    
    // 5. 🔥 设备ID检查
    const cookieStore = cookies();
    const deviceIdCookie = cookieStore.get('love_ludo_device_id');
    const currentDeviceId = deviceIdCookie?.value || 'unknown';
    
    // 检查并处理设备ID
    await checkAndUpdateDeviceId(supabase, user, profile, currentDeviceId, isLoginPage);
    
    // 6. 设置缓存
    userDataCache.set(cacheKey, {
      data: { user, profile },
      expiresAt: Date.now() + CACHE_TTL
    });
    
    // 7. 清理过期缓存
    cleanupCache();
    
    console.log('✅ 用户数据获取成功');
    return { user, profile, cacheHit: false };
    
  } catch (error) {
    console.error('❌ getUserData异常:', error);
    redirect('/login');
  }
}

/**
 * 清理过期缓存
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of userDataCache.entries()) {
    if (value.expiresAt < now) {
      userDataCache.delete(key);
    }
  }
}

/**
 * 清除指定用户的缓存
 */
export async function clearUserCache(userId: string): Promise<void> {
  const cacheKey = `user_${userId}`;
  userDataCache.delete(cacheKey);
  console.log(`🧹 清除用户缓存: ${userId}`);
}

/**
 * 快速获取用户（仅获取用户，不查询profile）
 */
export async function getUserFast() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}