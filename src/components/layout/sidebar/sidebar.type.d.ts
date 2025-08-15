import { ReactNode } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  subItems?: Omit<MenuItem, 'subItems'>[];
}

export interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export interface SidebarToggleProps {
  onToggle: () => void;
  isOpen: boolean;
}
