// /app/themes/actions.ts - 使用统一缓存模块
'use server';

import {
  getAllThemesForUser,
  getOfficialThemes,
  getUserThemes,
  clearUserThemesCache,
  incrementThemesVersion
} from '@/lib/cache/themes-cache';
import { createClient } from '@/lib/supabase/server';
import { checkUserLoggedIn, validateThemeOwnership, getLastTaskOrderIndex, validateForm } from '@/lib/utils/theme-utils';
import { handleError } from '@/lib/utils/error-handler';

// 复用统一缓存
export {
  getOfficialThemes as listOfficialThemes,
  getUserThemes as listMyThemes,
  clearUserThemesCache,
  incrementThemesVersion
};

// 重新定义 listAllThemesForUser 函数，自动获取当前用户ID
export async function listAllThemesForUser() {
  try {
    const user = await checkUserLoggedIn();
    return await getAllThemesForUser(user.id);
  } catch (error: any) {
    console.error('[listAllThemesForUser] 异常:', error);
    return { data: [], error: error.message || '服务器错误' };
  }
}

// 下面是任务相关的函数（这些是themes独有的，保持不变）

/**
 * 获取主题详情
 */
export async function getThemeById(id: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('themes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[getThemeById] 查询失败:', error);
      return { data: null, error: error.message };
    }

    return { data: error ? null : data, error: null };
  } catch (error: any) {
    console.error('[getThemeById] 异常:', error);
    return { data: null, error: '服务器错误' };
  }
}

/**
 * 获取主题的任务列表
 */
export async function listTasksByTheme(themeId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tasks')
      .select('id, theme_id, description, type, order_index')
      .eq('theme_id', themeId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[listTasksByTheme] 查询失败:', error);
      return { data: [], error: error.message };
    }

    return { data: error ? [] : data, error: null };
  } catch (error: any) {
    console.error('[listTasksByTheme] 异常:', error);
    return { data: [], error: '服务器错误' };
  }
}

/**
 * 更新主题
 */
export async function updateTheme(formData: FormData) {
  try {
    const user = await checkUserLoggedIn();

    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;

    validateForm({ id, title }, ['id', 'title']);

    // 验证主题归属
    await validateThemeOwnership(id, user.id);

    const supabase = await createClient();

    // 更新主题
    const { data: updatedTheme, error: updateError } = await supabase
      .from('themes')
      .update({
        title: title.trim(),
        description: (description || '').trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      const appError = handleError(updateError);
      console.error('[updateTheme] 更新失败:', appError.message);
      return { data: null, error: appError.message };
    }

    // 递增缓存版本号
    await incrementThemesVersion(user.id, 'update', updatedTheme);

    return { data: updatedTheme, error: null };

  } catch (error: any) {
    console.error('[updateTheme] 异常:', error);
    return { data: null, error: error.message || '更新主题时发生错误' };
  }
}

/**
 * 创建任务
 */
export async function createTask(formData: FormData) {
  try {
    const user = await checkUserLoggedIn();

    const theme_id = formData.get('theme_id') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string || 'interaction';

    validateForm({ theme_id, description }, ['theme_id', 'description']);

    // 验证主题归属
    await validateThemeOwnership(theme_id, user.id);

    // 计算新任务的order_index
    const newOrderIndex = await getLastTaskOrderIndex(theme_id);

    const supabase = await createClient();

    // 创建任务
    const { data: newTask, error: createError } = await supabase
      .from('tasks')
      .insert({
        theme_id,
        description: description.trim(),
        type,
        order_index: newOrderIndex
      })
      .select()
      .single();

    if (createError) {
      const appError = handleError(createError);
      console.error('[createTask] 创建失败:', appError.message);
      return { data: null, error: appError.message };
    }

    // 更新主题的任务数量
    const { data: updatedTheme, error: updateError } = await supabase
      .from('themes')
      .select('task_count')
      .eq('id', theme_id)
      .single();

    if (!updateError && updatedTheme) {
      await supabase
        .from('themes')
        .update({
          task_count: (updatedTheme.task_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', theme_id);
    }

    // 递增缓存版本号
    await incrementThemesVersion(user.id);

    return { data: newTask, error: null };

  } catch (error: any) {
    console.error('[createTask] 异常:', error);
    return { data: null, error: error.message || '创建任务时发生错误' };
  }
}

/**
 * 更新任务
 */
export async function updateTask(formData: FormData) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: '用户未登录' };
    }

    const id = formData.get('id') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string || 'interaction';
    const order_index = parseInt(formData.get('order_index') as string) || 0;
    const theme_id = formData.get('theme_id') as string;

    if (!id || !description || description.trim() === '') {
      return { data: null, error: '任务ID和内容不能为空' };
    }

    // 验证主题归属
    const { data: theme, error: fetchError } = await supabase
      .from('themes')
      .select('creator_id')
      .eq('id', theme_id)
      .single();

    if (fetchError || !theme) {
      return { data: null, error: '主题不存在' };
    }

    if (theme.creator_id !== user.id) {
      return { data: null, error: '无权修改此任务' };
    }

    // 更新任务
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        description: description.trim(),
        type,
        order_index
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[updateTask] 更新失败:', updateError);
      return { data: null, error: updateError.message };
    }

    return { data: updatedTask, error: null };

  } catch (error: any) {
    console.error('[updateTask] 异常:', error);
    return { data: null, error: '更新任务时发生错误' };
  }
}

/**
 * 删除任务
 */
export async function deleteTask(formData: FormData) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: '用户未登录' };
    }

    const id = formData.get('id') as string;

    if (!id) {
      return { error: '任务ID不能为空' };
    }

    // 获取任务所属的主题
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('theme_id')
      .eq('id', id)
      .single();

    if (fetchError || !task) {
      return { error: '任务不存在' };
    }

    // 验证主题归属
    const { data: theme, error: themeError } = await supabase
      .from('themes')
      .select('creator_id, task_count')
      .eq('id', task.theme_id)
      .single();

    if (themeError || !theme) {
      return { error: '主题不存在' };
    }

    if (theme.creator_id !== user.id) {
      return { error: '无权删除此任务' };
    }

    // 删除任务
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[deleteTask] 删除失败:', deleteError);
      return { error: deleteError.message };
    }

    // 更新主题的任务数量
    await supabase
      .from('themes')
      .update({
        task_count: Math.max(0, (theme.task_count || 1) - 1),
        updated_at: new Date().toISOString()
      })
      .eq('id', task.theme_id);

    // 递增缓存版本号
    await incrementThemesVersion(user.id);

    return { error: null };

  } catch (error: any) {
    console.error('[deleteTask] 异常:', error);
    return { error: '删除任务时发生错误' };
  }
}

/**
 * 获取官方主题下的任务
 */
export async function listOfficialTasksByTheme(themeId: string) {
  try {
    const supabase = await createClient();

    // 直接从 tasks 表查询
    const { data, error } = await supabase
      .from('tasks')
      .select('id, theme_id, description, type, order_index')
      .eq('theme_id', themeId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[listOfficialTasksByTheme] 查询失败:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [], error: null };
  } catch (error: any) {
    console.error('[listOfficialTasksByTheme] 异常:', error);
    return { data: [], error: '服务器错误' };
  }
}

/**
 * 获取官方主题详情
 */
export async function getOfficialThemeById(id: string) {
  try {
    const supabase = await createClient();

    // 直接从 themes 表查询
    const { data, error } = await supabase
      .from('themes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      console.error('[getOfficialThemeById] 查询失败:', error);
      return { data: null, error: '主题不存在' };
    }

    // 确保数据结构一致性
    const themeData = {
      ...data,
      is_official: true
    };

    return { data: themeData, error: null };
  } catch (error: any) {
    console.error('[getOfficialThemeById] 异常:', error);
    return { data: null, error: '服务器错误' };
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

    if (!title || title.trim() === '') {
      return { data: null, error: '主题标题不能为空' };
    }

    console.log(`[createTheme] 用户 ${user.email} 创建主题: ${title}`);

    // 1. 插入主题到数据库
    const { data, error } = await supabase
      .from('themes')
      .insert({
        title: title.trim(),
        description: (description || '').trim(),
        creator_id: user.id,
        task_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[createTheme] 创建主题失败:', error);
      return { data: null, error: error.message };
    }

    console.log(`[createTheme] 主题创建成功: ${data.id}`);

    // 2. 递增缓存版本号（确保数据立即生效）
    await incrementThemesVersion(user.id);

    return { data, error: null };

  } catch (error: any) {
    console.error('[createTheme] 异常:', error);
    return { data: null, error: '创建主题时发生错误' };
  }
}

/**
 * 批量插入任务（用于AI生成）
 */
export async function bulkInsertTasks(formData: FormData) {
  try {
    const supabase = await createClient();

    const theme_id = formData.get('theme_id') as string;
    const tasksJson = formData.get('tasks') as string;

    if (!theme_id || !tasksJson) {
      return { data: null, error: '缺少必要参数' };
    }

    const tasks = JSON.parse(tasksJson);
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { data: null, error: '任务列表不能为空' };
    }

    // 插入任务 - 处理对象数组的情况
    const tasksToInsert = tasks.map((task: any, index: number) => {
      // 提取描述字段，处理对象或字符串的情况
      const description = typeof task === 'object' && task.description 
        ? task.description 
        : typeof task === 'string' 
          ? task 
          : '';
      
      return {
        theme_id,
        description: description.trim(),
        type: 'interaction',
        order_index: index
      };
    }).filter(task => task.description); // 过滤空描述的任务

    const { error: insertError } = await supabase
      .from('tasks')
      .insert(tasksToInsert);

    if (insertError) {
      console.error('[bulkInsertTasks] 插入任务失败:', insertError);
      return { data: null, error: insertError.message };
    }

    // 更新主题的任务数量
    const { error: updateError } = await supabase
      .from('themes')
      .update({
        task_count: tasksToInsert.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', theme_id);

    if (updateError) {
      console.error('[bulkInsertTasks] 更新任务数量失败:', updateError);
    }

    // 清除缓存
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await incrementThemesVersion(user.id);
    }

    return { data: { count: tasksToInsert.length }, error: null };

  } catch (error: any) {
    console.error('[bulkInsertTasks] 异常:', error);
    return { data: null, error: '批量插入任务时发生错误' };
  }
}

/**
 * 获取用户主题的任务
 */
export async function listUserTasksByTheme(themeId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('tasks')
      .select('id, theme_id, description, type, order_index')
      .eq('theme_id', themeId)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[listUserTasksByTheme] 查询失败:', error);
      return { data: [], error: error.message };
    }

    return { data: error ? [] : data, error: null };
  } catch (error: any) {
    console.error('[listUserTasksByTheme] 异常:', error);
    return { data: [], error: '服务器错误' };
  }
}

/**
 * 获取用户主题详情
 */
export async function getUserThemeById(id: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('themes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[getUserThemeById] 查询失败:', error);
      return { data: null, error: error.message };
    }

    return { data: error ? null : data, error: null };
  } catch (error: any) {
    console.error('[getUserThemeById] 异常:', error);
    return { data: null, error: '服务器错误' };
  }
}

/**
 * 删除用户主题
 */
export async function deleteTheme(formData: FormData) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: '用户未登录' };
    }

    const themeId = formData.get('id') as string;

    if (!themeId) {
      return { error: '主题ID不能为空' };
    }

    console.log(`[deleteTheme] 用户 ${user.email} 删除主题: ${themeId}`);

    // 验证主题归属
    const { data: theme, error: fetchError } = await supabase
      .from('themes')
      .select('creator_id')
      .eq('id', themeId)
      .single();

    if (fetchError || !theme) {
      return { error: '主题不存在' };
    }

    if (theme.creator_id !== user.id) {
      return { error: '无权删除此主题' };
    }

    // 删除主题（关联任务会通过CASCADE自动删除）
    const { error: deleteError } = await supabase
      .from('themes')
      .delete()
      .eq('id', themeId);

    if (deleteError) {
      console.error('[deleteTheme] 删除主题失败:', deleteError);
      return { error: deleteError.message };
    }

    console.log(`[deleteTheme] 主题删除成功: ${themeId}`);

    // 递增缓存版本号
    await incrementThemesVersion(user.id);

    return { error: null };

  } catch (error: any) {
    console.error('[deleteTheme] 异常:', error);
    return { error: '删除主题时发生错误' };
  }
}
