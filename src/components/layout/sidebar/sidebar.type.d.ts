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
  headerClassName?: string;
  navClassName?: string;
  footerClassName?: string;
  logoClassName?: string;
  menuItemClassName?: string;
}

export interface SidebarToggleProps {
  className?: string;
  onToggle: () => void;
  isOpen: boolean;
}
