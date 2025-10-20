'use client';

import React, { useState, ReactNode, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { NodeExecutionPanel } from '../node-execution-panel';
import { cn } from '@/lib/utils';
import { Pencil, Check, X } from 'lucide-react';

interface NodeConfigLayoutProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  nodeId?: string;
  flowId?: string;
  children: ReactNode;
  nodeLabel?: string;
  onNodeLabelChange?: (label: string) => void;
}

export function NodeConfigLayout({
  isOpen,
  onClose,
  title,
  nodeId,
  flowId,
  children,
  nodeLabel,
  onNodeLabelChange,
}: NodeConfigLayoutProps) {
  const [showExecutionPanel, setShowExecutionPanel] = useState(true);
  const [localLabel, setLocalLabel] = useState(nodeLabel || '');
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState(nodeLabel || '');

  useEffect(() => {
    setLocalLabel(nodeLabel || '');
    setTempLabel(nodeLabel || '');
  }, [nodeLabel]);

  const handleSaveLabel = () => {
    setLocalLabel(tempLabel);
    onNodeLabelChange?.(tempLabel);
    setIsEditingLabel(false);
  };

  const handleCancelEdit = () => {
    setTempLabel(localLabel);
    setIsEditingLabel(false);
  };

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
              <Typography variant="h3" className="font-semibold">
                📥 Entrada
              </Typography>
              <Typography variant="span" className="text-neutral-600">
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
            <div className="flex items-center justify-between mb-6 gap-3">
              {/* Título com nome editável */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Typography variant="h2" className="whitespace-nowrap hidden">
                  {title}
                </Typography>

                {isEditingLabel ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      value={tempLabel}
                      onChange={(e) => setTempLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveLabel();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      placeholder="Nome do node..."
                      className="min-w-0 !w-72 rounded-md border border-gray-300 bg-neutral-100 p-2.5 text-sm text-black/80 outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#5c5e5d]"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveLabel}
                      className="p-1.5 hover:bg-green-100 rounded transition-colors"
                      title="Salvar (Enter)"
                    >
                      <Check className="w-4 h-4 text-green-600" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1.5 hover:bg-red-100 rounded transition-colors"
                      title="Cancelar (Esc)"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                ) : (
                  <>
                    {localLabel && (
                      <Typography
                        variant="h2"
                        className="whitespace-nowrap truncate"
                        title={localLabel}
                      >
                        ⚙️ {localLabel}
                      </Typography>
                    )}
                    <button
                      onClick={() => setIsEditingLabel(true)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                      title="Editar nome do node"
                    >
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                  </>
                )}
              </div>

              {nodeId && flowId && (
                <button
                  onClick={() => setShowExecutionPanel(!showExecutionPanel)}
                  className="text-sm text-neutral-600 hover:text-neutral-800 font-medium whitespace-nowrap flex-shrink-0"
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
              <Typography variant="h3" className="font-semibold">
                📤 Saída
              </Typography>
              <Typography variant="span" className="text-neutral-600">
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
