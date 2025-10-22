/**
 * Error Handler para React Query
 *
 * Gerenciamento centralizado de erros com logging e recovery
 */

import { QueryCache, MutationCache } from '@tanstack/react-query';
import { ApiError } from './types';

/**
 * Categorias de erros
 */
export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  SERVER = 'server',
  UNKNOWN = 'unknown',
}

/**
 * Classificar erro por categoria
 */
export function categorizeError(error: any): ErrorCategory {
  const status = error?.status || error?.response?.status;

  if (!status) {
    return ErrorCategory.NETWORK;
  }

  if (status === 401) {
    return ErrorCategory.AUTHENTICATION;
  }

  if (status === 403) {
    return ErrorCategory.AUTHORIZATION;
  }

  if (status >= 400 && status < 500) {
    return ErrorCategory.VALIDATION;
  }

  if (status >= 500) {
    return ErrorCategory.SERVER;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Formatar mensagem de erro para o usuário
 */
export function formatErrorMessage(error: any): string {
  const category = categorizeError(error);

  // Mensagens personalizadas por categoria
  const defaultMessages: Record<ErrorCategory, string> = {
    [ErrorCategory.NETWORK]: 'Erro de conexão. Verifique sua internet.',
    [ErrorCategory.AUTHENTICATION]: 'Sessão expirada. Faça login novamente.',
    [ErrorCategory.AUTHORIZATION]: 'Você não tem permissão para essa ação.',
    [ErrorCategory.VALIDATION]: 'Dados inválidos. Verifique os campos.',
    [ErrorCategory.SERVER]: 'Erro no servidor. Tente novamente mais tarde.',
    [ErrorCategory.UNKNOWN]: 'Erro inesperado. Tente novamente.',
  };

  // Usar mensagem específica do erro se disponível
  const specificMessage =
    error?.message || error?.error || error?.data?.message;

  return specificMessage || defaultMessages[category];
}

/**
 * Logger de erros (pode integrar com serviços externos)
 */
export class ErrorLogger {
  private static instance: ErrorLogger;

  private constructor() {}

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  log(error: any, context?: any): void {
    const category = categorizeError(error);
    const timestamp = new Date().toISOString();

    const errorLog = {
      timestamp,
      category,
      message: formatErrorMessage(error),
      error: error?.message || String(error),
      status: error?.status,
      context,
    };

    // Log no console em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      console.error('[React Query Error]', errorLog);
    }

    // Aqui você pode integrar com:
    // - Sentry: Sentry.captureException(error)
    // - LogRocket: LogRocket.captureException(error)
    // - Custom analytics

    // Para erros críticos, pode enviar para servidor
    if (category === ErrorCategory.SERVER) {
      this.sendToServer(errorLog);
    }
  }

  private sendToServer(errorLog: any): void {
    // TODO: Implementar envio para servidor de logs
    // fetch('/api/logs/error', {
    //   method: 'POST',
    //   body: JSON.stringify(errorLog),
    // }).catch(() => {
    //   // Falhou silenciosamente
    // });
  }
}

/**
 * Handler global para queries
 */
export function createQueryErrorHandler() {
  const logger = ErrorLogger.getInstance();

  return (error: any, query: any) => {
    logger.log(error, {
      type: 'query',
      queryKey: query.queryKey,
      queryHash: query.queryHash,
    });

    // Ações específicas baseadas no tipo de erro
    const category = categorizeError(error);

    // Para erros de autenticação, pode redirecionar para login
    if (category === ErrorCategory.AUTHENTICATION) {
      // window.location.href = '/login';
    }
  };
}

/**
 * Handler global para mutations
 */
export function createMutationErrorHandler() {
  const logger = ErrorLogger.getInstance();

  return (error: any, variables: any, context: any, mutation: any) => {
    logger.log(error, {
      type: 'mutation',
      mutationKey: mutation.options.mutationKey,
      variables,
    });
  };
}

/**
 * Retry strategy baseada em categoria de erro
 */
export function shouldRetryError(failureCount: number, error: any): boolean {
  const category = categorizeError(error);

  // Não retry para erros de validação e autenticação
  if (
    category === ErrorCategory.VALIDATION ||
    category === ErrorCategory.AUTHENTICATION ||
    category === ErrorCategory.AUTHORIZATION
  ) {
    return false;
  }

  // Retry limitado para erros de rede e servidor
  if (category === ErrorCategory.NETWORK || category === ErrorCategory.SERVER) {
    return failureCount < 3;
  }

  return false;
}

/**
 * Delay para retry com backoff exponencial
 */
export function getRetryDelay(attemptIndex: number, error: any): number {
  const category = categorizeError(error);

  // Para erros de rede, usar backoff mais agressivo
  if (category === ErrorCategory.NETWORK) {
    return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
  }

  // Para erros de servidor, backoff mais conservador
  return Math.min(2000 * attemptIndex, 10000);
}

/**
 * Wrapper para error boundary
 */
export function createErrorBoundaryHandler() {
  const logger = ErrorLogger.getInstance();

  return (error: Error, errorInfo: React.ErrorInfo) => {
    logger.log(error, {
      type: 'boundary',
      componentStack: errorInfo.componentStack,
    });
  };
}

/**
 * Utilidade para mostrar toast de erro (integrar com sua biblioteca de toast)
 */
export function showErrorToast(error: any): void {
  const message = formatErrorMessage(error);

  // TODO: Integrar com biblioteca de toast (ex: react-hot-toast, sonner, etc)
  // toast.error(message);

  console.error(message);
}

/**
 * Validador de resposta da API
 */
export function validateApiResponse(response: any): boolean {
  // Verificar estrutura básica
  if (!response || typeof response !== 'object') {
    return false;
  }

  // Verificar propriedade success
  if (typeof response.success !== 'boolean') {
    return false;
  }

  // Se não foi sucesso, deve ter mensagem de erro
  if (!response.success && !response.error && !response.message) {
    return false;
  }

  return true;
}

/**
 * Sanitizar dados de erro (remover informações sensíveis)
 */
export function sanitizeError(error: any): ApiError {
  const sanitized: ApiError = {
    message: formatErrorMessage(error),
    status: error?.status || error?.response?.status,
    code: error?.code,
  };

  // Não incluir detalhes em produção
  if (process.env.NODE_ENV === 'development') {
    sanitized.details = error?.details || error?.response?.data;
  }

  return sanitized;
}
