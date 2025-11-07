/**
 * Hooks para Executions
 *
 * Gerenciamento de execuções de workflows
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { executionKeys, ExecutionFilters } from '../query-keys';
import { CACHE_TIMES } from '../config';
import { safeQueryFn } from '../utils';
import { CustomQueryOptions, CustomMutationOptions, ApiError } from '../types';
import {
  listExecutions,
  getExecution as getExecutionAction,
  stopExecution,
  type ListExecutionsParams,
} from '@/actions/executions/executions';

/**
 * Tipos para Executions (re-export do tipo do action)
 */
export interface Execution {
  id: string;
  status: 'running' | 'success' | 'error' | 'stopped';
  triggerType: 'webhook' | 'manual' | 'schedule';
  startTime: string;
  endTime?: string;
  duration?: number;
  error?: string;
  data?: unknown;
  result?: unknown;
  nodeExecutions?: unknown;
}

/**
 * Hook para listar todas as execuções
 * @deprecated Use useFlowExecutions com flowId específico
 */
export function useExecutions(
  filters?: ExecutionFilters,
  options?: CustomQueryOptions<Execution[]>,
) {
  // Como a API atual requer flowId, este hook retorna array vazio
  // Use useFlowExecutions para buscar execuções de um flow específico
  return useQuery({
    queryKey: executionKeys.list(filters),
    queryFn: async () => [],
    enabled: false, // Desabilitado por padrão
    ...CACHE_TIMES.REALTIME,
    ...options,
  });
}

/**
 * Hook para buscar execuções de um flow específico
 */
export function useFlowExecutions(
  flowId: string | null,
  params?: Partial<ListExecutionsParams>,
  options?: CustomQueryOptions<Execution[]>,
) {
  return useQuery({
    queryKey: executionKeys.byFlow(flowId || ''),
    queryFn: () =>
      safeQueryFn(async () => {
        if (!flowId) throw new Error('Flow ID is required');

        const response = await listExecutions({
          flowId,
          limit: params?.limit || 20,
          offset: params?.offset || 0,
        });

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch executions');
        }

        return {
          success: true,
          data: response.executions || [],
        };
      }),
    enabled: !!flowId,
    ...CACHE_TIMES.REALTIME,
    // Refetch automático para execuções em andamento
    refetchInterval: (query) => {
      const executions = (
        query.state.data as unknown as { data: Execution[] } | undefined
      )?.data;
      const hasRunning = executions?.some(
        (exec: Execution) => exec.status === 'running',
      );
      return hasRunning ? 3000 : false; // Poll a cada 3 segundos se houver execuções ativas
    },
    ...options,
  });
}

/**
 * Hook para buscar uma execução específica
 */
export function useExecution(
  executionId: string | null,
  options?: CustomQueryOptions<Execution>,
) {
  return useQuery({
    queryKey: executionKeys.detail(executionId || ''),
    queryFn: () =>
      safeQueryFn(async () => {
        if (!executionId) throw new Error('Execution ID is required');

        const response = await getExecutionAction(executionId);

        if (!response.success) {
          throw new Error(response.error || 'Failed to fetch execution');
        }

        return {
          success: true,
          data: response.execution as Execution,
        };
      }),
    enabled: !!executionId,
    ...CACHE_TIMES.REALTIME,
    // Refetch automático se execução estiver em andamento
    refetchInterval: (query) => {
      const execution = (
        query.state.data as unknown as { data: Execution } | undefined
      )?.data;
      const status = execution?.status;
      return status === 'running' ? 2000 : false;
    },
    ...options,
  });
}

/**
 * Hook para parar execução em andamento
 */
export function useStopExecution(
  options?: CustomMutationOptions<void, ApiError, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (executionId: string) => {
      return safeQueryFn(async () => {
        const response = await stopExecution(executionId);

        if (!response.success) {
          throw new Error(response.error || 'Failed to stop execution');
        }

        return response;
      });
    },

    onMutate: async (executionId) => {
      // Cancelar queries relacionadas
      await queryClient.cancelQueries({
        queryKey: executionKeys.detail(executionId),
      });

      // Snapshot
      const previousExecution = queryClient.getQueryData<Execution>(
        executionKeys.detail(executionId),
      );

      // Atualização otimista
      queryClient.setQueryData<Execution>(
        executionKeys.detail(executionId),
        (old) => (old ? { ...old, status: 'stopped' as const } : old),
      );

      return { previousExecution, executionId };
    },

    onError: (error, executionId, context) => {
      // Rollback
      if (context?.previousExecution) {
        queryClient.setQueryData(
          executionKeys.detail(executionId),
          context.previousExecution,
        );
      }
    },

    onSettled: (data, error, executionId) => {
      // Refetch para sincronização
      queryClient.invalidateQueries({
        queryKey: executionKeys.detail(executionId),
      });
      queryClient.invalidateQueries({
        queryKey: executionKeys.all,
      });
    },

    ...options,
  });
}

/**
 * Hook para cancelar execução (alias para useStopExecution)
 * Mantido para backward compatibility
 */
export const useCancelExecution = useStopExecution;

/**
 * Hook para invalidar execuções
 */
export function useInvalidateExecutions() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      return queryClient.invalidateQueries({ queryKey: executionKeys.all });
    },
    invalidateList: () => {
      return queryClient.invalidateQueries({ queryKey: executionKeys.lists() });
    },
    invalidateDetail: (id: string) => {
      return queryClient.invalidateQueries({
        queryKey: executionKeys.detail(id),
      });
    },
    invalidateByFlow: (flowId: string) => {
      return queryClient.invalidateQueries({
        queryKey: executionKeys.byFlow(flowId),
      });
    },
  };
}

/**
 * Hook para prefetch de execuções
 */
export function usePrefetchExecutions() {
  const queryClient = useQueryClient();

  return {
    prefetchFlowExecutions: (
      flowId: string,
      params?: Partial<ListExecutionsParams>,
    ) => {
      return queryClient.prefetchQuery({
        queryKey: executionKeys.byFlow(flowId),
        queryFn: () =>
          safeQueryFn(async () => {
            const response = await listExecutions({
              flowId,
              limit: params?.limit || 20,
              offset: params?.offset || 0,
            });

            if (!response.success) {
              throw new Error(response.error || 'Failed to fetch executions');
            }

            return {
              success: true,
              data: response.executions || [],
            };
          }),
        staleTime: CACHE_TIMES.REALTIME.staleTime,
      });
    },
  };
}
