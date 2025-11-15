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

  const getInitials = (nameOrEmail: string) => {
    // Se for um email, pegar a primeira letra antes do @
    if (nameOrEmail.includes('@')) {
      const beforeAt = nameOrEmail.split('@')[0];
      // Pegar primeira letra válida (ignorar números e caracteres especiais)
      const firstLetter = beforeAt.match(/[a-zA-Z]/)?.[0];
      return firstLetter
        ? firstLetter.toUpperCase()
        : beforeAt.charAt(0).toUpperCase();
    }

    // Se for um nome, pegar as iniciais
    return nameOrEmail
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
        textClassName="justify-start"
        className={cn(
          'flex items-center min-w-6 gap-3 px-2.5 py-2 rounded-lg hover:bg-neutral-200 transition-all duration-200',
          'bg-transparent border-none shadow-none',
          avatarClassName,
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-8 h-8 min-w-8 min-h-8 rounded-full bg-neutral-500 flex items-center justify-center">
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
              {getInitials(user?.name || user?.email || 'U')}
            </Typography>
          )}
        </div>
        <div className="hidden sm:block text-left">
          <Typography variant="span" className="text-white text-sm font-medium">
            {user?.name}
          </Typography>
        </div>
        {user?.email && (
          <Typography
            variant="span"
            className="text-zinc-400 text-xs truncate max-w-[150px] min-w-0"
            title={user.email}
          >
            {user.email}
          </Typography>
        )}
        <ChevronUp
          size={16}
          className={cn(
            'text-zinc-400 transition-transform duration-200 flex-shrink-0',
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
