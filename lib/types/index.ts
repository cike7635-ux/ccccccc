// /lib/types/index.ts - TypeScript 类型定义

/**
 * 用户信息类型
 */
export interface User {
  id: string;
  email: string;
  email_confirmed_at?: string;
  phone?: string;
  phone_confirmed_at?: string;
  last_sign_in_at?: string;
  app_metadata: {
    provider: string;
    providers?: string[];
  };
  user_metadata: {
    name?: string;
    avatar_url?: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * 个人资料类型
 */
export interface Profile {
  id: string;
  email: string;
  nickname?: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  preferences?: {
    gender?: string;
    kinks?: string[];
  };
  access_key_id?: number;
  account_expires_at?: string;
  created_at: string;
  updated_at: string;
  last_login_session?: string;
  last_login_at?: string;
  custom_daily_limit?: number;
  custom_cycle_limit?: number;
  last_login_device_id?: string;
}

/**
 * 主题类型
 */
export interface Theme {
  id: string;
  title: string;
  description?: string;
  task_count: number;
  creator_id: string;
  is_official: boolean;
  priority?: number;
  created_at: string;
  updated_at?: string;
}

/**
 * 任务类型
 */
export interface Task {
  id: string;
  theme_id: string;
  description: string;
  type: string;
  order_index: number;
  created_at: string;
  updated_at?: string;
}

/**
 * 缓存条目类型
 */
export interface CacheEntry<T> {
  data: T;
  version: number;
  expiresAt: number;
}

/**
 * 错误类型
 */
export interface AppError {
  code: string;
  message: string;
  details?: any;
  status?: number;
}

/**
 * 分页选项类型
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * 分页结果类型
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 主题操作类型
 */
export type ThemeOperation = 'create' | 'update' | 'delete';

/**
 * 任务类型枚举
 */
export enum TaskType {
  INTERACTION = 'interaction',
  QUIZ = 'quiz',
  QUESTION = 'question',
  ACTIVITY = 'activity',
}

/**
 * 响应类型
 */
export interface ApiResponse<T> {
  data: T;
  error: string | null;
}

/**
 * 主题列表项类型
 */
export interface ThemeListItem {
  id: string;
  title: string;
  description: string;
  task_count: number;
  created_at: string;
  is_official?: boolean;
}

/**
 * 缓存版本类型
 */
export interface CacheVersion {
  user_id: string;
  themes_version: number;
  updated_at: string;
}

/**
 * 表单数据类型
 */
export interface ThemeFormData {
  id?: string;
  title: string;
  description?: string;
  is_official?: boolean;
  priority?: number;
}

/**
 * 任务表单数据类型
 */
export interface TaskFormData {
  id?: string;
  theme_id: string;
  description: string;
  type?: string;
  order_index?: number;
}

/**
 * 搜索选项类型
 */
export interface SearchOptions {
  query?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/**
 * 统计数据类型
 */
export interface UsageStats {
  daily: {
    tasks_completed: number;
    themes_created: number;
    active_time: number;
  };
  cycle: {
    tasks_completed: number;
    themes_created: number;
    active_time: number;
  };
  cycleInfo: {
    start: string;
    end: string;
    days: number;
  };
  _raw: any;
}

/**
 * 心跳数据类型
 */
export interface HeartbeatData {
  user_id: string;
  action: string;
  duration?: number;
  metadata?: any;
  timestamp: string;
}