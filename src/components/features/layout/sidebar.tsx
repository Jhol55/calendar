import { useState, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {
  Sidebar as SidebarComponent,
  SidebarToggle,
} from '@/components/layout/sidebar';

interface SidebarProps {
  /**
   * Lista de rotas onde o sidebar deve começar fechado
   * Se a rota atual estiver nessa lista, o sidebar começa fechado (false)
   * Se não estiver, começa aberto (true)
   */
  noExpandedRoutes?: string[];
}

export const Sidebar = ({ noExpandedRoutes = [] }: SidebarProps) => {
  const pathname = usePathname();

  const shouldStartExpanded = useMemo(() => {
    return noExpandedRoutes.some((route) => pathname?.startsWith(route));
  }, [pathname, noExpandedRoutes]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isFakeHovered = !shouldStartExpanded;

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      <SidebarComponent
        isOpen={isSidebarOpen}
        isFakeHovered={isFakeHovered}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <SidebarToggle
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
    </div>
  );
};
