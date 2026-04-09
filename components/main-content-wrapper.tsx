'use client';

import { usePathname } from 'next/navigation';

const HIDDEN_PATHS = [
  '/account-expired',
  '/login',
  '/login/expired',
  '/admin'
];

export function MainContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const shouldHideNav = HIDDEN_PATHS.some(hiddenPath => 
    pathname === hiddenPath || pathname.startsWith(hiddenPath + '/')
  );

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 ${shouldHideNav ? '' : 'pb-16'}`}>
      {children}
    </div>
  );
}
