/**
 * Hook para gerenciar execução parcial de workflows
 * Permite executar o workflow do início até um node específico
 */

import { useState, useCallback } from 'react';
import { Edge, Node } from 'reactflow';
import { NodeData } from '@/components/layout/chatbot-flow';

interface PartialExecutionOptions {
  flowId: string;
  targetNodeId: string;
  executionData?: Record<string, unknown>;
  flow?: {
    id: string;
    name: string;
    nodes: Node<NodeData>[];
    edges: Edge[];
    originalFlowId?: string | null;
  };
}

interface PartialExecutionResult {
  executionId: string;
  flowId?: string; // ✅ FlowId usado para salvar a execução (pode ser diferente do flowId original se for temporário)
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
          // Verificar se a resposta é JSON antes de tentar fazer parse
          const contentType = response.headers.get('content-type');
          let errorMessage = `Erro ${response.status}: ${response.statusText}`;

          if (contentType?.includes('application/json')) {
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorMessage;
            } catch {
              // Se falhar o parse, usar a mensagem padrão
            }
          } else {
            // Se não for JSON, tentar ler como texto para debug
            try {
              await response.text();
            } catch {
              // Ignorar erro ao ler texto
            }
          }

          throw new Error(errorMessage);
        }

        const result = await response.json();

        // A API de execução parcial agora retorna também flowId e status inicial
        // Preservar esses campos para o FlowEditor conseguir atualizar o flow selecionado
        return {
          executionId: result.executionId,
          flowId: result.flowId,
          status: result.status ?? 'running',
          duration: result.duration ?? undefined,
        };
      } catch (err) {
        let errorMessage = 'Erro desconhecido';

        if (err instanceof Error) {
          errorMessage = err.message;

          // Se for um erro de sintaxe JSON, pode ser que a resposta seja HTML
          if (
            err.message.includes('Unexpected token') ||
            err.message.includes('JSON')
          ) {
            errorMessage = 'Erro ao processar resposta do servidor.';
          }
        }

        setError(errorMessage);

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
