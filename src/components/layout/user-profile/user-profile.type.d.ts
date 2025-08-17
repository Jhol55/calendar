import { ReactNode } from 'react';

export interface UserProfileOption {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  divider?: boolean;
}

export interface UserProfileProps {
  className?: string;
  avatarClassName?: string;
  dropdownClassName?: string;
  optionClassName?: string;
  options?: UserProfileOption[];
}
