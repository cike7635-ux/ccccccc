import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function HelpPage() {
  return (
    <>
      <div className="max-w-md mx-auto min-h-svh flex flex-col p-6 pb-24">
        <div className="flex items-center justify-between mb-6 pt-4">
          <Link href="/profile" className="w-10 h-10 glass rounded-xl flex items-center justify-center hover:bg-white/10 transition-all" aria-label="返回我的">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-xl font-bold">帮助中心</h2>
          <div className="w-10" />
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-2">Q：账户密码不知道怎么办？</h3>
            <p className="text-sm text-gray-300">
              右上角昵称右边复制图标点击一下即可复制账户密码，这是存储在浏览器上的，数据库中存储的是加密后的密码，所以不需要担心密码泄露。因为没有邮箱验证所以不提供密码找回，好在账户也不重要。
            </p>
          </div>

          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-2">Q：游戏怎么玩？</h3>
            <p className="text-sm text-gray-300">
              填写用户偏好 → 添加自定义题库 → 创建房间/加入房间 → 开始游戏。
            </p>
          </div>

          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-2">Q：用户隐私如何保护？</h3>
            <p className="text-sm text-gray-300">
              邮箱密码可以随机生成，一定程度上是匿名的。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}