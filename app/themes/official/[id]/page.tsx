'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";
import { getOfficialThemeById, listOfficialTasksByTheme } from "../../actions";

type Params = { params: Promise<{ id: string }> };

export default function OfficialThemeDetailPage({ params }: Params) {
  const [theme, setTheme] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      const { id: themeId } = await params;
      const [themeResult, tasksResult] = await Promise.all([
        getOfficialThemeById(themeId),
        listOfficialTasksByTheme(themeId),
      ]);
      
      setTheme(themeResult.data);
      setTasks(tasksResult.data || []);
      setLoading(false);
    };
    initData();
  }, [params]);

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
          <h3 className="text-xl font-bold mb-2">官方主题不存在</h3>
          <p className="text-gray-400 mb-4">请返回主题列表重试</p>
          <Link href="/themes" className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors">
            返回主题列表
          </Link>
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
          <h2 className="text-xl font-bold">官方主题</h2>
          <div className="w-16" />
        </div>
        
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">{theme.title}</h1>
          <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full">官方</span>
        </div>
        {theme.description && (
          <p className="text-gray-400 mt-2">{theme.description}</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">任务列表</h3>
            <span className="text-sm text-gray-400">
              共 {tasks.length} 个任务
            </span>
          </div>
          
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4">
            <div className="flex items-center text-yellow-400">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="text-sm">官方主题仅供查看，无法编辑或删除</span>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="space-y-3">
            {tasks.map((task: any, index: number) => (
              <div 
                key={task.id} 
                className="bg-white/5 rounded-xl p-4 border border-white/10"
              >
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-brand-pink to-brand-purple flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm">{task.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}