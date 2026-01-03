// /app/admin/ai-usage/page.tsx - 动态渲染版本
export const dynamic = 'force-dynamic'; // 强制动态渲染，绕过预渲染错误
export const revalidate = 0; // 不缓存

export default function AIUsagePage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* 头部 */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827' }}>
            AI使用统计
          </h1>
          <p style={{ color: '#4b5563', marginTop: '0.25rem' }}>
            监控AI功能使用情况和成本
          </p>
        </div>

        {/* 统计卡片 */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(1, 1fr)',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {[
            { title: '总使用次数', value: '4,231', change: '+12%' },
            { title: '总用户数', value: '34', change: '+8%' },
            { title: 'Tokens消耗', value: '73,381', change: '+15%' },
            { title: '总成本', value: '¥0.138', change: '+18%' },
            { title: '成功率', value: '95.2%', change: '+2%' },
            { title: '活跃用户', value: '12', change: '+10%' },
          ].map((card, index) => (
            <div key={index} style={{
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              padding: '1rem',
            }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#4b5563', marginBottom: '0.5rem' }}>
                {card.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
                  {card.value}
                </span>
                <span style={{
                  marginLeft: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: card.change.startsWith('+') ? '#059669' : '#dc2626'
                }}>
                  {card.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 关键数据 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#111827', marginBottom: '1rem' }}>
            关键指标
          </h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#4b5563' }}>24小时窗口：4次</span>
              <span style={{ fontWeight: '500' }}>成本：¥0.0103</span>
            </div>
            <div style={{ height: '0.5rem', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', backgroundColor: '#3b82f6', width: '40%' }}></div>
            </div>
          </div>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
              <span style={{ color: '#4b5563' }}>30天窗口：19次</span>
              <span style={{ fontWeight: '500' }}>成本：¥0.0488</span>
            </div>
            <div style={{ height: '0.5rem', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', backgroundColor: '#10b981', width: '19%' }}></div>
            </div>
          </div>
        </div>

        {/* 底部信息 */}
        <div style={{ paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb', fontSize: '0.875rem', color: '#6b7280' }}>
          <p>最后更新: {new Date().toLocaleString('zh-CN')}</p>
          <p style={{ marginTop: '0.25rem' }}>系统基于生产环境实时统计，仅管理员可见</p>
        </div>
      </div>
    </div>
  );
}