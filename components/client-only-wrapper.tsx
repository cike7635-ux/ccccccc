'use client';

import { useEffect, useState } from 'react';

interface ClientOnlyWrapperProps {
  children: React.ReactNode;
}

export default function ClientOnlyWrapper({ children }: ClientOnlyWrapperProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return <>{children}</>;
}
