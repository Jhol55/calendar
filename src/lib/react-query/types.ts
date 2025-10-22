/**
 * Types para React Query
 *
 * Tipos compartilhados para garantir type-safety em toda aplicação
 */

import {
  UseQueryOptions,
  UseMutationOptions,
  QueryKey,
} from '@tanstack/react-query';

/**
 * Tipo genérico para respostas da API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Tipo para erros da API
 */
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

/**
 * Options personalizadas para queries
 */
export type CustomQueryOptions<
  TQueryFnData = unknown,
  TError = ApiError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> = Omit<
  UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
  'queryKey' | 'queryFn'
>;

/**
 * Options personalizadas para mutations
 */
export type CustomMutationOptions<
  TData = unknown,
  TError = ApiError,
  TVariables = void,
  TContext = unknown,
> = UseMutationOptions<TData, TError, TVariables, TContext>;

/**
 * Tipo para query com prefetch
 */
export interface PrefetchableQuery<T = any> {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
}

/**
 * Estado de loading para queries
 */
export interface QueryLoadingState {
  isLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  isLoadingError: boolean;
  isRefetchError: boolean;
}

/**
 * Contexto para optimistic updates
 */
export interface OptimisticContext<T = any> {
  previous?: T;
  optimistic?: T;
  rollback?: () => void;
}

/**
 * Parâmetros para paginação
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

/**
 * Resposta paginada
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Parâmetros para infinite queries
 */
export interface InfiniteQueryParams {
  pageParam?: number;
  limit?: number;
}

/**
 * Configurações de cache por tipo
 */
export interface CacheConfig {
  staleTime: number;
  gcTime: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
}

/**
 * Tipo para invalidação seletiva
 */
export interface InvalidateOptions {
  exact?: boolean;
  refetchType?: 'active' | 'inactive' | 'all' | 'none';
}

/**
 * Metadata para queries (observability)
 */
export interface QueryMetadata {
  component?: string;
  feature?: string;
  userId?: string;
  timestamp?: number;
  version?: string;
}

/**
 * Tipo para retry configuration
 */
export interface RetryConfig {
  attempts: number;
  delay: number | ((attemptIndex: number) => number);
  shouldRetry?: (error: any) => boolean;
}
