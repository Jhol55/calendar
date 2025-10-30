// ============================================
// DATABASE NODE TYPES
// ============================================

/**
 * Tipos de dados suportados pelas colunas
 */
export type ColumnType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'array'
  | 'object';

/**
 * Operadores de filtro disponíveis
 */
export type FilterOperator =
  // Comparação
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'

  // String
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'

  // Array/Lista
  | 'in'
  | 'notIn'

  // Null/Empty
  | 'isEmpty'
  | 'isNotEmpty'
  | 'isNull'
  | 'isNotNull'

  // Boolean
  | 'isTrue'
  | 'isFalse';

/**
 * Condição lógica para combinar múltiplos filtros
 */
export type FilterCondition = 'AND' | 'OR';

/**
 * Operações disponíveis no database-node
 */
export type DatabaseOperation =
  | 'addColumns'
  | 'removeColumns'
  | 'insert'
  | 'update'
  | 'delete'
  | 'get'
  | 'sql_query';

/**
 * Definição de uma coluna
 */
export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  required?: boolean;
  default?: any;
}

/**
 * Schema de uma tabela (coleção de colunas)
 */
export interface TableSchema {
  columns: ColumnDefinition[];
}

/**
 * Regra de filtro individual
 */
export interface FilterRule {
  field: string;
  operator: FilterOperator;
  value: any;
}

/**
 * Configuração de filtros com múltiplas regras
 * Permite nested configs para queries complexas (OR dentro de AND, etc)
 */
export interface FilterConfig {
  condition: FilterCondition;
  rules: (FilterRule | FilterConfig)[];
}

/**
 * Configuração de ordenação
 */
export interface SortConfig {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * Configuração de paginação
 */
export interface PaginationConfig {
  limit?: number;
  offset?: number;
}

/**
 * Opções para queries (get)
 */
export interface QueryOptions {
  filters?: FilterConfig;
  sort?: SortConfig;
  pagination?: PaginationConfig;
}

/**
 * Configuração completa do database-node
 */
export interface DatabaseNodeConfig {
  operation: DatabaseOperation;
  tableName?: string; // Opcional para sql_query

  // Para addColumns
  columns?: ColumnDefinition[];

  // Para removeColumns
  columnsToRemove?: string[];

  // Para insert
  record?: Record<string, any>;

  // Para update
  updates?: Record<string, any>;

  // Para update, delete, get
  filters?: FilterConfig | FilterRule[]; // Suporta array ou FilterConfig

  // Para get
  sort?: SortConfig;
  pagination?: PaginationConfig;
  limit?: number; // Paginação simplificada
  offset?: number; // Paginação simplificada

  // Para sql_query
  sqlQuery?: string;
  enableComplexQueries?: boolean;
  maxRecordsPerTable?: number;
}

/**
 * Registro com campos automáticos
 */
export interface DatabaseRecord {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  [key: string]: any;
}

/**
 * Resultado de operações de escrita
 */
export interface WriteResult {
  success: boolean;
  affected: number;
  records?: DatabaseRecord[];
  batchInfo?: {
    totalBatches: number;
    executionTimeMs: number;
    averageTimePerBatch: number;
  };
}

/**
 * Estatísticas de uma tabela
 */
export interface TableStats {
  tableName: string;
  totalPartitions: number;
  totalRecords: number;
  fullPartitions: number;
  activePartition: number | null;
  schema: TableSchema;
}

/**
 * Erro customizado do database-node
 */
export class DatabaseNodeError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'DatabaseNodeError';
  }
}
