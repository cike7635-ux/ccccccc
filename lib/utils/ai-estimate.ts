// /lib/utils/ai-estimate.ts
// 基于账单数据的估算参数
const BILL_ESTIMATE_PARAMS = {
  avgTokensPerRequest: 2188.125,    // 基于2026-01-02账单：8次 = 17,505 tokens
  avgCostPerRequest: 0.00307465,    // 基于2026-01-02账单：8次 = 0.0245972元
  cacheHitRatio: 0.526,             // 缓存命中率 52.6%
  cacheMissRatio: 0.121,            // 缓存未命中率 12.1%
  outputRatio: 0.353,               // 输出占比 35.3%
  rateHit: 0.0000002,               // 0.2元/百万 tokens
  rateMiss: 0.000002,               // 2元/百万 tokens
  rateOutput: 0.000003,             // 3元/百万 tokens
};

export function calculateBillBasedEstimate(usageCount: number) {
  const { avgTokensPerRequest, avgCostPerRequest } = BILL_ESTIMATE_PARAMS;
  
  return {
    estimatedTokens: Math.round(usageCount * avgTokensPerRequest),
    estimatedCost: parseFloat((usageCount * avgCostPerRequest).toFixed(6)),
  };
}

export function calculatePreciseEstimate(usageCount: number) {
  const {
    avgTokensPerRequest,
    cacheHitRatio,
    cacheMissRatio,
    outputRatio,
    rateHit,
    rateMiss,
    rateOutput,
  } = BILL_ESTIMATE_PARAMS;

  const totalTokens = usageCount * avgTokensPerRequest;
  const tokensHit = totalTokens * cacheHitRatio;
  const tokensMiss = totalTokens * cacheMissRatio;
  const tokensOutput = totalTokens * outputRatio;

  const cost = 
    tokensHit * rateHit +
    tokensMiss * rateMiss +
    tokensOutput * rateOutput;

  return {
    estimatedTokens: Math.round(totalTokens),
    estimatedTokensHit: Math.round(tokensHit),
    estimatedTokensMiss: Math.round(tokensMiss),
    estimatedTokensOutput: Math.round(tokensOutput),
    estimatedCost: parseFloat(cost.toFixed(6)),
  };
}

// 计算增长率（模拟，实际项目应使用历史数据）
export function calculateGrowthRate(current: number, previous: number = current * 0.8): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}