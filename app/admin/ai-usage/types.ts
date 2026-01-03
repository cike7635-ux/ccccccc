// // /app/admin/ai-usage/types.ts

// // 基础类型
// export type TimeRange = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'custom' | 'all';
// export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'heatmap';
// export type UserGender = 'male' | 'female' | 'non_binary' | 'not_set';
// export type PreferenceType = 'domination' | 'submission' | 'humiliation' | 'control' | 'exposure' | 'service' | 'petplay' | 'bondage' | 'roleplay' | 'other';

// // 概览统计数据
// export interface OverviewStats {
//   totalUsage: number;
//   totalUsers: number;
//   totalTokens: number;
//   totalCost: number;
//   avgResponseTime: number;
//   successRate: number;
//   activeUsers: number;
//   avgTokensPerRequest: number;
//   comparison: {
//     day: number;    // 日环比
//     week: number;   // 周环比
//     month: number;  // 月环比
//   };
// }

// // 趋势数据点
// export interface TrendDataPoint {
//   date: string;
//   usage: number;
//   users: number;
//   tokens: number;
//   cost: number;
//   successRate: number;
// }

// // 小时分布数据
// export interface HourlyData {
//   hour: number;      // 0-23
//   usage: number;
//   successRate: number;
//   avgTokens: number;
// }

// // 用户分析数据
// export interface UserProfile {
//   id: string;
//   email: string;
//   nickname: string;
//   gender: UserGender;
//   preferences: PreferenceType[];
//   customPreferences: string[];
//   totalUsage: number;
//   totalTokens: number;
//   avgSuccessRate: number;
//   lastActive: string;
//   registrationDate: string;
//   userTier: 'high' | 'medium' | 'low';
// }

// export interface PreferenceStats {
//   preference: PreferenceType;
//   count: number;
//   percentage: number;
//   maleCount: number;
//   femaleCount: number;
//   nonBinaryCount: number;
//   avgUsagePerUser: number;
//   combinations: Array<{
//     withPreference: PreferenceType;
//     frequency: number;
//     percentage: number;
//   }>;
// }

// export interface GenderPreferenceAnalysis {
//   gender: UserGender;
//   totalUsers: number;
//   topPreferences: Array<{
//     preference: PreferenceType;
//     count: number;
//     percentage: number;
//   }>;
//   avgUsagePerUser: number;
//   avgSessionDuration: number;
//   favoriteTimeSlots: number[];
// }

// // AI密钥数据
// export interface AIKey {
//   id: string;
//   keyCode: string;
//   keyType: 'cycle' | 'daily' | 'total';
//   incrementAmount: number;
//   durationDays?: number;
//   maxUses: number;
//   usedCount: number;
//   usedByUserId?: string;
//   usedAt?: string;
//   expiresAt?: string;
//   createdAt: string;
//   isActive: boolean;
//   description?: string;
// }

// export interface KeyAnalytics {
//   totalKeys: number;
//   usedKeys: number;
//   activeKeys: number;
//   expiredKeys: number;
//   activationRate: number;
//   usageEfficiency: number;
//   topUsers: Array<{
//     userId: string;
//     nickname: string;
//     keysUsed: number;
//     totalIncrement: number;
//   }>;
//   popularKeyTypes: Array<{
//     keyType: string;
//     count: number;
//     usageRate: number;
//   }>;
// }

// // 内容分析数据
// export interface TopicAnalysis {
//   topic: string;
//   usageCount: number;
//   avgTokens: number;
//   successRate: number;
//   userSatisfaction: number; // 0-100
//   relatedPreferences: PreferenceType[];
//   trend: 'up' | 'down' | 'stable';
// }

// export interface QualityMetrics {
//   adoptionRate: number;      // 任务采纳率
//   editRate: number;         // 任务编辑率
//   avgTaskLength: number;    // 平均任务长度
//   complexityDistribution: {
//     simple: number;
//     medium: number;
//     complex: number;
//   };
//   emotionDistribution: {
//     dominant: number;
//     submissive: number;
//     neutral: number;
//     explicit: number;
//   };
// }

// // 预测数据
// export interface UsageForecast {
//   date: string;
//   predictedUsage: number;
//   predictedCost: number;
//   confidenceInterval: [number, number];
//   factors: Array<{
//     factor: string;
//     impact: 'positive' | 'negative' | 'neutral';
//     magnitude: number; // 0-1
//   }>;
// }

// export interface OptimizationSuggestion {
//   id: string;
//   category: 'key_distribution' | 'feature_improvement' | 'cost_optimization' | 'user_engagement';
//   title: string;
//   description: string;
//   impact: 'high' | 'medium' | 'low';
//   effort: 'low' | 'medium' | 'high';
//   estimatedBenefit: string;
//   metricsAffected: string[];
//   actionSteps: string[];
// }

// // API响应类型
// export interface StatisticsResponse {
//   overview: OverviewStats;
//   trends: TrendDataPoint[];
//   hourly: HourlyData[];
//   userProfiles: UserProfile[];
//   preferenceStats: PreferenceStats[];
//   genderAnalysis: GenderPreferenceAnalysis[];
//   keys: AIKey[];
//   keyAnalytics: KeyAnalytics;
//   topics: TopicAnalysis[];
//   quality: QualityMetrics;
//   forecast: UsageForecast[];
//   suggestions: OptimizationSuggestion[];
//   meta: {
//     timeRange: TimeRange;
//     startDate: string;
//     endDate: string;
//     generatedAt: string;
//     dataPoints: number;
//   };
// }

// // 筛选条件
// export interface FilterOptions {
//   timeRange: TimeRange;
//   startDate?: string;
//   endDate?: string;
//   gender?: UserGender[];
//   preferences?: PreferenceType[];
//   userTier?: string[];
//   minUsage?: number;
//   maxUsage?: number;
//   keyStatus?: ('active' | 'used' | 'expired' | 'inactive')[];
// }

// // 导出配置
// export interface ExportConfig {
//   format: 'json' | 'csv' | 'excel';
//   include: Array<'overview' | 'users' | 'keys' | 'content' | 'predictions'>;
//   timeRange: TimeRange;
//   filters: FilterOptions;
// }