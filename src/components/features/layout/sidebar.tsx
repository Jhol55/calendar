import { useState } from 'react';
import {
  Sidebar as SidebarComponent,
  SidebarToggle,
} from '@/components/layout/sidebar';

export const Sidebar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen bg-neutral-50">
      <SidebarComponent
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <SidebarToggle
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
    </div>
  );
};
