// /app/themes/actions.ts - 完整缓存版本方案 + 所有任务管理函数
'use server';

import { createClient } from '@/lib/supabase/server';

// 🔥 缓存存储（用于性能优化）
const myThemesCache = new Map<string, { 
  data: any; 
  version: number;  // 缓存版本号
  expiresAt: number; 
}>();
const MY_THEMES_CACHE_TTL = 5 * 60 * 1000; // 5分钟

// 🔥 获取用户主题缓存版本号
async function getUserThemesVersion(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    
    // 查询用户缓存版本
    const { data, error } = await supabase
      .from('cache_versions')
      .select('themes_version')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      // 用户无缓存版本，创建默认值
      const { error: insertError } = await supabase
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

// 🔥 递增用户主题缓存版本号
async function incrementThemesVersion(userId: string): Promise<void> {
  try {
    const supabase = await createClient();
    
    // 尝试调用数据库函数（更高效）
    const { error } = await supabase.rpc('increment_themes_version', { 
      p_user_id: userId 
    });
    
    if (error) {
      console.warn('[incrementThemesVersion] RPC调用失败，使用降级方案:', error);
      
      // 降级方案：先获取当前版本，然后+1
      const { data } = await supabase
        .from('cache_versions')
        .select('themes_version')
        .eq('user_id', userId)
        .single();
      
      const currentVersion = data?.themes_version || 1;
      
      const { error: updateError } = await supabase
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
    
    // 清除内存缓存
    const cacheKey = `myThemes_${userId}`;
    myThemesCache.delete(cacheKey);
    
  } catch (error) {
    console.error('[incrementThemesVersion] 递增缓存版本失败:', error);
    throw error;
  }
}

// 🔥 清除我的主题缓存（兼容旧版本）
export async function clearMyThemesCache(userId: string): Promise<void> {
  const cacheKey = `myThemes_${userId}`;
  myThemesCache.delete(cacheKey);
  console.log(`🧹 清除我的主题缓存，用户: ${userId}`);
}

// 🔥 核心函数：列出用户主题（带缓存版本检查）
export async function listMyThemes() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('[listMyThemes] 用户未登录');
      return { data: [], error: '用户未登录' };
    }
    
    const userId = user.id;
    const cacheKey = `myThemes_${userId}`;
    
    // 1. 获取当前缓存版本号
    const currentVersion = await getUserThemesVersion(userId);
    
    // 2. 检查缓存（版本匹配且未过期）
    const cached = myThemesCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() && cached.version === currentVersion) {
      console.log(`✅ 主题缓存命中，用户: ${user.email}, 版本: ${currentVersion}`);
      return { data: cached.data, error: null };
    }
    
    console.log(`[listMyThemes] 缓存未命中，查询用户 ${user.email} 的主题，版本: ${currentVersion}`);
    
    // 3. 查询数据库
    const { data, error } = await supabase
      .from('themes')
      .select('id, title, description, created_at, task_count, updated_at')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[listMyThemes] 查询主题失败:', error);
      return { data: [], error: error.message };
    }
    
    // 4. 更新缓存（带版本号）
    myThemesCache.set(cacheKey, {
      data: data || [],
      version: currentVersion,
      expiresAt: Date.now() + MY_THEMES_CACHE_TTL
    });
    
    return { data: data || [], error: null };
    
  } catch (error: any) {
    console.error('[listMyThemes] 异常:', error);
    return { data: [], error: '服务器错误' };
  }
}

// 🔥 创建新主题
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

// 🔥 批量插入任务（用于AI生成）
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
    
    // 1. 获取当前用户信息
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: '用户未登录' };
    }
    
    // 2. 验证主题是否属于当前用户
    const { data: theme, error: themeError } = await supabase
      .from('themes')
      .select('id, creator_id')
      .eq('id', theme_id)
      .single();
    
    if (themeError || !theme) {
      return { data: null, error: '主题不存在' };
    }
    
    if (theme.creator_id !== user.id) {
      return { data: null, error: '无权修改此主题' };
    }
    
    // 3. 批量插入任务
    const tasksToInsert = tasks.map((task, index) => ({
      theme_id,
      description: task.description || task.content || '未命名任务',
      type: task.type || 'interaction',
      order_index: task.order_index || index,
      is_ai_generated: true,
      created_at: new Date().toISOString()
    }));
    
    const { data: insertedTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();
    
    if (insertError) {
      console.error('[bulkInsertTasks] 批量插入任务失败:', insertError);
      return { data: null, error: `数据库错误: ${insertError.message}` };
    }
    
    // 4. 更新主题的任务计数
    const { count, error: countError } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('theme_id', theme_id);
    
    if (countError) {
      console.error('[bulkInsertTasks] 统计任务数失败:', countError);
    } else {
      const { error: updateError } = await supabase
        .from('themes')
        .update({ 
          task_count: count || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', theme_id);
      
      if (updateError) {
        console.error('[bulkInsertTasks] 更新主题任务计数失败:', updateError);
      }
    }
    
    console.log(`[bulkInsertTasks] 成功插入 ${insertedTasks?.length || 0} 个任务`);
    
    // 5. 递增缓存版本号
    await incrementThemesVersion(user.id);
    
    return { data: insertedTasks, error: null };
    
  } catch (error: any) {
    console.error('[bulkInsertTasks] 未知错误:', error);
    return { data: null, error: error.message || '保存任务失败' };
  }
}

// 🔥 创建单个任务（手动添加）
export async function createTask(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: '用户未登录' };
    
    const theme_id = formData.get('theme_id') as string;
    const description = formData.get('description') as string;
    const type = (formData.get('type') as string) || 'interaction';
    const order_index = parseInt(formData.get('order_index') as string) || 0;
    
    if (!theme_id || !description) {
      return { data: null, error: '主题ID和任务描述不能为空' };
    }
    
    console.log(`[createTask] 用户 ${user.email} 为主题 ${theme_id} 创建任务`);
    
    // 验证主题所有权
    const { data: theme, error: themeError } = await supabase
      .from('themes')
      .select('creator_id')
      .eq('id', theme_id)
      .single();
    
    if (themeError || !theme) {
      return { data: null, error: '主题不存在' };
    }
    
    if (theme.creator_id !== user.id) {
      return { data: null, error: '无权在此主题下创建任务' };
    }
    
    // 创建任务
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        theme_id,
        description: description.trim(),
        type,
        order_index,
        is_ai_generated: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) return { data: null, error: error.message };
    
    console.log(`[createTask] 任务创建成功: ${data.id}`);
    
    // 更新主题任务计数
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('theme_id', theme_id);
    
    await supabase
      .from('themes')
      .update({ 
        task_count: count || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', theme_id);
    
    // 递增缓存版本号
    await incrementThemesVersion(user.id);
    
    return { data, error: null };
  } catch (error: any) {
    console.error('[createTask] 异常:', error);
    return { data: null, error: error.message || '创建任务时发生错误' };
  }
}

// 🔥 更新任务
export async function updateTask(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: '用户未登录' };
    
    const id = formData.get('id') as string;
    const description = formData.get('description') as string;
    const type = formData.get('type') as string;
    const order_index = parseInt(formData.get('order_index') as string) || 0;
    
    if (!id || !description) {
      return { data: null, error: '任务ID和描述不能为空' };
    }
    
    console.log(`[updateTask] 用户 ${user.email} 更新任务 ${id}`);
    
    // 获取任务以验证所有权
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('theme_id, themes!inner(creator_id)')
      .eq('id', id)
      .single();
    
    if (taskError || !task) {
      return { data: null, error: '任务不存在' };
    }
    
    // 验证主题所有权
    const { data: theme } = await supabase
      .from('themes')
      .select('creator_id')
      .eq('id', task.theme_id)
      .single();
    
    if (!theme || theme.creator_id !== user.id) {
      return { data: null, error: '无权更新此任务' };
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .update({ 
        description, 
        type, 
        order_index, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) return { data: null, error: error.message };
    
    console.log(`[updateTask] 任务 ${id} 更新成功`);
    
    // 递增缓存版本号
    await incrementThemesVersion(user.id);
    
    return { data, error: null };
  } catch (error: any) {
    console.error('[updateTask] 异常:', error);
    return { data: null, error: error.message || '更新任务时发生错误' };
  }
}

// 🔥 删除任务
export async function deleteTask(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: '用户未登录' };
    
    const id = formData.get('id') as string;
    
    if (!id) {
      return { data: null, error: '任务ID不能为空' };
    }
    
    console.log(`[deleteTask] 用户 ${user.email} 删除任务 ${id}`);
    
    // 获取任务信息以更新主题计数
    const { data: task, error: fetchError } = await supabase
      .from('tasks')
      .select('theme_id')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('[deleteTask] 获取任务信息失败:', fetchError);
      return { data: null, error: fetchError.message || '任务不存在' };
    }
    
    // 验证主题所有权
    const { data: theme, error: themeError } = await supabase
      .from('themes')
      .select('creator_id')
      .eq('id', task.theme_id)
      .single();
    
    if (themeError || !theme || theme.creator_id !== user.id) {
      return { data: null, error: '无权删除此任务' };
    }
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('[deleteTask] 删除任务失败:', error);
      return { data: null, error: error.message };
    }
    
    console.log(`[deleteTask] 任务 ${id} 删除成功`);
    
    // 更新主题的任务计数
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('theme_id', task.theme_id);
    
    await supabase
      .from('themes')
      .update({ 
        task_count: count || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', task.theme_id);
    
    // 递增缓存版本号
    await incrementThemesVersion(user.id);
    
    return { data: { success: true }, error: null };
  } catch (error: any) {
    console.error('[deleteTask] 异常:', error);
    return { data: null, error: error.message || '删除任务时发生错误' };
  }
}

// 🔥 删除主题
export async function deleteTheme(formData: FormData) {
  try {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: '用户未登录' };
    }
    
    const id = formData.get('id') as string;
    
    console.log(`[deleteTheme] 用户 ${user.email} 删除主题 ${id}`);
    
    // 1. 验证主题是否属于当前用户
    const { data: theme, error: themeError } = await supabase
      .from('themes')
      .select('id, creator_id')
      .eq('id', id)
      .single();
    
    if (themeError || !theme) {
      return { data: null, error: '主题不存在' };
    }
    
    if (theme.creator_id !== user.id) {
      return { data: null, error: '无权删除此主题' };
    }
    
    // 2. 先删除关联的任务（级联删除）
    const { error: deleteTasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('theme_id', id);
    
    if (deleteTasksError) {
      console.error('[deleteTheme] 删除关联任务失败:', deleteTasksError);
    }
    
    // 3. 删除主题
    const { error: deleteThemeError } = await supabase
      .from('themes')
      .delete()
      .eq('id', id);
    
    if (deleteThemeError) {
      console.error('[deleteTheme] 删除主题失败:', deleteThemeError);
      return { data: null, error: '删除主题失败: ' + deleteThemeError.message };
    }
    
    console.log(`[deleteTheme] 主题 ${id} 删除成功`);
    
    // 4. 递增缓存版本号
    await incrementThemesVersion(user.id);
    
    return { data: { success: true }, error: null };
    
  } catch (error: any) {
    console.error('[deleteTheme] 异常:', error);
    return { data: null, error: '删除主题时发生错误' };
  }
}

// 🔥 获取主题详情
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
  } catch (error: any) {
    console.error('[getThemeById] 异常:', error);
    return { data: null, error: '服务器错误' };
  }
}

// 🔥 获取主题下的任务
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
  } catch (error: any) {
    console.error('[listTasksByTheme] 异常:', error);
    return { data: [], error: '服务器错误' };
  }
}

// 🔥 更新主题
export async function updateTheme(formData: FormData) {
  try {
    const supabase = await createClient();
    
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: '用户未登录' };
    }
    
    // 验证主题所有权
    const { data: theme, error: checkError } = await supabase
      .from('themes')
      .select('creator_id')
      .eq('id', id)
      .single();
    
    if (checkError || !theme) {
      return { data: null, error: '主题不存在' };
    }
    
    if (theme.creator_id !== user.id) {
      return { data: null, error: '无权更新此主题' };
    }
    
    const { data, error } = await supabase
      .from('themes')
      .update({ 
        title, 
        description, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[updateTheme] 更新主题失败:', error);
      return { data: null, error: error.message };
    }
    
    // 递增缓存版本号
    await incrementThemesVersion(user.id);
    
    return { data, error: null };
  } catch (error: any) {
    console.error('[updateTheme] 异常:', error);
    return { data: null, error: '服务器错误' };
  }
}

// 🔥 获取可用主题（包括公开主题）
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
  } catch (error: any) {
    console.error('[listAvailableThemes] 异常:', error);
    return { data: [], error: '服务器错误' };
  }
}

// 🔥 确保数据库函数存在（用于主题任务计数）
async function ensureRpcFunctions() {
  try {
    const supabase = await createClient();
    
    // 检查increment_theme_task_count函数是否存在
    const { error: checkError } = await supabase.rpc('increment_theme_task_count', { 
      theme_id: 0  // 使用虚拟参数检查函数是否存在
    });
    
    // 如果函数不存在（错误中包含"function does not exist"），则创建
    if (checkError && checkError.message.includes('function does not exist')) {
      console.warn('RPC函数不存在，需要创建...');
      // 注意：实际项目中，应该在数据库迁移中创建这些函数
      // 这里只是打印警告，提醒开发者
    }
  } catch (error) {
    console.error('[ensureRpcFunctions] 检查RPC函数失败:', error);
  }
}
