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
  isFakeHovered?: boolean;
  onToggle?: () => void;
  headerClassName?: string;
  navClassName?: string;
  footerClassName?: string;
  logoClassName?: string;
  menuItemClassName?: string;
  changeWidthOnHover?: boolean;
}

export interface SidebarToggleProps {
  className?: string;
  onToggle: () => void;
  isOpen: boolean;
}
