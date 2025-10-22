/**
 * React Query Configuration
 *
 * Configurações otimizadas para segurança, performance e UX
 * - Cache strategies baseadas em tipo de dado
 * - Retry logic inteligente
 * - Error handling robusto
 * - Performance optimizations
 */

import {
  QueryClient,
  DefaultOptions,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';

/**
 * Tempos de cache otimizados por categoria
 */
export const CACHE_TIMES = {
  // Dados estáticos ou raramente modificados
  STATIC: {
    staleTime: 30 * 60 * 1000, // 30 minutos
    gcTime: 60 * 60 * 1000, // 1 hora (anteriormente cacheTime)
  },
  // Dados do usuário (autenticação, perfil)
  USER: {
    staleTime: 10 * 60 * 1000, // 10 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos
  },
  // Dados frequentemente atualizados
  DYNAMIC: {
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  },
  // Dados em tempo real
  REALTIME: {
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
  },
  // Sem cache
  NO_CACHE: {
    staleTime: 0,
    gcTime: 0,
  },
} as const;

/**
 * Estratégia de retry inteligente
 * - Falhas de rede: retry com backoff exponencial
 * - Erros 4xx (exceto 401/403): não retry
 * - Erros 5xx: retry limitado
 */
const retryStrategy = (failureCount: number, error: any): boolean => {
  // Não retry em erros de autenticação/autorização
  if (error?.status === 401 || error?.status === 403) {
    return false;
  }

  // Não retry em erros de validação (4xx)
  if (error?.status >= 400 && error?.status < 500) {
    return false;
  }

  // Retry até 3 vezes para erros de servidor
  return failureCount < 3;
};

/**
 * Delay para retry com backoff exponencial
 */
const retryDelay = (attemptIndex: number): number => {
  return Math.min(1000 * 2 ** attemptIndex, 30000);
};

/**
 * Opções padrão para queries
 */
const defaultQueryOptions: DefaultOptions['queries'] = {
  // Cache e stale time padrão (pode ser sobrescrito por query)
  staleTime: CACHE_TIMES.DYNAMIC.staleTime,
  gcTime: CACHE_TIMES.DYNAMIC.gcTime,

  // Retry strategy
  retry: retryStrategy,
  retryDelay,

  // Refetch strategies
  refetchOnWindowFocus: false, // Desabilitado para melhor performance
  refetchOnReconnect: true, // Refetch quando reconectar
  refetchOnMount: true, // Refetch ao montar se stale

  // Error handling
  throwOnError: false, // Erros tratados via error state

  // Performance
  structuralSharing: true, // Otimiza re-renders

  // Network mode
  networkMode: 'online', // Apenas quando online
};

/**
 * Opções padrão para mutations
 */
const defaultMutationOptions: DefaultOptions['mutations'] = {
  retry: 1, // Retry apenas 1 vez para mutations
  retryDelay: 1000, // 1 segundo de delay
  throwOnError: false,
  networkMode: 'online',
};

/**
 * Query Cache com handlers globais
 */
export const queryCache = new QueryCache({
  onError: (error, query) => {
    // Log de erros em queries (pode integrar com serviço de monitoramento)
    if (process.env.NODE_ENV === 'development') {
      console.error('Query Error:', {
        queryKey: query.queryKey,
        error,
      });
    }

    // Aqui você pode adicionar integração com Sentry, LogRocket, etc.
  },
  onSuccess: (data, query) => {
    // Validação de dados recebidos (segurança)
    if (data && typeof data === 'object') {
      // Sanitizar dados se necessário
      sanitizeData(data);
    }
  },
});

/**
 * Mutation Cache com handlers globais
 */
export const mutationCache = new MutationCache({
  onError: (error, variables, context, mutation) => {
    // Log de erros em mutations
    if (process.env.NODE_ENV === 'development') {
      console.error('Mutation Error:', {
        mutationKey: mutation.options.mutationKey,
        error,
        variables,
      });
    }
  },
});

/**
 * Query Client configurado
 */
export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: defaultQueryOptions,
    mutations: defaultMutationOptions,
  },
});

/**
 * Sanitizar dados recebidos (segurança)
 * Remove propriedades potencialmente perigosas
 */
function sanitizeData(data: any): void {
  if (typeof data !== 'object' || data === null) return;

  // Lista de propriedades a remover (exemplo)
  const dangerousProps = ['__proto__', 'constructor', 'prototype'];

  for (const prop of dangerousProps) {
    if (prop in data) {
      delete data[prop];
    }
  }

  // Recursivamente sanitizar objetos aninhados
  for (const key in data) {
    if (typeof data[key] === 'object' && data[key] !== null) {
      sanitizeData(data[key]);
    }
  }
}

/**
 * Rate Limiter para prevenir abuso
 */
class RateLimiter {
  private requests = new Map<string, number[]>();
  private readonly maxRequests = 10; // máximo de requisições
  private readonly timeWindow = 60000; // por minuto

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remover requisições antigas
    const recentRequests = requests.filter(
      (time) => now - time < this.timeWindow,
    );

    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }
}

export const rateLimiter = new RateLimiter();
