// /lib/utils/error-handler.ts - 统一错误处理工具

/**
 * 错误类型定义
 */
export interface AppError {
  code: string;
  message: string;
  details?: any;
  status?: number;
}

/**
 * 常见错误代码
 */
export const ErrorCodes = {
  // 认证错误
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // 数据库错误
  DATABASE_ERROR: 'DATABASE_ERROR',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD: 'DUPLICATE_RECORD',
  
  // 输入错误
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_PARAMS: 'MISSING_PARAMS',
  
  // 网络错误
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  
  // 服务器错误
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

/**
 * 错误消息映射
 */
export const ErrorMessages = {
  [ErrorCodes.UNAUTHORIZED]: '用户未登录，请先登录',
  [ErrorCodes.FORBIDDEN]: '没有权限执行此操作',
  [ErrorCodes.SESSION_EXPIRED]: '会话已过期，请重新登录',
  [ErrorCodes.DATABASE_ERROR]: '数据库操作失败，请稍后重试',
  [ErrorCodes.RECORD_NOT_FOUND]: '记录不存在',
  [ErrorCodes.DUPLICATE_RECORD]: '记录已存在',
  [ErrorCodes.INVALID_INPUT]: '输入参数无效',
  [ErrorCodes.MISSING_PARAMS]: '缺少必要参数',
  [ErrorCodes.NETWORK_ERROR]: '网络连接失败，请检查网络',
  [ErrorCodes.TIMEOUT]: '请求超时，请稍后重试',
  [ErrorCodes.SERVER_ERROR]: '服务器内部错误，请稍后重试',
  [ErrorCodes.UNKNOWN_ERROR]: '未知错误，请稍后重试',
};

/**
 * 创建错误对象
 */
export function createError(code: string, message?: string, details?: any, status?: number): AppError {
  return {
    code,
    message: message || ErrorMessages[code as keyof typeof ErrorMessages] || '未知错误',
    details,
    status,
  };
}

/**
 * 处理 Supabase 错误
 */
export function handleSupabaseError(error: any): AppError {
  if (!error) {
    return createError(ErrorCodes.UNKNOWN_ERROR);
  }

  // 处理 Supabase 错误代码
  switch (error.code) {
    case 'PGRST116': // Record not found
      return createError(ErrorCodes.RECORD_NOT_FOUND, '记录不存在');
    case '23505': // Unique violation
      return createError(ErrorCodes.DUPLICATE_RECORD, '记录已存在');
    case '401': // Unauthorized
      return createError(ErrorCodes.UNAUTHORIZED, '用户未登录');
    case '403': // Forbidden
      return createError(ErrorCodes.FORBIDDEN, '没有权限执行此操作');
    default:
      return createError(
        ErrorCodes.DATABASE_ERROR,
        error.message || '数据库操作失败',
        error
      );
  }
}

/**
 * 处理网络错误
 */
export function handleNetworkError(error: any): AppError {
  if (!error) {
    return createError(ErrorCodes.UNKNOWN_ERROR);
  }

  if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
    return createError(ErrorCodes.TIMEOUT, '请求超时');
  }

  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
    return createError(ErrorCodes.NETWORK_ERROR, '网络连接失败');
  }

  return createError(
    ErrorCodes.NETWORK_ERROR,
    error.message || '网络错误',
    error
  );
}

/**
 * 统一错误处理函数
 */
export function handleError(error: any): AppError {
  if (!error) {
    return createError(ErrorCodes.UNKNOWN_ERROR);
  }

  // 处理 Supabase 错误
  if (error.code && error.message) {
    return handleSupabaseError(error);
  }

  // 处理网络错误
  if (error.name && (error.name.includes('Network') || error.code)) {
    return handleNetworkError(error);
  }

  // 处理其他错误
  return createError(
    ErrorCodes.SERVER_ERROR,
    error.message || '服务器内部错误',
    error
  );
}

/**
 * 格式化错误消息
 */
export function formatErrorMessage(error: AppError | string): string {
  if (typeof error === 'string') {
    return error;
  }
  return error.message;
}

/**
 * 检查是否是认证错误
 */
export function isAuthError(error: AppError): boolean {
  return [ErrorCodes.UNAUTHORIZED, ErrorCodes.FORBIDDEN, ErrorCodes.SESSION_EXPIRED].includes(error.code);
}

/**
 * 检查是否是网络错误
 */
export function isNetworkError(error: AppError): boolean {
  return [ErrorCodes.NETWORK_ERROR, ErrorCodes.TIMEOUT].includes(error.code);
}