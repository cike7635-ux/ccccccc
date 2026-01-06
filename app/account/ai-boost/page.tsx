// /app/account/ai-boost/page.tsx
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, XCircle, Key, Zap, CalendarDays, Clock } from "lucide-react";
import Link from "next/link";

export default function AIBoostPage() {
  const [keyCode, setKeyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);

  const handleRedeem = async () => {
    if (!keyCode.trim()) {
      setResult({ 
        success: false, 
        message: '请输入AI密钥代码' 
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // 🔥 修复：将错误的路径 '/api/user/ai-keys/redeem' 改为 '/api/admin/ai-keys/redeem'
      const response = await fetch('/api/admin/ai-keys/redeem', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keyCode }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '兑换失败');
      }

      setResult({
        success: true,
        message: data.message,
        data: data.data
      });
      
      // 清空输入框
      setKeyCode('');
      
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || '兑换失败，请重试'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-svh flex flex-col pb-24 px-6">
      {/* 头部 */}
      <div className="glass px-6 pt-4 pb-6 rounded-b-3xl -mx-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/account" className="text-white/80 hover:text-white flex items-center space-x-2">
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </Link>
          <h2 className="text-xl font-bold">兑换AI次数</h2>
          <div className="w-16" />
        </div>
      </div>

      {/* 内容 */}
      <div className="space-y-6">
        <Card className="glass border-white/10 bg-gradient-to-br from-gray-900/50 to-purple-900/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <div className="p-2 bg-gradient-to-br from-brand-pink to-purple-600 rounded-lg">
                <Key className="w-5 h-5 text-white" />
              </div>
              <span>兑换AI使用次数</span>
            </CardTitle>
            <CardDescription className="text-gray-400">
              输入AI密钥兑换额外的AI使用次数，兑换后立即生效
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-code" className="text-sm font-medium">
                AI密钥代码
              </Label>
              <Input
                id="key-code"
                placeholder="输入AI密钥，格式如：AI-XXXX-XXXX"
                value={keyCode}
                onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
                className="bg-white/10 border-white/20 text-white placeholder-gray-500"
                disabled={loading}
              />
              <p className="text-xs text-gray-400">
                注意：密钥区分大小写，请输入完整代码
              </p>
            </div>

            {/* 结果提示 */}
            {result && (
              <div className={`rounded-xl p-4 border ${
                result.success 
                  ? 'bg-gradient-to-r from-green-900/30 to-green-800/20 border-green-500/20' 
                  : 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-red-500/20'
              }`}>
                <div className="flex items-start space-x-3">
                  {result.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                  )}
                  <div>
                    <p className={result.success ? 'text-green-300' : 'text-red-300'}>
                      {result.message}
                    </p>
                    {result.success && result.data && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Zap className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm text-gray-300">
                            类型：{result.data.boostType === 'cycle' ? '周期次数' : '每日次数'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <CalendarDays className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-gray-300">
                            增加：{result.data.amount}次
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-gray-300">
                            新限制：每日{result.data.newLimits.daily}次 / 周期{result.data.newLimits.cycle}次
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={handleRedeem}
              disabled={loading || !keyCode.trim()}
              className="w-full gradient-primary glow-pink hover:shadow-lg hover:shadow-brand-pink/30 transition-all duration-300"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  兑换中...
                </>
              ) : (
                '立即兑换'
              )}
            </Button>

            {/* 使用说明 */}
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <h4 className="text-sm font-medium mb-3 text-gray-300">💡 使用说明</h4>
              <ul className="text-sm text-gray-400 space-y-2">
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-brand-pink rounded-full mt-1.5"></div>
                  <span>兑换后AI使用次数立即增加，无需等待</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-1.5"></div>
                  <span><strong>每日次数</strong>：24小时滚动窗口，每天重置</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-1.5"></div>
                  <span><strong>周期次数</strong>：30天滚动窗口，过期自动释放</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-1.5"></div>
                  <span>每个密钥只能使用一次，兑换后失效</span>
                </li>
                <li className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-1.5"></div>
                  <span>请在密钥有效期内兑换，过期无法使用</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}