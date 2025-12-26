// /app/themes/actions.ts - 完整版（包含所有缺失的函数）
'use server';

import { createClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/profile';
import fs from 'fs/promises';
import path from 'path';

// 🔥 补充缺失的函数

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
    return { data: { success: true }, error: null };
    
  } catch (error) {
    console.error('[deleteTheme] 异常:', error);
    return { data: null, error: '删除主题时发生错误' };
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
    
    if (!tasksJson) {
      return { data: null, error: '没有提供任务数据' };
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
    
    // 准备批量插入数据
    const tasksToInsert = tasks.map((task, index) => ({
      theme_id,
      description: task.description || task.content || task.task || '未命名任务',
      type: task.type || 'interaction',
      order_index: task.order_index || index,
      is_ai_generated: true,
      ai_metadata: task.metadata || {},
    }));
    
    // 批量插入
    const { data, error } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();
    
    if (error) {
      console.error('[bulkInsertTasks] 批量插入任务失败:', error);
      return { data: null, error: error.message };
    }
    
    // 更新主题的任务计数
    await supabase.rpc('increment_theme_task_count_by', { 
      theme_id, 
      increment: tasks.length 
    });
    
    console.log(`[bulkInsertTasks] 成功插入 ${data.length} 个任务`);
    return { data, error: null };
    
  } catch (error) {
    console.error('[bulkInsertTasks] 异常:', error);
    return { data: null, error: '批量插入任务时发生错误' };
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
    return { data, error: null };
    
  } catch (error) {
    console.error('[createTheme] 异常:', error);
    return { data: null, error: '创建主题时发生错误' };
  }
}

// 之前的函数保持不变...

// 获取用户所有主题
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
    
    console.log(`[listMyThemes] 查询用户 ${user.email} 的主题列表`);
    
    // 查询用户主题
    const { data, error } = await supabase
      .from('themes')
      .select('*, task_count')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[listMyThemes] 查询主题失败:', error);
      return { data: [], error: error.message };
    }
    
    // 🔥 关键修复：如果用户没有主题，初始化默认主题
    if (!data || data.length === 0) {
      console.log(`[listMyThemes] 用户 ${user.email} 没有主题，开始初始化默认主题`);
      
      try {
        // 读取默认主题模板
        const filePath = path.join(process.cwd(), 'lib', 'tasks.json');
        console.log(`[listMyThemes] 读取默认主题文件: ${filePath}`);
        
        const content = await fs.readFile(filePath, 'utf-8');
        const templates = JSON.parse(content);
        
        console.log(`[listMyThemes] 找到 ${templates.length} 个默认主题模板`);
        
        // 创建默认主题
        const createdThemes = [];
        for (const tpl of templates) {
          console.log(`[listMyThemes] 创建主题: ${tpl.title}`);
          
          // 创建主题
          const { data: theme, error: themeError } = await supabase
            .from('themes')
            .insert({
              title: tpl.title,
              description: tpl.description,
              creator_id: user.id,
              is_public: false,
              task_count: tpl.tasks.length
            })
            .select()
            .single();
          
          if (themeError) {
            console.error('[listMyThemes] 创建主题失败:', themeError);
            continue;
          }
          
          console.log(`[listMyThemes] 主题 ${theme.id} 创建成功，开始创建任务`);
          
          // 创建任务
          for (const task of tpl.tasks) {
            const { error: taskError } = await supabase.from('tasks').insert({
              theme_id: theme.id,
              description: task.description,
              type: task.type || 'interaction',
              order_index: task.order_index || 0,
              is_ai_generated: false
            });
            
            if (taskError) {
              console.error('[listMyThemes] 创建任务失败:', taskError);
            }
          }
          
          console.log(`[listMyThemes] 主题 ${theme.title} 创建完成，共 ${tpl.tasks.length} 个任务`);
          createdThemes.push(theme);
        }
        
        console.log(`[listMyThemes] 为用户 ${user.email} 创建了 ${createdThemes.length} 个默认主题`);
        
        // 返回创建的主题
        return { data: createdThemes, error: null };
        
      } catch (initError) {
        console.error('[listMyThemes] 初始化主题失败:', initError);
        
        // 尝试使用备选方案：创建一个默认主题
        try {
          console.log('[listMyThemes] 尝试创建基础默认主题');
          
          const { data: fallbackTheme, error: fallbackError } = await supabase
            .from('themes')
            .insert({
              title: '默认主题',
              description: '这是您的第一个主题，可以自由编辑任务内容',
              creator_id: user.id,
              is_public: false,
              task_count: 0
            })
            .select()
            .single();
          
          if (fallbackError) {
            console.error('[listMyThemes] 创建基础默认主题失败:', fallbackError);
            return { data: [], error: '初始化主题失败，请手动创建主题' };
          }
          
          return { data: [fallbackTheme], error: null };
          
        } catch (fallbackError) {
          console.error('[listMyThemes] 备选方案也失败:', fallbackError);
          return { data: [], error: null }; // 返回空数组，让用户手动创建
        }
      }
    }
    
    console.log(`[listMyThemes] 用户 ${user.email} 已有 ${data.length} 个主题`);
    return { data, error: null };
    
  } catch (error) {
    console.error('[listMyThemes] 获取主题异常:', error);
    return { data: [], error: '服务器错误' };
  }
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
