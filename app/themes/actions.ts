// /app/themes/actions.ts - 完整版（修正AI生成任务保存问题）
'use server';

import { createClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/profile';
import fs from 'fs/promises';
import path from 'path';

// 🔥 在文件顶部添加缓存 
const myThemesCache = new Map<string, { 
  data: any; 
  expiresAt: number; 
}>();
const MY_THEMES_CACHE_TTL = 5 * 60 * 1000; // 5分钟 

// 🔥 批量插入任务（用于AI生成）- 修正版
export async function bulkInsertTasks(formData: FormData) {
  try {
    const supabase = await createClient();
    
    const theme_id = formData.get('theme_id') as string;
    const tasksJson = formData.get('tasks') as string;
    
    if (!theme_id || !tasksJson) {
      return { data: null, error: '缺少必要参数' };
    }
    
    let tasks;
    try {
      tasks = JSON.parse(tasksJson);
    } catch (parseError) {
      console.error('[bulkInsertTasks] 解析任务JSON失败:', parseError);
      return { data: null, error: '任务数据格式错误' };
    }
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { data: null, error: '任务数据必须是非空数组' };
    }
    
    console.log(`[bulkInsertTasks] 为主题 ${theme_id} 批量插入 ${tasks.length} 个任务`);
    
    // ✅ 修正：移除不存在的 ai_metadata 字段
    const tasksToInsert = tasks.map((task, index) => ({
      theme_id,
      description: task.description || task.content || task.task || '未命名任务',
      type: task.type || 'interaction',
      order_index: task.order_index || index,
      is_ai_generated: true
      // ❌ 已删除：ai_metadata: task.metadata || {},
    }));
    
    // 批量插入
    const { data, error } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();
    
    if (error) {
      console.error('[bulkInsertTasks] 批量插入任务失败:', error);
      console.error('详细错误:', error.message);
      return { data: null, error: `数据库错误: ${error.message}` };
    }
    
    // 更新主题的任务计数
    try {
      // 先检查函数是否存在
      const { error: rpcError } = await supabase.rpc('increment_theme_task_count_by', { 
        theme_id, 
        increment: tasks.length 
      });
      
      if (rpcError) {
        console.warn('[bulkInsertTasks] 调用increment_theme_task_count_by失败:', rpcError);
        // 降级方案：直接更新主题表
        await updateThemeTaskCount(supabase, theme_id);
      }
    } catch (rpcException) {
      console.warn('[bulkInsertTasks] RPC调用异常，使用降级方案:', rpcException);
      await updateThemeTaskCount(supabase, theme_id);
    }
    
    console.log(`[bulkInsertTasks] 成功插入 ${data?.length || 0} 个任务`);
    return { data, error: null };
    
  } catch (error: any) {
    console.error('[bulkInsertTasks] 未知错误:', error);
    return { data: null, error: error.message || '保存任务失败' };
  }
}

// 辅助函数：更新主题任务计数
async function updateThemeTaskCount(supabase: any, theme_id: string) {
  try {
    // 查询当前任务数
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('theme_id', theme_id);
    
    // 更新主题表的任务计数
    await supabase
      .from('themes')
      .update({ task_count: count })
      .eq('id', theme_id);
    
    console.log(`[updateThemeTaskCount] 主题 ${theme_id} 任务计数更新为: ${count}`);
  } catch (error) {
    console.error('[updateThemeTaskCount] 更新任务计数失败:', error);
  }
}

/**
 * 删除主题及其关联的任务
 */
export async function deleteTheme(formData: FormData) {
  try {
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    
    console.log(`[deleteTheme] 开始删除主题 ${id}`);
    
    // 首先删除所有关联的任务（确保外键约束）
    const { error: deleteTasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('theme_id', id);
    
    if (deleteTasksError) {
      console.error('[deleteTheme] 删除关联任务失败:', deleteTasksError);
      return { data: null, error: '删除任务失败: ' + deleteTasksError.message };
    }
    
    // 然后删除主题
    const { error: deleteThemeError } = await supabase
      .from('themes')
      .delete()
      .eq('id', id);
    
    if (deleteThemeError) {
      console.error('[deleteTheme] 删除主题失败:', deleteThemeError);
      return { data: null, error: '删除主题失败: ' + deleteThemeError.message };
    }
    
    console.log(`[deleteTheme] 主题 ${id} 删除成功`);
    
    // 🔥 清除缓存
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      clearMyThemesCache(user.id);
    }
    
    return { data: { success: true }, error: null };
    
  } catch (error) {
    console.error('[deleteTheme] 异常:', error);
    return { data: null, error: '删除主题时发生错误' };
  }
}

/**
 * 创建新主题
 */
export async function createTheme(formData: FormData) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: '用户未登录' };
    }
    
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const isPublic = formData.get('is_public') === 'true';
    
    if (!title || title.trim() === '') {
      return { data: null, error: '主题标题不能为空' };
    }
    
    console.log(`[createTheme] 用户 ${user.email} 创建主题: ${title}`);
    
    const { data, error } = await supabase
      .from('themes')
      .insert({
        title: title.trim(),
        description: (description || '').trim(),
        creator_id: user.id,
        is_public: isPublic,
        task_count: 0,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[createTheme] 创建主题失败:', error);
      return { data: null, error: error.message };
    }
    
    console.log(`[createTheme] 主题创建成功: ${data.id}`);
    
    // 🔥 清除缓存
    clearMyThemesCache(user.id);
    
    return { data, error: null };
    
  } catch (error) {
    console.error('[createTheme] 异常:', error);
    return { data: null, error: '创建主题时发生错误' };
  }
}

// 🔥 修改 listMyThemes() 函数 
export async function listMyThemes() {
  try {
    const supabase = await createClient();
    
    // 确保用户资料存在
    await ensureProfile();
    
    // 获取当前用户
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[listMyThemes] 用户未登录');
      return { data: [], error: '用户未登录' };
    }
    
    // 🔥 缓存检查 
    const cacheKey = `myThemes_${user.id}`;
    const cached = myThemesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`✅ 我的主题缓存命中，用户: ${user.email}`);
      return { data: cached.data, error: null };
    }
    
    console.log(`[listMyThemes] 查询用户 ${user.email} 的主题列表`);
    
    // 🔥 只查询必要的字段，不要关联查询（除非真的需要） 
    const { data, error } = await supabase
      .from('themes')
      .select('id, title, description, created_at, task_count')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[listMyThemes] 查询主题失败:', error);
      return { data: [], error: error.message };
    }
    
    // 🔥 用户没有主题，但不要在这里初始化（太慢） 
    // 让用户手动创建，或者在其他地方异步初始化 
    if (!data || data.length === 0) {
      console.log(`[listMyThemes] 用户 ${user.email} 没有主题，返回空数组`);
      return { data: [], error: null };
    }
    
    console.log(`[listMyThemes] 用户 ${user.email} 已有 ${data.length} 个主题`);
    
    // 🔥 设置缓存 
    myThemesCache.set(cacheKey, { 
      data, 
      expiresAt: Date.now() + MY_THEMES_CACHE_TTL 
    });
    
    return { data, error: null };
    
  } catch (error) {
    console.error('[listMyThemes] 获取主题异常:', error);
    return { data: [], error: '服务器错误' };
  }
}

// 🔥 添加清除缓存的函数 
export async function clearMyThemesCache(userId: string): Promise<void> {
  const cacheKey = `myThemes_${userId}`;
  myThemesCache.delete(cacheKey);
  console.log(`🧹 清除我的主题缓存，用户: ${userId}`);
}

// 根据ID获取主题
export async function getThemeById(id: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('themes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('[getThemeById] 查询主题失败:', error);
      return { data: null, error: error.message };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('[getThemeById] 异常:', error);
    return { data: null, error: '服务器错误' };
  }
}

// 获取主题下的任务
export async function listTasksByTheme(themeId: string) {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('theme_id', themeId)
      .order('order_index', { ascending: true });
    
    if (error) {
      console.error('[listTasksByTheme] 查询任务失败:', error);
      return { data: [], error: error.message };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('[listTasksByTheme] 异常:', error);
    return { data: [], error: '服务器错误' };
  }
}

// 更新主题
export async function updateTheme(formData: FormData) {
  try {
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    
    const { data, error } = await supabase
      .from('themes')
      .update({ title, description, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[updateTheme] 更新主题失败:', error);
      return { data: null, error: error.message };
    }
    
    // 🔥 清除缓存
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      clearMyThemesCache(user.id);
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('[updateTheme] 异常:', error);
    return { data: null, error: '服务器错误' };
  }
}

// 创建任务
export async function createTask(formData: FormData) {
  try {
    const supabase = await createClient();
    
    const theme_id = formData.get('theme_id') as string;
    const description = formData.get('description') as string;
    const type = (formData.get('type') as string) || 'interaction';
    const order_index = parseInt(formData.get('order_index') as string) || 0;
    
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        theme_id,
        description,
        type,
        order_index,
        is_ai_generated: false
      })
      .select()
      .single();
    
    if (error) {
      console.error('[createTask] 创建任务失败:', error);
      return { data: null, error: error.message };
    }
    
    // 更新主题的任务计数
    await supabase.rpc('increment_theme_task_count', { theme_id });
    
    return { data, error: null };
  } catch (error) {
    console.error('[createTask] 异常:', error);
    return { data: null, error: '服务器错误' };
  }
}

// 更新任务
export async function updateTask(formData: FormData) {
  try {
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string;
    const order_index = parseInt(formData.get('order_index') as string) || 0;
    
    const { data, error } = await supabase
      .from('tasks')
      .update({ description, type, order_index, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[updateTask] 更新任务失败:', error);
      return { data: null, error: error.message };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('[updateTask] 异常:', error);
    return { data: null, error: '服务器错误' };
  }
}

// 删除任务
export async function deleteTask(formData: FormData) {
  try {
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    
    // 先获取任务信息以更新主题计数
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('theme_id')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('[deleteTask] 获取任务信息失败:', fetchError);
      return { data: null, error: fetchError.message };
    }
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[deleteTask] 删除任务失败:', error);
      return { data: null, error: error.message };
    }
    
    // 更新主题的任务计数
    await supabase.rpc('decrement_theme_task_count', { theme_id: task.theme_id });
    
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error('[deleteTask] 异常:', error);
    return { data: null, error: '服务器错误' };
  }
}

// 获取可用主题（包括公开主题）
export async function listAvailableThemes() {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('[listAvailableThemes] 用户未登录');
      return { data: [], error: '用户未登录' };
    }
    
    // 查询用户自己的主题和公开主题
    const { data, error } = await supabase
      .from('themes')
      .select('*')
      .or(`creator_id.eq.${user.id},is_public.eq.true`)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[listAvailableThemes] 查询主题失败:', error);
      return { data: [], error: error.message };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('[listAvailableThemes] 异常:', error);
    return { data: [], error: '服务器错误' };
  }
}