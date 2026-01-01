'use client'

import { User } from 'lucide-react'
import { RecentUser } from '../types'

interface UsersDisplayProps {
  recentUsers: RecentUser[]
  totalUsers: number
  maxDisplay?: number
  className?: string
}

export default function UsersDisplay({
  recentUsers = [],
  totalUsers = 0,
  maxDisplay = 2,
  className = ''
}: UsersDisplayProps) {
  
  if (totalUsers === 0 && recentUsers.length === 0) {
    return <span className="text-gray-500 text-sm">-</span>
  }
  
  return (
    <div className={`max-w-[180px] ${className}`}>
      {recentUsers.length > 0 ? (
        <div className="space-y-1">
          {recentUsers.slice(0, maxDisplay).map((user, index) => (
            <div key={index} className="flex items-start">
              <User className="w-3 h-3 text-gray-500 mr-1 mt-0.5 flex-shrink-0" />
              <p 
                className="text-gray-300 text-sm truncate flex-1" 
                title={`${user.email}${user.nickname ? ` (${user.nickname})` : ''}`}
              >
                {user.email}
              </p>
            </div>
          ))}
          {totalUsers > maxDisplay && (
            <div className="flex items-center ml-4 mt-1">
              <span className="text-gray-500 text-xs">
                等{totalUsers - maxDisplay}人
              </span>
              <div className="ml-1 px-1.5 py-0.5 bg-blue-500/20 rounded text-xs text-blue-400">
                {totalUsers}
              </div>
            </div>
          )}
        </div>
      ) : (
        <span className="text-gray-500 text-sm">-</span>
      )}
    </div>
  )
}