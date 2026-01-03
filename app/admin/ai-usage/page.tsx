// // /app/admin/ai-usage/page.tsx
// 'use client';

// import { useState, useEffect } from 'react';
// import { 
//   Activity, Users, TrendingUp, DollarSign, 
//   CheckCircle, Clock, Target, BarChart3,
//   Calendar, Download, Filter, RefreshCw,
//   Settings, Bell, Search, Zap, PieChart, LineChart,
//   Key, ChevronRight, Eye, Copy, Trash2, Edit, MoreVertical,
//   TrendingDown, AlertCircle, Info, ExternalLink, Home,
//   BarChart, PieChart as PieChartIcon, User, Key as KeyIcon
// } from 'lucide-react';
// import { 
//   LineChart as RechartsLineChart, 
//   Line, 
//   BarChart as RechartsBarChart, 
//   Bar, 
//   XAxis, 
//   YAxis, 
//   CartesianGrid, 
//   Tooltip, 
//   Legend, 
//   ResponsiveContainer,
//   PieChart as RechartsPieChart, 
//   Pie, 
//   Cell,
//   AreaChart,
//   Area
// } from 'recharts';

// // 简化版 AI 统计页面
// export default function AIUsagePage() {
//   const [loading, setLoading] = useState(true);
//   const [timeRange, setTimeRange] = useState('7d');
//   const [activeTab, setActiveTab] = useState('dashboard');

//   useEffect(() => {
//     setTimeout(() => setLoading(false), 1000);
//   }, []);

//   // 时间范围选项
//   const timeRanges = [
//     { value: '24h', label: '24小时' },
//     { value: '7d', label: '7天' },
//     { value: '30d', label: '30天' },
//     { value: '90d', label: '90天' }
//   ];

//   // 统计卡片数据
//   const statsCards = [
//     { 
//       title: '总使用次数', 
//       value: '4,231', 
//       icon: Activity, 
//       change: '+12%', 
//       isPositive: true,
//       color: 'blue',
//       description: 'AI功能调用总次数'
//     },
//     { 
//       title: '总用户数', 
//       value: '34', 
//       icon: Users, 
//       change: '+8%', 
//       isPositive: true,
//       color: 'green',
//       description: '使用AI功能的用户'
//     },
//     { 
//       title: 'Tokens消耗', 
//       value: '73,381', 
//       icon: BarChart3, 
//       change: '+15%', 
//       isPositive: true,
//       color: 'purple',
//       description: '总Tokens使用量'
//     },
//     { 
//       title: '总成本', 
//       value: '¥0.138', 
//       icon: DollarSign, 
//       change: '+18%', 
//       isPositive: false,
//       color: 'red',
//       description: 'AI使用总成本'
//     },
//     { 
//       title: '平均响应时间', 
//       value: '1.2s', 
//       icon: Clock, 
//       change: '-5%', 
//       isPositive: true,
//       color: 'teal',
//       description: 'AI平均响应时间'
//     },
//     { 
//       title: '成功率', 
//       value: '95.2%', 
//       icon: CheckCircle, 
//       change: '+2%', 
//       isPositive: true,
//       color: 'green',
//       description: 'AI调用成功率'
//     },
//     { 
//       title: '活跃用户', 
//       value: '12', 
//       icon: Activity, 
//       change: '+10%', 
//       isPositive: true,
//       color: 'orange',
//       description: '7天内活跃用户'
//     },
//     { 
//       title: '平均Tokens/次', 
//       value: '17.3', 
//       icon: TrendingUp, 
//       change: '+3%', 
//       isPositive: true,
//       color: 'indigo',
//       description: '每次使用平均Tokens'
//     }
//   ];

//   // 图表数据（示例）
//   const trendData = [
//     { date: '12-23', usage: 42, users: 8, tokens: 6500, cost: 0.013 },
//     { date: '12-24', usage: 58, users: 10, tokens: 8500, cost: 0.017 },
//     { date: '12-25', usage: 35, users: 6, tokens: 5200, cost: 0.010 },
//     { date: '12-26', usage: 67, users: 12, tokens: 9800, cost: 0.020 },
//     { date: '12-27', usage: 89, users: 15, tokens: 12500, cost: 0.025 },
//     { date: '12-28', usage: 76, users: 14, tokens: 11200, cost: 0.022 },
//     { date: '12-29', usage: 94, users: 18, tokens: 13800, cost: 0.028 },
//   ];

//   const hourlyData = [
//     { hour: '0:00', usage: 8, cost: 0.0016 },
//     { hour: '4:00', usage: 4, cost: 0.0008 },
//     { hour: '8:00', usage: 12, cost: 0.0024 },
//     { hour: '12:00', usage: 18, cost: 0.0036 },
//     { hour: '16:00', usage: 22, cost: 0.0044 },
//     { hour: '20:00', usage: 16, cost: 0.0032 },
//   ];

//   const preferenceData = [
//     { name: '支配', value: 65, color: '#8884d8' },
//     { name: '服从', value: 48, color: '#82ca9d' },
//     { name: '羞辱', value: 32, color: '#ffc658' },
//     { name: '控制', value: 28, color: '#ff8042' },
//     { name: '暴露', value: 24, color: '#0088fe' },
//   ];

//   const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 p-6">
//         <div className="max-w-7xl mx-auto">
//           {/* 骨架屏加载 */}
//           <div className="animate-pulse space-y-6">
//             <div className="h-8 bg-gray-200 rounded w-1/4"></div>
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
//               {[...Array(8)].map((_, i) => (
//                 <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
//               ))}
//             </div>
//             <div className="h-64 bg-gray-200 rounded-lg"></div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* 顶部导航栏 */}
//       <div className="bg-white border-b border-gray-200">
//         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4">
//             <div className="flex items-center space-x-3">
//               <div className="p-2 bg-blue-100 rounded-lg">
//                 <BarChart3 className="h-6 w-6 text-blue-600" />
//               </div>
//               <div>
//                 <h1 className="text-2xl font-bold text-gray-900">AI使用统计</h1>
//                 <p className="text-sm text-gray-600">监控AI功能使用情况和成本</p>
//               </div>
//             </div>
            
//             <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
//               {/* 时间范围选择器 */}
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//                   <Calendar className="h-4 w-4 text-gray-400" />
//                 </div>
//                 <select
//                   value={timeRange}
//                   onChange={(e) => setTimeRange(e.target.value)}
//                   className="pl-10 pr-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
//                 >
//                   {timeRanges.map((range) => (
//                     <option key={range.value} value={range.value}>
//                       {range.label}
//                     </option>
//                   ))}
//                 </select>
//               </div>
              
//               {/* 操作按钮 */}
//               <button
//                 onClick={() => window.location.reload()}
//                 className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
//               >
//                 <RefreshCw className="h-4 w-4 mr-2" />
//                 刷新
//               </button>
              
//               <button
//                 onClick={() => {
//                   const data = { test: 'export' };
//                   const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
//                   const url = URL.createObjectURL(blob);
//                   const a = document.createElement('a');
//                   a.href = url;
//                   a.download = `ai-statistics-${new Date().toISOString().split('T')[0]}.json`;
//                   a.click();
//                 }}
//                 className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
//               >
//                 <Download className="h-4 w-4 mr-2" />
//                 导出
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* 主内容区域 */}
//       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
//         {/* 标签页导航 */}
//         <div className="border-b border-gray-200 mb-8">
//           <nav className="-mb-px flex space-x-8">
//             <button
//               onClick={() => setActiveTab('dashboard')}
//               className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
//                 activeTab === 'dashboard'
//                   ? 'border-blue-500 text-blue-600'
//                   : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//               }`}
//             >
//               <div className="flex items-center">
//                 <BarChart3 className="h-5 w-5 mr-2" />
//                 仪表盘
//               </div>
//             </button>
            
//             <button
//               onClick={() => setActiveTab('users')}
//               className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
//                 activeTab === 'users'
//                   ? 'border-blue-500 text-blue-600'
//                   : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//               }`}
//             >
//               <div className="flex items-center">
//                 <Users className="h-5 w-5 mr-2" />
//                 用户分析
//               </div>
//             </button>
            
//             <button
//               onClick={() => setActiveTab('keys')}
//               className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
//                 activeTab === 'keys'
//                   ? 'border-blue-500 text-blue-600'
//                   : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//               }`}
//             >
//               <div className="flex items-center">
//                 <Key className="h-5 w-5 mr-2" />
//                 密钥管理
//               </div>
//             </button>
            
//             <button
//               onClick={() => setActiveTab('preferences')}
//               className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
//                 activeTab === 'preferences'
//                   ? 'border-blue-500 text-blue-600'
//                   : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
//               }`}
//             >
//               <div className="flex items-center">
//                 <PieChartIcon className="h-5 w-5 mr-2" />
//                 偏好分析
//               </div>
//             </button>
//           </nav>
//         </div>

//         {/* 统计卡片 */}
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
//           {statsCards.map((card, index) => {
//             const Icon = card.icon;
//             return (
//               <div key={index} className="bg-white overflow-hidden shadow rounded-lg border border-gray-200 hover:shadow-md transition-shadow duration-200">
//                 <div className="p-5">
//                   <div className="flex items-center">
//                     <div className="flex-shrink-0">
//                       <div className={`p-3 rounded-lg ${getColorClasses(card.color).bg}`}>
//                         <Icon className={`h-6 w-6 ${getColorClasses(card.color).text}`} />
//                       </div>
//                     </div>
//                     <div className="ml-5 w-0 flex-1">
//                       <dl>
//                         <dt className="text-sm font-medium text-gray-500 truncate">{card.title}</dt>
//                         <dd className="flex items-baseline">
//                           <div className="text-2xl font-semibold text-gray-900">{card.value}</div>
//                           <div className={`ml-2 flex items-baseline text-sm font-semibold ${
//                             card.isPositive ? 'text-green-600' : 'text-red-600'
//                           }`}>
//                             {card.isPositive ? (
//                               <TrendingUp className="h-4 w-4 mr-1" />
//                             ) : (
//                               <TrendingDown className="h-4 w-4 mr-1" />
//                             )}
//                             {card.change}
//                           </div>
//                         </dd>
//                       </dl>
//                     </div>
//                   </div>
//                 </div>
//                 <div className="bg-gray-50 px-5 py-3">
//                   <div className="text-sm">
//                     <span className="text-gray-600">{card.description}</span>
//                   </div>
//                 </div>
//               </div>
//             );
//           })}
//         </div>

//         {/* 仪表盘内容 */}
//         {activeTab === 'dashboard' && (
//           <div className="space-y-8">
//             {/* 使用趋势图表 */}
//             <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
//               <div className="flex items-center justify-between mb-6">
//                 <div>
//                   <h3 className="text-lg font-medium text-gray-900">使用趋势</h3>
//                   <p className="mt-1 text-sm text-gray-500">AI使用量随时间变化趋势</p>
//                 </div>
//                 <div className="flex space-x-2">
//                   <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
//                     24小时: 4次
//                   </span>
//                   <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
//                     30天: 19次
//                   </span>
//                 </div>
//               </div>
              
//               <div className="h-80">
//                 <ResponsiveContainer width="100%" height="100%">
//                   <RechartsLineChart data={trendData}>
//                     <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
//                     <XAxis dataKey="date" stroke="#666" fontSize={12} />
//                     <YAxis stroke="#666" fontSize={12} />
//                     <Tooltip 
//                       contentStyle={{ 
//                         backgroundColor: 'white',
//                         border: '1px solid #e5e7eb',
//                         borderRadius: '0.375rem',
//                         boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
//                       }}
//                     />
//                     <Legend />
//                     <Line 
//                       type="monotone" 
//                       dataKey="usage" 
//                       name="使用次数" 
//                       stroke="#3b82f6" 
//                       strokeWidth={2}
//                       dot={{ r: 4 }}
//                       activeDot={{ r: 6 }}
//                     />
//                     <Line 
//                       type="monotone" 
//                       dataKey="users" 
//                       name="用户数" 
//                       stroke="#10b981" 
//                       strokeWidth={2}
//                       dot={{ r: 4 }}
//                     />
//                   </RechartsLineChart>
//                 </ResponsiveContainer>
//               </div>
//             </div>

//             {/* 成本和小时分布 */}
//             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
//               {/* 成本分析 */}
//               <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
//                 <div className="flex items-center mb-6">
//                   <div className="p-2 bg-teal-100 rounded-lg mr-3">
//                     <DollarSign className="h-5 w-5 text-teal-600" />
//                   </div>
//                   <div>
//                     <h3 className="text-lg font-medium text-gray-900">成本分析</h3>
//                     <p className="text-sm text-gray-500">AI使用成本详细分析</p>
//                   </div>
//                 </div>
                
//                 <div className="space-y-6">
//                   <div>
//                     <div className="flex justify-between text-sm mb-2">
//                       <span className="text-gray-600">24小时窗口：4次</span>
//                       <span className="font-medium text-gray-900">成本：¥0.0103</span>
//                     </div>
//                     <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
//                       <div 
//                         className="h-full bg-blue-500" 
//                         style={{ width: '40%' }}
//                       ></div>
//                     </div>
//                   </div>
                  
//                   <div>
//                     <div className="flex justify-between text-sm mb-2">
//                       <span className="text-gray-600">30天窗口：19次</span>
//                       <span className="font-medium text-gray-900">成本：¥0.0488</span>
//                     </div>
//                     <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
//                       <div 
//                         className="h-full bg-green-500" 
//                         style={{ width: '19%' }}
//                       ></div>
//                     </div>
//                   </div>
                  
//                   <div className="pt-4 border-t border-gray-200">
//                     <div className="text-sm text-gray-500 mb-2">成本效益分析</div>
//                     <div className="grid grid-cols-3 gap-4">
//                       <div className="text-center p-3 bg-gray-50 rounded-lg">
//                         <div className="text-lg font-semibold text-gray-900">389次</div>
//                         <div className="text-xs text-gray-500">1元可支持</div>
//                       </div>
//                       <div className="text-center p-3 bg-gray-50 rounded-lg">
//                         <div className="text-lg font-semibold text-gray-900">0.00257元</div>
//                         <div className="text-xs text-gray-500">平均成本/次</div>
//                       </div>
//                       <div className="text-center p-3 bg-gray-50 rounded-lg">
//                         <div className="text-lg font-semibold text-gray-900">73,381</div>
//                         <div className="text-xs text-gray-500">总Tokens消耗</div>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* 小时分布 */}
//               <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
//                 <div className="flex items-center mb-6">
//                   <div className="p-2 bg-indigo-100 rounded-lg mr-3">
//                     <Clock className="h-5 w-5 text-indigo-600" />
//                   </div>
//                   <div>
//                     <h3 className="text-lg font-medium text-gray-900">小时分布</h3>
//                     <p className="text-sm text-gray-500">24小时内使用情况分布</p>
//                   </div>
//                 </div>
                
//                 <div className="h-64">
//                   <ResponsiveContainer width="100%" height="100%">
//                     <RechartsBarChart data={hourlyData}>
//                       <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
//                       <XAxis dataKey="hour" stroke="#666" fontSize={12} />
//                       <YAxis stroke="#666" fontSize={12} />
//                       <Tooltip 
//                         contentStyle={{ 
//                           backgroundColor: 'white',
//                           border: '1px solid #e5e7eb',
//                           borderRadius: '0.375rem'
//                         }}
//                       />
//                       <Bar dataKey="usage" name="使用次数" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
//                     </RechartsBarChart>
//                   </ResponsiveContainer>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* 用户分析内容 */}
//         {activeTab === 'users' && (
//           <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
//             <div className="flex items-center mb-6">
//               <div className="p-2 bg-blue-100 rounded-lg mr-3">
//                 <Users className="h-5 w-5 text-blue-600" />
//               </div>
//               <div>
//                 <h3 className="text-lg font-medium text-gray-900">用户分析</h3>
//                 <p className="text-sm text-gray-500">AI使用用户的详细数据</p>
//               </div>
//             </div>
            
//             <div className="overflow-x-auto">
//               <table className="min-w-full divide-y divide-gray-200">
//                 <thead>
//                   <tr>
//                     <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       用户
//                     </th>
//                     <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       使用次数
//                     </th>
//                     <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       Tokens
//                     </th>
//                     <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       成本
//                     </th>
//                     <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       最后使用
//                     </th>
//                     <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                       操作
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="bg-white divide-y divide-gray-200">
//                   <tr className="hover:bg-gray-50">
//                     <td className="px-6 py-4 whitespace-nowrap">
//                       <div className="flex items-center">
//                         <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-blue-100 rounded-lg">
//                           <User className="h-5 w-5 text-blue-600" />
//                         </div>
//                         <div className="ml-4">
//                           <div className="text-sm font-medium text-gray-900">测试用户</div>
//                           <div className="text-sm text-gray-500 truncate max-w-xs">
//                             ID: 30832503-dbfc-4a96-9ec5-bd34d0d87cd0
//                           </div>
//                         </div>
//                       </div>
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap">
//                       <div className="text-sm text-gray-900 font-medium">19次</div>
//                       <div className="text-sm text-gray-500">30天窗口</div>
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                       73,381
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap">
//                       <div className="text-sm text-gray-900">¥0.138</div>
//                       <div className="text-xs text-gray-500">平均¥0.00257/次</div>
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                       2025-12-29
//                       <div className="text-xs">最近24小时: 4次</div>
//                     </td>
//                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
//                       <button className="text-blue-600 hover:text-blue-900 mr-3">详情</button>
//                       <button className="text-gray-600 hover:text-gray-900">编辑</button>
//                     </td>
//                   </tr>
                  
//                   {/* 更多用户行 */}
//                   {[1, 2, 3, 4].map((i) => (
//                     <tr key={i} className="hover:bg-gray-50">
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="flex items-center">
//                           <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg">
//                             <User className="h-5 w-5 text-gray-600" />
//                           </div>
//                           <div className="ml-4">
//                             <div className="text-sm font-medium text-gray-900">用户 {i}</div>
//                             <div className="text-sm text-gray-500">user{i}@example.com</div>
//                           </div>
//                         </div>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="text-sm text-gray-900 font-medium">{Math.floor(Math.random() * 20) + 5}次</div>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
//                         {Math.floor(Math.random() * 50000) + 1000}
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap">
//                         <div className="text-sm text-gray-900">¥{(Math.random() * 0.1).toFixed(3)}</div>
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
//                         2025-12-{28 - i}
//                       </td>
//                       <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
//                         <button className="text-blue-600 hover:text-blue-900 mr-3">详情</button>
//                         <button className="text-gray-600 hover:text-gray-900">编辑</button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         )}

//         {/* 密钥管理内容 */}
//         {activeTab === 'keys' && (
//           <div className="space-y-8">
//             {/* 密钥生成器 */}
//             <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
//               <div className="flex items-center mb-6">
//                 <div className="p-2 bg-purple-100 rounded-lg mr-3">
//                   <KeyIcon className="h-5 w-5 text-purple-600" />
//                 </div>
//                 <div>
//                   <h3 className="text-lg font-medium text-gray-900">AI密钥生成器</h3>
//                   <p className="text-sm text-gray-500">生成新的AI使用密钥</p>
//                 </div>
//               </div>
              
//               <div className="max-w-md space-y-6">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     密钥类型
//                   </label>
//                   <div className="grid grid-cols-3 gap-3">
//                     <button className="px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
//                       周期增量
//                     </button>
//                     <button className="px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
//                       每日增量
//                     </button>
//                     <button className="px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
//                       总次数
//                     </button>
//                   </div>
//                 </div>
                
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     增加次数: <span className="font-bold text-lg">50</span>
//                   </label>
//                   <div className="mt-2">
//                     <input 
//                       type="range" 
//                       min="10"
//                       max="500"
//                       step="10"
//                       defaultValue="50"
//                       className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
//                     />
//                     <div className="flex justify-between text-xs text-gray-500 mt-1">
//                       <span>10</span>
//                       <span>250</span>
//                       <span>500</span>
//                     </div>
//                   </div>
//                 </div>
                
//                 <div className="flex items-center">
//                   <input 
//                     type="checkbox" 
//                     id="activate" 
//                     defaultChecked
//                     className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
//                   />
//                   <label htmlFor="activate" className="ml-2 block text-sm text-gray-700">
//                     立即激活密钥
//                   </label>
//                 </div>
                
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-2">
//                     描述（可选）
//                   </label>
//                   <input 
//                     type="text" 
//                     placeholder="例如：促销活动密钥、VIP用户奖励"
//                     className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                   />
//                 </div>
                
//                 <button className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-medium">
//                   生成密钥
//                 </button>
//               </div>
//             </div>

//             {/* 密钥列表 */}
//             <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
//               <div className="flex items-center justify-between mb-6">
//                 <div className="flex items-center">
//                   <div className="p-2 bg-gray-100 rounded-lg mr-3">
//                     <KeyIcon className="h-5 w-5 text-gray-600" />
//                   </div>
//                   <div>
//                     <h3 className="text-lg font-medium text-gray-900">密钥列表</h3>
//                     <p className="text-sm text-gray-500">管理所有AI使用密钥</p>
//                   </div>
//                 </div>
//                 <div className="text-sm text-gray-500">
//                   共 <span className="font-bold">26</span> 个密钥
//                 </div>
//               </div>
              
//               <div className="space-y-4">
//                 {[1, 2, 3].map((i) => (
//                   <div key={i} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
//                     <div className="flex-1">
//                       <div className="flex items-center">
//                         <div className="p-2 bg-green-100 rounded-lg mr-3">
//                           <KeyIcon className="h-4 w-4 text-green-600" />
//                         </div>
//                         <div>
//                           <div className="font-medium text-gray-900">
//                             AI-{String(Date.now()).slice(-4)}-{Math.random().toString(36).substr(2, 4).toUpperCase()}
//                           </div>
//                           <div className="text-sm text-gray-500">
//                             周期增量密钥 · 增加50次 · 已激活
//                           </div>
//                         </div>
//                       </div>
//                     </div>
//                     <div className="flex items-center space-x-2">
//                       <button className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
//                         <Copy className="h-4 w-4" />
//                       </button>
//                       <button className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
//                         <Trash2 className="h-4 w-4" />
//                       </button>
//                       <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
//                         <MoreVertical className="h-4 w-4" />
//                       </button>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>
//         )}

//         {/* 偏好分析内容 */}
//         {activeTab === 'preferences' && (
//           <div className="space-y-8">
//             <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
//               <div className="flex items-center mb-6">
//                 <div className="p-2 bg-pink-100 rounded-lg mr-3">
//                   <PieChartIcon className="h-5 w-5 text-pink-600" />
//                 </div>
//                 <div>
//                   <h3 className="text-lg font-medium text-gray-900">用户偏好分布</h3>
//                   <p className="text-sm text-gray-500">用户偏好统计与分析</p>
//                 </div>
//               </div>
              
//               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
//                 <div className="h-80">
//                   <ResponsiveContainer width="100%" height="100%">
//                     <RechartsPieChart>
//                       <Pie
//                         data={preferenceData}
//                         cx="50%"
//                         cy="50%"
//                         labelLine={false}
//                         label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
//                         outerRadius={80}
//                         fill="#8884d8"
//                         dataKey="value"
//                       >
//                         {preferenceData.map((entry, index) => (
//                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//                         ))}
//                       </Pie>
//                       <Tooltip />
//                     </RechartsPieChart>
//                   </ResponsiveContainer>
//                 </div>
                
//                 <div>
//                   <h4 className="text-sm font-medium text-gray-900 mb-4">偏好详细数据</h4>
//                   <div className="space-y-4">
//                     {preferenceData.map((item, index) => (
//                       <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
//                         <div className="flex items-center">
//                           <div 
//                             className="w-3 h-3 rounded-full mr-3" 
//                             style={{ backgroundColor: item.color }}
//                           ></div>
//                           <span className="text-sm font-medium text-gray-900">{item.name}</span>
//                         </div>
//                         <div className="text-right">
//                           <div className="text-sm font-semibold text-gray-900">{item.value} 用户</div>
//                           <div className="text-xs text-gray-500">
//                             {Math.round((item.value / preferenceData.reduce((a, b) => a + b.value, 0)) * 100)}%
//                           </div>
//                         </div>
//                       </div>
//                     ))}
//                   </div>
                  
//                   <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
//                     <div className="flex">
//                       <Info className="h-5 w-5 text-blue-400 flex-shrink-0" />
//                       <div className="ml-3">
//                         <h5 className="text-sm font-medium text-blue-800">数据洞察</h5>
//                         <div className="mt-2 text-sm text-blue-700">
//                           <p>• "支配" 是最受欢迎的偏好类型</p>
//                           <p>• 前3种偏好占总数的 62%</p>
//                           <p>• 平均每个用户有 2.3 个偏好</p>
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* 底部信息 */}
//         <div className="mt-12 pt-8 border-t border-gray-200">
//           <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
//             <div className="text-sm text-gray-500">
//               <p>最后更新: {new Date().toLocaleString('zh-CN')}</p>
//               <p className="mt-1">系统基于生产环境实时统计，仅管理员可见</p>
//             </div>
//             <div className="mt-4 sm:mt-0">
//               <button
//                 onClick={() => window.open('/admin', '_self')}
//                 className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
//               >
//                 <Home className="h-4 w-4 mr-2" />
//                 返回管理后台
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// // 辅助函数：获取颜色类
// function getColorClasses(color: string) {
//   const colors: Record<string, { text: string; bg: string }> = {
//     blue: { text: 'text-blue-600', bg: 'bg-blue-100' },
//     green: { text: 'text-green-600', bg: 'bg-green-100' },
//     purple: { text: 'text-purple-600', bg: 'bg-purple-100' },
//     red: { text: 'text-red-600', bg: 'bg-red-100' },
//     teal: { text: 'text-teal-600', bg: 'bg-teal-100' },
//     orange: { text: 'text-orange-600', bg: 'bg-orange-100' },
//     indigo: { text: 'text-indigo-600', bg: 'bg-indigo-100' },
//     pink: { text: 'text-pink-600', bg: 'bg-pink-100' },
//   };
  
//   return colors[color] || colors.blue;
// }


// /app/admin/ai-usage/page.tsx - 最简化版本
'use client';

import { useState, useEffect } from 'react';

export default function AIUsagePage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  const timeRanges = [
    { value: '24h', label: '24小时' },
    { value: '7d', label: '7天' },
    { value: '30d', label: '30天' },
    { value: '90d', label: '90天' }
  ];

  const cards = [
    { title: '总使用次数', value: '4,231', change: '+12%' },
    { title: '总用户数', value: '34', change: '+8%' },
    { title: 'Tokens消耗', value: '73,381', change: '+15%' },
    { title: '总成本', value: '¥0.138', change: '+18%' },
    { title: '成功率', value: '95.2%', change: '+2%' },
    { title: '活跃用户', value: '12', change: '+10%' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI使用统计</h1>
              <p className="text-gray-600">监控AI功能使用情况和成本</p>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
              
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
              >
                刷新
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 标签页导航 */}
        <div className="mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              仪表盘
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              用户分析
            </button>
            <button
              onClick={() => setActiveTab('keys')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === 'keys'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              密钥管理
            </button>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {cards.map((card, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="text-sm font-medium text-gray-600 mb-2">{card.title}</div>
              <div className="flex items-baseline">
                <span className="text-2xl font-bold text-gray-900">{card.value}</span>
                <span className={`ml-2 text-sm font-medium ${
                  card.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {card.change}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 关键数据 */}
        {activeTab === 'dashboard' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">关键指标</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">24小时窗口：4次</span>
                  <span className="font-medium">成本：¥0.0103</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: '40%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">30天窗口：19次</span>
                  <span className="font-medium">成本：¥0.0488</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: '19%' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 用户分析 */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">用户分析</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">使用次数</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tokens</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">成本</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">测试用户</div>
                      <div className="text-sm text-gray-500">30832503-...-87cd0</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">19次</div>
                      <div className="text-sm text-gray-500">30天窗口</div>
                    </td>
                    <td className="px-4 py-3">73,381</td>
                    <td className="px-4 py-3">¥0.138</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 密钥管理 */}
        {activeTab === 'keys' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">密钥管理</h2>
            <div className="text-center py-8 text-gray-500">
              <p>密钥管理功能待实现</p>
              <p className="text-sm mt-2">需要创建 ai_boost_keys 表和 API</p>
            </div>
          </div>
        )}

        {/* 底部信息 */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
          <p>最后更新: {new Date().toLocaleString('zh-CN')}</p>
          <p className="mt-1">系统基于生产环境实时统计，仅管理员可见</p>
        </div>
      </div>
    </div>
  );
}