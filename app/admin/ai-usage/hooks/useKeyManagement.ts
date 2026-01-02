// /app/admin/ai-usage/hooks/useKeyManagement.ts
import { useState, useCallback } from 'react';
import { AIKey } from '../types';

export function useKeyManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 生成密钥
  const generateKey = useCallback(async (params: {
    keyType: 'cycle' | 'daily' | 'total';
    incrementAmount: number;
    durationDays?: number;
    maxUses?: number;
    isActive?: boolean;
    description?: string;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/ai-usage/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          keyCode: generateKeyCode(),
        }),
      });

      if (!response.ok) {
        throw new Error('生成密钥失败');
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      console.error('生成密钥失败:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 更新密钥状态
  const updateKeyStatus = useCallback(async (keyId: string, isActive: boolean) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/ai-usage/keys/${keyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        throw new Error('更新密钥状态失败');
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      console.error('更新密钥状态失败:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 删除密钥
  const deleteKey = useCallback(async (keyId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/ai-usage/keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除密钥失败');
      }

      return true;
    } catch (err: any) {
      setError(err.message);
      console.error('删除密钥失败:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 批量操作
  const batchOperation = useCallback(async (operation: 'activate' | 'deactivate' | 'delete', keyIds: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/ai-usage/keys/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operation, keyIds }),
      });

      if (!response.ok) {
        throw new Error('批量操作失败');
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      setError(err.message);
      console.error('批量操作失败:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 导出密钥
  const exportKeys = useCallback(async (keys: AIKey[], format: 'json' | 'csv') => {
    const exportData = keys.map(key => ({
      ...key,
      status: getKeyStatus(key),
    }));

    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;
      case 'csv':
        const headers = Object.keys(exportData[0]);
        const rows = exportData.map(key => Object.values(key).join(','));
        content = [headers.join(','), ...rows].join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-keys-export-${new Date().toISOString().split('T')[0]}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return url;
  }, []);

  return {
    loading,
    error,
    generateKey,
    updateKeyStatus,
    deleteKey,
    batchOperation,
    exportKeys,
  };
}

// 辅助函数
function generateKeyCode(): string {
  const prefix = 'AI';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function getKeyStatus(key: AIKey): string {
  if (!key.isActive) return '禁用';
  if (key.usedAt) return '已使用';
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) return '已过期';
  return '未使用';
}