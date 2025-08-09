'use client';

import { useEffect } from 'react';
import { useUser } from '@/hooks/use-user';
import { userService } from '@/services/user';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { setUser } = useUser();

  useEffect(() => {
    const getUser = async () => {
      const response = await userService.getUser();
      setUser(response);
    };
    getUser();
  }, [setUser]);

  return <>{children}</>;
}
