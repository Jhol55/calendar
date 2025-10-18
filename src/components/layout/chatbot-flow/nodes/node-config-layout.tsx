'use client';

import React, { useState, ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { NodeExecutionPanel } from '../node-execution-panel';
import { cn } from '@/lib/utils';

interface NodeConfigLayoutProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  nodeId?: string;
  flowId?: string;
  children: ReactNode;
}

export function NodeConfigLayout({
  isOpen,
  onClose,
  title,
  nodeId,
  flowId,
  children,
}: NodeConfigLayoutProps) {
  const [showExecutionPanel, setShowExecutionPanel] = useState(true);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      contentClassName={cn(
        showExecutionPanel && '!max-w-[95vw]',
        'overflow-hidden max-w-[40vw]',
      )}
    >
      <div className="flex h-screen w-full" style={{ zoom: 0.9 }}>
        {/* Painel de Entrada (Esquerda) */}
        {showExecutionPanel && nodeId && flowId && (
          <div className="w-1/4 h-screen border-r bg-gray-50 flex flex-col">
            <div className="p-4 border-b bg-white">
              <Typography variant="h3" className="text-sm font-semibold">
                📥 Entrada
              </Typography>
              <Typography variant="span" className="text-neutral-600 text-xs">
                Dados recebidos
              </Typography>
            </div>
            <div className="flex-1 overflow-auto">
              <NodeExecutionPanel
                nodeId={nodeId}
                flowId={flowId}
                mode="input"
                onVariableSelect={(variable) => {
                  console.log('Variable selected:', variable);
                }}
              />
            </div>
          </div>
        )}

        {/* Configuração (Centro) */}
        <div
          className={cn(
            'flex flex-col bg-white w-full',
            showExecutionPanel && '!w-2/4',
          )}
        >
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <Typography variant="h2">{title}</Typography>
              {nodeId && flowId && (
                <button
                  onClick={() => setShowExecutionPanel(!showExecutionPanel)}
                  className="text-sm text-neutral-600 hover:text-neutral-800 font-medium"
                >
                  {showExecutionPanel ? 'Ocultar Painéis' : 'Mostrar Painéis'}
                </button>
              )}
            </div>

            {/* Conteúdo do formulário de configuração */}
            <div className="flex flex-col gap-4 flex-1 overflow-y-auto pr-2">
              {children}
            </div>
          </div>
        </div>

        {/* Painel de Saída (Direita) */}
        {showExecutionPanel && nodeId && flowId && (
          <div className="w-1/4 h-screen border-l bg-gray-50 flex flex-col">
            <div className="p-4 border-b bg-white">
              <Typography variant="h3" className="text-sm font-semibold">
                📤 Saída
              </Typography>
              <Typography variant="span" className="text-neutral-600 text-xs">
                Resultado da execução
              </Typography>
            </div>
            <div className="flex-1 overflow-auto">
              <NodeExecutionPanel
                nodeId={nodeId}
                flowId={flowId}
                mode="output"
                onVariableSelect={(variable) => {
                  console.log('Variable selected:', variable);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
