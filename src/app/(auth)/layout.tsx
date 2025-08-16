'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { getUser } from '@/services/user';
import { Sidebar } from '@/features/layout/sidebar';

interface UserData {
  id: number;
  email: string;
  confirmed: boolean;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { setUser } = useUser();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await getUser();
        if (response.success && response.data) {
          setUser(response.data as UserData);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
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
