'use client';

import React, { useState, useEffect } from 'react';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
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
    }
  }, [isOpen, flowId]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'stopped':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Play className="w-6 h-6 text-blue-500" />
            <Typography variant="h3">Execuções do Fluxo</Typography>
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
            <Button variant="default" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Lista de Execuções */}
          <div className="w-1/2 border-r overflow-y-auto">
            <div className="p-4">
              <Typography variant="h4" className="mb-4">
                Histórico de Execuções ({executions.length})
              </Typography>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                  <Typography variant="p" className="ml-2">
                    Carregando...
                  </Typography>
                </div>
              ) : executions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Play className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <Typography variant="p">
                    Nenhuma execução encontrada
                  </Typography>
                </div>
              ) : (
                <div className="space-y-2">
                  {executions.map((execution) => (
                    <div
                      key={execution.id}
                      className={cn(
                        'p-4 border rounded-lg cursor-pointer transition-colors',
                        selectedExecution?.id === execution.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300',
                      )}
                      onClick={() => setSelectedExecution(execution)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(execution.status)}
                          <Typography
                            variant="span"
                            className="font-mono text-sm"
                          >
                            {execution.id.substring(0, 8)}...
                          </Typography>
                        </div>
                        <div className="flex items-center gap-2">
                          {execution.status === 'running' && (
                            <Button
                              variant="ghost"
                              onClick={(e) =>
                                handleStopExecution(execution.id, e)
                              }
                              className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Parar execução"
                            >
                              <StopCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <span
                            className={cn(
                              'px-2 py-1 rounded-full text-xs font-semibold',
                              getStatusColor(execution.status),
                            )}
                          >
                            {execution.status}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Início: {formatDate(execution.startTime)}</div>
                        {execution.endTime && (
                          <div>Fim: {formatDate(execution.endTime)}</div>
                        )}
                        <div>Duração: {formatDuration(execution.duration)}</div>
                        <div>Tipo: {execution.triggerType}</div>
                      </div>

                      {selectedExecution?.id === execution.id &&
                        onExecutionSelect && (
                          <Button
                            variant="gradient"
                            className="mt-3 w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              onExecutionSelect(execution);
                              onClose();
                            }}
                          >
                            🔍 Visualizar no Fluxo
                          </Button>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detalhes da Execução */}
          <div className="w-1/2 overflow-y-auto">
            {selectedExecution ? (
              <div className="p-6">
                <Typography variant="h4" className="mb-4">
                  Detalhes da Execução
                </Typography>

                <div className="space-y-4">
                  {/* Status */}
                  <div>
                    <Typography variant="h5" className="mb-2">
                      Status
                    </Typography>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedExecution.status)}
                      <span
                        className={cn(
                          'px-3 py-1 rounded-full text-sm font-semibold',
                          getStatusColor(selectedExecution.status),
                        )}
                      >
                        {selectedExecution.status}
                      </span>
                    </div>
                  </div>

                  {/* Informações Básicas */}
                  <div>
                    <Typography variant="h5" className="mb-2">
                      Informações
                    </Typography>
                    <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                      <div>
                        <strong>ID:</strong> {selectedExecution.id}
                      </div>
                      <div>
                        <strong>Início:</strong>{' '}
                        {formatDate(selectedExecution.startTime)}
                      </div>
                      {selectedExecution.endTime && (
                        <div>
                          <strong>Fim:</strong>{' '}
                          {formatDate(selectedExecution.endTime)}
                        </div>
                      )}
                      <div>
                        <strong>Duração:</strong>{' '}
                        {formatDuration(selectedExecution.duration)}
                      </div>
                      <div>
                        <strong>Tipo:</strong> {selectedExecution.triggerType}
                      </div>
                    </div>
                  </div>

                  {/* Dados de Entrada */}
                  {selectedExecution.data && (
                    <div>
                      <Typography variant="h5" className="mb-2">
                        Dados de Entrada
                      </Typography>
                      <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto">
                        {JSON.stringify(selectedExecution.data, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Resultado */}
                  {selectedExecution.result && (
                    <div>
                      <Typography variant="h5" className="mb-2">
                        Resultado
                      </Typography>
                      <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto">
                        {JSON.stringify(selectedExecution.result, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Erro */}
                  {selectedExecution.error && (
                    <div>
                      <Typography variant="h5" className="mb-2 text-red-600">
                        Erro
                      </Typography>
                      <pre className="bg-red-50 p-3 rounded-lg text-xs text-red-800 overflow-x-auto">
                        {selectedExecution.error}
                      </pre>
                    </div>
                  )}

                  {/* Execução dos Nós */}
                  {selectedExecution.nodeExecutions && (
                    <div>
                      <Typography variant="h5" className="mb-2">
                        Execução dos Nós
                      </Typography>
                      <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto">
                        {JSON.stringify(
                          selectedExecution.nodeExecutions,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Play className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <Typography variant="p">
                    Selecione uma execução para ver os detalhes
                  </Typography>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
