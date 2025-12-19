// /app/admin/keys/page.tsx
'use client'; // 这是一个客户端交互页面

import { useState, useEffect } from 'react';

export default function KeyManagerPage() {
  const [keys, setKeys] = useState([]);
  const [newKey, setNewKey] = useState('');
  const [form, setForm] = useState({
    description: '一年期VIP用户',
    maxUses: 1,
    validDays: 365,
  });

  // 1. 加载密钥列表
  const loadKeys = async () => {
    const res = await fetch('/api/admin/keys');
    const data = await res.json();
    setKeys(data);
  };

  // 2. 生成新密钥
  const handleGenerate = async () => {
    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const result = await res.json();
    if (res.ok) {
      setNewKey(result.key_code); // 显示新生成的密钥
      loadKeys(); // 重新加载列表
      alert(`新密钥已生成：${result.key_code}`);
    } else {
      alert('生成失败：' + result.error);
    }
  };

  // 3. 复制密钥
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  // 页面加载时获取一次密钥列表
  useEffect(() => {
    loadKeys();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>访问密钥管理后台</h1>

      {/* 生成密钥区域 */}
      <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}>
        <h2>生成新密钥</h2>
        <div>
          <label>描述： </label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={{ width: '300px' }}
          />
        </div>
        <div>
          <label>使用次数： </label>
          <input
            type="number"
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: parseInt(e.target.value) })}
            style={{ width: '80px' }}
          />
        </div>
        <div>
          <label>账号有效期(天)： </label>
          <input
            type="number"
            value={form.validDays}
            onChange={(e) => setForm({ ...form, validDays: parseInt(e.target.value) })}
            style={{ width: '80px' }}
          />
        </div>
        <button onClick={handleGenerate} style={{ marginTop: '10px' }}>
          生成密钥
        </button>
        {newKey && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#f0f0f0' }}>
            <p>
              <strong>新密钥：</strong> <code>{newKey}</code>
            </p>
            <button onClick={() => copyToClipboard(newKey)}>复制</button>
          </div>
        )}
      </div>

      {/* 密钥列表区域 */}
      <div>
        <h2>密钥列表</h2>
        <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>密钥</th>
              <th>描述</th>
              <th>已用/次数</th>
              <th>账号有效期</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>
                  <code>{k.key_code}</code>
                </td>
                <td>{k.description}</td>
                <td>
                  {k.used_count} / {k.max_uses}
                </td>
                <td>{k.account_valid_for_days} 天</td>
                <td>{k.is_active ? '✅ 有效' : '❌ 禁用'}</td>
                <td>
                  <button onClick={() => copyToClipboard(k.key_code)}>复制</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
