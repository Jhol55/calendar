/**
 * Hooks para Workflows (Chatbot Flows)
 *
 * Hooks customizados com optimistic updates, type-safety e error handling
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowKeys } from '../query-keys';
import { CACHE_TIMES } from '../config';
import {
  safeQueryFn,
  optimisticUpdate,
  rollbackOptimisticUpdate,
} from '../utils';
import {
  CustomQueryOptions,
  CustomMutationOptions,
  ApiResponse,
} from '../types';
import {
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  ChatbotFlow,
} from '@/actions/chatbot-flows/flows';

/**
 * Hook para listar todos os workflows do usuário autenticado
 * SEGURANÇA: userId é obtido automaticamente da sessão no backend
 */
export function useWorkflows(options?: CustomQueryOptions<ChatbotFlow[]>) {
  return useQuery({
    queryKey: workflowKeys.lists(),
    queryFn: () =>
      safeQueryFn(async () => {
        const response = await listFlows();

        // A API retorna { success, flows } mas safeQueryFn espera { success, data }
        // Transformar para o formato esperado
        if (response.success && response.flows) {
          return {
            success: true,
            data: response.flows,
          };
        }

        return response;
      }),
    ...CACHE_TIMES.DYNAMIC,
    ...options,
  });
}

/**
 * Hook para buscar um workflow específico
 */
export function useWorkflow(
  flowId: string | null,
  options?: CustomQueryOptions<ChatbotFlow>,
) {
  return useQuery({
    queryKey: workflowKeys.detail(flowId || ''),
    queryFn: () =>
      safeQueryFn(async () => {
        if (!flowId) throw new Error('Flow ID is required');
        const response = await getFlow(flowId);

        // A API retorna { success, flow } mas safeQueryFn espera { success, data }
        // Transformar para o formato esperado
        if (response.success && response.flow) {
          return {
            success: true,
            data: response.flow,
          };
        }

        return response;
      }),
    enabled: !!flowId,
    ...CACHE_TIMES.DYNAMIC,
    ...options,
  });
}

/**
 * Hook para criar workflow
 */
export function useCreateWorkflow(
  options?: CustomMutationOptions<
    ChatbotFlow,
    any,
    Omit<ChatbotFlow, 'id' | 'createdAt' | 'updatedAt'>
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      return safeQueryFn(async () => {
        const response = await createFlow(data);

        // A API retorna { success, flow } mas safeQueryFn espera { success, data }
        if (response.success && response.flow) {
          return {
            success: true,
            data: response.flow,
          };
        }

        return response;
      });
    },

    onMutate: async (newWorkflow) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: workflowKeys.lists() });

      // Snapshot do estado anterior
      const previousWorkflows = queryClient.getQueryData<ChatbotFlow[]>(
        workflowKeys.lists(),
      );

      // Criar workflow temporário para UI
      const tempWorkflow: ChatbotFlow = {
        id: `temp-${Date.now()}`,
        ...newWorkflow,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Atualização otimista
      queryClient.setQueryData<ChatbotFlow[]>(workflowKeys.lists(), (old) =>
        old ? [...old, tempWorkflow] : [tempWorkflow],
      );

      return { previousWorkflows, tempWorkflow };
    },

    onError: (error, variables, context) => {
      // Rollback em caso de erro
      if (context?.previousWorkflows) {
        rollbackOptimisticUpdate(
          queryClient,
          workflowKeys.lists(),
          context.previousWorkflows,
        );
      }
    },

    onSuccess: (newWorkflow, variables, context) => {
      // Substituir workflow temporário pelo real
      queryClient.setQueryData<ChatbotFlow[]>(workflowKeys.lists(), (old) => {
        if (!old) return [newWorkflow];
        return old.map((w) =>
          w.id === context?.tempWorkflow.id ? newWorkflow : w,
        );
      });

      // Adicionar ao cache individual
      queryClient.setQueryData(
        workflowKeys.detail(newWorkflow.id),
        newWorkflow,
      );
    },

    onSettled: () => {
      // Garantir sincronização
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },

    ...options,
  });
}

/**
 * Hook para atualizar workflow com optimistic updates
 */
export function useUpdateWorkflow(
  options?: CustomMutationOptions<
    ChatbotFlow,
    any,
    { id: string; data: Partial<ChatbotFlow> }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      return safeQueryFn(async () => {
        const response = await updateFlow(id, data);

        // A API retorna { success, flow } mas safeQueryFn espera { success, data }
        if (response.success && response.flow) {
          return {
            success: true,
            data: response.flow,
          };
        }

        return response;
      });
    },

    onMutate: async ({ id, data }) => {
      // Cancelar queries relacionadas
      await queryClient.cancelQueries({ queryKey: workflowKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: workflowKeys.lists() });

      // Snapshot do estado anterior
      const previousWorkflow = queryClient.getQueryData<ChatbotFlow>(
        workflowKeys.detail(id),
      );
      const previousWorkflows = queryClient.getQueryData<ChatbotFlow[]>(
        workflowKeys.lists(),
      );

      // Atualização otimista do workflow específico
      queryClient.setQueryData<ChatbotFlow>(workflowKeys.detail(id), (old) =>
        old ? { ...old, ...data, updatedAt: new Date() } : old,
      );

      // Atualização otimista da lista
      queryClient.setQueryData<ChatbotFlow[]>(workflowKeys.lists(), (old) => {
        if (!old) return old;
        return old.map((w) =>
          w.id === id ? { ...w, ...data, updatedAt: new Date() } : w,
        );
      });

      return { previousWorkflow, previousWorkflows, id };
    },

    onError: (error, variables, context) => {
      // Rollback em caso de erro
      if (context?.previousWorkflow) {
        rollbackOptimisticUpdate(
          queryClient,
          workflowKeys.detail(context.id),
          context.previousWorkflow,
        );
      }
      if (context?.previousWorkflows) {
        rollbackOptimisticUpdate(
          queryClient,
          workflowKeys.lists(),
          context.previousWorkflows,
        );
      }
    },

    onSettled: (data, error, { id }) => {
      // Refetch para sincronização
      queryClient.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },

    ...options,
  });
}

/**
 * Hook para deletar workflow
 */
export function useDeleteWorkflow(
  options?: CustomMutationOptions<void, any, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return safeQueryFn(async () => {
        const response = await deleteFlow(id);

        // DELETE não retorna flow, apenas success/message
        // Manter response como está
        return response;
      });
    },

    onMutate: async (id) => {
      // Cancelar queries relacionadas
      await queryClient.cancelQueries({ queryKey: workflowKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: workflowKeys.lists() });

      // Snapshot
      const previousWorkflow = queryClient.getQueryData<ChatbotFlow>(
        workflowKeys.detail(id),
      );
      const previousWorkflows = queryClient.getQueryData<ChatbotFlow[]>(
        workflowKeys.lists(),
      );

      // Remover otimisticamente
      queryClient.setQueryData<ChatbotFlow[]>(workflowKeys.lists(), (old) =>
        old ? old.filter((w) => w.id !== id) : old,
      );

      return { previousWorkflow, previousWorkflows, id };
    },

    onError: (error, id, context) => {
      // Rollback
      if (context?.previousWorkflow) {
        queryClient.setQueryData(
          workflowKeys.detail(id),
          context.previousWorkflow,
        );
      }
      if (context?.previousWorkflows) {
        rollbackOptimisticUpdate(
          queryClient,
          workflowKeys.lists(),
          context.previousWorkflows,
        );
      }
    },

    onSuccess: (data, id) => {
      // Remover do cache
      queryClient.removeQueries({ queryKey: workflowKeys.detail(id) });
    },

    onSettled: () => {
      // Garantir sincronização
      queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },

    ...options,
  });
}

/**
 * Hook para prefetch de workflow
 */
export function usePrefetchWorkflow() {
  const queryClient = useQueryClient();

  return (flowId: string) => {
    return queryClient.prefetchQuery({
      queryKey: workflowKeys.detail(flowId),
      queryFn: () =>
        safeQueryFn(async () => {
          const response = await getFlow(flowId);
          return response;
        }),
      staleTime: CACHE_TIMES.DYNAMIC.staleTime,
    });
  };
}

/**
 * Hook para invalidar cache de workflows
 */
export function useInvalidateWorkflows() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      return queryClient.invalidateQueries({ queryKey: workflowKeys.all });
    },
    invalidateList: () => {
      return queryClient.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
    invalidateDetail: (id: string) => {
      return queryClient.invalidateQueries({
        queryKey: workflowKeys.detail(id),
      });
    },
  };
}
