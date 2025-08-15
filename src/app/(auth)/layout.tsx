'use client';

import { useEffect } from 'react';
import { useUser } from '@/hooks/use-user';
import { userService } from '@/services/user';
import { useState } from 'react';
import { Sidebar, SidebarToggle } from '@/components/layout/sidebar';

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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen bg-zinc-900">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <SidebarToggle
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
