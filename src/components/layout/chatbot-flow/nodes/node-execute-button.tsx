/**
 * Botão de execução parcial que aparece nos nodes
 * Permite executar o workflow do início até o node atual
 */

import React, { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NodeExecuteButtonProps {
  nodeId: string;
  onExecute: (nodeId: string) => void | Promise<void>;
  isExecuting?: boolean;
  className?: string;
}

export function NodeExecuteButton({
  nodeId,
  onExecute,
  isExecuting = false,
  className,
}: NodeExecuteButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Evitar que o clique no botão selecione o node
    await onExecute(nodeId);
  };

  return (
    <div
      className={cn(
        'absolute -top-6 -right-3 z-50',
        'transition-all duration-200',
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Button
        onClick={handleClick}
        disabled={isExecuting}
        variant="default"
        className={cn(
          'h-8 w-8 p-0 rounded-full shadow-lg',
          'bg-gradient-to-br from-emerald-500 to-emerald-600',
          'hover:from-emerald-600 hover:to-emerald-700',
          'transition-all duration-200',
          'border',
          isExecuting && 'cursor-not-allowed opacity-75',
          isHovered && 'scale-110',
        )}
        title="Executar até aqui"
      >
        {isExecuting ? (
          <Loader2 className="w-4 h-4 text-white animate-spin" />
        ) : (
          <Play className="w-4 h-4 text-white fill-white" />
        )}
      </Button>

      {/* Tooltip no hover */}
      {isHovered && !isExecuting && (
        <div className="absolute top-10 right-0 whitespace-nowrap">
          <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg">
            Executar até aqui
          </div>
        </div>
      )}
    </div>
  );
}
