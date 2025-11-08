/**
 * Hooks para User
 *
 * Gerenciamento de dados do usuário com React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userKeys } from '../query-keys';
import { CACHE_TIMES } from '../config';
import { safeQueryFn } from '../utils';
import { CustomQueryOptions, CustomMutationOptions, ApiError } from '../types';
import { getUser } from '@/services/user';
import { getInstances } from '@/actions/uazapi/instance';

/**
 * Tipos para User (compatíveis com UserProps do contexto)
 */
export interface User {
  id: number;
  username: string;
  email: string;
  confirmed: boolean;
  name?: string;
  avatar?: string;
  onboardingCompleted?: boolean;
  [key: string]: unknown;
}

/**
 * Tipos para Instance (compatíveis com InstanceProps do contexto)
 */
export interface Instance {
  id: string;
  token: string;
  status: string;
  paircode: string;
  qrcode: string;
  name: string;
  profileName: string;
  profilePicUrl: string;
  isBusiness: boolean;
  plataform: string;
  systemName: string;
  owner: string;
  current_presence: string;
  lastDisconnect: string;
  lastDisconnectReason: string;
  adminField01: string;
  adminField02: string;
  openai_apikey: string;
  chatbot_enabled: boolean;
  chatbot_ignoreGroups: boolean;
  chatbot_stopConversation: string;
  chatbot_stopMinutes: number;
  chatbot_stopWhenYouSendMsg: number;
  created: string;
  updated: string;
  currentTime: string;
  [key: string]: unknown;
}

/**
 * Hook para buscar dados do usuário autenticado
 */
export function useUser(options?: CustomQueryOptions<User>) {
  return useQuery({
    queryKey: userKeys.profile(),
    queryFn: () =>
      safeQueryFn<User>(async () => {
        const response = await getUser();
        return {
          success: response.success,
          data: response.data as User,
          error: response.success
            ? undefined
            : response.statusText || 'Failed to fetch user',
        };
      }),
    ...CACHE_TIMES.USER,
    retry: 3,
    // Refetch quando janela ganha foco para dados de auth
    refetchOnWindowFocus: true,
    ...options,
  });
}

/**
 * Hook para buscar instâncias do usuário
 */
export function useInstances(options?: CustomQueryOptions<Instance[]>) {
  return useQuery({
    queryKey: userKeys.instances(),
    queryFn: () =>
      safeQueryFn<Instance[]>(async () => {
        const response = await getInstances();
        return {
          success: response.success,
          data: (response.data as Instance[]) || [],
          error: response.success
            ? undefined
            : response.message || 'Failed to fetch instances',
        };
      }),
    ...CACHE_TIMES.DYNAMIC,
    retry: 3,
    ...options,
  });
}

/**
 * Hook para buscar uma instância específica
 */
export function useInstance(
  instanceId: string | null,
  options?: CustomQueryOptions<Instance>,
) {
  return useQuery({
    queryKey: userKeys.instance(instanceId || ''),
    queryFn: () =>
      safeQueryFn(async () => {
        if (!instanceId) throw new Error('Instance ID is required');

        // Buscar da lista de instâncias
        const response = await getInstances();
        const instance = (response.data as Instance[])?.find(
          (i: Instance) => i.id === instanceId,
        );

        if (!instance) {
          throw new Error('Instance not found');
        }

        return { success: true, data: instance };
      }),
    enabled: !!instanceId,
    ...CACHE_TIMES.DYNAMIC,
    ...options,
  });
}

/**
 * Hook para atualizar dados do usuário
 */
export function useUpdateUser(
  options?: CustomMutationOptions<
    User,
    ApiError,
    Partial<User>,
    { previousUser: User | undefined }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<
    User,
    ApiError,
    Partial<User>,
    { previousUser: User | undefined }
  >({
    mutationFn: async (data: Partial<User>) => {
      // Implementar chamada à API de atualização
      // Por enquanto, simula atualização
      return safeQueryFn<User>(async () => {
        // TODO: Implementar endpoint de update user
        const currentUser = queryClient.getQueryData<User>(userKeys.profile());
        return {
          success: true,
          data: { ...currentUser, ...data } as User,
        };
      });
    },

    onMutate: async (
      updatedData: Partial<User>,
    ): Promise<{ previousUser: User | undefined }> => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: userKeys.profile() });

      // Snapshot
      const previousUser = queryClient.getQueryData<User>(userKeys.profile());

      // Atualização otimista
      queryClient.setQueryData<User>(userKeys.profile(), (old) =>
        old ? { ...old, ...updatedData } : old,
      );

      return { previousUser };
    },

    onError: (error, variables, context) => {
      // Rollback
      if (context?.previousUser) {
        queryClient.setQueryData(userKeys.profile(), context.previousUser);
      }
    },

    onSettled: () => {
      // Refetch para sincronização
      queryClient.invalidateQueries({ queryKey: userKeys.profile() });
    },

    ...options,
  });
}

/**
 * Hook para logout (limpar cache do usuário)
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return () => {
    // Limpar todos os dados do usuário do cache
    queryClient.removeQueries({ queryKey: userKeys.all });

    // Limpar todo o cache (opcional, dependendo da necessidade)
    // queryClient.clear();
  };
}

/**
 * Hook para invalidar dados do usuário
 */
export function useInvalidateUser() {
  const queryClient = useQueryClient();

  return {
    invalidateProfile: () => {
      return queryClient.invalidateQueries({ queryKey: userKeys.profile() });
    },
    invalidateInstances: () => {
      return queryClient.invalidateQueries({ queryKey: userKeys.instances() });
    },
    invalidateAll: () => {
      return queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
  };
}

/**
 * Hook para prefetch de dados do usuário
 */
export function usePrefetchUser() {
  const queryClient = useQueryClient();

  return {
    prefetchProfile: () => {
      return queryClient.prefetchQuery({
        queryKey: userKeys.profile(),
        queryFn: () =>
          safeQueryFn(async () => {
            const response = await getUser();
            return response;
          }),
        staleTime: CACHE_TIMES.USER.staleTime,
      });
    },
    prefetchInstances: () => {
      return queryClient.prefetchQuery({
        queryKey: userKeys.instances(),
        queryFn: () =>
          safeQueryFn(async () => {
            const response = await getInstances();
            return response;
          }),
        staleTime: CACHE_TIMES.DYNAMIC.staleTime,
      });
    },
  };
}
