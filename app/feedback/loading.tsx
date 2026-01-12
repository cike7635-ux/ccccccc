export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 mb-4">
          <div className="w-8 h-8 bg-white/30 rounded-full"></div>
        </div>
        <h1 className="text-3xl font-bold mb-2">加载中...</h1>
        <p className="text-gray-400">正在加载反馈页面</p>
      </div>
    </div>
  );
}