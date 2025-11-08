/**
 * Hooks para Workflows (Chatbot Flows)
 *
 * Hooks customizados com optimistic updates, type-safety e error handling
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowKeys } from '../query-keys';
import { CACHE_TIMES } from '../config';
import { safeQueryFn, rollbackOptimisticUpdate } from '../utils';
import { CustomQueryOptions, CustomMutationOptions, ApiError } from '../types';
import {
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  ChatbotFlow,
  CreateFlowData,
  UpdateFlowData,
} from '@/actions/chatbot-flows/flows';
import { Node, Edge } from 'reactflow';
import { NodeData } from '@/components/layout/chatbot-flow';

/**
 * Converter dados do Prisma para ChatbotFlow
 * Prisma retorna nodes/edges como JsonValue, mas precisamos convertê-los
 */
function convertFlowFromPrisma(flow: {
  id: string;
  name: string;
  description?: string | null;
  nodes: unknown;
  edges: unknown;
  token?: string | null;
  userId?: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  isTemporary?: boolean;
  instance?: {
    id: string;
    name: string;
    profileName: string;
  } | null;
  user?: {
    id: number;
    name: string | null;
    email: string;
  } | null;
}): ChatbotFlow {
  return {
    ...flow,
    nodes: (Array.isArray(flow.nodes) ? flow.nodes : []) as Node<NodeData>[],
    edges: (Array.isArray(flow.edges) ? flow.edges : []) as Edge[],
  };
}

/**
 * Hook para listar todos os workflows do usuário autenticado
 * SEGURANÇA: userId é obtido automaticamente da sessão no backend
 */
export function useWorkflows(options?: CustomQueryOptions<ChatbotFlow[]>) {
  return useQuery({
    queryKey: workflowKeys.lists(),
    queryFn: () =>
      safeQueryFn<ChatbotFlow[]>(async () => {
        const response = await listFlows();

        // A API retorna { success, flows } mas safeQueryFn espera { success, data }
        // Transformar para o formato esperado e converter tipos do Prisma
        if (response.success && response.flows) {
          const convertedFlows = response.flows.map(convertFlowFromPrisma);
          return {
            success: true,
            data: convertedFlows,
          };
        }

        return {
          success: false,
          error: response.error || 'Failed to fetch workflows',
        };
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
      safeQueryFn<ChatbotFlow>(async () => {
        if (!flowId) throw new Error('Flow ID is required');
        const response = await getFlow(flowId);

        // A API retorna { success, flow } mas safeQueryFn espera { success, data }
        // Transformar para o formato esperado e converter tipos do Prisma
        if (response.success && response.flow) {
          return {
            success: true,
            data: convertFlowFromPrisma(response.flow),
          };
        }

        return {
          success: false,
          error: response.error || 'Failed to fetch workflow',
        };
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
    ApiError,
    Omit<ChatbotFlow, 'id' | 'createdAt' | 'updatedAt'>,
    { previousWorkflows: ChatbotFlow[] | undefined; tempWorkflow: ChatbotFlow }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<
    ChatbotFlow,
    ApiError,
    Omit<ChatbotFlow, 'id' | 'createdAt' | 'updatedAt'>,
    { previousWorkflows: ChatbotFlow[] | undefined; tempWorkflow: ChatbotFlow }
  >({
    mutationFn: async (data) => {
      return safeQueryFn<ChatbotFlow>(async () => {
        // Converter dados para CreateFlowData, convertendo null para undefined onde necessário
        const createData: CreateFlowData = {
          name: data.name,
          description: data.description ?? undefined, // CreateFlowData não aceita null, apenas undefined
          nodes: data.nodes,
          edges: data.edges,
          token: data.token, // CreateFlowData aceita null para token, não precisa converter
          userId: data.userId ?? undefined, // CreateFlowData não aceita null, apenas undefined
          isActive: data.isActive,
        };

        const response = await createFlow(createData);

        // A API retorna { success, flow } mas safeQueryFn espera { success, data }
        // Converter tipos do Prisma
        if (response.success && response.flow) {
          return {
            success: true,
            data: convertFlowFromPrisma(response.flow),
          };
        }

        return {
          success: false,
          error: response.error || 'Failed to create workflow',
        };
      });
    },

    onMutate: async (
      newWorkflow: Omit<ChatbotFlow, 'id' | 'createdAt' | 'updatedAt'>,
    ): Promise<{
      previousWorkflows: ChatbotFlow[] | undefined;
      tempWorkflow: ChatbotFlow;
    }> => {
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
    ApiError,
    { id: string; data: Partial<ChatbotFlow> },
    {
      previousWorkflow: ChatbotFlow | undefined;
      previousWorkflows: ChatbotFlow[] | undefined;
      id: string;
    }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<
    ChatbotFlow,
    ApiError,
    { id: string; data: Partial<ChatbotFlow> },
    {
      previousWorkflow: ChatbotFlow | undefined;
      previousWorkflows: ChatbotFlow[] | undefined;
      id: string;
    }
  >({
    mutationFn: async ({ id, data }) => {
      return safeQueryFn<ChatbotFlow>(async () => {
        // Converter dados para UpdateFlowData, convertendo null para undefined onde necessário
        const updateData: UpdateFlowData = {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && {
            description: data.description ?? undefined, // UpdateFlowData não aceita null, apenas undefined
          }),
          ...(data.nodes !== undefined && { nodes: data.nodes }),
          ...(data.edges !== undefined && { edges: data.edges }),
          ...(data.token !== undefined && { token: data.token }), // UpdateFlowData aceita null para token
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        };

        const response = await updateFlow(id, updateData);

        // A API retorna { success, flow } mas safeQueryFn espera { success, data }
        // Converter tipos do Prisma
        if (response.success && response.flow) {
          return {
            success: true,
            data: convertFlowFromPrisma(response.flow),
          };
        }

        return {
          success: false,
          error: response.error || 'Failed to update workflow',
        };
      });
    },

    onMutate: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ChatbotFlow>;
    }): Promise<{
      previousWorkflow: ChatbotFlow | undefined;
      previousWorkflows: ChatbotFlow[] | undefined;
      id: string;
    }> => {
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
  options?: CustomMutationOptions<void, ApiError, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await deleteFlow(id);

      // Se não foi bem-sucedido, lançar erro
      if (!response.success) {
        throw {
          message: response.error || 'Failed to delete workflow',
          status: response.code,
        } as ApiError;
      }

      // DELETE não retorna dados, apenas sucesso
      return;
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
        safeQueryFn<ChatbotFlow>(async () => {
          const response = await getFlow(flowId);
          if (response.success && response.flow) {
            return {
              success: true,
              data: convertFlowFromPrisma(response.flow),
            };
          }
          return {
            success: false,
            error: response.error || 'Failed to fetch workflow',
          };
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
