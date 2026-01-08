/**
 * 系统配置管理工具
 * 支持内存缓存，减少数据库查询
 */

import { createClient } from '@supabase/supabase-js';

// 缓存接口
interface CacheItem<T> {
  value: T;
  expiry: number;
}

// 内存缓存
class ConfigCache {
  private cache = new Map<string, CacheItem<any>>();
  private static instance: ConfigCache;

  static getInstance(): ConfigCache {
    if (!ConfigCache.instance) {
      ConfigCache.instance = new ConfigCache();
    }
    return ConfigCache.instance;
  }

  set<T>(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// 配置管理器
export class SystemConfig {
  private cache = ConfigCache.getInstance();
  private supabase: any;

  constructor() {
    // 只在服务端创建Supabase客户端
    if (typeof window === 'undefined') {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
    }
  }

  /**
   * 获取配置值
   * @param key 配置键
   * @param defaultValue 默认值
   * @param useCache 是否使用缓存
   */
  async get<T>(key: string, defaultValue: T, useCache: boolean = true): Promise<T> {
    // 1. 从缓存获取
    if (useCache) {
      const cached = this.cache.get<T>(key);
      if (cached !== null) return cached;
    }

    // 2. 从数据库获取
    try {
      const { data, error } = await this.supabase
        .from('system_config')
        .select('config_value, data_type')
        .eq('config_key', key)
        .single();

      if (error || !data) {
        console.warn(`配置键 "${key}" 不存在，使用默认值`, error);
        return defaultValue;
      }

      // 3. 根据数据类型转换
      let value: any;
      switch (data.data_type) {
        case 'number':
          value = Number(data.config_value);
          break;
        case 'boolean':
          value = data.config_value === 'true' || data.config_value === '1';
          break;
        case 'json':
          try {
            value = JSON.parse(data.config_value);
          } catch {
            value = data.config_value;
          }
          break;
        default:
          value = data.config_value;
      }

      // 4. 存入缓存（5分钟）
      this.cache.set(key, value, 5 * 60 * 1000);
      return value as T;

    } catch (error) {
      console.error(`获取配置失败 "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * 获取AI默认限制配置
   */
  async getAIDefaultLimits() {
    const [daily, cycle] = await Promise.all([
      this.get<number>('ai_default_daily_limit', 10),
      this.get<number>('ai_default_cycle_limit', 120)
    ]);
    return { daily, cycle };
  }

  /**
   * 获取AI成本配置
   */
  async getAICostConfig() {
    const [perToken, perRequest] = await Promise.all([
      this.get<number>('ai_cost_per_token', 0.000001405),
      this.get<number>('ai_cost_per_request', 0.00307465)
    ]);
    return { perToken, perRequest };
  }

  /**
   * 获取系统维护配置
   */
  async getMaintenanceConfig() {
    const [mode, message] = await Promise.all([
      this.get<boolean>('system_maintenance_mode', false),
      this.get<string>('system_maintenance_message', '系统维护中，请稍后再试')
    ]);
    return { mode, message };
  }

  /**
   * 清除配置缓存
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 获取所有配置（用于系统设置页面）
   */
  async getAllConfigs() {
    try {
      const { data, error } = await this.supabase
        .from('system_config')
        .select('*')
        .order('config_key');

      if (error) throw error;

      // 转换为对象格式
      const configs: Record<string, any> = {};
      data?.forEach(item => {
        let value: any = item.config_value;
        switch (item.data_type) {
          case 'number':
            value = Number(value);
            break;
          case 'boolean':
            value = value === 'true' || value === '1';
            break;
          case 'json':
            try {
              value = JSON.parse(value);
            } catch {
              // 保持原值
            }
            break;
        }
        configs[item.config_key] = value;
      });

      return configs;
    } catch (error) {
      console.error('获取所有配置失败:', error);
      return {};
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(key: string, value: any, description?: string) {
    try {
      // 确定数据类型
      let dataType = 'string';
      let configValue: string;

      if (typeof value === 'number') {
        dataType = 'number';
        configValue = String(value);
      } else if (typeof value === 'boolean') {
        dataType = 'boolean';
        configValue = value ? 'true' : 'false';
      } else if (typeof value === 'object') {
        dataType = 'json';
        configValue = JSON.stringify(value);
      } else {
        configValue = String(value);
      }

      const { error } = await this.supabase
        .from('system_config')
        .upsert({
          config_key: key,
          config_value: configValue,
          data_type: dataType,
          description,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'config_key'
        });

      if (error) throw error;

      // 清除缓存
      this.cache.delete(key);

      return true;
    } catch (error) {
      console.error(`更新配置失败 "${key}":`, error);
      return false;
    }
  }
}

// 单例实例
let systemConfigInstance: SystemConfig;

export function getSystemConfig(): SystemConfig {
  if (!systemConfigInstance) {
    systemConfigInstance = new SystemConfig();
  }
  return systemConfigInstance;
}

// 工具函数：快速获取配置
export async function getConfig<T>(key: string, defaultValue: T): Promise<T> {
  return getSystemConfig().get(key, defaultValue);
}

// 工具函数：快速获取AI限制
export async function getAIDefaultLimits() {
  return getSystemConfig().getAIDefaultLimits();
}

// 工具函数：快速获取成本配置
export async function getAICostConfig() {
  return getSystemConfig().getAICostConfig();
}