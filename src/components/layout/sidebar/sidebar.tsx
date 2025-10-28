'use client';

import React, { useState, useCallback, memo } from 'react';
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
  Server,
  Workflow,
} from 'lucide-react';
import { MenuItem, SidebarProps, SidebarToggleProps } from './sidebar.type';
import { UserProfile } from '../user-profile';

const menuItems: MenuItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <Home size={20} />,
    href: '/index',
  },
  {
    id: 'instances',
    label: 'Instâncias',
    icon: <Server size={20} />,
    href: '/instances',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    icon: <Workflow size={20} />,
    href: '/workflows',
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

const MenuItemComponent = memo(
  ({
    item,
    level,
    isExpanded,
    isActive,
    isHovered,
    onToggle,
    onClick,
    menuItemClassName,
  }: {
    item: MenuItem;
    level: number;
    isExpanded: boolean;
    isActive: boolean;
    isHovered: boolean;
    onToggle: () => void;
    onClick: () => void;
    menuItemClassName?: string;
  }) => {
    const hasSubItems = item.subItems && item.subItems.length > 0;

    return (
      <div className="w-full">
        <Button
          variant="ghost"
          className={cn(
            'relative w-full gap-3 h-12 text-left transition-all duration-200',
            isHovered ? 'justify-start px-4' : 'justify-center px-0',
            isActive && isHovered && '!bg-neutral-200 shadow-lg rounded-full',
            'hover:bg-neutral-200 rounded-full',
            level > 0 && isHovered && 'ml-4 text-sm h-10 w-[calc(100%-1rem)]',
            'bg-transparent border-none shadow-none',
            menuItemClassName,
          )}
          onClick={() => {
            if (hasSubItems) {
              onToggle();
            } else {
              onClick();
            }
          }}
        >
          {isActive && !isHovered && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 !h-10 !w-10 inset-0 rounded-full bg-neutral-200 -z-50 border" />
          )}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  'flex-shrink-0',
                  isActive ? 'text-neutral-700' : 'text-neutral-500',
                )}
              >
                {item.icon}
              </div>
              {isHovered && (
                <Typography
                  variant="span"
                  className={cn(
                    'whitespace-nowrap overflow-hidden',
                    isActive ? 'text-neutral-700' : 'text-neutral-500',
                  )}
                  style={{
                    transition: 'opacity 0.15s ease-out',
                  }}
                >
                  {item.label}
                </Typography>
              )}
            </div>
            {hasSubItems && isHovered && (
              <div className="flex-shrink-0">
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
            className="overflow-hidden"
            style={{
              maxHeight: isHovered && isExpanded ? '500px' : '0',
              opacity: isHovered && isExpanded ? 1 : 0,
              transition: 'max-height 0.2s ease-out, opacity 0.15s ease-out',
            }}
          >
            <div className="space-y-1">
              {item.subItems!.map((subItem) => (
                <MenuItemComponent
                  key={subItem.id}
                  item={subItem}
                  level={level + 1}
                  isExpanded={false}
                  isActive={false}
                  isHovered={isHovered}
                  onToggle={() => {}}
                  onClick={onClick}
                  menuItemClassName={menuItemClassName}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
);

MenuItemComponent.displayName = 'MenuItemComponent';

export const Sidebar: React.FC<SidebarProps> = ({
  className,
  isOpen = true,
  isFakeHovered = false,
  headerClassName,
  navClassName,
  footerClassName,
  logoClassName,
  menuItemClassName,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<string>('');
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  const toggleExpanded = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(itemId)) {
        newExpanded.delete(itemId);
      } else {
        newExpanded.add(itemId);
      }
      return newExpanded;
    });
  }, []);

  const handleItemClick = useCallback(
    (itemId: string, href?: string) => {
      setActiveItem(itemId);
      if (href) {
        router.push(href);
      }
    },
    [router],
  );

  return (
    <>
      {/* Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(!isHovered)}
        onMouseLeave={() => setIsHovered(!isHovered)}
        style={{ zoom: 0.9 }}
        className={cn(
          'fixed left-0 sm:top-0 top-10 flex-1 bg-white backdrop-blur-sm border-r border-neutral-200',
          'z-50 flex flex-col transition-all duration-200 ease-out',
          isOpen ? 'translate-y-0' : '-translate-y-full',
          'md:relative md:translate-x-0',
          isHovered || isFakeHovered ? 'sm:w-52' : 'sm:w-12',
          'w-full',
          className,
        )}
      >
        <div className="flex flex-col h-full relative" style={{ zoom: 0.9 }}>
          {/* Header with Logo */}
          <div
            className={cn(
              'absolute w-full flex items-center justify-start ml-1.5 border-neutral-200 h-20 transition-all duration-200',
              headerClassName,
            )}
          >
            <div className="flex items-center overflow-hidden">
              <div
                className={cn(
                  'w-10 h-10 min-w-10 min-h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0',
                  logoClassName,
                )}
              >
                <Calendar size={24} className="text-white" />
              </div>
              <div
                className="overflow-hidden whitespace-nowrap ml-4"
                style={{
                  opacity: isHovered || isFakeHovered ? 1 : 0,
                  width: isHovered || isFakeHovered ? 'auto' : '0',
                  transition: 'opacity 0.15s ease-out, width 0.2s ease-out',
                }}
              >
                <Typography
                  variant="h5"
                  className="text-white font-bold whitespace-nowrap"
                >
                  Calendar
                </Typography>
                <Typography
                  variant="span"
                  className="text-zinc-400 text-xs whitespace-nowrap"
                >
                  Sistema de Agendamento
                </Typography>
              </div>
            </div>
          </div>
          {/* Navigation Menu */}
          <nav
            style={{ marginTop: '4rem' }}
            className={cn('flex-1 p-4 overflow-y-auto space-y-1', navClassName)}
          >
            {menuItems.map((item) => (
              <MenuItemComponent
                key={item.id}
                item={item}
                level={0}
                isExpanded={expandedItems.has(item.id)}
                isActive={activeItem === item.id}
                isHovered={isHovered || isFakeHovered}
                onToggle={() => toggleExpanded(item.id)}
                onClick={() => handleItemClick(item.id, item.href)}
                menuItemClassName={menuItemClassName}
              />
            ))}
          </nav>
          {/* Footer */}
          <div
            className={cn(
              'border-t border-neutral-200 h-20 flex items-center transition-all duration-200',
              isHovered ? 'justify-start px-4' : 'justify-center px-0',
              footerClassName,
            )}
          >
            <div
              className="overflow-hidden"
              style={{
                opacity: isHovered ? 1 : 0,
                width: isHovered ? '100%' : '0',
                transition: 'opacity 0.15s ease-out, width 0.2s ease-out',
              }}
            >
              <UserProfile />
            </div>
            {!isHovered && (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Users size={16} className="text-white" />
              </div>
            )}
          </div>
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
        'absolute z-50 sm:hidden p-3 bg-zinc-900/95 backdrop-blur-sm border rounded-none border-zinc-800/50 hover:bg-zinc-800/95',
        className,
      )}
      onClick={onToggle}
    >
      {isOpen ? <X size={20} /> : <Menu size={20} />}
    </Button>
  );
};
