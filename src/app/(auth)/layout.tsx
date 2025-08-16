'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { getUser } from '@/services/user';
import { Sidebar } from '@/features/layout/sidebar';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { setUser } = useUser();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUser = async () => {
      const response = await getUser();
      setUser(response.data);
    };
    fetchUser();
  }, [setUser]);

  return (
    <>
      {pathname !== '/confirm' && <Sidebar />}
      {children}
    </>
  );
}
