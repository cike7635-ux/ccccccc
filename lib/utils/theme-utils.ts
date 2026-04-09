// /lib/utils/theme-utils.ts - 主题相关的公共函数

import { createClient } from '@/lib/supabase/server';
import { getUserData } from '@/lib/server/auth';
import { handleError, createError, ErrorCodes } from './error-handler';

/**
 * 检查用户是否已登录（包含会员和设备检查）
 */
export async function checkUserLoggedIn() {
  try {
    const { user } = await getUserData();
    return user;
  } catch (error) {
    throw handleError(error);
  }
}

/**
 * 验证主题归属
 * @param themeId 主题ID
 * @param userId 用户ID
 * @param allowOfficial 是否允许操作官方主题（仅管理员）
 */
export async function validateThemeOwnership(themeId: string, userId: string, allowOfficial: boolean = false) {
  try {
    const supabase = await createClient();
    
    const { data: theme, error } = await supabase
      .from('themes')
      .select('creator_id, is_official')
      .eq('id', themeId)
      .single();
    
    if (error) {
      throw createError(ErrorCodes.RECORD_NOT_FOUND, '主题不存在');
    }
    
    // 官方主题只有管理员可以修改
    if (theme.is_official) {
      if (!allowOfficial) {
        throw createError(ErrorCodes.FORBIDDEN, '官方主题不能编辑或删除');
      }
      return { theme, isOfficial: true };
    }
    
    if (theme.creator_id !== userId) {
      throw createError(ErrorCodes.FORBIDDEN, '无权操作此主题');
    }
    
    return { theme, isOfficial: false };
  } catch (error) {
    throw handleError(error);
  }
}

/**
 * 获取主题的最后一个任务的 order_index
 * @param themeId 主题ID
 */
export async function getLastTaskOrderIndex(themeId: string) {
  try {
    const supabase = await createClient();
    
    const { data: lastTask, error } = await supabase
      .from('tasks')
      .select('order_index')
      .eq('theme_id', themeId)
      .order('order_index', { ascending: false })
      .limit(1)
      .single();
    
    return error || !lastTask ? 0 : lastTask.order_index + 1;
  } catch (error) {
    console.error('[getLastTaskOrderIndex] 异常:', error);
    return 0;
  }
}

/**
 * 格式化主题数据
 * @param theme 主题数据
 */
export function formatTheme(theme: any) {
  return {
    id: theme.id,
    title: theme.title,
    description: theme.description || '',
    task_count: theme.task_count || 0,
    created_at: theme.created_at,
    updated_at: theme.updated_at,
    creator_id: theme.creator_id,
    is_official: theme.is_official || false,
    priority: theme.priority || 0,
  };
}

/**
 * 格式化任务数据
 * @param task 任务数据
 */
export function formatTask(task: any) {
  return {
    id: task.id,
    theme_id: task.theme_id,
    description: task.description,
    type: task.type || 'interaction',
    order_index: task.order_index || 0,
    created_at: task.created_at,
  };
}

/**
 * 验证表单数据
 * @param data 表单数据
 * @param requiredFields 必需字段
 */
export function validateForm(data: any, requiredFields: string[]) {
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      throw createError(ErrorCodes.MISSING_PARAMS, `${field} 不能为空`);
    }
  }
}

/**
 * 生成缓存键
 * @param prefix 前缀
 * @param ...args 其他参数
 */
export function generateCacheKey(prefix: string, ...args: any[]) {
  return `${prefix}_${args.join('_')}`;
}

/**
 * 延迟函数
 * @param ms 延迟时间（毫秒）
 */
export function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 批量处理任务
 * @param tasks 任务列表
 * @param batchSize 批量大小
 * @param processor 处理函数
 */
export async function batchProcess<T>(
  tasks: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void>
) {
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    await processor(batch);
  }
}

/**
 * 安全地获取环境变量
 * @param key 环境变量键
 * @param defaultValue 默认值
 */
export function getEnv(key: string, defaultValue: string = '') {
  return process.env[key] || defaultValue;
}