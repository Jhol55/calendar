'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  contentClassName?: string;
  closeButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  children,
  className,
  overlayClassName,
  contentClassName,
  closeButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, closeOnEscape]);

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && closeOnOverlayClick) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const dialogContent = (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        className,
      )}
      style={{ zoom: 0.9 }}
    >
      {/* Overlay */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          overlayClassName,
        )}
        onClick={handleOverlayClick}
      />

      {/* Dialog Content */}
      <div
        className={cn(
          'relative bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] h-screen overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-300',
          contentClassName,
        )}
      >
        {closeButton && (
          <Button
            variant="ghost"
            className="absolute top-4 right-4 z-10 h-8 w-8 p-0 text-neutral-400 hover:text-neutral-500 !shadow-none !text-center"
            textClassName="!justify-center"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        )}

        {children}
      </div>
    </div>
  );

  // Use portal to render dialog at the root level
  return createPortal(dialogContent, document.body);
};
