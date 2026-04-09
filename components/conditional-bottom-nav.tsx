'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from '@/components/ui/bottom-nav';

const HIDDEN_PATHS = [
  '/account-expired',
  '/login',
  '/login/expired',
  '/admin'
];

export function ConditionalBottomNav() {
  const pathname = usePathname();

  const shouldHide = HIDDEN_PATHS.some(hiddenPath => 
    pathname === hiddenPath || pathname.startsWith(hiddenPath + '/')
  );

  if (shouldHide) {
    return null;
  }

  return <BottomNav />;
}
