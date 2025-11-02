'use client';

import React, { useState, useEffect } from 'react';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  StopCircle,
} from 'lucide-react';
import {
  listExecutions,
  stopExecution,
  type Execution,
} from '@/actions/executions';

interface ExecutionsPanelProps {
  flowId: string;
  isOpen: boolean;
  onClose: () => void;
  onExecutionSelect?: (execution: Execution) => void;
}

export function ExecutionsPanel({
  flowId,
  isOpen,
  onClose,
  onExecutionSelect,
}: ExecutionsPanelProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(
    null,
  );

  const fetchExecutions = async () => {
    setLoading(true);
    try {
      const result = await listExecutions({
        flowId,
        limit: 20,
      });

      if (result.success && result.executions) {
        setExecutions(result.executions);
      } else {
        console.error('Error fetching executions:', result.error);
        setExecutions([]);
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStopExecution = async (
    executionId: string,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation(); // Evitar selecionar a execução ao clicar no botão

    if (!confirm('Tem certeza que deseja parar esta execução?')) {
      return;
    }

    try {
      const result = await stopExecution(executionId);
      if (result.success) {
        console.log('✅ Execution stopped successfully');
        // Atualizar lista de execuções
        await fetchExecutions();
        // Se a execução parada estava selecionada, atualizar
        if (selectedExecution?.id === executionId) {
          setSelectedExecution(result.execution as Execution);
        }
      } else {
        alert(`Erro ao parar execução: ${result.error}`);
      }
    } catch (error) {
      console.error('Error stopping execution:', error);
      alert('Erro ao parar execução');
    }
  };

  useEffect(() => {
    if (isOpen && flowId) {
      fetchExecutions();

      // Verificar se há uma execução selecionada no sessionStorage
      const selectedExecutionStr = sessionStorage.getItem('selectedExecution');
      if (selectedExecutionStr) {
        try {
          const execution = JSON.parse(selectedExecutionStr);
          setSelectedExecution(execution);
          if (onExecutionSelect) {
            onExecutionSelect(execution);
          }
        } catch (err) {
          console.warn('⚠️ Could not parse selected execution');
        }
      }
    }
  }, [isOpen, flowId]);

  // Detectar quando uma execução é selecionada (evento customizado)
  useEffect(() => {
    const handleExecutionSelected = (event: any) => {
      const execution = event.detail;
      console.log('🎯 Nova execução detectada:', execution.id);
      setSelectedExecution(execution);
      if (onExecutionSelect) {
        onExecutionSelect(execution);
      }
      // Atualizar lista de execuções para incluir a nova
      fetchExecutions();
    };

    window.addEventListener('executionSelected', handleExecutionSelected);

    return () => {
      window.removeEventListener('executionSelected', handleExecutionSelected);
    };
  }, [onExecutionSelect]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'stopped':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '-';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="max-w-[95vw] w-full max-h-[90vh] h-screen flex flex-col"
    >
      <div className="flex flex-col h-full" style={{ zoom: 0.9 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Play className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <Typography variant="h3" className="font-semibold">
                Execuções do Fluxo
              </Typography>
              <Typography variant="span" className="text-sm text-neutral-600">
                Histórico e detalhes de execuções
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              onClick={fetchExecutions}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden bg-neutral-50">
          {/* Lista de Execuções */}
          <div className="w-full bg-white overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Typography variant="h4" className="font-semibold">
                  Histórico de Execuções
                </Typography>
                <Badge variant="secondary" className="text-xs">
                  {executions.length}
                </Badge>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-3" />
                  <Typography variant="p" className="text-neutral-600">
                    Carregando execuções...
                  </Typography>
                </div>
              ) : executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
                  <div className="p-4 bg-neutral-100 rounded-full mb-4">
                    <Play className="w-8 h-8 text-neutral-400" />
                  </div>
                  <Typography variant="h5" className="mb-2">
                    Nenhuma execução encontrada
                  </Typography>
                  <Typography variant="span" className="text-sm">
                    Execute o fluxo para ver o histórico aqui
                  </Typography>
                </div>
              ) : (
                <div className="space-y-3">
                  {executions.map((execution) => (
                    <div
                      key={execution.id}
                      className={cn(
                        'p-4 border-2 rounded-xl cursor-pointer transition-all bg-white',
                        selectedExecution?.id === execution.id
                          ? 'border-blue-500 bg-blue-50/50 shadow-md'
                          : 'border-neutral-200 hover:border-neutral-300 hover:shadow-sm',
                      )}
                      onClick={() => setSelectedExecution(execution)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 bg-neutral-100 rounded-lg">
                            {getStatusIcon(execution.status)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Typography
                              variant="span"
                              className="font-mono text-xs text-neutral-500 block truncate"
                            >
                              {execution.id.substring(0, 12)}...
                            </Typography>
                            <Badge
                              variant={
                                execution.status === 'success'
                                  ? 'default'
                                  : execution.status === 'error'
                                    ? 'destructive'
                                    : execution.status === 'running'
                                      ? 'outline'
                                      : 'secondary'
                              }
                              className={cn(
                                'mt-1 text-xs font-semibold',
                                execution.status === 'success' &&
                                  'bg-green-600 text-white border-green-600',
                                execution.status === 'error' &&
                                  'bg-red-600 text-white border-red-600',
                              )}
                            >
                              {execution.status}
                            </Badge>
                          </div>
                        </div>
                        {execution.status === 'running' && (
                          <Button
                            variant="ghost"
                            onClick={(e) =>
                              handleStopExecution(execution.id, e)
                            }
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Parar execução"
                          >
                            <StopCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-neutral-600">
                          <Clock className="w-3 h-3" />
                          <Typography variant="span" className="text-xs">
                            {formatDate(execution.startTime)}
                          </Typography>
                        </div>
                        {execution.endTime && (
                          <div className="flex items-center gap-2 text-neutral-600">
                            <CheckCircle className="w-3 h-3" />
                            <Typography variant="span" className="text-xs">
                              {formatDate(execution.endTime)}
                            </Typography>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                          <Typography
                            variant="span"
                            className="text-xs text-neutral-500"
                          >
                            Duração
                          </Typography>
                          <Typography
                            variant="span"
                            className="text-xs font-medium"
                          >
                            {formatDuration(execution.duration)}
                          </Typography>
                        </div>
                        <div className="flex items-center justify-between">
                          <Typography
                            variant="span"
                            className="text-xs text-neutral-500"
                          >
                            Tipo
                          </Typography>
                          <Typography
                            variant="span"
                            className="text-xs font-medium"
                          >
                            {execution.triggerType}
                          </Typography>
                        </div>
                      </div>

                      {selectedExecution?.id === execution.id &&
                        onExecutionSelect && (
                          <Button
                            variant="gradient"
                            className="mt-4 w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              onExecutionSelect(execution);
                              onClose();
                            }}
                          >
                            Visualizar no Fluxo
                          </Button>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
