// /app/admin/users/types.ts - 紧急修复版本

export function normalizeUserDetail(data: any): UserDetail {
  if (!data) {
    console.warn('❌ normalizeUserDetail: 输入数据为空')
    return {} as UserDetail
  }
  
  // 🔥 关键修复：打印完整的原始数据
  console.log('🔄 完整原始数据:', {
    所有字段: Object.keys(data),
    每个字段的值: Object.entries(data).map(([key, value]) => ({
      字段名: key,
      类型: typeof value,
      是数组: Array.isArray(value),
      长度: Array.isArray(value) ? value.length : 'N/A',
      第一个元素: Array.isArray(value) ? value[0] : value
    }))
  })
  
  // 🔥 关键修复：尝试所有可能的字段名
  const keyUsageHistory = data.keyUsageHistory || data.key_usage_history || data.keyUsageHistoryRaw || []
  const currentAccessKey = data.currentAccessKey || data.current_access_key || data.currentAccessKeyRaw
  const accessKeys = data.accessKeys || data.access_keys || data.keys || []
  const aiUsageRecords = data.aiUsageRecords || data.ai_usage_records || data.aiRecords || []
  const gameHistory = data.gameHistory || data.game_history || []
  
  console.log('🔍 字段名检测结果:', {
    keyUsageHistory: {
      驼峰存在: 'keyUsageHistory' in data,
      下划线存在: 'key_usage_history' in data,
      值: keyUsageHistory,
      长度: keyUsageHistory?.length || 0
    },
    currentAccessKey: {
      驼峰存在: 'currentAccessKey' in data,
      下划线存在: 'current_access_key' in data,
      值: currentAccessKey
    },
    accessKeys: {
      驼峰存在: 'accessKeys' in data,
      下划线存在: 'access_keys' in data,
      值: accessKeys,
      长度: accessKeys?.length || 0
    },
    aiUsageRecords: {
      驼峰存在: 'aiUsageRecords' in data,
      下划线存在: 'ai_usage_records' in data,
      值: aiUsageRecords,
      长度: aiUsageRecords?.length || 0
    }
  })
  
  // 🔥 如果字段名检测失败，尝试暴力查找
  if (!('accessKeys' in data) && !('access_keys' in data)) {
    console.log('🔍 暴力查找密钥字段...')
    const possibleKeyFields = ['accessKeys', 'access_keys', 'keys', 'accessKeysList', 'keyList']
    possibleKeyFields.forEach(field => {
      if (field in data) {
        console.log(`✅ 找到密钥字段: ${field}`, data[field])
      }
    })
  }
  
  if (!('aiUsageRecords' in data) && !('ai_usage_records' in data)) {
    console.log('🔍 暴力查找AI记录字段...')
    const possibleAiFields = ['aiUsageRecords', 'ai_usage_records', 'aiRecords', 'ai_usage', 'aiRecordsList']
    possibleAiFields.forEach(field => {
      if (field in data) {
        console.log(`✅ 找到AI记录字段: ${field}`, data[field])
      }
    })
  }
  
  // 🎯 核心修复：使用检测到的字段
  const result: UserDetail = {
    // 基本字段
    id: data.id || '',
    email: data.email || '',
    nickname: data.nickname || null,
    fullName: data.fullName || data.full_name || null,
    avatarUrl: data.avatarUrl || data.avatar_url || null,
    bio: data.bio || null,
    preferences: data.preferences || {},
    accountExpiresAt: data.accountExpiresAt || data.account_expires_at || null,
    lastLoginAt: data.lastLoginAt || data.last_login_at || null,
    lastLoginSession: data.lastLoginSession || data.last_login_session || null,
    accessKeyId: data.accessKeyId || data.access_key_id || null,
    createdAt: data.createdAt || data.created_at || '',
    updatedAt: data.updatedAt || data.updated_at || '',
    
    // 🔥 关键：使用检测到的字段
    keyUsageHistory: normalizeKeyUsageHistory(keyUsageHistory),
    currentAccessKey: currentAccessKey ? normalizeAccessKey(currentAccessKey) : null,
    accessKeys: normalizeAccessKeys(accessKeys),
    aiUsageRecords: normalizeAiUsageRecords(aiUsageRecords),
    gameHistory: normalizeGameHistory(gameHistory)
  }
  
  console.log('✅ 归一化完成结果:', {
    keyUsageHistory数量: result.keyUsageHistory.length,
    currentAccessKey存在: !!result.currentAccessKey,
    currentAccessKey详情: result.currentAccessKey,
    accessKeys数量: result.accessKeys.length,
    accessKeys详情: result.accessKeys,
    aiUsageRecords数量: result.aiUsageRecords.length,
    aiUsageRecords详情: result.aiUsageRecords.slice(0, 2), // 只显示前2条
    gameHistory数量: result.gameHistory.length
  })
  
  return result
}

// 🔥 增强的 normalizeAccessKeys 函数
export function normalizeAccessKeys(keys: any): AccessKey[] {
  console.log('🔧 normalizeAccessKeys 输入详细:', {
    输入: keys,
    输入类型: typeof keys,
    是数组: Array.isArray(keys),
    长度: Array.isArray(keys) ? keys.length : 0,
    如果是数组第一个元素: Array.isArray(keys) && keys.length > 0 ? keys[0] : '空'
  })
  
  // 如果 keys 是对象而不是数组（可能是包含其他字段的对象）
  if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
    console.log('⚠️ keys 是对象，尝试提取数组...', keys)
    // 尝试找到数组字段
    const possibleArrayFields = ['data', 'items', 'list', 'records']
    for (const field of possibleArrayFields) {
      if (Array.isArray(keys[field])) {
        console.log(`✅ 在对象中找到数组字段: ${field}`, keys[field])
        keys = keys[field]
        break
      }
    }
  }
  
  if (keys === undefined || keys === null) {
    console.log('📭 keys 是 undefined 或 null，返回空数组')
    return []
  }
  
  if (!Array.isArray(keys)) {
    console.warn('❌ keys 不是数组:', typeof keys, keys)
    return []
  }
  
  if (keys.length === 0) {
    console.log('📭 keys 是空数组，返回空数组')
    return []
  }
  
  console.log('🔧 开始处理密钥数组，长度:', keys.length)
  
  const result = keys.map((key, index) => {
    // 🔥 打印每个密钥的完整结构
    console.log(`🔧 处理密钥 ${index + 1} 完整结构:`, key)
    
    // 智能检测所有可能的字段名
    const keyCode = key.keyCode || key.key_code || key.code || key.key || ''
    const isActive = key.isActive !== undefined 
      ? key.isActive 
      : (key.is_active !== undefined ? key.is_active : true)
    
    return {
      id: key.id || 0,
      keyCode: keyCode,
      isActive: isActive,
      usedCount: key.usedCount || key.used_count || 0,
      maxUses: key.maxUses || key.max_uses || 1,
      keyExpiresAt: key.keyExpiresAt || key.key_expires_at || null,
      accountValidForDays: key.accountValidForDays || key.account_valid_for_days || 30,
      userId: key.userId || key.user_id || null,
      usedAt: key.usedAt || key.used_at || null,
      createdAt: key.createdAt || key.created_at || '',
      updatedAt: key.updatedAt || key.updated_at || ''
    }
  })
  
  console.log('✅ normalizeAccessKeys 输出:', {
    处理数量: result.length,
    结果: result
  })
  
  return result
}

// 🔥 增强的 normalizeAiUsageRecords 函数
export function normalizeAiUsageRecords(records: any): AiUsageRecord[] {
  console.log('🔧 normalizeAiUsageRecords 输入详细:', {
    输入: records,
    输入类型: typeof records,
    是数组: Array.isArray(records),
    长度: Array.isArray(records) ? records.length : 0
  })
  
  // 如果 records 是对象而不是数组
  if (records && typeof records === 'object' && !Array.isArray(records)) {
    console.log('⚠️ records 是对象，尝试提取数组...', records)
    const possibleArrayFields = ['data', 'items', 'list', 'records']
    for (const field of possibleArrayFields) {
      if (Array.isArray(records[field])) {
        console.log(`✅ 在对象中找到数组字段: ${field}`, records[field])
        records = records[field]
        break
      }
    }
  }
  
  if (records === undefined || records === null) {
    console.log('📭 records 是 undefined 或 null，返回空数组')
    return []
  }
  
  if (!Array.isArray(records)) {
    console.warn('❌ records 不是数组:', typeof records, records)
    return []
  }
  
  if (records.length === 0) {
    console.log('📭 records 是空数组，返回空数组')
    return []
  }
  
  console.log('🔧 开始处理AI记录数组，长度:', records.length)
  
  const result = records.map((record, index) => {
    console.log(`🔧 处理AI记录 ${index + 1}:`, {
      id: record.id,
      feature: record.feature,
      success: record.success,
      所有字段: Object.keys(record)
    })
    
    return {
      id: record.id || 0,
      userId: record.userId || record.user_id || '',
      feature: record.feature || 'unknown',
      createdAt: record.createdAt || record.created_at || '',
      requestData: record.requestData || record.request_data || {},
      responseData: record.responseData || record.response_data || {},
      success: record.success !== undefined ? record.success : true
    }
  })
  
  console.log('✅ normalizeAiUsageRecords 输出:', {
    处理数量: result.length,
    第一条记录: result[0] || '无'
  })
  
  return result
}
