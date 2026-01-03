// // /app/admin/ai-usage/components/UserAnalysis/PreferenceAnalysis.tsx
// 'use client';

// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { PreferenceStats, GenderPreferenceAnalysis } from '../../types';
// import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
// import { Users, Heart, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';

// interface PreferenceAnalysisProps {
//   preferenceStats: PreferenceStats[];
//   genderAnalysis: GenderPreferenceAnalysis[];
// }

// const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// export default function PreferenceAnalysis({ preferenceStats, genderAnalysis }: PreferenceAnalysisProps) {
//   // 准备偏好热度数据
//   const preferenceData = preferenceStats
//     .slice(0, 10)
//     .map(stat => ({
//       name: stat.preference,
//       使用人数: stat.count,
//       占比: stat.percentage
//     }));

//   // 准备性别偏好对比数据
//   const genderComparisonData = genderAnalysis.map(gender => ({
//     name: gender.gender === 'male' ? '男性' : gender.gender === 'female' ? '女性' : '非二元',
//     平均使用次数: gender.avgUsagePerUser,
//     偏好数量: gender.topPreferences.length
//   }));

//   // 准备组合分析数据
//   const combinationData = preferenceStats.flatMap(stat => 
//     stat.combinations.slice(0, 3).map(combo => ({
//       combination: `${stat.preference}+${combo.withPreference}`,
//       频率: combo.frequency,
//       占比: combo.percentage
//     }))
//   ).slice(0, 8);

//   return (
//     <div className="space-y-6">
//       {/* 偏好热度排行 */}
//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <TrendingUp className="h-5 w-5" />
//             偏好热度排行
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="h-80">
//             <ResponsiveContainer width="100%" height="100%">
//               <BarChart data={preferenceData}>
//                 <CartesianGrid strokeDasharray="3 3" />
//                 <XAxis dataKey="name" />
//                 <YAxis />
//                 <Tooltip />
//                 <Legend />
//                 <Bar dataKey="使用人数" fill="#8884d8" />
//                 <Bar dataKey="占比" fill="#82ca9d" />
//               </BarChart>
//             </ResponsiveContainer>
//           </div>
//         </CardContent>
//       </Card>

//       {/* 性别偏好对比 */}
//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <Users className="h-5 w-5" />
//               性别偏好对比
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="h-64">
//               <ResponsiveContainer width="100%" height="100%">
//                 <PieChart>
//                   <Pie
//                     data={genderComparisonData}
//                     cx="50%"
//                     cy="50%"
//                     labelLine={false}
//                     label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
//                     outerRadius={80}
//                     fill="#8884d8"
//                     dataKey="平均使用次数"
//                   >
//                     {genderComparisonData.map((_, index) => (
//                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//                     ))}
//                   </Pie>
//                   <Tooltip />
//                 </PieChart>
//               </ResponsiveContainer>
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardHeader>
//             <CardTitle className="flex items-center gap-2">
//               <Heart className="h-5 w-5" />
//               热门组合分析
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="h-64">
//               <ResponsiveContainer width="100%" height="100%">
//                 <BarChart data={combinationData}>
//                   <CartesianGrid strokeDasharray="3 3" />
//                   <XAxis dataKey="combination" />
//                   <YAxis />
//                   <Tooltip />
//                   <Bar dataKey="频率" fill="#ff8042" />
//                 </BarChart>
//               </ResponsiveContainer>
//             </div>
//           </CardContent>
//         </Card>
//       </div>

//       {/* 详细偏好分析表格 */}
//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2">
//             <PieChartIcon className="h-5 w-5" />
//             偏好详细数据
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <div className="overflow-x-auto">
//             <table className="w-full text-sm">
//               <thead>
//                 <tr className="border-b">
//                   <th className="text-left p-2">偏好类型</th>
//                   <th className="text-left p-2">用户数</th>
//                   <th className="text-left p-2">占比</th>
//                   <th className="text-left p-2">男性用户</th>
//                   <th className="text-left p-2">女性用户</th>
//                   <th className="text-left p-2">非二元</th>
//                   <th className="text-left p-2">常用组合</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {preferenceStats.slice(0, 5).map((stat, index) => (
//                   <tr key={index} className="border-b hover:bg-gray-50">
//                     <td className="p-2">{stat.preference}</td>
//                     <td className="p-2">{stat.count}</td>
//                     <td className="p-2">{stat.percentage}%</td>
//                     <td className="p-2">{stat.maleCount}</td>
//                     <td className="p-2">{stat.femaleCount}</td>
//                     <td className="p-2">{stat.nonBinaryCount}</td>
//                     <td className="p-2">
//                       {stat.combinations.slice(0, 2).map(combo => 
//                         `${combo.withPreference}(${combo.percentage}%)`
//                       ).join(', ')}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </CardContent>
//       </Card>
//     </div>
//   );
// }