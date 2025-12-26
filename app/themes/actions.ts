// /app/themes/actions.ts
// 修复版本：确保新用户有默认主题，修复初始化逻辑
'use server';

import { createClient } from '@/lib/supabase/server';
import { ensureProfile } from '@/lib/profile';
import fs from 'fs/promises';
import path from 'path';

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
