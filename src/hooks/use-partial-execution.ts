/**
 * Hook para gerenciar execução parcial de workflows
 * Permite executar o workflow do início até um node específico
 */

import { useState, useCallback } from 'react';
import { Edge } from 'reactflow';

interface PartialExecutionOptions {
  flowId: string;
  targetNodeId: string;
  executionData?: any;
  flow?: {
    id: string;
    name: string;
    nodes: any[];
    edges: any[];
    originalFlowId?: string | null;
  };
}

interface PartialExecutionResult {
  executionId: string;
  status: 'success' | 'error';
  duration: number;
}

export function usePartialExecution() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Encontra todos os nodes no caminho do início até o target
   */
  const findPathToNode = useCallback(
    (targetNodeId: string, edges: Edge[], allNodeIds: string[]): string[] => {
      // Criar mapa de conexões (predecessor -> successors)
      const graph = new Map<string, string[]>();
      edges.forEach((edge) => {
        if (!graph.has(edge.source)) {
          graph.set(edge.source, []);
        }
        graph.get(edge.source)!.push(edge.target);
      });

      // Encontrar nodes sem predecessores (nodes iniciais)
      const hasIncoming = new Set(edges.map((e) => e.target));
      const startNodes = allNodeIds.filter((id) => !hasIncoming.has(id));

      // BFS para encontrar caminho mais curto do início até o target
      const queue: Array<{ nodeId: string; path: string[] }> = startNodes.map(
        (id) => ({
          nodeId: id,
          path: [id],
        }),
      );
      const visited = new Set<string>(startNodes);

      while (queue.length > 0) {
        const { nodeId, path } = queue.shift()!;

        if (nodeId === targetNodeId) {
          return path;
        }

        const neighbors = graph.get(nodeId) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push({
              nodeId: neighbor,
              path: [...path, neighbor],
            });
          }
        }
      }

      // Se não encontrou caminho, retornar apenas o target (para nodes isolados)
      return [targetNodeId];
    },
    [],
  );

  /**
   * Executa o workflow até o node especificado
   */
  const executeUntilNode = useCallback(
    async (
      options: PartialExecutionOptions,
    ): Promise<PartialExecutionResult | null> => {
      const { flowId, targetNodeId, executionData, flow } = options;

      setIsExecuting(true);
      setExecutingNodeId(targetNodeId);
      setError(null);

      try {
        // Chamar API para executar parcialmente
        const response = await fetch('/api/workflows/execute-partial', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            flowId,
            targetNodeId,
            triggerData: executionData,
            flow, // Passar o flow completo se fornecido (para execução sem salvar)
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao executar workflow');
        }

        const result = await response.json();

        return {
          executionId: result.executionId,
          status: 'success',
          duration: result.duration,
        };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMessage);
        console.error('❌ Erro na execução parcial:', err);
        return null;
      } finally {
        setIsExecuting(false);
        setExecutingNodeId(null);
      }
    },
    [],
  );

  return {
    isExecuting,
    executingNodeId,
    error,
    executeUntilNode,
    findPathToNode,
  };
}
