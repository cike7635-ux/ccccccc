'use client';

import { Skeleton } from '@/components/ui/skeleton';

function RoomSkeleton() {
  return (
    <div className="glass rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="bg-white/5 rounded-lg p-3 mb-3">
        <div className="text-center">
          <Skeleton className="h-8 w-32 mx-auto mb-2" />
          <Skeleton className="h-3 w-16 mx-auto" />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export default RoomSkeleton;