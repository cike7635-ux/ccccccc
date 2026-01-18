// /components/heartbeat-provider.tsx - 心跳提供者组件
'use client';

import { useHeartbeat } from '@/hooks/use-heartbeat';

export function HeartbeatProvider() {
  // 使用心跳钩子
  useHeartbeat();
  
  // 这个组件不渲染任何UI，只提供心跳功能
  return null;
}