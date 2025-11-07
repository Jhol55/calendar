/**
 * Error Handler para React Query
 *
 * Gerenciamento centralizado de erros com logging e recovery
 */

import { Query, Mutation } from '@tanstack/react-query';
import { ApiError } from './types';
import { getErrorMessage, hasStatus, hasCode } from '@/lib/types/error-guards';

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
export function categorizeError(error: unknown): ErrorCategory {
  const status = hasStatus(error) ? error.status : undefined;

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
export function formatErrorMessage(error: unknown): string {
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
  const specificMessage = getErrorMessage(error);

  return specificMessage || defaultMessages[category];
}

/**
 * Interface para log de erros
 */
interface ErrorLog {
  timestamp: string;
  category: ErrorCategory;
  message: string;
  error: string;
  status?: number;
  context?: unknown;
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

  log(error: unknown, context?: unknown): void {
    const category = categorizeError(error);
    const timestamp = new Date().toISOString();

    const errorLog: ErrorLog = {
      timestamp,
      category,
      message: formatErrorMessage(error),
      error: getErrorMessage(error),
      status: hasStatus(error) ? error.status : undefined,
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
      this.sendToServer();
    }
  }

  private sendToServer(): void {
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

  return (error: unknown, query: Query) => {
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

  return (
    error: unknown,
    variables: unknown,
    context: unknown,
    mutation: Mutation,
  ) => {
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
export function shouldRetryError(
  failureCount: number,
  error: unknown,
): boolean {
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
export function getRetryDelay(attemptIndex: number, error: unknown): number {
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
export function showErrorToast(error: unknown): void {
  const message = formatErrorMessage(error);

  // TODO: Integrar com biblioteca de toast (ex: react-hot-toast, sonner, etc)
  // toast.error(message);

  console.error(message);
}

/**
 * Validador de resposta da API
 */
export function validateApiResponse(response: unknown): boolean {
  // Verificar estrutura básica
  if (!response || typeof response !== 'object') {
    return false;
  }

  const responseObj = response as Record<string, unknown>;

  // Verificar propriedade success
  if (typeof responseObj.success !== 'boolean') {
    return false;
  }

  // Se não foi sucesso, deve ter mensagem de erro
  if (!responseObj.success && !responseObj.error && !responseObj.message) {
    return false;
  }

  return true;
}

/**
 * Sanitizar dados de erro (remover informações sensíveis)
 */
export function sanitizeError(error: unknown): ApiError {
  const sanitized: ApiError = {
    message: formatErrorMessage(error),
    status: hasStatus(error) ? error.status : undefined,
    code: hasCode(error) ? error.code : undefined,
  };

  // Não incluir detalhes em produção
  if (process.env.NODE_ENV === 'development') {
    // Detalhes não tipados por segurança
    sanitized.details = undefined;
  }

  return sanitized;
}
