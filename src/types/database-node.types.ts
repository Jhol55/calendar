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
  | 'get';

/**
 * Definição de uma coluna
 */
export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  required?: boolean;
  default?: unknown;
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
  value: unknown;
}

/**
 * Configuração de filtros com múltiplas regras
 */
export interface FilterConfig {
  condition: FilterCondition;
  rules: FilterRule[];
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
  tableName: string;

  // Para addColumns
  columns?: ColumnDefinition[];

  // Para removeColumns
  columnsToRemove?: string[];

  // Para insert
  record?: Record<string, unknown>;

  // Para update
  updates?: Record<string, unknown>;

  // Para update, delete, get
  filters?: FilterConfig;

  // Para get
  sort?: SortConfig;
  pagination?: PaginationConfig;
}

/**
 * Registro com campos automáticos
 */
export interface DatabaseRecord {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  [key: string]: unknown;
}

/**
 * Resultado de operações de escrita
 */
export interface WriteResult {
  success: boolean;
  affected: number;
  records?: DatabaseRecord[];
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
    public details?: unknown,
  ) {
    super(message);
    this.name = 'DatabaseNodeError';
  }
}
