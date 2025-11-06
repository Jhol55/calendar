'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  onLoginClick: () => void;
  className?: string;
  style?: object;
}

export const Navbar: React.FC<NavbarProps> = ({
  onLoginClick,
  className,
  style,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav
      style={style}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200',
        className,
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Typography
              variant="h1"
              className="text-2xl font-bold text-neutral-900"
            >
              4itt
            </Typography>
          </div>

          {/* Navigation Links - Desktop */}
          <div className="hidden md:flex items-center gap-8">
            <a
              href="#resources"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Recursos
            </a>
            <a
              href="#plans"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Preços
            </a>
          </div>

          {/* Login Button & Mobile Menu */}
          <div className="flex items-center gap-4">
            <Button
              variant="gradient"
              bgHexColor="#545556"
              onClick={onLoginClick}
              className="hidden md:block px-6 py-2"
            >
              Login
            </Button>
            <button
              className="md:hidden p-2 text-neutral-600 hover:text-neutral-900"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden pb-4 border-t border-neutral-200 mt-2 pt-4">
            <div className="flex flex-col gap-4">
              <a
                href="#resources"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Recursos
              </a>
              <a
                href="#plans"
                className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Preços
              </a>
              <Button
                variant="gradient"
                bgHexColor="#545556"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLoginClick();
                }}
                className="w-full px-6 py-2"
              >
                Login
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
