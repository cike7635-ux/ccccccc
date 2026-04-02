// /lib/cache/themes-cache.ts - 统一的主题缓存管理（简化版）
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleError, createError, ErrorCodes } from '@/lib/utils/error-handler';
import { Theme, Task, ThemeOperation, ApiResponse } from '@/lib/types';

// ============================================  
// 缓存配置
// ============================================
const USER_THEMES_CACHE_TTL = 10 * 60 * 1000; // 10分钟

// ============================================
// 内存缓存（进程级别，全局共享）
// ============================================
interface CacheEntry<T> {
  data: T;
  version: number;
  expiresAt: number;
}

// 用户主题内存缓存 - key: `${userId}_v${version}`
const userThemesMemoryCache = new Map<string, CacheEntry<Theme[]>>();

// 用户主题版本号（内存存储，作为数据库存储的 fallback）
const userThemesVersions = new Map<string, number>();

// 官方主题内存缓存 - 全局共享
let officialThemesMemoryCache: CacheEntry<Theme[]> | null = null;
let officialThemesVersion: number = 1;

// ============================================
// 版本管理（数据库存储，持久化，带内存 fallback）
// ============================================

/**
 * 获取用户主题缓存版本号
 * @param userId 用户ID
 * @param supabase 可选的 Supabase 客户端，用于复用
 */
export async function getUserThemesVersion(userId: string, supabase?: any): Promise<number> {
  try {
    // 复用或创建 Supabase 客户端
    const client = supabase || await createClient();
    
    // 查询用户缓存版本
    const { data, error } = await client
      .from('cache_versions')
      .select('themes_version')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      // 用户无缓存版本，创建默认值
      const { error: insertError } = await client
        .from('cache_versions')
        .insert({ 
          user_id: userId, 
          themes_version: 1,
          updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.warn('[getUserThemesVersion] 创建缓存版本失败，使用默认值1');
      }
      return 1;
    }
    
    return data.themes_version || 1;
  } catch (error) {
    console.error('[getUserThemesVersion] 获取缓存版本失败:', error);
    return 1;
  }
}

/**
 * 递增用户主题缓存版本号
 * @param userId 用户ID
 * @param operation 操作类型: ThemeOperation
 * @param theme 主题信息（创建或更新时需要）
 * @param themeId 主题ID（删除时需要）
 * @param supabase 可选的 Supabase 客户端，用于复用
 */
export async function incrementThemesVersion(userId: string, operation?: ThemeOperation, theme?: Theme, themeId?: string, supabase?: any): Promise<void> {
  try {
    // 复用或创建 Supabase 客户端
    const client = supabase || await createClient();
    
    // 尝试调用数据库函数（更高效）
    const { error } = await client.rpc('increment_themes_version', { 
      p_user_id: userId 
    });
    
    if (error) {
      console.warn('[incrementThemesVersion] RPC调用失败，使用降级方案:', error);
      
      // 降级方案：先获取当前版本，然后+1
      const { data } = await client
        .from('cache_versions')
        .select('themes_version')
        .eq('user_id', userId)
        .single();
      
      const currentVersion = data?.themes_version || 1;
      
      const { error: updateError } = await client
        .from('cache_versions')
        .upsert({ 
          user_id: userId,
          themes_version: currentVersion + 1,
          updated_at: new Date().toISOString()
        });
      
      if (updateError) {
        console.error('[incrementThemesVersion] 更新缓存版本失败:', updateError);
        throw updateError;
      }
    }
    
    console.log(`✅ 用户 ${userId} 主题缓存版本已递增`);
    
    // 尝试增量更新缓存 - 需要匹配所有分页缓存键
    const cacheKeysToUpdate: string[] = [];
    
    // 查找所有该用户的缓存键
    for (const key of userThemesMemoryCache.keys()) {
      if (key.startsWith(`${userId}_p`)) {
        cacheKeysToUpdate.push(key);
      }
    }
    
    if (cacheKeysToUpdate.length > 0 && operation) {
      try {
        for (const cacheKey of cacheKeysToUpdate) {
          const cached = userThemesMemoryCache.get(cacheKey);
          if (!cached) continue;
          
          let updatedData = [...cached.data];
          
          switch (operation) {
            case 'delete':
              if (themeId) {
                updatedData = updatedData.filter(t => t.id !== themeId);
                console.log(`✅ 从缓存中删除主题: ${themeId}`);
              }
              break;
            case 'create':
              if (theme) {
                updatedData.unshift(theme);
                console.log(`✅ 向缓存中添加新主题: ${theme.id}`);
              }
              break;
            case 'update':
              if (theme && theme.id) {
                const index = updatedData.findIndex(t => t.id === theme.id);
                if (index !== -1) {
                  updatedData[index] = { ...updatedData[index], ...theme };
                  console.log(`✅ 更新缓存中的主题: ${theme.id}`);
                }
              }
              break;
          }
          
          // 更新缓存
          userThemesMemoryCache.set(cacheKey, {
            ...cached,
            data: updatedData,
            version: cached.version + 1
          });
        }
        
        console.log(`✅ 增量缓存更新成功，更新了 ${cacheKeysToUpdate.length} 个缓存，用户: ${userId}`);
        return;
      } catch (cacheError) {
        console.warn('[incrementThemesVersion] 增量缓存更新失败，清除整个缓存:', cacheError);
      }
    }
    
    // 增量更新失败时，清除该用户的所有缓存
    for (const key of userThemesMemoryCache.keys()) {
      if (key.startsWith(`${userId}_p`)) {
        userThemesMemoryCache.delete(key);
      }
    }
    console.log(`✅ 清除用户 ${userId} 的所有主题缓存`);
    
  } catch (error) {
    console.error('[incrementThemesVersion] 递增缓存版本失败:', error);
  }
}

/**
 * 递增官方主题缓存版本号
 */
export async function incrementOfficialThemesVersion(): Promise<void> {
  try {
    officialThemesVersion++;
    officialThemesMemoryCache = null;
    console.log(`✅ 官方主题缓存版本已递增到: ${officialThemesVersion}`);
  } catch (error) {
    console.error('[themes-cache] 递增官方主题缓存版本失败:', error);
    throw error;
  }
}

/**
 * 清除用户主题缓存（兼容旧接口）
 */
export async function clearUserThemesCache(userId: string): Promise<void> {
  await incrementThemesVersion(userId);
}

// ============================================
// 统一的主题数据查询接口
// ============================================

/**
 * 获取用户主题（带缓存）
 * @param userId 用户ID
 * @param page 页码，默认1
 * @param pageSize 每页数量，默认10
 * @param supabase 可选的 Supabase 客户端，用于复用
 */
export async function getUserThemes(userId: string, page: number = 1, pageSize: number = 10, supabase?: any): Promise<Theme[]> {
  if (!userId) {
    console.error('❌ 用户主题查询失败: userId 为 undefined');
    return [];
  }

  // 获取当前版本号
  const currentVersion = await getUserThemesVersion(userId);
  
  // 检查内存缓存（基于版本）
  const cacheKey = `${userId}_p${page}_s${pageSize}`;
  const cached = userThemesMemoryCache.get(cacheKey);

  console.log(`🔍 缓存检查 - 用户: ${userId}, 版本: ${currentVersion}, 页码: ${page}, 缓存存在: ${!!cached}, 缓存版本: ${cached?.version}`);

  if (cached && cached.expiresAt > Date.now() && cached.version === currentVersion) {
    console.log(`✅ 用户主题缓存命中，用户: ${userId}, 版本: ${currentVersion}`);
    return cached.data;
  }

  console.log(`🔄 用户主题缓存未命中，查询数据库，用户: ${userId}, 页码: ${page}, 每页: ${pageSize}`);

  // 复用或创建 Supabase 客户端
  const client = supabase || await createClient();
  // 优化查询：只选择必要的字段，使用复合索引 (creator_id, created_at)
  const { data, error } = await client
    .from('themes')
    .select('id, title, description, task_count, is_official, creator_id, created_at')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (error) {
    const appError = handleError(error);
    console.error(`❌ 用户主题查询失败: ${appError.message}`);
    return [];
  }

  const themes = data || [];
  console.log(`📊 查询到 ${themes.length} 个主题`);

  // 设置内存缓存
  userThemesMemoryCache.set(cacheKey, {
    data: themes,
    version: currentVersion,
    expiresAt: Date.now() + USER_THEMES_CACHE_TTL
  });

  return themes;
}

/**
 * 获取官方主题（带缓存）
 * 注意：官方主题通过 is_official = true 字段标识
 * @param supabase 可选的 Supabase 客户端，用于复用
 */
export async function getOfficialThemes(supabase?: any): Promise<Theme[]> {
  // 检查内存缓存
  if (officialThemesMemoryCache && officialThemesMemoryCache.expiresAt > Date.now() && officialThemesMemoryCache.version === officialThemesVersion) {
    console.log('✅ 官方主题缓存命中');
    return officialThemesMemoryCache.data;
  }

  console.log('🔄 官方主题缓存未命中，查询数据库');

  // 复用或创建 Supabase 客户端
  const client = supabase || await createClient();
  
  // 直接从 themes 表查询 is_official = true 且 is_public = true 的主题
  // 优化查询：只选择必要的字段，使用复合索引 (is_official, priority, created_at)
  // 优先级升序：数字越小优先级越高，排在前面（支持负数优先级）
  const { data, error } = await client
    .from('themes')
    .select('id, title, description, task_count, is_official, is_public, priority, creator_id, created_at')
    .eq('is_official', true)
    .eq('is_public', true)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    const appError = handleError(error);
    console.error(`❌ 官方主题查询失败: ${appError.message}`);
    return [];
  }

  const publicThemes = data || [];

  // 设置内存缓存
  officialThemesMemoryCache = {
    data: publicThemes,
    version: officialThemesVersion,
    expiresAt: Date.now() + 60 * 60 * 1000 // 1小时
  };

  return publicThemes;
}

/**
 * 获取所有主题（用户主题 + 官方主题，官方在后）
 * @param userId 用户ID
 * @param supabase 可选的 Supabase 客户端，用于复用
 */
export async function getAllThemesForUser(userId: string, supabase?: any): Promise<ApiResponse<Theme[]>> {
  try {
    // 并行获取
    const [userThemes, officialThemes] = await Promise.all([
      getUserThemes(userId, 1, 20), // 减少初始获取的主题数量，提高响应速度
      getOfficialThemes(supabase)
    ]);

    // 合并：用户主题在前，官方主题在后
    const allThemes = [...userThemes, ...officialThemes];

    return { data: allThemes, error: null };
  } catch (error: any) {
    console.error('[getAllThemesForUser] 异常:', error);
    return { data: [], error: '服务器错误' };
  }
}

/**
 * 获取主题详情（统一接口）
 * 使用 admin 客户端绕过 RLS 限制
 */
export async function getThemeById(themeId: string): Promise<Theme | null> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('themes')
      .select('*')
      .eq('id', themeId)
      .single();

    if (error) {
    const appError = handleError(error);
    console.error(`❌ 主题详情查询失败: ${appError.message}`);
    return null;
  }

    return data;
  } catch (error) {
    const appError = handleError(error);
    console.error('[getThemeById] 异常:', appError.message);
    return null;
  }
}

/**
 * 获取主题的任务列表
 * 使用 admin 客户端绕过 RLS 限制
 */
export async function getTasksByTheme(themeId: string): Promise<Task[]> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('tasks')
      .select('id, theme_id, description, type, order_index')
      .eq('theme_id', themeId)
      .order('order_index', { ascending: true });

    if (error) {
    const appError = handleError(error);
    console.error(`❌ 主题任务查询失败: ${appError.message}`);
    return [];
  }

    return (data || []) as Task[];
  } catch (error) {
    const appError = handleError(error);
    console.error('[getTasksByTheme] 异常:', appError.message);
    return [];
  }
}
