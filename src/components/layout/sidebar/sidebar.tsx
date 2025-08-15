'use client';

import React, { useState } from 'react';
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
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { MenuItem, SidebarProps, SidebarToggleProps } from './sidebar.type';

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Home size={20} />,
    href: '/dashboard',
  },
  {
    id: 'calendar',
    label: 'Calendário',
    icon: <Calendar size={20} />,
    href: '/calendar',
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
  onToggle,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<string>('');

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
      // Aqui você pode adicionar navegação
      console.log(`Navegando para: ${href}`);
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
            level > 0 && 'ml-4 text-sm py-2 w-[calc(100%-1rem)]',
            'bg-transparent border-none shadow-none',
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
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen bg-zinc-900/95 backdrop-blur-sm border-r border-zinc-800/50',
          'transition-transform duration-300 ease-in-out z-50',
          'flex flex-col',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'w-80 md:relative md:translate-x-0',
          className,
        )}
      >
        {/* Header with Logo */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center">
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

          {/* Mobile close button */}
          <Button
            variant="default"
            className="md:hidden p-2 bg-zinc-800/50 hover:bg-zinc-700/50 border-none"
            onClick={onToggle}
          >
            <X size={20} />
          </Button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => renderMenuItem(item))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/50">
          <Button
            variant="gradient"
            className="w-full justify-start gap-3 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30"
            onClick={() => console.log('Logout')}
          >
            <LogOut size={20} />
            <Typography variant="span">Sair</Typography>
          </Button>
        </div>
      </aside>
    </>
  );
};

// Mobile toggle button component
export const SidebarToggle: React.FC<SidebarToggleProps> = ({
  onToggle,
  isOpen,
}) => {
  return (
    <Button
      variant="default"
      className="fixed top-4 left-4 z-50 md:hidden p-3 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800/50 hover:bg-zinc-800/95"
      onClick={onToggle}
    >
      {isOpen ? <X size={20} /> : <Menu size={20} />}
    </Button>
  );
};
