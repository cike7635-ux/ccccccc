// /app/themes/[id]/page.tsx - 修复 TypeScript 错误
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Check, AlertCircle } from "lucide-react";
import { getThemeById, listTasksByTheme, updateTheme, createTask, updateTask, deleteTask } from "../actions";
import GenerateTasksSection from "@/components/generate-tasks";
import { useRouter } from 'next/navigation';

type Params = { params: Promise<{ id: string }> };

export default function ThemeDetailPage({ params }: Params) {
  const [theme, setTheme] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [themeSaveStatus, setThemeSaveStatus] = useState<{
    isSaving: boolean;
    showSuccess: boolean;
    error: string | null;
  }>({ isSaving: false, showSuccess: false, error: null });
  const [taskSavingId, setTaskSavingId] = useState<string | null>(null);
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({});
  const router = useRouter();
  const themeFormRef = useRef<HTMLFormElement>(null);

  // 初始化数据
  useEffect(() => {
    const initData = async () => {
      const { id: themeId } = await params;
      const [themeResult, tasksResult] = await Promise.all([
        getThemeById(themeId),
        listTasksByTheme(themeId),
      ]);
      
      setTheme(themeResult.data);
      setTasks(tasksResult.data || []);
      setLoading(false);
    };
    initData();
  }, [params]);

  // 处理主题保存 - 修复：不刷新页面
  const handleSaveTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (themeSaveStatus.isSaving || !themeFormRef.current) return;
    
    setThemeSaveStatus({ isSaving: true, showSuccess: false, error: null });
    
    try {
      const formData = new FormData(themeFormRef.current);
      await updateTheme(formData); // 假设 updateTheme 没有返回值或返回 void
      
      // 更新本地theme状态
      setTheme((prev: any) => ({
        ...prev,
        title: formData.get('title') as string,
        description: formData.get('description') as string,
      }));
      
      // 显示成功状态
      setThemeSaveStatus({ isSaving: false, showSuccess: true, error: null });
      
      // 3秒后隐藏成功提示
      setTimeout(() => {
        setThemeSaveStatus(prev => ({ ...prev, showSuccess: false }));
      }, 3000);
      
    } catch (error: any) {
      setThemeSaveStatus({ 
        isSaving: false, 
        showSuccess: false, 
        error: error.message || '保存失败，请重试' 
      });
      console.error('保存失败:', error);
    }
  };

  // 处理任务保存 - 修复：不刷新页面
  const handleSaveTask = async (e: React.FormEvent, taskId: string) => {
    e.preventDefault();
    if (taskSavingId === taskId) return;
    
    setTaskSavingId(taskId);
    setTaskErrors(prev => ({ ...prev, [taskId]: '' }));
    
    try {
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      await updateTask(formData); // 假设 updateTask 没有返回值或返回 void
      
      // 更新本地tasks状态
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { ...task, description: formData.get('description') as string }
          : task
      ));
      
      // 显示成功状态
      const taskElement = form.closest('.task-item');
      if (taskElement) {
        const saveBtn = taskElement.querySelector('.save-btn');
        if (saveBtn) {
          const originalText = saveBtn.textContent;
          saveBtn.innerHTML = `
            <div class="flex items-center gap-1 text-green-400">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <span>已保存</span>
            </div>
          `;
          
          setTimeout(() => {
            saveBtn.innerHTML = originalText || '保存';
            setTaskSavingId(null);
          }, 1500);
        }
      }
      
    } catch (error: any) {
      setTaskSavingId(null);
      setTaskErrors(prev => ({ 
        ...prev, 
        [taskId]: error.message || '保存失败，请重试' 
      }));
      console.error('保存任务失败:', error);
    }
  };

  // 处理添加任务
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    
    try {
      await createTask(formData); // 假设 createTask 没有返回值或返回 void
      
      // 刷新任务列表
      const { id: themeId } = await params;
      const tasksResult = await listTasksByTheme(themeId);
      setTasks(tasksResult.data || []);
      
      // 清空表单
      form.reset();
      
      // 显示成功提示
      const addBtn = form.querySelector('.add-task-btn');
      if (addBtn) {
        const originalText = addBtn.innerHTML;
        addBtn.innerHTML = `
          <div class="flex items-center gap-2 text-green-400">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span>添加成功</span>
          </div>
        `;
        
        setTimeout(() => {
          addBtn.innerHTML = originalText;
        }, 1500);
      }
      
    } catch (error: any) {
      console.error('添加任务失败:', error);
    }
  };

  // 处理删除任务
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) return;
    
    try {
      const formData = new FormData();
      formData.append('id', taskId);
      
      await deleteTask(formData); // 假设 deleteTask 没有返回值或返回 void
      
      // 从本地状态中移除任务
      setTasks(prev => prev.filter(task => task.id !== taskId));
      
    } catch (error: any) {
      console.error('删除任务失败:', error);
      alert('删除失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-svh flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-pink mx-auto mb-4"></div>
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="max-w-md mx-auto min-h-svh flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-6 text-center">
          <h3 className="text-xl font-bold mb-2">主题不存在</h3>
          <p className="text-gray-400 mb-4">请返回主题列表重试</p>
          <Button asChild className="gradient-primary glow-pink">
            <Link href="/themes">返回主题列表</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-svh flex flex-col pb-24 px-6">
      <div className="glass px-6 pt-4 pb-6 rounded-b-3xl -mx-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/themes" className="text-white/80 hover:text-white flex items-center space-x-2">
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </Link>
          <h2 className="text-xl font-bold">主题管理</h2>
          <div className="w-16" />
        </div>
      </div>

      <div className="space-y-4">
        {/* 主题信息表单 */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-lg font-bold mb-4">主题信息</h3>
          <form ref={themeFormRef} onSubmit={handleSaveTheme} className="space-y-4">
            <input type="hidden" name="id" value={theme.id} />
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium">主题标题</Label>
              <Input
                id="title"
                name="title"
                defaultValue={theme.title}
                required
                className="bg-white/10 border-white/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">主题描述</Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm outline-none focus:border-brand-pink transition-all"
                defaultValue={theme.description ?? ""}
              />
            </div>
            
            {/* 错误提示 */}
            {themeSaveStatus.error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-center text-red-400">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span className="text-sm">{themeSaveStatus.error}</span>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-end gap-3">
              {themeSaveStatus.showSuccess && (
                <div className="flex items-center text-green-400 animate-pulse">
                  <Check className="w-4 h-4 mr-1" />
                  <span className="text-sm">保存成功</span>
                </div>
              )}
              <Button 
                type="submit" 
                className="gradient-primary glow-pink"
                disabled={themeSaveStatus.isSaving}
              >
                {themeSaveStatus.isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    保存中...
                  </>
                ) : (
                  '保存修改'
                )}
              </Button>
            </div>
          </form>
        </div>

        {/* 添加任务表单 */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-lg font-bold mb-4">添加任务</h3>
          <form onSubmit={handleAddTask} className="space-y-4">
            <input type="hidden" name="theme_id" value={theme.id} />
            <input type="hidden" name="type" value="interaction" />
            <input type="hidden" name="order_index" value="0" />
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">任务内容</Label>
              <textarea
                id="description"
                name="description"
                rows={3}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-sm outline-none focus:border-brand-pink transition-all"
                placeholder="例如：一起完成 10 分钟冥想并分享感受"
                required
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <GenerateTasksSection inline themeId={theme.id} themeTitle={theme.title} themeDescription={theme.description} />
              <Button 
                type="submit" 
                className="gradient-primary glow-pink flex items-center space-x-2 add-task-btn"
              >
                <Plus className="w-4 h-4" />
                <span>添加任务</span>
              </Button>
            </div>
          </form>
        </div>

        {/* 任务列表 */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">任务列表</h3>
            <span className="text-sm text-gray-400">{tasks.length} 个任务</span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">暂无任务，先添加一个吧</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 task-item" key={task.id}>
                  <form onSubmit={(e) => handleSaveTask(e, task.id)} className="space-y-3">
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="type" value={task.type} />
                    <input type="hidden" name="order_index" value={task.order_index ?? 0} />
                    <input type="hidden" name="theme_id" value={theme.id} />
                    <div className="space-y-2">
                      <textarea
                        name="description"
                        rows={3}
                        className="w-full min-h-16 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm outline-none focus:border-brand-pink transition-all"
                        defaultValue={task.description}
                        required
                      />
                    </div>
                    
                    {/* 任务错误提示 */}
                    {taskErrors[task.id] && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                        <div className="flex items-center text-red-400">
                          <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                          <span className="text-xs">{taskErrors[task.id]}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                        variant="ghost"
                        size="icon"
                        aria-label="删除任务"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        type="submit" 
                        variant="outline" 
                        size="sm" 
                        className="border-white/20 hover:bg-white/10 flex items-center gap-2 save-btn"
                        disabled={taskSavingId === task.id}
                      >
                        {taskSavingId === task.id ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            保存中...
                          </>
                        ) : (
                          '保存'
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
