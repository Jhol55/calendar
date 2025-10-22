/**
 * Query Keys Factory
 *
 * Factory pattern para criar query keys de forma type-safe e consistente
 * - Previne duplicação de keys
 * - Facilita invalidação em cascade
 * - Type-safe
 * - Fácil manutenção
 */

/**
 * Factory para Workflows (Chatbot Flows)
 */
export const workflowKeys = {
  all: ['workflows'] as const,
  lists: () => [...workflowKeys.all, 'list'] as const,
  list: (filters?: WorkflowFilters) =>
    [...workflowKeys.lists(), { filters }] as const,
  details: () => [...workflowKeys.all, 'detail'] as const,
  detail: (id: string) => [...workflowKeys.details(), id] as const,
  executions: (flowId: string) =>
    [...workflowKeys.detail(flowId), 'executions'] as const,
} as const;

/**
 * Factory para User
 */
export const userKeys = {
  all: ['user'] as const,
  profile: () => [...userKeys.all, 'profile'] as const,
  instances: () => [...userKeys.all, 'instances'] as const,
  instance: (id: string) => [...userKeys.instances(), id] as const,
  preferences: () => [...userKeys.all, 'preferences'] as const,
} as const;

/**
 * Factory para Database
 */
export const databaseKeys = {
  all: ['database'] as const,
  tables: () => [...databaseKeys.all, 'tables'] as const,
  table: (tableName: string) => [...databaseKeys.tables(), tableName] as const,
  tableData: (tableName: string, filters?: TableFilters) =>
    [...databaseKeys.table(tableName), 'data', { filters }] as const,
  tableSchema: (tableName: string) =>
    [...databaseKeys.table(tableName), 'schema'] as const,
} as const;

/**
 * Factory para Executions
 */
export const executionKeys = {
  all: ['executions'] as const,
  lists: () => [...executionKeys.all, 'list'] as const,
  list: (filters?: ExecutionFilters) =>
    [...executionKeys.lists(), { filters }] as const,
  details: () => [...executionKeys.all, 'detail'] as const,
  detail: (id: string) => [...executionKeys.details(), id] as const,
  byFlow: (flowId: string) => [...executionKeys.all, 'byFlow', flowId] as const,
  logs: (executionId: string) =>
    [...executionKeys.detail(executionId), 'logs'] as const,
} as const;

/**
 * Factory para Chatbot
 */
export const chatbotKeys = {
  all: ['chatbot'] as const,
  conversations: () => [...chatbotKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...chatbotKeys.conversations(), id] as const,
  memories: () => [...chatbotKeys.all, 'memories'] as const,
  memory: (id: string) => [...chatbotKeys.memories(), id] as const,
} as const;

/**
 * Factory para Data (tabelas customizadas)
 */
export const dataKeys = {
  all: ['data'] as const,
  table: (tableName: string) => [...dataKeys.all, tableName] as const,
  row: (tableName: string, rowId: string) =>
    [...dataKeys.table(tableName), rowId] as const,
} as const;

/**
 * Tipos para filtros
 */
export interface WorkflowFilters {
  isActive?: boolean;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ExecutionFilters {
  status?: string;
  flowId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface TableFilters {
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Utilitário para criar query keys customizadas
 */
export const createQueryKey = <T extends readonly unknown[]>(key: T): T => {
  return key;
};

/**
 * Utilitário para validar query keys (segurança)
 * Previne injection e garante formato correto
 */
export const validateQueryKey = (key: unknown): boolean => {
  if (!Array.isArray(key)) return false;

  // Query key deve ter pelo menos um elemento
  if (key.length === 0) return false;

  // Primeiro elemento deve ser string (namespace)
  if (typeof key[0] !== 'string') return false;

  // Validar que não contém caracteres perigosos
  const hasInvalidChars = key.some((item) => {
    if (typeof item === 'string') {
      return /[<>{}()[\];]/.test(item);
    }
    return false;
  });

  return !hasInvalidChars;
};

/**
 * Todas as keys para facilitar invalidação global
 */
export const queryKeys = {
  workflow: workflowKeys,
  user: userKeys,
  database: databaseKeys,
  execution: executionKeys,
  chatbot: chatbotKeys,
  data: dataKeys,
} as const;

/**
 * Tipo helper para extrair query key type
 */
export type QueryKeyType = typeof queryKeys;
