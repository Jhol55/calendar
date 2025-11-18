'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Typography } from '@/components/ui/typography';
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react';
import { listExecutions } from '@/actions/executions';
import { getFlow } from '@/actions/chatbot-flows/flows';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any;

interface PreviousNodeOutput {
  nodeId: string;
  nodeLabel: string;
  output: JsonValue;
  customLabel?: string;
}

interface ExecutionData {
  input?: JsonValue;
  output?: JsonValue;
  previousNodesOutputs?: Record<string, PreviousNodeOutput>;
}

interface NodeExecutionPanelProps {
  nodeId: string;
  flowId: string;
  mode: 'input' | 'output';
  onVariableSelect?: (variablePath: string) => void;
  currentEdges?: Array<{ source: string; target: string }>; // ✅ Edges atuais do editor
  currentNodes?: Array<{
    id: string;
    type?: string;
    data?: { label?: string };
  }>; // ✅ Nodes atuais do editor
}

// Componente para dropdown de node anterior
function PreviousNodeDropdown({
  nodeLabel,
  nodeId,
  output,
  renderJsonTree,
  customLabel,
}: {
  nodeLabel: string;
  nodeId: string;
  output: JsonValue;
  renderJsonTree: (
    obj: JsonValue,
    parentPath: string,
    level: number,
  ) => React.ReactNode;
  customLabel?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-2 border z-50 !bg-white hover:!bg-neutral-100 border-neutral-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 p-3 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-neutral-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-neutral-600" />
        )}
        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
        <Typography
          variant="span"
          className="text-sm font-medium text-neutral-800"
        >
          {nodeLabel}
        </Typography>
        <Typography
          variant="span"
          className="text-xs text-neutral-400 font-mono hidden"
        >
          ({customLabel || `${nodeId.substring(0, 8)}...`})
        </Typography>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-white border-t border-neutral-200">
          {output ? (
            renderJsonTree(output, `$nodes.${nodeId}.output`, 0)
          ) : (
            <Typography variant="span" className="text-neutral-600">
              Sem dados de saída
            </Typography>
          )}
        </div>
      )}
    </div>
  );
}

// Componente separado para cada item da árvore (resolve o problema de hooks)
function JsonTreeItem({
  itemKey,
  value,
  parentPath,
  level,
  copiedPath,
  onCopyPath,
  renderJsonTree,
}: {
  itemKey: string;
  value: JsonValue;
  parentPath: string;
  level: number;
  copiedPath: string | null;
  onCopyPath: (path: string) => void;
  renderJsonTree: (
    obj: JsonValue,
    parentPath: string,
    level: number,
  ) => React.ReactNode;
}) {
  const currentPath = `${parentPath}.${itemKey}`;
  const isObject = typeof value === 'object' && value !== null;
  const [isExpanded, setIsExpanded] = useState(level < 2);

  return (
    <div className="my-1">
      <div className="flex items-center gap-2 group hover:bg-neutral-50 rounded px-2 py-1">
        {isObject && (
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-0.5">
            <ChevronRight
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
        <span className="text-sm font-medium text-neutral-700">{itemKey}:</span>
        <div
          className={cn(
            'flex items-center gap-2 w-full justify-between',
            isObject && 'justify-end',
          )}
        >
          {!isObject && (
            <span className="text-sm text-blue-600 font-mono">
              {JSON.stringify(value)}
            </span>
          )}
          <button
            onClick={() => onCopyPath(currentPath)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-neutral-100 rounded"
            title="Copiar variável"
          >
            {copiedPath === currentPath ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3 text-neutral-400" />
            )}
          </button>
        </div>
      </div>
      {isObject && isExpanded && renderJsonTree(value, currentPath, level + 1)}
    </div>
  );
}

export function NodeExecutionPanel({
  nodeId,
  flowId,
  mode,
  onVariableSelect,
  currentEdges,
  currentNodes,
}: NodeExecutionPanelProps) {
  const [executionData, setExecutionData] = useState<ExecutionData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const fetchExecutionData = useCallback(async () => {
    try {
      setLoading(true);

      // ✅ Para modo OUTPUT, sempre buscar do servidor para garantir dados atualizados
      // (webhook pode ter atualizado o nodeExecution após a execução inicial)
      let execution = null;

      if (mode === 'output') {
        // Em modo output, sempre buscar do servidor para ter dados atualizados
        const selectedExecutionStr =
          sessionStorage.getItem('selectedExecution');
        let executionId = null;

        if (selectedExecutionStr) {
          try {
            const selectedExecution = JSON.parse(selectedExecutionStr);
            executionId = selectedExecution.id;
          } catch {
            // Se falhar, buscar a última execução
          }
        }

        // Buscar execução específica ou a última
        if (executionId) {
          const { getExecution } = await import('@/actions/executions');
          const result = await getExecution(executionId);
          if (result.success && result.execution) {
            execution = result.execution;
          }
        } else {
          const result = await listExecutions({
            flowId,
            limit: 1,
          });

          if (
            result.success &&
            result.executions &&
            result.executions.length > 0
          ) {
            execution = result.executions[0];
          }
        }
      } else {
        // Para modo INPUT, usar sessionStorage (mais rápido, dados não mudam)
        const selectedExecutionStr =
          sessionStorage.getItem('selectedExecution');
        if (selectedExecutionStr) {
          try {
            execution = JSON.parse(selectedExecutionStr);
          } catch {
            // Se falhar, buscar do servidor
          }
        }

        // Se não houver execução selecionada, buscar a última
        if (!execution) {
          const result = await listExecutions({
            flowId,
            limit: 1,
          });

          if (
            result.success &&
            result.executions &&
            result.executions.length > 0
          ) {
            execution = result.executions[0];
          }
        }
      }

      if (execution) {
        const nodeExecutions = execution.nodeExecutions || {};
        const nodeData = nodeExecutions[nodeId];

        // Buscar o flow para obter edges e informações dos nodes
        const previousNodesOutputs: Record<string, PreviousNodeOutput> = {};

        try {
          // ✅ Usar edges e nodes atuais do editor se disponíveis, senão buscar do banco
          let edges: Array<{ source: string; target: string }> = [];
          let nodes: Array<{
            id: string;
            type?: string;
            data?: { label?: string };
          }> = [];

          if (currentEdges && currentNodes) {
            // Usar dados do editor (suporta nodes não salvos)
            console.log(
              '🔄 Usando edges/nodes do editor (suporta mudanças não salvas)',
            );
            edges = currentEdges;
            nodes = currentNodes;
          } else {
            // Buscar do banco (fallback)
            console.log('🔄 Buscando edges/nodes do banco');
            const flowResult = await getFlow(flowId);
            if (flowResult.success && flowResult.flow) {
              edges = (flowResult.flow.edges || []) as Array<{
                source: string;
                target: string;
              }>;
              nodes = (flowResult.flow.nodes || []) as Array<{
                id: string;
                type?: string;
                data?: { label?: string };
              }>;
            }
          }

          if (edges.length > 0 && nodes.length > 0) {
            // Função recursiva para encontrar TODOS os nodes anteriores na cadeia
            const findAllPreviousNodes = (
              currentNodeId: string,
              visited = new Set<string>(),
            ): string[] => {
              if (visited.has(currentNodeId)) {
                return []; // Evitar loops infinitos
              }
              visited.add(currentNodeId);

              // Encontrar nodes diretamente conectados a este node
              const directPreviousNodeIds = edges
                .filter((edge) => edge.target === currentNodeId)
                .map((edge) => edge.source);

              // Recursivamente buscar os anteriores dos anteriores
              const allPreviousNodeIds: string[] = [];
              directPreviousNodeIds.forEach((prevNodeId: string) => {
                allPreviousNodeIds.push(prevNodeId);
                const nestedPrevious = findAllPreviousNodes(
                  prevNodeId,
                  visited,
                );
                allPreviousNodeIds.push(...nestedPrevious);
              });

              return allPreviousNodeIds;
            };

            // Buscar TODOS os nodes anteriores na cadeia
            const allPreviousNodeIds = findAllPreviousNodes(nodeId);

            // Para cada node anterior, buscar sua saída
            allPreviousNodeIds.forEach((prevNodeId: string) => {
              const prevNodeExecution = nodeExecutions[prevNodeId];
              const prevNode = nodes.find((n) => n.id === prevNodeId);

              // Usar "result" se existir, senão usar "data" (para webhook node)
              const output =
                prevNodeExecution?.result || prevNodeExecution?.data;

              if (output) {
                previousNodesOutputs[prevNodeId] = {
                  nodeId: prevNodeId,
                  nodeLabel:
                    prevNode?.data?.label || prevNode?.type || prevNodeId,
                  output: output,
                  customLabel: prevNode?.data?.label, // Nome customizado do node
                };
              }
            });
          } // ✅ Fecha o if (edges.length > 0)
        } catch (error) {
          console.error('Error fetching flow data:', error);
        }

        setExecutionData({
          input: nodeData?.data || execution.data,
          output: nodeData?.result || null,
          previousNodesOutputs,
        });
      }
    } catch (error) {
      console.error('Error fetching execution data:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, flowId]);

  useEffect(() => {
    fetchExecutionData();

    // ✅ Para modo OUTPUT, escutar eventos de atualização ao invés de fazer polling
    // O webhook atualiza o banco diretamente e dispara o evento 'executionUpdated'
    if (mode === 'output') {
      const handleExecutionUpdated = async (event: Event) => {
        const customEvent = event as CustomEvent<{ executionId: string }>;
        const { executionId } = customEvent.detail;

        // Verificar se é a execução que estamos exibindo
        const selectedExecutionStr =
          sessionStorage.getItem('selectedExecution');
        if (!selectedExecutionStr) {
          return;
        }

        try {
          const selectedExecution = JSON.parse(selectedExecutionStr);
          if (selectedExecution.id !== executionId) {
            return; // Não é a execução que estamos exibindo
          }

          // Buscar execução atualizada do servidor
          const { getExecution } = await import('@/actions/executions');
          const result = await getExecution(executionId);

          if (result.success && result.execution) {
            // Atualizar sessionStorage
            sessionStorage.setItem(
              'selectedExecution',
              JSON.stringify(result.execution),
            );

            // Re-buscar dados para atualizar a UI
            fetchExecutionData();
          }
        } catch (error) {
          console.error('Erro ao atualizar execução:', error);
        }
      };

      window.addEventListener('executionUpdated', handleExecutionUpdated);

      return () => {
        window.removeEventListener('executionUpdated', handleExecutionUpdated);
      };
    }
  }, [fetchExecutionData, mode]);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(`{{${path}}}`);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);

    if (onVariableSelect) {
      onVariableSelect(`{{${path}}}`);
    }
  };

  const renderJsonTree = (
    obj: JsonValue,
    parentPath: string = '$node.input',
    level: number = 0,
  ): React.ReactNode => {
    if (obj === null || obj === undefined) {
      return <div className="ml-4 text-neutral-500 text-sm">null</div>;
    }

    if (typeof obj !== 'object') {
      return (
        <div className="ml-4 text-sm flex items-center gap-2 group">
          <span className="text-blue-600 font-mono">{JSON.stringify(obj)}</span>
          <button
            onClick={() => handleCopyPath(parentPath)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-neutral-100 rounded"
            title="Copiar variável"
          >
            {copiedPath === parentPath ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3 text-neutral-400" />
            )}
          </button>
        </div>
      );
    }

    return (
      <div className={level > 0 ? 'ml-4' : ''}>
        {Object.entries(obj).map(([key, value]) => (
          <JsonTreeItem
            key={key}
            itemKey={key}
            value={value}
            parentPath={parentPath}
            level={level}
            copiedPath={copiedPath}
            onCopyPath={handleCopyPath}
            renderJsonTree={renderJsonTree}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Typography variant="p" className="text-neutral-500">
          Carregando execuções...
        </Typography>
      </div>
    );
  }

  if (!executionData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <Typography variant="p" className="text-neutral-600 text-center">
          Nenhuma execução encontrada.
        </Typography>
        <Typography
          variant="span"
          className="text-neutral-600 text-center mt-2"
        >
          Execute o fluxo para ver os dados aqui.
        </Typography>
      </div>
    );
  }

  const data = mode === 'input' ? executionData.input : executionData.output;
  const pathPrefix = mode === 'input' ? '$node.input' : '$node.output';

  return (
    <div className="h-full flex flex-col">
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Typography variant="span" className="text-neutral-600 mb-3">
          {mode === 'input'
            ? 'Clique no ícone de cópia para usar a variável'
            : 'Dados retornados após execução'}
        </Typography>

        {mode === 'input' ? (
          // Modo Input: Mostrar apenas os dropdowns dos nodes anteriores
          executionData.previousNodesOutputs &&
          Object.keys(executionData.previousNodesOutputs).length > 0 ? (
            <div className="mt-2">
              {Object.values(executionData.previousNodesOutputs).map(
                (prevNode) => (
                  <PreviousNodeDropdown
                    key={prevNode.nodeId}
                    nodeLabel={prevNode.nodeLabel}
                    nodeId={prevNode.nodeId}
                    output={prevNode.output}
                    renderJsonTree={renderJsonTree}
                    customLabel={prevNode.customLabel}
                  />
                ),
              )}
            </div>
          ) : (
            <Typography variant="p" className="text-neutral-400">
              Nenhum node anterior encontrado
            </Typography>
          )
        ) : // Modo Output: Mostrar dados de saída normalmente
        data ? (
          renderJsonTree(data, pathPrefix)
        ) : (
          <Typography variant="p" className="text-neutral-400">
            Nenhum dado de saída
          </Typography>
        )}
      </div>
    </div>
  );
}
