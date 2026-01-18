'use client';

export default function ThemesSkeleton() {
  return (
    <div className="max-w-md mx-auto min-h-svh flex flex-col pb-24 px-4">
      {/* 头部骨架 */}
      <div className="pt-8 pb-4">
        <div className="mb-6">
          <div className="h-8 bg-white/10 rounded-lg w-32 mb-2 animate-pulse"></div>
          <div className="h-4 bg-white/5 rounded w-24 animate-pulse"></div>
        </div>
        
        {/* 会员状态骨架 */}
        <div className="mb-6">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-3 bg-white/5 rounded w-16 mb-2 animate-pulse"></div>
                <div className="h-4 bg-white/10 rounded w-24 animate-pulse"></div>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 创建按钮骨架 */}
      <div className="w-full mb-6">
        <div className="bg-white/10 rounded-2xl p-5 animate-pulse">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 bg-white/10 rounded w-32 mb-2"></div>
              <div className="h-4 bg-white/5 rounded w-40"></div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10"></div>
          </div>
        </div>
      </div>

      {/* 主题列表骨架 */}
      <div className="flex-1 space-y-3">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10"></div>
              <div className="flex-1">
                <div className="h-5 bg-white/10 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-white/5 rounded w-1/2 mb-3"></div>
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <div className="flex gap-4">
                    <div className="h-3 bg-white/5 rounded w-12"></div>
                    <div className="h-3 bg-white/5 rounded w-12"></div>
                  </div>
                  <div className="h-3 bg-white/10 rounded w-8"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}