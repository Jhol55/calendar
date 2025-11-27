'use client';

import React, { ReactNode } from 'react';
import { Handle, Position } from 'reactflow';
import { Typography } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { NodeThemeColor, nodeThemes } from './node-theme';

export interface NodeHandle {
  id?: string;
  label?: string;
  color?: string;
  position?: number; // Porcentagem da posição vertical (0-100)
}

export interface BaseNodeProps {
  /** Ícone do node (componente Lucide) */
  icon: ReactNode;
  /** Título principal do node */
  title: string;
  /** Subtítulo opcional */
  subtitle?: string;
  /** Badge/tag de tipo ou status */
  badge?: string;
  /** Conteúdo de preview */
  preview?: ReactNode;
  /** Conteúdo adicional no footer */
  footer?: ReactNode;
  /** Se o node está selecionado */
  selected?: boolean;
  /** Cor do tema */
  themeColor: NodeThemeColor;
  /** Configuração de handles */
  handles?: {
    /** Se tem handle de entrada (esquerda) */
    input?: boolean;
    /** Handles de saída (direita) - pode ser múltiplos */
    outputs?: NodeHandle[];
  };
  /** Conteúdo customizado dentro do node */
  children?: ReactNode;
  /** Classes CSS adicionais para o container */
  className?: string;
  /** Largura mínima customizada */
  minWidth?: number;
  /** Largura máxima customizada */
  maxWidth?: number;
}

export function BaseNode({
  icon,
  title,
  subtitle,
  badge,
  preview,
  footer,
  selected = false,
  themeColor,
  handles = { input: true, outputs: [{}] },
  children,
  className,
  minWidth = 220,
  maxWidth = 300,
}: BaseNodeProps) {
  const theme = nodeThemes[themeColor];
  const outputs = handles.outputs || [{}];

  return (
    <div
      className={cn(
        'bg-white rounded-lg border-2 shadow-lg transition-all duration-200',
        selected ? theme.borderSelected : theme.border,
        className,
      )}
      style={{ minWidth: `${minWidth}px`, maxWidth: `${maxWidth}px` }}
    >
      {/* Handle de entrada */}
      {handles.input && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !border-2 !border-white"
          style={{ background: theme.handleColor }}
        />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className={cn('p-2 rounded-lg', theme.iconBg, theme.iconText)}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <Typography
              variant="h3"
              className="font-semibold text-sm text-gray-800 truncate"
            >
              {title}
            </Typography>
            {subtitle && (
              <Typography
                variant="span"
                className="text-xs text-gray-500 block truncate"
              >
                {subtitle}
              </Typography>
            )}
          </div>
        </div>

        {/* Badge */}
        {badge && (
          <div className="mb-2">
            <span
              className={cn(
                'inline-block px-2 py-1 rounded text-xs font-medium',
                theme.badgeBg,
                theme.badgeText,
              )}
            >
              {badge}
            </span>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
            {preview}
          </div>
        )}

        {/* Custom children */}
        {children}

        {/* Footer */}
        {footer && <div className="mt-2">{footer}</div>}
      </div>

      {/* Handles de saída */}
      {outputs.length === 1 && !outputs[0].label ? (
        // Handle único simples
        <Handle
          type="source"
          position={Position.Right}
          id={outputs[0].id}
          className="!w-3 !h-3 !border-2 !border-white"
          style={{ background: outputs[0].color || theme.handleColor }}
        />
      ) : (
        // Múltiplos handles ou handles com label
        outputs.map((output, index) => {
          const positionPercent =
            output.position ?? (100 / (outputs.length + 1)) * (index + 1);

          return (
            <div
              key={output.id || index}
              className="absolute right-0 flex items-center"
              style={{
                top: `${positionPercent}%`,
                transform: 'translateY(-50%)',
              }}
            >
              {output.label && (
                <span className="text-[10px] font-medium text-gray-600 mr-2 bg-gray-100 px-1.5 py-0.5 rounded">
                  {output.label}
                </span>
              )}
              <Handle
                type="source"
                position={Position.Right}
                id={output.id}
                className="!w-3 !h-3 !border-2 !border-white !relative !transform-none !top-0 !right-0"
                style={{
                  background: output.color || theme.handleColor,
                  position: 'relative',
                }}
              />
            </div>
          );
        })
      )}
    </div>
  );
}

// Componente de preview padronizado
export function NodePreview({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-xs text-gray-600 bg-gray-50 p-2 rounded line-clamp-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

// Componente de info line padronizado
export function NodeInfoLine({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Typography
      variant="span"
      className={cn('text-xs text-gray-600 flex items-center gap-1', className)}
    >
      {icon}
      {children}
    </Typography>
  );
}

// Componente de badge list
export function NodeBadgeList({
  items,
  themeColor,
}: {
  items: string[];
  themeColor: NodeThemeColor;
}) {
  const theme = nodeThemes[themeColor];

  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, index) => (
        <span
          key={index}
          className={cn(
            'px-2 py-0.5 rounded text-xs font-medium',
            theme.badgeBg,
            theme.badgeText,
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
