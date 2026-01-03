// // /app/admin/ai-usage/components/Dashboard/OverviewCards.tsx
// 'use client';

// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { OverviewStats } from '../../types';
// import { 
//   TrendingUp, 
//   TrendingDown, 
//   Users, 
//   Zap, 
//   DollarSign, 
//   Clock, 
//   CheckCircle,
//   Activity,
//   BarChart3
// } from 'lucide-react';
// import { cn } from '@/lib/utils';

// interface OverviewCardsProps {
//   data?: OverviewStats;
// }

// export default function OverviewCards({ data }: OverviewCardsProps) {
//   const cards = [
//     {
//       title: '总使用次数',
//       value: data?.totalUsage.toLocaleString() || '0',
//       icon: Zap,
//       change: data?.comparison.day,
//       description: 'AI功能调用总次数'
//     },
//     {
//       title: '总用户数',
//       value: data?.totalUsers.toLocaleString() || '0',
//       icon: Users,
//       change: data?.comparison.week,
//       description: '使用AI功能的用户数'
//     },
//     {
//       title: 'Tokens消耗',
//       value: data?.totalTokens.toLocaleString() || '0',
//       icon: BarChart3,
//       change: data?.comparison.month,
//       description: '总Tokens使用量'
//     },
//     {
//       title: '总成本',
//       value: `¥${(data?.totalCost || 0).toFixed(2)}`,
//       icon: DollarSign,
//       change: data?.comparison.day,
//       description: 'AI使用总成本'
//     },
//     {
//       title: '平均响应时间',
//       value: `${data?.avgResponseTime || 0}ms`,
//       icon: Clock,
//       change: -5, // 示例值
//       description: 'AI平均响应时间'
//     },
//     {
//       title: '成功率',
//       value: `${(data?.successRate || 0).toFixed(1)}%`,
//       icon: CheckCircle,
//       change: data?.comparison.week,
//       description: 'AI调用成功率'
//     },
//     {
//       title: '活跃用户',
//       value: data?.activeUsers.toLocaleString() || '0',
//       icon: Activity,
//       change: data?.comparison.day,
//       description: '7天内活跃用户数'
//     },
//     {
//       title: '平均Tokens/次',
//       value: data?.avgTokensPerRequest.toLocaleString() || '0',
//       icon: TrendingUp,
//       change: data?.comparison.month,
//       description: '每次使用平均Tokens'
//     }
//   ];

//   return (
//     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//       {cards.map((card, index) => {
//         const Icon = card.icon;
//         const isPositive = card.change > 0;
        
//         return (
//           <Card key={index} className="hover:shadow-lg transition-shadow">
//             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
//               <CardTitle className="text-sm font-medium">
//                 {card.title}
//               </CardTitle>
//               <Icon className="h-4 w-4 text-muted-foreground" />
//             </CardHeader>
//             <CardContent>
//               <div className="text-2xl font-bold">{card.value}</div>
//               <div className="flex items-center pt-2">
//                 <div className={cn(
//                   "flex items-center text-xs",
//                   isPositive ? "text-green-600" : "text-red-600"
//                 )}>
//                   {isPositive ? (
//                     <TrendingUp className="mr-1 h-3 w-3" />
//                   ) : (
//                     <TrendingDown className="mr-1 h-3 w-3" />
//                   )}
//                   {Math.abs(card.change)}%
//                 </div>
//                 <span className="ml-2 text-xs text-muted-foreground">
//                   {card.description}
//                 </span>
//               </div>
//             </CardContent>
//           </Card>
//         );
//       })}
//     </div>
//   );
// }