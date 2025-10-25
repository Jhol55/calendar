'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/features/layout/sidebar';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const noExpandedRoutes = ['/workflows'];

  return (
    <>
      {pathname !== '/confirm' && (
        <Sidebar noExpandedRoutes={noExpandedRoutes} />
      )}
      {children}
    </>
  );
}
