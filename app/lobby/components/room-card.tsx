'use client';

import { memo } from 'react';
import { Users, Clock, Star } from 'lucide-react';

interface RoomCardProps {
  room: {
    id: string;
    code: string;
    created_at: string;
    player1_id: string;
    player2_id: string | null;
  };
  playerName: string;
}

function RoomCard({ room, playerName }: RoomCardProps) {
  return (
    <div className="glass rounded-xl p-4 border border-white/10 hover:bg-white/5 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white">
            {playerName} 的房间
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {new Date(room.created_at).toLocaleTimeString()}
        </div>
      </div>
      <div className="bg-white/5 rounded-lg p-3 mb-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-white mb-1">{room.code}</div>
          <div className="text-xs text-gray-400">房间码</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center space-x-1">
          <Clock className="w-3 h-3" />
          <span>等待中</span>
        </div>
        <div className="flex items-center space-x-1">
          <Star className="w-3 h-3" />
          <span>1/2人</span>
        </div>
      </div>
    </div>
  );
}

export default memo(RoomCard);