'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Home,
  Calendar,
  Users,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { MenuItem, SidebarProps, SidebarToggleProps } from './sidebar.type';
import { UserProfile } from '../user-profile';

const menuItems: MenuItem[] = [
  {
    id: 'calendar',
    label: 'Calendário',
    icon: <Calendar size={20} />,
    href: '/index',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Home size={20} />,
    href: '/dashboard',
  },
  {
    id: 'users',
    label: 'Usuários',
    icon: <Users size={20} />,
    subItems: [
      {
        id: 'clients',
        label: 'Clientes',
        icon: <Users size={16} />,
        href: '/users/clients',
      },
      {
        id: 'staff',
        label: 'Equipe',
        icon: <Users size={16} />,
        href: '/users/staff',
      },
    ],
  },
  {
    id: 'settings',
    label: 'Configurações',
    icon: <Settings size={20} />,
    href: '/settings',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  className,
  isOpen = true,
  headerClassName,
  navClassName,
  footerClassName,
  logoClassName,
  menuItemClassName,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<string>('');
  const router = useRouter();

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleItemClick = (itemId: string, href?: string) => {
    setActiveItem(itemId);
    if (href) {
      router.push(href);
    }
  };

  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const isActive = activeItem === item.id;
    const hasSubItems = item.subItems && item.subItems.length > 0;

    return (
      <div key={item.id} className="w-full">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 px-4 py-3 text-left transition-all duration-300',
            'hover:bg-zinc-800/50',
            isActive && '!bg-zinc-800/50 shadow-lg',
            level > 0 && 'ml-4 text-sm py-2 sm:w-[calc(100%-1rem)]',
            'bg-transparent border-none shadow-none',
            menuItemClassName,
          )}
          onClick={() => {
            if (hasSubItems) {
              toggleExpanded(item.id);
            } else {
              handleItemClick(item.id, item.href);
            }
          }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'transition-colors duration-200',
                  isActive ? 'text-white' : 'text-zinc-300',
                )}
              >
                {item.icon}
              </div>
              <Typography
                variant="span"
                className={cn(
                  'transition-colors duration-200',
                  isActive ? 'text-white' : 'text-zinc-300',
                )}
              >
                {item.label}
              </Typography>
            </div>
            {hasSubItems && (
              <div className="transition-transform duration-200">
                {isExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </div>
            )}
          </div>
        </Button>

        {hasSubItems && (
          <div
            className={cn(
              'overflow-hidden transition-all duration-300 ease-in-out',
              isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
            )}
          >
            <div className="space-y-1">
              {item.subItems!.map((subItem) =>
                renderMenuItem(subItem, level + 1),
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 sm:top-0 top-10 sm:h-screen h-[calc(100vh-2.5rem)] bg-zinc-900/95 backdrop-blur-sm border-r border-zinc-800/50',
          'transition-transform duration-300 ease-in-out z-50',
          'flex flex-col',
          isOpen ? 'translate-y-0' : '-translate-y-full',
          'sm:w-80 w-full md:relative md:translate-x-0',
          className,
        )}
      >
        {/* Header with Logo */}
        <div
          className={cn(
            'flex items-center justify-between p-6 border-b border-zinc-800/50',
            headerClassName,
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center',
                logoClassName,
              )}
            >
              <Calendar size={24} className="text-white" />
            </div>
            <div>
              <Typography variant="h5" className="text-white font-bold">
                Calendar
              </Typography>
              <Typography variant="span" className="text-zinc-400 text-xs">
                Sistema de Agendamento
              </Typography>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav
          className={cn('flex-1 p-4 space-y-2 overflow-y-auto', navClassName)}
        >
          {menuItems.map((item) => renderMenuItem(item))}
        </nav>

        {/* Footer */}
        <div className={cn('p-4 border-t border-zinc-800/50', footerClassName)}>
          <UserProfile />
        </div>
      </aside>
    </>
  );
};

// Mobile toggle button component
export const SidebarToggle: React.FC<SidebarToggleProps> = ({
  className,
  onToggle,
  isOpen,
}) => {
  return (
    <Button
      variant="default"
      className={cn(
        'z-50 sm:hidden p-3 bg-zinc-900/95 backdrop-blur-sm border rounded-none border-zinc-800/50 hover:bg-zinc-800/95',
        className,
      )}
      onClick={onToggle}
    >
      {isOpen ? <X size={20} /> : <Menu size={20} />}
    </Button>
  );
};
