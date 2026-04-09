'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Power, 
  PowerOff,
  Loader2,
  Save,
  X
} from 'lucide-react';

interface AIModel {
  id: string;
  name: string;
  display_name: string;
  provider: string;
  api_url: string;
  priority: number;
  is_active: boolean;
  max_tokens: number;
  temperature: number;
  success_count: number;
  fail_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function AIModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    provider: 'openrouter',
    api_url: '',
    priority: 0,
    is_active: true,
    max_tokens: 6000,
    temperature: 0.9
  });

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/admin/ai-models');
      const result = await response.json();
      if (result.success) {
        setModels(result.data);
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const url = editingModel ? '/api/admin/ai-models' : '/api/admin/ai-models';
      const method = editingModel ? 'PUT' : 'POST';
      
      const payload = editingModel 
        ? { id: editingModel.id, ...formData }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      if (result.success) {
        setShowAddModal(false);
        setEditingModel(null);
        setFormData({
          name: '',
          display_name: '',
          provider: 'openrouter',
          api_url: '',
          priority: 0,
          is_active: true,
          max_tokens: 6000,
          temperature: 0.9
        });
        fetchModels();
      } else {
        alert(result.error || '保存失败');
      }
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个模型吗？')) return;

    try {
      const response = await fetch(`/api/admin/ai-models?id=${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        fetchModels();
      } else {
        alert(result.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  const handleToggleActive = async (model: AIModel) => {
    try {
      const response = await fetch('/api/admin/ai-models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: model.id,
          is_active: !model.is_active
        })
      });

      const result = await response.json();
      
      if (result.success) {
        fetchModels();
      } else {
        alert(result.error || '操作失败');
      }
    } catch (error) {
      console.error('操作失败:', error);
      alert('操作失败');
    }
  };

  const handleMovePriority = async (model: AIModel, direction: 'up' | 'down') => {
    const currentIndex = models.findIndex(m => m.id === model.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= models.length) return;

    const targetModel = models[targetIndex];

    try {
      const response1 = await fetch('/api/admin/ai-models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: model.id,
          priority: targetModel.priority
        })
      });

      const response2 = await fetch('/api/admin/ai-models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetModel.id,
          priority: model.priority
        })
      });

      if (response1.ok && response2.ok) {
        fetchModels();
      } else {
        alert('调整优先级失败');
      }
    } catch (error) {
      console.error('调整优先级失败:', error);
      alert('调整优先级失败');
    }
  };

  const openEditModal = (model: AIModel) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      display_name: model.display_name,
      provider: model.provider,
      api_url: model.api_url,
      priority: model.priority,
      is_active: model.is_active,
      max_tokens: model.max_tokens,
      temperature: model.temperature
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingModel(null);
    setFormData({
      name: '',
      display_name: '',
      provider: 'openrouter',
      api_url: '',
      priority: 0,
      is_active: true,
      max_tokens: 6000,
      temperature: 0.9
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-brand-pink" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">AI 模型管理</h1>
          <p className="text-gray-400 text-sm">管理 AI 模型配置，调整优先级和参数</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-pink to-brand-rose text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          添加模型
        </button>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700/50">
              <th className="text-left p-4 text-gray-300 font-medium">优先级</th>
              <th className="text-left p-4 text-gray-300 font-medium">模型名称</th>
              <th className="text-left p-4 text-gray-300 font-medium">提供商</th>
              <th className="text-left p-4 text-gray-300 font-medium">API 地址</th>
              <th className="text-left p-4 text-gray-300 font-medium">状态</th>
              <th className="text-left p-4 text-gray-300 font-medium">统计</th>
              <th className="text-left p-4 text-gray-300 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model, index) => (
              <tr key={model.id} className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{model.priority}</span>
                    <div className="flex flex-col">
                      <button
                        onClick={() => handleMovePriority(model, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleMovePriority(model, 'down')}
                        disabled={index === models.length - 1}
                        className="p-1 hover:bg-gray-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div>
                    <div className="text-white font-medium">{model.display_name}</div>
                    <div className="text-gray-500 text-sm">{model.name}</div>
                  </div>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-sm">
                    {model.provider}
                  </span>
                </td>
                <td className="p-4">
                  <div className="text-gray-400 text-sm truncate max-w-xs" title={model.api_url}>
                    {model.api_url}
                  </div>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleToggleActive(model)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                      model.is_active 
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    }`}
                  >
                    {model.is_active ? (
                      <Power className="w-4 h-4" />
                    ) : (
                      <PowerOff className="w-4 h-4" />
                    )}
                    {model.is_active ? '启用' : '禁用'}
                  </button>
                </td>
                <td className="p-4">
                  <div className="text-sm">
                    <div className="text-green-400">成功: {model.success_count}</div>
                    <div className="text-red-400">失败: {model.fail_count}</div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(model)}
                      className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDelete(model.id)}
                      className="p-2 hover:bg-red-600 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingModel ? '编辑模型' : '添加模型'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">模型标识名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-brand-pink outline-none"
                  placeholder="例如: deepseek-chat"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">显示名称</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-brand-pink outline-none"
                  placeholder="例如: DeepSeek Chat"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">提供商</label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-brand-pink outline-none"
                >
                  <option value="openrouter">OpenRouter</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="other">其他</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">API 地址</label>
                <input
                  type="text"
                  value={formData.api_url}
                  onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-brand-pink outline-none"
                  placeholder="例如: https://openrouter.ai/api/v1/chat/completions"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">优先级</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-brand-pink outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-2">最大 Token</label>
                  <input
                    type="number"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-brand-pink outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">温度</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-brand-pink outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 text-brand-pink focus:ring-brand-pink"
                />
                <label htmlFor="is_active" className="text-sm text-gray-300">启用此模型</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-pink to-brand-rose text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
