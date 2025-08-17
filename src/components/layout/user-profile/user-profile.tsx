'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { User, Settings, LogOut, ChevronUp, Palette } from 'lucide-react';
import { UserProfileProps, UserProfileOption } from './user-profile.type';
import { useOutsideClick } from '@/hooks/use-outside-click';
import { useUser } from '@/hooks/use-user';
import { logout } from '@/actions/user/logout';

const defaultOptions: UserProfileOption[] = [
  {
    id: 'profile',
    label: 'Perfil',
    icon: <User size={16} />,
    href: '/profile',
  },
  {
    id: 'settings',
    label: 'Configurações',
    icon: <Settings size={16} />,
    href: '/settings',
  },
  {
    id: 'theme',
    label: 'Tema',
    icon: <Palette size={16} />,
    onClick: () => console.log('Theme toggle'),
  },
  {
    id: 'divider',
    label: '',
    icon: <></>,
    divider: true,
  },
  {
    id: 'logout',
    label: 'Sair',
    icon: <LogOut size={16} />,
    onClick: () => console.log('Logout'),
  },
];

export const UserProfile: React.FC<UserProfileProps> = ({
  className,
  avatarClassName,
  dropdownClassName,
  optionClassName,
  options = defaultOptions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { user } = useUser();

  useOutsideClick(dropdownRef, () => setIsOpen(false));

  const handleOptionClick = async (option: UserProfileOption) => {
    if (option.onClick) {
      option.onClick();
    } else if (option.href) {
      router.push(option.href);
    }

    // Handle specific actions
    if (option.id === 'logout') {
      await logout();
      router.push('/login');
    } else if (option.id === 'settings') {
    } else if (option.id === 'theme') {
    }

    setIsOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Avatar Button */}
      <Button
        variant="ghost"
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 transition-all duration-200',
          'bg-transparent border-none shadow-none',
          avatarClassName,
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
          {user?.avatar ? (
            <Image
              src={user.avatar}
              alt={user.name || ''}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <Typography
              variant="span"
              className="text-white text-sm font-medium"
            >
              {getInitials(user?.name || 'U')}
            </Typography>
          )}
        </div>
        <div className="hidden sm:block text-left">
          <Typography variant="span" className="text-white text-sm font-medium">
            {user?.name}
          </Typography>
          <Typography variant="span" className="text-zinc-400 text-xs block">
            {user?.email}
          </Typography>
        </div>
        <ChevronUp
          size={16}
          className={cn(
            'text-zinc-400 transition-transform duration-200',
            !isOpen && 'rotate-180',
          )}
        />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            'absolute bottom-full left-0 mb-2 w-56 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800/50 rounded-lg shadow-md',
            'transition-all duration-200 ease-in-out z-50',
            dropdownClassName,
          )}
        >
          {/* Options List */}
          <div className="p-2">
            {options.map((option) => (
              <div key={option.id}>
                {option.divider ? (
                  <div className="h-px bg-zinc-800/50 my-2" />
                ) : (
                  <Button
                    variant="ghost"
                    className={cn(
                      'w-full flex !justify-start gap-3 px-3 py-2 text-left transition-all duration-200',
                      'hover:bg-zinc-800/50 rounded-md',
                      'bg-transparent border-none shadow-none',
                      optionClassName,
                    )}
                    onClick={() => handleOptionClick(option)}
                  >
                    <div className="text-zinc-300">{option.icon}</div>
                    <Typography
                      variant="span"
                      className="text-zinc-300 text-sm"
                    >
                      {option.label}
                    </Typography>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
