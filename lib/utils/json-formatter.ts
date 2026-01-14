// lib\utils\json-formatter.ts
/**
 * 格式化JSON数据，提供更好的可读性
 */
export function formatJsonForDisplay(data: any): {
  formatted: string;
  type: 'json' | 'string' | 'error';
} {
  if (!data) {
    return {
      formatted: '(空)',
      type: 'string'
    };
  }

  try {
    // 如果已经是字符串，尝试解析
    if (typeof data === 'string') {
      const parsed = JSON.parse(data);
      return {
        formatted: JSON.stringify(parsed, null, 2),
        type: 'json'
      };
    }

    // 如果是对象，直接格式化
    return {
      formatted: JSON.stringify(data, null, 2),
      type: 'json'
    };
  } catch (error) {
    // 如果无法解析为JSON，返回原始字符串
    return {
      formatted: String(data),
      type: 'string'
    };
  }
}

/**
 * 截断长文本
 */
export function truncateText(text: string, maxLength: number = 200): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 提取请求的关键信息
 */
export function extractRequestInfo(requestData: any): {
  type: string;
  params: Record<string, any>;
  summary: string;
} {
  if (!requestData) {
    return {
      type: '未知',
      params: {},
      summary: '无请求数据'
    };
  }

  // 尝试提取常见字段
  const type = requestData.type || 'AI生成任务';
  const params = { ...requestData };

  // 创建摘要
  let summary = '';
  if (requestData.prompt) {
    summary = truncateText(requestData.prompt, 100);
  } else if (requestData.messages) {
    summary = `对话消息: ${requestData.messages.length} 条`;
  } else {
    summary = JSON.stringify(params);
  }

  return { type, params, summary };
}