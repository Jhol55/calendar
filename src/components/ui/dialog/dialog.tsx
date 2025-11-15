'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loading } from '../loading';

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, right: 0 });
  const [isPositionCalculated, setIsPositionCalculated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => {
      setIsLoading(false);
    };
  }, []);

  // Calcular posição do botão
  const updateButtonPosition = () => {
    if (dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect();
      const offset = 12; // 16px de distância da borda

      // Calcular posição baseada no canto superior direito do conteúdo do dialog
      setButtonPosition({
        top: rect.top - offset, // 16px acima do topo do dialog
        right: (window.innerWidth - rect.right) / 0.9 - offset, // 16px à direita do dialog
      });
      setIsPositionCalculated(true);
    }
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    };

    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';

      // Calcular posição inicial
      updateButtonPosition();

      // ResizeObserver para mudanças de tamanho em tempo real
      if (dialogRef.current) {
        resizeObserver = new ResizeObserver(() => {
          requestAnimationFrame(() => {
            updateButtonPosition();
          });
        });
        resizeObserver.observe(dialogRef.current);
      }

      // MutationObserver para mudanças de classes CSS
      if (dialogRef.current) {
        mutationObserver = new MutationObserver(() => {
          requestAnimationFrame(() => {
            updateButtonPosition();
          });
        });
        mutationObserver.observe(dialogRef.current, {
          attributes: true,
          attributeFilter: ['class', 'style'],
          subtree: true,
        });
      }

      // Fallback para redimensionamento da janela
      const handleResize = () => {
        requestAnimationFrame(() => {
          updateButtonPosition();
        });
      };
      window.addEventListener('resize', handleResize);

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = 'unset';
        window.removeEventListener('resize', handleResize);

        if (resizeObserver) {
          resizeObserver.disconnect();
        }
        if (mutationObserver) {
          mutationObserver.disconnect();
        }
      };
    } else {
      setIsPositionCalculated(false);
    }
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
      <div className="flex justify-center w-full relative">
        <div
          ref={dialogRef}
          className={cn(
            'bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] h-screen overflow-hidden',
            'animate-in fade-in-0 zoom-in-95 duration-300',
            contentClassName,
          )}
          onSubmit={(e) => {
            // Prevenir propagação de submit para dialogs pais
            e.stopPropagation();
          }}
        >
          {!isLoading ? (
            children
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <Loading size="md" />
            </div>
          )}
        </div>

        {/* Botão de fechar posicionado dinamicamente */}
        {closeButton && isPositionCalculated && (
          <Button
            variant="ghost"
            className="fixed z-50 h-8 w-8 p-0 text-neutral-400 hover:text-neutral-500 bg-neutral-100 border border-neutral-300 hover:border-neutral-300 rounded-full shadow-md hover:shadow-lg"
            textClassName="!justify-center"
            onClick={onClose}
            style={{
              top: `${buttonPosition.top}px`,
              right: `${buttonPosition.right}px`,
              transition: 'none', // Remove transição para movimento instantâneo
            }}
          >
            <div className="relative flex items-center justify-center w-full h-full">
              <X
                size={18}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              />
            </div>
          </Button>
        )}
      </div>
    </div>
  );

  // Use portal to render dialog at the root level
  return createPortal(dialogContent, document.body);
};
