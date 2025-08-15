'use client';

import { useEffect } from 'react';
import { useUser } from '@/hooks/use-user';
import { userService } from '@/services/user';
import { Sidebar } from '@/features/layout/sidebar';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { setUser } = useUser();

  useEffect(() => {
    const fetchUser = async () => {
      const response = await userService.getUser();
      console.log(response);
      setUser(response);
    };
    fetchUser();
  }, [setUser]);

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </>
  );
}
