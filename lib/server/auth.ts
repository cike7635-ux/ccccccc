// /lib/server/auth.ts - 修改版本
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

// 🔥 分层内存缓存
// 用户基本信息缓存（5分钟）- 昵称、会员有效期等不常变化的数据
const userDataCache = new Map<string, { 
  data: any; 
  expiresAt: number; 
}>();
const USER_DATA_CACHE_TTL = 5 * 60 * 1000; // 5分钟

// 设备验证缓存（50秒）- 满足多设备限制需求
const deviceCheckCache = new Map<string, {
  deviceId: string;
  expiresAt: number;
}>();
const DEVICE_CHECK_CACHE_TTL = 50 * 1000; // 50秒

/**
 * 创建服务端Supabase客户端
 */
async function createClient() {
  const cookieStore = await cookies();

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
 * 生成会话标识
 */
function generateSessionId(userId: string, accessToken: string, deviceId: string = 'unknown'): string {
  const tokenPart = accessToken.substring(0, 12);
  return `sess_${userId}_${deviceId}_${tokenPart}`;
}

/**
 * 更新数据库中的会话标识
 */
async function updateSessionInDatabase(supabase: any, userId: string, sessionId: string, deviceId?: string) {
  const now = new Date().toISOString();
  const updateData: any = {
    last_login_session: sessionId,
    last_login_at: now,
    updated_at: now
  };
  if (deviceId) {
    updateData.last_login_device_id = deviceId;
  }
  return await supabase
    .from('profiles')
    .update(updateData)
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
  if (!profile.last_login_device_id) {
    console.log(`🆕 新用户，设置初始设备ID: ${currentDeviceId}`);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const currentSessionId = generateSessionId(user.id, session.access_token, currentDeviceId);
      await updateSessionInDatabase(supabase, user.id, currentSessionId, currentDeviceId);
      profile.last_login_session = currentSessionId;
      profile.last_login_device_id = currentDeviceId;
    }
    return true;
  }

  const storedDeviceId = profile.last_login_device_id;

  if (storedDeviceId !== currentDeviceId) {
    if (isLoginPage) {
      console.log(`🆕 新设备登录：${currentDeviceId}，踢出旧设备：${storedDeviceId}`);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const currentSessionId = generateSessionId(user.id, session.access_token, currentDeviceId);
        await updateSessionInDatabase(supabase, user.id, currentSessionId, currentDeviceId);
        profile.last_login_session = currentSessionId;
        profile.last_login_device_id = currentDeviceId;
      }

      clearUserCache(user.id);
      console.log(`✅ 新设备登录成功，旧设备将被踢出`);
      return true;
    } else {
      console.log(`🔴 设备ID不匹配！当前设备：${currentDeviceId}，存储设备：${storedDeviceId}`);
      console.log(`🔴 旧设备访问，重定向到 /login/expired`);
      redirect('/login/expired');
    }
  } else {
    console.log(`✅ 设备ID匹配：${currentDeviceId}，更新活动时间`);
    await updateLastLoginAt(supabase, user.id);
    return true;
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
  const supabase = await createClient();
  const cookieStore = await cookies();
  
  // 获取设备ID（用于缓存键）
  const deviceIdCookie = cookieStore.get('love_ludo_device_id');
  const currentDeviceId = deviceIdCookie?.value || 'unknown';
  const deviceCacheKey = `device_${currentDeviceId}`;
  
  // 1. 尝试从缓存获取用户信息（不依赖网络）
  let cachedUser = null;
  
  try {
    const { data } = await supabase.auth.getUser();
    cachedUser = data?.user;
  } catch (error) {
    console.error('获取用户信息异常（网络错误？）:', error);
  }
  
  // 尝试多种缓存键
  const userCacheKey = cachedUser ? `user_${cachedUser.id}` : null;
  const userDataCached = userCacheKey ? userDataCache.get(userCacheKey) : null;
  const deviceDataCached = userDataCache.get(deviceCacheKey);
  
  // 如果获取用户失败（网络错误），但有有效的设备缓存，直接使用缓存
  if (!cachedUser && deviceDataCached && deviceDataCached.expiresAt > Date.now()) {
    console.log('🔄 网络错误，但有有效设备缓存，使用缓存数据');
    const profile = deviceDataCached.data.profile;
    
    if (profile?.account_expires_at) {
      const expiryDate = new Date(profile.account_expires_at);
      if (expiryDate < new Date()) {
        console.log('❌ 会员已过期（缓存检查）');
        redirect('/account-expired');
      }
    }
    
    return { ...deviceDataCached.data, cacheHit: true };
  }
  
  // 如果获取用户失败（网络错误），但有有效的用户缓存，尝试使用
  if (!cachedUser && userDataCached && userDataCached.expiresAt > Date.now()) {
    console.log('🔄 网络错误，但有有效用户缓存，使用缓存数据');
    const profile = userDataCached.data.profile;
    
    if (profile?.account_expires_at) {
      const expiryDate = new Date(profile.account_expires_at);
      if (expiryDate < new Date()) {
        console.log('❌ 会员已过期（缓存检查）');
        redirect('/account-expired');
      }
    }
    
    return { ...userDataCached.data, cacheHit: true };
  }
  
  // 如果仍然没有cachedUser，重定向
  if (!cachedUser) {
    console.log('❌ 用户未登录（或网络错误），重定向到登录页');
    redirect('/login');
    return; // 这行不会执行，但让TypeScript安心
  }
  
  const cacheKey = `user_${cachedUser.id}`;
  
  // 检查设备验证缓存（50秒）
  const deviceCached = deviceCheckCache.get(cacheKey);
  
  if (deviceCached && deviceCached.expiresAt > Date.now() && deviceCached.deviceId === currentDeviceId) {
    const userDataCached2 = userDataCache.get(cacheKey);
    if (userDataCached2 && userDataCached2.expiresAt > Date.now()) {
      const profile = userDataCached2.data.profile;
      if (profile?.account_expires_at) {
        const expiryDate = new Date(profile.account_expires_at);
        if (expiryDate < new Date()) {
          console.log('❌ 会员已过期（缓存检查）');
          redirect('/account-expired');
        }
      }
      
      console.log('✅ 分层缓存命中（设备+用户数据）');
      return { ...userDataCached2.data, cacheHit: true };
    }
  }
  
  const userDataCached3 = userDataCache.get(cacheKey);
  if (userDataCached3 && userDataCached3.expiresAt > Date.now()) {
    console.log('🔄 设备验证缓存过期，重新验证设备');
  }

  console.log('🔄 查询用户数据（缓存未命中）');
  
  // 4. 并行查询用户信息和profile
  const startTime = Date.now();
  
  const [userResult, profileResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('profiles')
      .select('id, email, account_expires_at, last_login_at, last_login_session, last_login_device_id, nickname, preferences, avatar_url, custom_daily_limit, custom_cycle_limit')
      .eq('id', cachedUser.id)
      .single()
  ]);
  
  const queryTime = Date.now() - startTime;
  console.log(`⏱️ 并行查询耗时: ${queryTime}ms`);
  
  // 5. 错误处理
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
  
  // 6. 会员过期检查
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
  
  // 7. 🔥 设备ID检查
  await checkAndUpdateDeviceId(supabase, user, profile, currentDeviceId, isLoginPage);
  
  // 8. 设置分层缓存
  // 用户数据缓存（5分钟）
  userDataCache.set(cacheKey, {
    data: { user, profile },
    expiresAt: Date.now() + USER_DATA_CACHE_TTL
  });
  
  // 🔥 同时使用设备ID作为缓存键，方便网络恢复时查找
  userDataCache.set(`device_${currentDeviceId}`, {
    data: { user, profile },
    expiresAt: Date.now() + USER_DATA_CACHE_TTL
  });
  
  // 设备验证缓存（50秒）
  deviceCheckCache.set(cacheKey, {
    deviceId: currentDeviceId,
    expiresAt: Date.now() + DEVICE_CHECK_CACHE_TTL
  });
  
  // 9. 清理过期缓存
  cleanupCache();
  
  console.log('✅ 用户数据获取成功');
  return { user, profile, cacheHit: false };
}

/**
 * 清理过期缓存
 */
function cleanupCache() {
  const now = Date.now();
  // 清理用户数据缓存
  for (const [key, value] of userDataCache.entries()) {
    if (value.expiresAt < now) {
      userDataCache.delete(key);
    }
  }
  // 清理设备验证缓存
  for (const [key, value] of deviceCheckCache.entries()) {
    if (value.expiresAt < now) {
      deviceCheckCache.delete(key);
    }
  }
}

/**
 * 清除指定用户的缓存
 */
export async function clearUserCache(userId: string): Promise<void> {
  const cacheKey = `user_${userId}`;
  userDataCache.delete(cacheKey);
  deviceCheckCache.delete(cacheKey);
  console.log(`🧹 清除用户缓存: ${userId}`);
}

/**
 * 快速获取用户（仅获取用户，不查询profile）
 */
export async function getUserFast() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}