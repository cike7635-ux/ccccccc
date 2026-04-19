'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Upload,
  RefreshCw,
  Trash2,
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Star,
  BookOpen,
  Eye,
  EyeOff,
  Edit,
  ExternalLink,
  List,
  ArrowUp
} from 'lucide-react';

interface OfficialTheme {
  id: string;
  title: string;
  description?: string;
  type?: string;
  priority: number;
  task_count: number;
  created_at: string;
  is_public?: boolean;
}

interface UserTheme {
  id: string;
  title: string;
  description?: string;
  task_count: number;
  created_at: string;
  creator_id: string;
  profiles?: {
    nickname?: string;
    email?: string;
  };
}

interface OfficialTask {
  id: string;
  theme_id: string;
  description: string;
  order_index: number;
}

interface UserTask {
  id: string;
  theme_id: string;
  description: string;
  created_at: string;
  completed_at?: string;
}

export default function ThemesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'official' | 'user'>('official');
  const [officialThemes, setOfficialThemes] = useState<OfficialTheme[]>([]);
  const [userThemes, setUserThemes] = useState<UserTheme[]>([]);
  const [themeTasks, setThemeTasks] = useState<OfficialTask[]>([]);
  const [userThemeTasks, setUserThemeTasks] = useState<UserTask[]>([]);
  const [viewingUserTheme, setViewingUserTheme] = useState<UserTheme | null>(null);
  const [editingTheme, setEditingTheme] = useState<OfficialTheme | null>(null);
  const [showOfficialTaskModal, setShowOfficialTaskModal] = useState(false);
  const [showUserTasksModal, setShowUserTasksModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedUserTasks, setSelectedUserTasks] = useState<string[]>([]);
  const [selectedOfficialThemes, setSelectedOfficialThemes] = useState<string[]>([]);
  const [selectedUserThemes, setSelectedUserThemes] = useState<string[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState(0);
  const [newTasks, setNewTasks] = useState('');
  const [batchTitle, setBatchTitle] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [batchPriority, setBatchPriority] = useState(0);
  const [batchTasks, setBatchTasks] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deletingTasks, setDeletingTasks] = useState(false);
  const [savingTasks, setSavingTasks] = useState(false);
  const [deletingUserTask, setDeletingUserTask] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState(false);
  const [deletingThemes, setDeletingThemes] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [jumpPage, setJumpPage] = useState('');
  
  // 添加编辑主题基本信息的状态
  const [showEditThemeModal, setShowEditThemeModal] = useState(false);
  const [editingThemeBasic, setEditingThemeBasic] = useState<{
    id: string;
    title: string;
    description: string;
    type: string;
    priority: number;
    is_public: boolean;
  } | null>(null);

  // 获取官方主题
  const fetchOfficialThemes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      })
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/admin/themes/official?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setOfficialThemes(result.data || [])
        setTotalCount(result.total || 0)
      }
    } catch (error) {
      console.error('获取官方主题失败:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm])

  // 获取用户主题
  const fetchUserThemes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      })
      if (searchTerm) params.append('search', searchTerm)

      const response = await fetch(`/api/admin/themes/list?${params.toString()}`)
      const result = await response.json()

      if (result.success) {
        setUserThemes(result.data || [])
        setTotalCount(result.total || 0)
      }
    } catch (error) {
      console.error('获取用户主题失败:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchTerm])

  // 获取官方主题任务
  const fetchOfficialThemeTasks = async (themeId: string) => {
    try {
      const response = await fetch(`/api/admin/themes/official/${themeId}`)
      const result = await response.json()
      if (result.success) {
        setThemeTasks(result.data?.tasks || [])
      }
    } catch (error) {
      console.error('获取任务失败:', error)
    }
  }

  // 获取用户主题任务
  const fetchUserThemeTasks = async (themeId: string) => {
    try {
      const response = await fetch(`/api/admin/themes/user-tasks?themeId=${themeId}`)
      const result = await response.json()
      if (result.success) {
        setUserThemeTasks(result.data || [])
      }
    } catch (error) {
      console.error('获取用户任务失败:', error)
    }
  }

  // 预览官方主题任务
  const handlePreviewOfficialTasks = async (theme: OfficialTheme) => {
    setEditingTheme(theme)
    await fetchOfficialThemeTasks(theme.id)
    setViewMode('view')
    setShowOfficialTaskModal(true)
  }

  // 查看官方主题任务
  const handleViewOfficialTasks = async (theme: OfficialTheme) => {
    setEditingTheme(theme)
    await fetchOfficialThemeTasks(theme.id)
    setTaskInput(themeTasks.map(t => t.description).join('\n'))
    setSelectedTasks([])
    setViewMode('edit')
    setShowOfficialTaskModal(true)
  }

  // 切换任务选择
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId)
      } else {
        return [...prev, taskId]
      }
    })
  }

  // 批量删除官方任务
  const handleBatchDeleteTasks = async () => {
    if (selectedTasks.length === 0) return
    if (!confirm(`确定要删除选中的 ${selectedTasks.length} 个任务吗？`)) return

    setDeletingTasks(true)
    try {
      // 批量删除任务
      for (const taskId of selectedTasks) {
        await fetch(`/api/admin/themes/official/${editingTheme?.id}?taskId=${taskId}`, {
          method: 'DELETE'
        })
      }

      // 刷新任务列表
      if (editingTheme) {
        await fetchOfficialThemeTasks(editingTheme.id)
        setTaskInput(themeTasks.map(t => t.description).join('\n'))
        setSelectedTasks([])
        setMessage({ type: 'success', text: `成功删除 ${selectedTasks.length} 个任务` })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '批量删除失败' })
    } finally {
      setDeletingTasks(false)
    }
  }

  // 查看用户主题任务
  const handleViewUserTasks = async (theme: UserTheme) => {
    setViewingUserTheme(theme)
    await fetchUserThemeTasks(theme.id)
    setShowUserTasksModal(true)
  }

  // 保存官方主题任务
  const handleSaveOfficialTasks = async () => {
    if (!editingTheme) return
    setSavingTasks(true)
    try {
      const tasks = taskInput.split('\n').filter(t => t.trim())
      if (tasks.length > 0) {
        await fetch('/api/admin/themes/official', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTheme.id,
            title: editingTheme.title,
            description: editingTheme.description,
            type: editingTheme.type,
            priority: editingTheme.priority,
            tasks: tasks
          })
        })
      }

      setMessage({ type: 'success', text: '任务更新成功' })
      setShowOfficialTaskModal(false)
      fetchOfficialThemes()
    } catch (error) {
      setMessage({ type: 'error', text: '保存失败' })
    } finally {
      setSavingTasks(false)
    }
  }

  // 删除用户任务
  const handleDeleteUserTask = async (taskId: string) => {
    if (!confirm('确定要删除这个任务吗？')) return

    setDeletingUserTask(taskId)
    try {
      const response = await fetch(`/api/admin/themes/user-tasks?id=${taskId}`, {
        method: 'DELETE'
      })
      const result = await response.json()

      if (result.success) {
        setUserThemeTasks(prev => prev.filter(t => t.id !== taskId))
        setSelectedUserTasks(prev => prev.filter(id => id !== taskId))
        setMessage({ type: 'success', text: '删除成功' })
        if (viewingUserTheme) {
          fetchUserThemes()
        }
      } else {
        setMessage({ type: 'error', text: result.error || '删除失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '删除失败' })
    } finally {
      setDeletingUserTask(null)
    }
  }

  // 批量删除用户任务
  const handleBatchDeleteUserTasks = async () => {
    if (selectedUserTasks.length === 0) return
    if (!confirm(`确定要删除选中的 ${selectedUserTasks.length} 个任务吗？`)) return

    setDeletingTasks(true)
    try {
      for (const taskId of selectedUserTasks) {
        await fetch(`/api/admin/themes/user-tasks?id=${taskId}`, {
          method: 'DELETE'
        })
      }

      if (viewingUserTheme) {
        await fetchUserThemeTasks(viewingUserTheme.id)
        setUserThemeTasks(userThemeTasks.filter(t => !selectedUserTasks.includes(t.id)))
        setSelectedUserTasks([])
        setMessage({ type: 'success', text: `成功删除 ${selectedUserTasks.length} 个任务` })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '批量删除失败' })
    } finally {
      setDeletingTasks(false)
    }
  }

  // 切换用户任务选择
  const toggleUserTaskSelection = (taskId: string) => {
    setSelectedUserTasks(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId)
      } else {
        return [...prev, taskId]
      }
    })
  }

  // 全选/取消全选用户任务
  const toggleSelectAllUserTasks = () => {
    if (selectedUserTasks.length === userThemeTasks.length) {
      setSelectedUserTasks([])
    } else {
      setSelectedUserTasks(userThemeTasks.map(t => t.id))
    }
  }

  // 切换官方主题公开/隐藏
  const handleToggleOfficialVisibility = async (theme: OfficialTheme) => {
    const newVisibility = theme.is_public === false ? true : false
    const action = newVisibility ? '公开' : '隐藏'

    if (!confirm(`确定要${action}这个主题吗？`)) return

    setOperationLoading(true)
    try {
      const response = await fetch(`/api/admin/themes/official/${theme.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: theme.title,
          description: theme.description,
          type: theme.type,
          priority: theme.priority,
          is_public: newVisibility
        })
      })
      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: `${action}成功` })
        fetchOfficialThemes()
      } else {
        setMessage({ type: 'error', text: result.error || `${action}失败` })
      }
    } catch (error) {
      setMessage({ type: 'error', text: `${action}失败` })
    } finally {
      setOperationLoading(false)
    }
  }

  // 删除官方主题
  const handleDeleteOfficialTheme = async (id: string) => {
    if (!confirm('确定要删除这个官方主题吗？此操作不可恢复。')) return

    setOperationLoading(true)
    try {
      const response = await fetch(`/api/admin/themes/official/${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: '删除成功' })
        fetchOfficialThemes()
      } else {
        setMessage({ type: 'error', text: result.error || '删除失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '删除失败' })
    } finally {
      setOperationLoading(false)
    }
  }

  // 删除用户主题
  const handleDeleteUserTheme = async (id: string) => {
    if (!confirm('确定要删除这个用户主题吗？此操作不可恢复。')) return

    setOperationLoading(true)
    try {
      const response = await fetch(`/api/admin/themes/${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: '删除成功' })
        fetchUserThemes()
      } else {
        setMessage({ type: 'error', text: result.error || '删除失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '删除失败' })
    } finally {
      setOperationLoading(false)
    }
  }

  // 切换官方主题选择
  const toggleOfficialThemeSelection = (id: string) => {
    setSelectedOfficialThemes(prev => {
      if (prev.includes(id)) {
        return prev.filter(themeId => themeId !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  // 全选/取消全选官方主题
  const toggleSelectAllOfficialThemes = () => {
    if (selectedOfficialThemes.length === officialThemes.length) {
      setSelectedOfficialThemes([])
    } else {
      setSelectedOfficialThemes(officialThemes.map(t => t.id))
    }
  }

  // 批量删除官方主题
  const handleBatchDeleteOfficialThemes = async () => {
    if (selectedOfficialThemes.length === 0) return
    if (!confirm(`确定要删除选中的 ${selectedOfficialThemes.length} 个官方主题吗？此操作不可恢复。`)) return

    setDeletingThemes(true)
    try {
      for (const id of selectedOfficialThemes) {
        await fetch(`/api/admin/themes/official/${id}`, { method: 'DELETE' })
      }
      setMessage({ type: 'success', text: `成功删除 ${selectedOfficialThemes.length} 个主题` })
      fetchOfficialThemes()
      setSelectedOfficialThemes([])
    } catch (error) {
      setMessage({ type: 'error', text: '批量删除失败' })
    } finally {
      setDeletingThemes(false)
    }
  }

  // 批量删除用户主题
  const handleBatchDeleteUserThemes = async () => {
    if (selectedUserThemes.length === 0) return
    if (!confirm(`确定要删除选中的 ${selectedUserThemes.length} 个用户主题吗？此操作不可恢复。`)) return

    setDeletingThemes(true)
    try {
      for (const id of selectedUserThemes) {
        await fetch(`/api/admin/themes/${id}`, { method: 'DELETE' })
      }
      setMessage({ type: 'success', text: `成功删除 ${selectedUserThemes.length} 个主题` })
      fetchUserThemes()
      setSelectedUserThemes([])
    } catch (error) {
      setMessage({ type: 'error', text: '批量删除失败' })
    } finally {
      setDeletingThemes(false)
    }
  }

  // 创建官方主题
  const handleCreateOfficialTheme = async () => {
    if (!newTitle.trim()) {
      setMessage({ type: 'error', text: '请输入主题标题' })
      return
    }

    const tasks = newTasks.split('\n').filter(t => t.trim())
    if (tasks.length === 0) {
      setMessage({ type: 'error', text: '请输入至少一个任务' })
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/admin/themes/official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          priority: newPriority,
          tasks: tasks
        })
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: '创建成功' })
        setShowCreateModal(false)
        setNewTitle('')
        setNewDescription('')
        setNewPriority(0)
        setNewTasks('')
        fetchOfficialThemes()
      } else {
        setMessage({ type: 'error', text: result.error || '创建失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '创建失败' })
    } finally {
      setCreating(false)
    }
  }

  // 批量导入
  const handleBatchImport = async () => {
    if (!batchTitle.trim()) {
      setMessage({ type: 'error', text: '请输入主题标题' })
      return
    }

    const tasks = batchTasks.split('\n').filter(t => t.trim())
    if (tasks.length === 0) {
      setMessage({ type: 'error', text: '请输入至少一个任务' })
      return
    }

    setBatchLoading(true)
    try {
      const response = await fetch('/api/admin/themes/official', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: batchTitle.trim(),
          description: batchDescription.trim() || null,
          priority: batchPriority,
          tasks: tasks
        })
      })

      const result = await response.json()

      if (result.success) {
        setMessage({ type: 'success', text: '批量导入成功' })
        setShowBatchImport(false)
        setBatchTitle('')
        setBatchDescription('')
        setBatchPriority(0)
        setBatchTasks('')
        fetchOfficialThemes()
      } else {
        setMessage({ type: 'error', text: result.error || '导入失败' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: '导入失败' })
    } finally {
      setBatchLoading(false)
    }
  }

  // 编辑主题基本信息
  const handleEditThemeBasic = (theme: OfficialTheme) => {
    setEditingThemeBasic({
      id: theme.id,
      title: theme.title,
      description: theme.description || '',
      type: theme.type || 'normal',
      priority: theme.priority || 0,
      is_public: theme.is_public === true
    });
    setShowEditThemeModal(true);
  };

  // 保存主题基本信息
  const handleSaveThemeBasic = async () => {
    if (!editingThemeBasic) return;
    
    setOperationLoading(true);
    try {
      const response = await fetch(`/api/admin/themes/official/${editingThemeBasic.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingThemeBasic)
      });
      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: '主题信息更新成功' });
        setShowEditThemeModal(false);
        fetchOfficialThemes();
      } else {
        setMessage({ type: 'error', text: result.error || '更新失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '更新失败' });
    } finally {
      setOperationLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const [viewMode, setViewMode] = useState<'view' | 'edit'>('edit');
  const [creating, setCreating] = useState(false);
  const totalPages = Math.ceil(totalCount / 20);

  const handleJumpPage = () => {
    const page = parseInt(jumpPage);
    if (page && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setJumpPage('');
    }
  };

  useEffect(() => {
    if (activeTab === 'official') {
      setTotalCount(0);
      fetchOfficialThemes()
    } else {
      setTotalCount(0);
      fetchUserThemes()
    }
  }, [activeTab, currentPage, searchTerm, fetchOfficialThemes, fetchUserThemes])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a12] to-[#12121a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2">主题管理</h1>
            <p className="text-gray-400 text-sm">管理官方主题和用户主题</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-pink hover:bg-brand-pink/80 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              新建官方主题
            </button>
            <button
              onClick={() => setShowBatchImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              批量导入
            </button>
            {activeTab === 'official' && selectedOfficialThemes.length > 0 && (
              <button
                onClick={handleBatchDeleteOfficialThemes}
                disabled={deletingThemes}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <Trash2 className={`w-4 h-4 ${deletingThemes ? 'animate-spin' : ''}`} />
                批量删除 ({selectedOfficialThemes.length})
              </button>
            )}
            {activeTab === 'user' && selectedUserThemes.length > 0 && (
              <button
                onClick={handleBatchDeleteUserThemes}
                disabled={deletingThemes}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <Trash2 className={`w-4 h-4 ${deletingThemes ? 'animate-spin' : ''}`} />
                批量删除 ({selectedUserThemes.length})
              </button>
            )}
            <button
              onClick={() => activeTab === 'official' ? fetchOfficialThemes() : fetchUserThemes()}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {message.text}
            <button onClick={() => setMessage(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setActiveTab('official'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'official'
                ? 'bg-brand-pink text-white'
                : 'bg-white/10 hover:bg-white/20 text-gray-300'
            }`}
          >
            <Star className="w-4 h-4" />
            官方主题 ({totalCount})
          </button>
          <button
            onClick={() => { setActiveTab('user'); setCurrentPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'user'
                ? 'bg-brand-pink text-white'
                : 'bg-white/10 hover:bg-white/20 text-gray-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            用户主题 ({totalCount})
          </button>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索主题..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 rounded-lg border border-white/20 focus:border-brand-pink outline-none"
                />
              </div>
              <div className="text-sm text-gray-400 flex items-center">
                共 {totalCount} 个主题，第 {currentPage}/{totalPages || 1} 页
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-pink" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr className="text-left text-sm text-gray-400">
                      {activeTab === 'official' && officialThemes.length > 0 && (
                        <th className="px-4 py-3 w-12">
                          <input
                            type="checkbox"
                            checked={selectedOfficialThemes.length === officialThemes.length && officialThemes.length > 0}
                            onChange={toggleSelectAllOfficialThemes}
                            className="w-4 h-4 rounded border-gray-500"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3">标题</th>
                      {activeTab === 'official' && <th className="px-4 py-3">优先级</th>}
                      {activeTab === 'user' && <th className="px-4 py-3">创建者</th>}
                      <th className="px-4 py-3">任务数</th>
                      <th className="px-4 py-3">创建时间</th>
                      <th className="px-4 py-3">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === 'official' ? (
                      officialThemes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                            暂无官方主题
                          </td>
                        </tr>
                      ) : (
                        officialThemes.map((theme) => (
                          <tr key={theme.id} className={`border-t border-white/5 hover:bg-white/5 ${selectedOfficialThemes.includes(theme.id) ? 'bg-brand-pink/10' : ''}`}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedOfficialThemes.includes(theme.id)}
                                onChange={() => toggleOfficialThemeSelection(theme.id)}
                                className="w-4 h-4 rounded border-gray-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <div className="font-medium">{theme.title}</div>
                                {theme.description && (
                                  <div className="text-sm text-gray-400 truncate max-w-xs">{theme.description}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <ArrowUp className="w-3 h-3 text-gray-400" />
                                <span className="text-sm">{theme.priority}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">{theme.task_count}</td>
                            <td className="px-4 py-3 text-sm text-gray-400">{formatDate(theme.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditThemeBasic(theme)}
                                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                  title="编辑主题信息"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleOfficialVisibility(theme)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    theme.is_public === false
                                      ? 'hover:bg-yellow-500/20 text-yellow-400'
                                      : 'hover:bg-green-500/20 text-green-400'
                                  }`}
                                  title={theme.is_public === false ? '隐藏中，点击公开' : '公开中，点击隐藏'}
                                >
                                  {theme.is_public === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => handlePreviewOfficialTasks(theme)}
                                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                  title="预览任务"
                                >
                                  <List className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleViewOfficialTasks(theme)}
                                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                  title="编辑任务"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => window.open(`/themes/official/${theme.id}`, '_blank')}
                                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                  title="预览"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOfficialTheme(theme.id)}
                                  disabled={operationLoading}
                                  className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                                  title="删除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )
                    ) : (
                      <>
                        {userThemes.length > 0 && (
                          <tr className="bg-white/5">
                            <td colSpan={6} className="px-4 py-2">
                              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedUserThemes.length === userThemes.length && userThemes.length > 0}
                                  onChange={toggleSelectAllUserThemes}
                                  className="w-4 h-4 rounded border-gray-500"
                                />
                                全选本页
                              </label>
                            </td>
                          </tr>
                        )}
                        {userThemes.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                              暂无用户主题
                            </td>
                          </tr>
                        ) : (
                          userThemes.map((theme) => (
                            <tr key={theme.id} className={`border-t border-white/5 hover:bg-white/5 ${selectedUserThemes.includes(theme.id) ? 'bg-brand-pink/10' : ''}`}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedUserThemes.includes(theme.id)}
                                  onChange={() => toggleUserThemeSelection(theme.id)}
                                  className="w-4 h-4 rounded border-gray-500"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <div className="font-medium">{theme.title}</div>
                                  {theme.description && (
                                    <div className="text-sm text-gray-400 truncate max-w-xs">{theme.description}</div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {theme.profiles?.nickname || theme.profiles?.email || theme.creator_id?.slice(0, 8) + '...' || '未知'}
                              </td>
                              <td className="px-4 py-3">{theme.task_count}</td>
                              <td className="px-4 py-3 text-sm text-gray-400">{formatDate(theme.created_at)}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleViewUserTasks(theme)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    title="查看任务"
                                  >
                                    <List className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => window.open(`/themes/${theme.id}`, '_blank')}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    title="预览"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUserTheme(theme.id)}
                                    disabled={operationLoading}
                                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                                    title="删除"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* 分页 */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-white/10 flex justify-center">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
                    >
                      上一页
                    </button>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={jumpPage}
                        onChange={(e) => setJumpPage(e.target.value ? parseInt(e.target.value) : '')}
                        onKeyDown={(e) => e.key === 'Enter' && handleJumpPage()}
                        className="w-16 px-2 py-1 bg-white/10 border border-white/20 rounded-lg text-center text-sm"
                        placeholder="1"
                      />
                      <span className="text-sm text-gray-400">/ {totalPages}</span>
                      <button
                        onClick={handleJumpPage}
                        className="px-2 py-1 bg-brand-pink hover:bg-brand-pink/80 rounded-lg text-sm transition-colors"
                      >
                        跳转
                      </button>
                    </div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-50"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 官方主题任务编辑模态框 */}
        {showOfficialTaskModal && editingTheme && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {viewMode === 'edit' ? `编辑任务 - ${editingTheme.title}` : `预览任务 - ${editingTheme.title}`}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode(viewMode === 'edit' ? 'view' : 'edit')}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                  >
                    {viewMode === 'edit' ? '预览' : '编辑'}
                  </button>
                  <button onClick={() => setShowOfficialTaskModal(false)} className="p-1 hover:bg-white/10 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {viewMode === 'edit' ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">任务列表（每行一个任务）</label>
                    <textarea
                      value={taskInput}
                      onChange={(e) => setTaskInput(e.target.value)}
                      className="w-full p-3 bg-white/10 border border-white/20 rounded-lg h-64"
                      placeholder="输入任务，每行一个"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <button
                        onClick={handleBatchDeleteTasks}
                        disabled={selectedTasks.length === 0 || deletingTasks}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className={`w-4 h-4 ${deletingTasks ? 'animate-spin' : ''}`} />
                        批量删除 ({selectedTasks.length})
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowOfficialTaskModal(false)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveOfficialTasks}
                        disabled={savingTasks}
                        className="px-4 py-2 bg-brand-pink hover:bg-brand-pink/80 rounded-lg transition-colors"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">任务列表</label>
                    <div className="bg-white/5 rounded-lg p-4 max-h-80 overflow-y-auto">
                      {themeTasks.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                          暂无任务
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {themeTasks.map((task, index) => (
                            <div key={task.id} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                              <div className="w-6 h-6 rounded-full bg-brand-pink/20 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-medium">{index + 1}</span>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm">{task.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowOfficialTaskModal(false)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                      关闭
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 用户主题任务查看模态框 */}
        {showUserTasksModal && viewingUserTheme && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">任务列表 - {viewingUserTheme.title}</h3>
                <button onClick={() => setShowUserTasksModal(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">任务</h4>
                  {userThemeTasks.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedUserTasks.length === userThemeTasks.length && userThemeTasks.length > 0}
                        onChange={toggleSelectAllUserTasks}
                        className="w-4 h-4 rounded border-gray-500"
                      />
                      全选
                    </label>
                  )}
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {userThemeTasks.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      暂无任务
                    </div>
                  ) : (
                    userThemeTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                        <input
                          type="checkbox"
                          checked={selectedUserTasks.includes(task.id)}
                          onChange={() => toggleUserTaskSelection(task.id)}
                          className="w-4 h-4 rounded border-gray-500"
                        />
                        <div className="flex-1">
                          <div className={`text-sm ${task.completed_at ? 'text-gray-400 line-through' : 'text-white'}`}>
                            {task.description}
                          </div>
                          {task.completed_at && (
                            <div className="text-xs text-gray-500 mt-1">
                              完成时间：{formatDate(task.completed_at)}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteUserTask(task.id)}
                          disabled={deletingUserTask === task.id}
                          className="p-1 hover:bg-red-500/20 rounded-lg text-red-400"
                        >
                          <Trash2 className={`w-4 h-4 ${deletingUserTask === task.id ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                {selectedUserTasks.length > 0 && (
                  <button
                    onClick={handleBatchDeleteUserTasks}
                    disabled={deletingTasks}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    <Trash2 className={`w-4 h-4 ${deletingTasks ? 'animate-spin' : ''}`} />
                    批量删除 ({selectedUserTasks.length})
                  </button>
                )}
                <button
                  onClick={() => setShowUserTasksModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 创建官方主题模态框 */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">新建官方主题</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">标题</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg"
                    placeholder="请输入主题标题"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">描述</label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg"
                    placeholder="请输入主题描述"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">优先级</label>
                  <input
                    type="number"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value === '' ? 0 : parseInt(e.target.value))}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">任务列表（每行一个任务）</label>
                  <textarea
                    value={newTasks}
                    onChange={(e) => setNewTasks(e.target.value)}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg h-40"
                    placeholder="输入任务，每行一个"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateOfficialTheme}
                  disabled={creating}
                  className="px-4 py-2 bg-brand-pink hover:bg-brand-pink/80 rounded-lg transition-colors"
                >
                  创建
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 批量导入模态框 */}
        {showBatchImport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">批量导入任务</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">主题标题</label>
                  <input
                    type="text"
                    value={batchTitle}
                    onChange={(e) => setBatchTitle(e.target.value)}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg"
                    placeholder="请输入主题标题"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">描述</label>
                  <textarea
                    value={batchDescription}
                    onChange={(e) => setBatchDescription(e.target.value)}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg"
                    placeholder="请输入主题描述"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">优先级</label>
                  <input
                    type="number"
                    value={batchPriority}
                    onChange={(e) => setBatchPriority(e.target.value === '' ? 0 : parseInt(e.target.value))}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">任务列表（每行一个任务）</label>
                  <textarea
                    value={batchTasks}
                    onChange={(e) => setBatchTasks(e.target.value)}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg h-64"
                    placeholder="输入任务，每行一个"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowBatchImport(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchImport}
                  disabled={batchLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  导入
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 编辑主题信息模态框 */}
        {showEditThemeModal && editingThemeBasic && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold mb-4">编辑主题信息</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">标题</label>
                  <input
                    type="text"
                    value={editingThemeBasic.title}
                    onChange={(e) => setEditingThemeBasic({ ...editingThemeBasic, title: e.target.value })}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg"
                    placeholder="请输入主题标题"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">描述</label>
                  <textarea
                    value={editingThemeBasic.description}
                    onChange={(e) => setEditingThemeBasic({ ...editingThemeBasic, description: e.target.value })}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg"
                    placeholder="请输入主题描述"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">类型</label>
                  <select
                    value={editingThemeBasic.type}
                    onChange={(e) => setEditingThemeBasic({ ...editingThemeBasic, type: e.target.value })}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg"
                  >
                    <option value="normal">普通</option>
                    <option value="special">特殊</option>
                    <option value="seasonal">季节性</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">优先级</label>
                  <input
                    type="number"
                    value={editingThemeBasic.priority}
                    onChange={(e) => setEditingThemeBasic({ ...editingThemeBasic, priority: e.target.value === '' ? 0 : parseInt(e.target.value) })}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded-lg"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editingThemeBasic.is_public}
                      onChange={(e) => setEditingThemeBasic({ ...editingThemeBasic, is_public: e.target.checked })}
                    />
                    <span className="text-sm">公开主题</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowEditThemeModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveThemeBasic}
                  disabled={operationLoading}
                  className="px-4 py-2 bg-brand-pink hover:bg-brand-pink/80 rounded-lg transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}