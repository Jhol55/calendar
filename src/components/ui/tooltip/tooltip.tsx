'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { TooltipProps } from './tooltip.type';

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className,
  delay = 300,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<
    'top' | 'bottom' | 'left' | 'right'
  >('bottom');
  const timeoutRef = useRef<NodeJS.Timeout>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const calculatePosition = () => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 300; // max-w-xs ~ 300px (estimativa)
    const tooltipHeight = 100; // estimativa
    const gap = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Verificar espaço disponível em cada direção
    const spaceBottom = viewportHeight - triggerRect.bottom;
    const spaceTop = triggerRect.top;
    const spaceRight = viewportWidth - triggerRect.right;
    const spaceLeft = triggerRect.left;

    let newPlacement: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    let top = 0;
    let left = 0;

    // Prioridade: bottom > top > right > left
    if (spaceBottom >= tooltipHeight + gap) {
      // Posicionar abaixo
      newPlacement = 'bottom';
      top = triggerRect.bottom + window.scrollY + gap;
      left = triggerRect.left + window.scrollX + triggerRect.width / 2;
    } else if (spaceTop >= tooltipHeight + gap) {
      // Posicionar acima
      newPlacement = 'top';
      top = triggerRect.top + window.scrollY - gap;
      left = triggerRect.left + window.scrollX + triggerRect.width / 2;
    } else if (spaceRight >= tooltipWidth + gap) {
      // Posicionar à direita
      newPlacement = 'right';
      top = triggerRect.top + window.scrollY + triggerRect.height / 2;
      left = triggerRect.right + window.scrollX + gap;
    } else if (spaceLeft >= tooltipWidth + gap) {
      // Posicionar à esquerda
      newPlacement = 'left';
      top = triggerRect.top + window.scrollY + triggerRect.height / 2;
      left = triggerRect.left + window.scrollX - gap;
    } else {
      // Se não houver espaço suficiente, usar bottom como padrão
      newPlacement = 'bottom';
      top = triggerRect.bottom + window.scrollY + gap;
      left = triggerRect.left + window.scrollX + triggerRect.width / 2;
    }

    setPlacement(newPlacement);
    setPosition({ top, left });
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        calculatePosition();
        setIsVisible(true);
      }
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>
      {isVisible &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            className={cn(
              'fixed z-[9999] max-w-xs px-3 py-2 text-sm text-white bg-neutral-700 rounded-lg',
              'shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-neutral-600/50',
              'animate-in fade-in-0 zoom-in-95 duration-150',
              'pointer-events-none',
              className,
            )}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              transform:
                placement === 'bottom' || placement === 'top'
                  ? 'translateX(-50%)'
                  : placement === 'left'
                    ? 'translate(-100%, -50%)'
                    : 'translateY(-50%)',
              zoom: 0.9,
            }}
          >
            <div className="relative">
              {/* Arrow - posição dinâmica baseada no placement */}
              {placement === 'bottom' && (
                <>
                  <div
                    className="absolute -top-[7px] left-1/2 -translate-x-1/2"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '7px solid transparent',
                      borderRight: '7px solid transparent',
                      borderBottom: '7px solid rgb(64, 64, 64)',
                    }}
                  />
                  <div
                    className="absolute -top-[8px] left-1/2 -translate-x-1/2"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '8px solid transparent',
                      borderRight: '8px solid transparent',
                      borderBottom: '8px solid rgba(82, 82, 82, 0.5)',
                    }}
                  />
                </>
              )}

              {placement === 'top' && (
                <>
                  <div
                    className="absolute -bottom-[7px] left-1/2 -translate-x-1/2"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '7px solid transparent',
                      borderRight: '7px solid transparent',
                      borderTop: '7px solid rgb(64, 64, 64)',
                    }}
                  />
                  <div
                    className="absolute -bottom-[8px] left-1/2 -translate-x-1/2"
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '8px solid transparent',
                      borderRight: '8px solid transparent',
                      borderTop: '8px solid rgba(82, 82, 82, 0.5)',
                    }}
                  />
                </>
              )}

              {placement === 'right' && (
                <>
                  <div
                    className="absolute -left-[7px] top-1/2 -translate-y-1/2"
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: '7px solid transparent',
                      borderBottom: '7px solid transparent',
                      borderRight: '7px solid rgb(64, 64, 64)',
                    }}
                  />
                  <div
                    className="absolute -left-[8px] top-1/2 -translate-y-1/2"
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: '8px solid transparent',
                      borderBottom: '8px solid transparent',
                      borderRight: '8px solid rgba(82, 82, 82, 0.5)',
                    }}
                  />
                </>
              )}

              {placement === 'left' && (
                <>
                  <div
                    className="absolute -right-[7px] top-1/2 -translate-y-1/2"
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: '7px solid transparent',
                      borderBottom: '7px solid transparent',
                      borderLeft: '7px solid rgb(64, 64, 64)',
                    }}
                  />
                  <div
                    className="absolute -right-[8px] top-1/2 -translate-y-1/2"
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: '8px solid transparent',
                      borderBottom: '8px solid transparent',
                      borderLeft: '8px solid rgba(82, 82, 82, 0.5)',
                    }}
                  />
                </>
              )}

              {content}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};
