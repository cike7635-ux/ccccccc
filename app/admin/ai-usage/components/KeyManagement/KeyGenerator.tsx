// // /app/admin/ai-usage/components/KeyManagement/KeyGenerator.tsx
// 'use client';

// import { useState } from 'react';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// import { Slider } from '@/components/ui/slider';
// import { Switch } from '@/components/ui/switch';
// import { Key, Copy, RefreshCw, Check, AlertCircle } from 'lucide-react';
// import { toast } from 'sonner';

// interface KeyGeneratorProps {
//   onKeyGenerated: () => void;
// }

// export default function KeyGenerator({ onKeyGenerated }: KeyGeneratorProps) {
//   const [loading, setLoading] = useState(false);
//   const [generatedKey, setGeneratedKey] = useState<string>('');
//   const [keyType, setKeyType] = useState<'cycle' | 'daily' | 'total'>('cycle');
//   const [incrementAmount, setIncrementAmount] = useState(50);
//   const [durationDays, setDurationDays] = useState(30);
//   const [maxUses, setMaxUses] = useState(1);
//   const [isActive, setIsActive] = useState(true);
//   const [description, setDescription] = useState('');
//   const [copied, setCopied] = useState(false);

//   const generateRandomKey = () => {
//     const prefix = 'AI';
//     const timestamp = Date.now().toString(36).toUpperCase();
//     const random = Math.random().toString(36).substring(2, 8).toUpperCase();
//     return `${prefix}-${timestamp}-${random}`;
//   };

//   const handleGenerate = async () => {
//     setLoading(true);
//     try {
//       const keyCode = generateRandomKey();
      
//       const response = await fetch('/api/admin/ai-usage/keys', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           keyCode,
//           keyType,
//           incrementAmount,
//           durationDays: keyType === 'daily' ? durationDays : undefined,
//           maxUses,
//           isActive,
//           description
//         }),
//       });

//       if (!response.ok) {
//         throw new Error('生成密钥失败');
//       }

//       const data = await response.json();
//       setGeneratedKey(keyCode);
//       toast.success('密钥生成成功');
//       onKeyGenerated();
//     } catch (error) {
//       toast.error('生成密钥失败');
//       console.error('生成密钥失败:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleCopy = async () => {
//     await navigator.clipboard.writeText(generatedKey);
//     setCopied(true);
//     toast.success('已复制到剪贴板');
//     setTimeout(() => setCopied(false), 2000);
//   };

//   const handleReset = () => {
//     setKeyType('cycle');
//     setIncrementAmount(50);
//     setDurationDays(30);
//     setMaxUses(1);
//     setIsActive(true);
//     setDescription('');
//     setGeneratedKey('');
//   };

//   return (
//     <Card>
//       <CardHeader>
//         <CardTitle className="flex items-center gap-2">
//           <Key className="h-5 w-5" />
//           密钥生成器
//         </CardTitle>
//       </CardHeader>
//       <CardContent className="space-y-4">
//         {/* 密钥类型选择 */}
//         <div className="space-y-2">
//           <Label htmlFor="keyType">密钥类型</Label>
//           <Select value={keyType} onValueChange={(value: any) => setKeyType(value)}>
//             <SelectTrigger>
//               <SelectValue placeholder="选择密钥类型" />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="cycle">周期增量密钥</SelectItem>
//               <SelectItem value="daily">每日增量密钥</SelectItem>
//               <SelectItem value="total">总次数密钥</SelectItem>
//             </SelectContent>
//           </Select>
//         </div>

//         {/* 增量设置 */}
//         <div className="space-y-2">
//           <div className="flex justify-between">
//             <Label htmlFor="incrementAmount">增加次数: {incrementAmount}</Label>
//             <span className="text-sm text-muted-foreground">
//               {keyType === 'cycle' ? '在30天周期内增加' : 
//                keyType === 'daily' ? '每天增加' : 
//                '总共增加'}
//             </span>
//           </div>
//           <Slider
//             value={[incrementAmount]}
//             onValueChange={([value]) => setIncrementAmount(value)}
//             min={10}
//             max={500}
//             step={10}
//             className="w-full"
//           />
//         </div>

//         {/* 有效期设置（仅每日增量密钥） */}
//         {keyType === 'daily' && (
//           <div className="space-y-2">
//             <div className="flex justify-between">
//               <Label htmlFor="durationDays">有效期: {durationDays}天</Label>
//             </div>
//             <Slider
//               value={[durationDays]}
//               onValueChange={([value]) => setDurationDays(value)}
//               min={7}
//               max={365}
//               step={7}
//               className="w-full"
//             />
//           </div>
//         )}

//         {/* 最大使用次数 */}
//         <div className="space-y-2">
//           <Label htmlFor="maxUses">最大使用次数</Label>
//           <Select value={maxUses.toString()} onValueChange={(value) => setMaxUses(parseInt(value))}>
//             <SelectTrigger>
//               <SelectValue placeholder="选择最大使用次数" />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="1">1次</SelectItem>
//               <SelectItem value="5">5次</SelectItem>
//               <SelectItem value="10">10次</SelectItem>
//               <SelectItem value="99999">无限次</SelectItem>
//             </SelectContent>
//           </Select>
//         </div>

//         {/* 描述信息 */}
//         <div className="space-y-2">
//           <Label htmlFor="description">描述（可选）</Label>
//           <Input
//             id="description"
//             value={description}
//             onChange={(e) => setDescription(e.target.value)}
//             placeholder="例如：促销活动密钥、VIP用户奖励"
//           />
//         </div>

//         {/* 激活状态 */}
//         <div className="flex items-center justify-between">
//           <Label htmlFor="isActive">立即激活</Label>
//           <Switch
//             id="isActive"
//             checked={isActive}
//             onCheckedChange={setIsActive}
//           />
//         </div>

//         {/* 生成的密钥显示 */}
//         {generatedKey && (
//           <div className="space-y-2">
//             <Label>生成的密钥</Label>
//             <div className="flex items-center gap-2">
//               <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm font-mono break-all">
//                 {generatedKey}
//               </code>
//               <Button
//                 size="icon"
//                 variant="outline"
//                 onClick={handleCopy}
//                 className="shrink-0"
//               >
//                 {copied ? (
//                   <Check className="h-4 w-4 text-green-600" />
//                 ) : (
//                   <Copy className="h-4 w-4" />
//                 )}
//               </Button>
//             </div>
//             <p className="text-xs text-muted-foreground flex items-center gap-1">
//               <AlertCircle className="h-3 w-3" />
//               请妥善保管此密钥，生成后将无法查看完整密钥
//             </p>
//           </div>
//         )}

//         {/* 操作按钮 */}
//         <div className="flex gap-2 pt-4">
//           <Button
//             onClick={handleGenerate}
//             disabled={loading}
//             className="flex-1 gap-2"
//           >
//             {loading ? (
//               <RefreshCw className="h-4 w-4 animate-spin" />
//             ) : (
//               <Key className="h-4 w-4" />
//             )}
//             {loading ? '生成中...' : '生成密钥'}
//           </Button>
//           <Button
//             variant="outline"
//             onClick={handleReset}
//             className="gap-2"
//           >
//             <RefreshCw className="h-4 w-4" />
//             重置
//           </Button>
//         </div>

//         {/* 使用说明 */}
//         <div className="pt-4 border-t">
//           <h4 className="text-sm font-medium mb-2">使用说明</h4>
//           <ul className="text-xs text-muted-foreground space-y-1">
//             <li>• 周期增量密钥：在30天滚动窗口内增加使用次数</li>
//             <li>• 每日增量密钥：每天增加指定次数，持续有效期</li>
//             <li>• 总次数密钥：一次性增加使用次数，用完为止</li>
//             <li>• 生成后可通过密钥列表管理所有密钥</li>
//           </ul>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }