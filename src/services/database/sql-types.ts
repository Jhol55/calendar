// ============================================
// SQL TYPES FOR SQL ENGINE
// ============================================

export type JoinType =
  | 'INNER JOIN'
  | 'LEFT JOIN'
  | 'RIGHT JOIN'
  | 'FULL JOIN'
  | 'CROSS JOIN';

export interface JoinCondition {
  left: {
    table: string;
    column: string;
  };
  right: {
    table: string;
    column: string;
  };
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
}

export interface JoinClause {
  type: JoinType;
  table: string;
  alias?: string;
  on: JoinCondition;
}

export interface AggregateFunction {
  function: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  field?: string; // undefined for COUNT(*)
  alias?: string;
  distinct?: boolean; // for COUNT(DISTINCT field)
}

export interface SelectColumn {
  type: 'column' | 'aggregate' | 'expression';
  table?: string;
  column?: string;
  aggregate?: AggregateFunction;
  expression?: string;
  alias?: string;
}

export interface OrderByClause {
  field: string;
  table?: string;
  order: 'ASC' | 'DESC';
}

export interface SqlOperation {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  tableAlias?: string;
}

export interface SelectOperation extends SqlOperation {
  type: 'SELECT';
  columns: SelectColumn[];
  joins?: JoinClause[];
  where?: any; // AST from node-sql-parser
  groupBy?: string[];
  having?: any; // AST from node-sql-parser
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
  distinct?: boolean;
}

export interface InsertOperation extends SqlOperation {
  type: 'INSERT';
  columns: string[];
  values: any[][];
}

export interface UpdateOperation extends SqlOperation {
  type: 'UPDATE';
  set: Record<string, any>;
  where?: any;
}

export interface DeleteOperation extends SqlOperation {
  type: 'DELETE';
  where?: any;
}

export type SqlOperationType =
  | SelectOperation
  | InsertOperation
  | UpdateOperation
  | DeleteOperation;

export interface SqlExecutionResult {
  success: boolean;
  data?: any[];
  affected?: number;
  error?: string;
}

// Config limits
export interface SqlEngineConfig {
  MAX_RECORDS_PER_TABLE: number;
  MAX_RESULT_SIZE: number;
  MAX_JOIN_TABLES: number;
  ENABLE_COMPLEX_QUERIES: boolean;
}

export const DEFAULT_SQL_CONFIG: SqlEngineConfig = {
  MAX_RECORDS_PER_TABLE: 10000,
  MAX_RESULT_SIZE: 50000,
  MAX_JOIN_TABLES: 5,
  ENABLE_COMPLEX_QUERIES: true,
};
