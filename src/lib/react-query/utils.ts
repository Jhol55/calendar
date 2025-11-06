/**
 * Utilities para React Query
 *
 * Funções auxiliares para trabalhar com React Query de forma segura e eficiente
 */

import { QueryClient, QueryKey } from '@tanstack/react-query';
import { ApiResponse, ApiError } from './types';
import {
  getErrorMessage,
  hasStatus,
  hasMessage,
  hasCode,
} from '@/lib/types/error-guards';

/**
 * Wrapper seguro para query functions
 * Garante tratamento consistente de erros e validação de respostas
 */
export async function safeQueryFn<T>(
  fn: () => Promise<ApiResponse<T>>,
  options?: {
    transformData?: (data: unknown) => T;
    validateResponse?: (response: unknown) => boolean;
  },
): Promise<T> {
  try {
    const response = await fn();

    // Validar estrutura da resposta
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format');
    }

    // Validação customizada
    if (options?.validateResponse && !options.validateResponse(response)) {
      throw new Error('Response validation failed');
    }

    // Verificar sucesso
    if (!response.success) {
      const status = hasStatus(response) ? response.status : undefined;
      throw {
        message: response.error || response.message || 'Request failed',
        status,
      } as ApiError;
    }

    // Transformar dados se necessário
    const data = options?.transformData
      ? options.transformData(response.data)
      : (response.data as T);

    return data;
  } catch (error: unknown) {
    // Normalizar erro
    const apiError: ApiError = {
      message: getErrorMessage(error),
      status: hasStatus(error) ? error.status : undefined,
      code: hasCode(error) ? error.code : undefined,
      details: undefined, // Não tipado, deixar undefined por segurança
    };

    throw apiError;
  }
}

/**
 * Invalidar queries de forma inteligente
 * Suporta invalidação em cascade e seletiva
 */
export async function invalidateQueries(
  queryClient: QueryClient,
  queryKey: QueryKey,
  options?: {
    exact?: boolean;
    refetchActive?: boolean;
    refetchInactive?: boolean;
  },
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey,
    exact: options?.exact ?? false,
    refetchType: options?.refetchActive
      ? 'active'
      : options?.refetchInactive
        ? 'inactive'
        : 'all',
  });
}

/**
 * Prefetch múltiplas queries em paralelo
 */
export async function prefetchQueries(
  queryClient: QueryClient,
  queries: Array<{
    queryKey: QueryKey;
    queryFn: () => Promise<unknown>;
    staleTime?: number;
  }>,
): Promise<void> {
  await Promise.all(
    queries.map((query) =>
      queryClient.prefetchQuery({
        queryKey: query.queryKey,
        queryFn: query.queryFn,
        staleTime: query.staleTime,
      }),
    ),
  );
}

/**
 * Atualizar cache de forma otimista
 */
export function optimisticUpdate<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (old: T | undefined) => T,
): T | undefined {
  const previousData = queryClient.getQueryData<T>(queryKey);

  queryClient.setQueryData(queryKey, updater(previousData));

  return previousData;
}

/**
 * Rollback de atualização otimista
 */
export function rollbackOptimisticUpdate<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  previousData: T | undefined,
): void {
  queryClient.setQueryData(queryKey, previousData);
}

/**
 * Remover queries antigas do cache (garbage collection manual)
 */
export function clearStaleQueries(
  queryClient: QueryClient,
  maxAge: number = 3600000, // 1 hora por padrão
): void {
  const cache = queryClient.getQueryCache();
  const queries = cache.getAll();
  const now = Date.now();

  queries.forEach((query) => {
    const state = query.state;
    const lastUpdated = state.dataUpdatedAt;

    if (lastUpdated && now - lastUpdated > maxAge) {
      cache.remove(query);
    }
  });
}

/**
 * Obter status de todas as queries (debugging)
 */
export function getQueriesStatus(queryClient: QueryClient): {
  total: number;
  fetching: number;
  stale: number;
  inactive: number;
  error: number;
} {
  const cache = queryClient.getQueryCache();
  const queries = cache.getAll();

  return {
    total: queries.length,
    fetching: queries.filter((q) => q.state.fetchStatus === 'fetching').length,
    stale: queries.filter((q) => q.isStale()).length,
    inactive: queries.filter((q) => !q.isActive()).length,
    error: queries.filter((q) => q.state.status === 'error').length,
  };
}

/**
 * Cancelar queries em andamento
 */
export async function cancelQueries(
  queryClient: QueryClient,
  queryKey?: QueryKey,
): Promise<void> {
  if (queryKey) {
    await queryClient.cancelQueries({ queryKey });
  } else {
    await queryClient.cancelQueries();
  }
}

/**
 * Aguardar até que queries específicas sejam resolvidas
 */
export async function waitForQueries(
  queryClient: QueryClient,
  queryKeys: QueryKey[],
  timeout: number = 10000,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const allResolved = queryKeys.every((queryKey) => {
      const query = queryClient.getQueryCache().find({ queryKey });
      return query?.state.status === 'success';
    });

    if (allResolved) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Serializar query key para logging/debugging
 */
export function serializeQueryKey(queryKey: QueryKey): string {
  try {
    return JSON.stringify(queryKey);
  } catch {
    return String(queryKey);
  }
}

/**
 * Verificar se query está no cache
 */
export function isQueryCached(
  queryClient: QueryClient,
  queryKey: QueryKey,
): boolean {
  const query = queryClient.getQueryCache().find({ queryKey });
  return !!query && query.state.data !== undefined;
}

/**
 * Obter idade do cache
 */
export function getCacheAge(
  queryClient: QueryClient,
  queryKey: QueryKey,
): number | null {
  const query = queryClient.getQueryCache().find({ queryKey });

  if (!query || !query.state.dataUpdatedAt) {
    return null;
  }

  return Date.now() - query.state.dataUpdatedAt;
}

/**
 * Forçar refetch de queries com retry
 */
export async function forceRefetch(
  queryClient: QueryClient,
  queryKey: QueryKey,
  maxRetries: number = 3,
): Promise<void> {
  let attempts = 0;
  let lastError: unknown;

  while (attempts < maxRetries) {
    try {
      await queryClient.refetchQueries({ queryKey });
      return;
    } catch (error: unknown) {
      lastError = error;
      attempts++;

      if (attempts < maxRetries) {
        // Backoff exponencial
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(1000 * Math.pow(2, attempts), 10000)),
        );
      }
    }
  }

  throw lastError;
}
