// ============================================
// SQL TYPES FOR SQL ENGINE
// ============================================

type ASTNode = Record<string, unknown>;

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
  function:
    | 'COUNT'
    | 'SUM'
    | 'AVG'
    | 'MIN'
    | 'MAX'
    | 'STRING_AGG'
    | 'GROUP_CONCAT'
    | 'ARRAY_AGG'
    | 'JSON_AGG'
    | 'JSON_OBJECT_AGG';
  field?: string; // undefined for COUNT(*), JSON_AGG()
  alias?: string;
  distinct?: boolean; // for COUNT(DISTINCT field)
  separator?: string; // for STRING_AGG/GROUP_CONCAT
  valueField?: string; // for JSON_OBJECT_AGG
  caseExpr?: ASTNode; // AST da expressão CASE para agregações com CASE
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
  where?: ASTNode; // AST from node-sql-parser
  groupBy?: string[];
  having?: ASTNode; // AST from node-sql-parser
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
  distinct?: boolean;
}

export interface InsertOperation extends SqlOperation {
  type: 'INSERT';
  columns: string[];
  values: unknown[][];
}

export interface UpdateOperation extends SqlOperation {
  type: 'UPDATE';
  set: Record<string, unknown>;
  where?: ASTNode;
}

export interface DeleteOperation extends SqlOperation {
  type: 'DELETE';
  where?: ASTNode;
}

export type SqlOperationType =
  | SelectOperation
  | InsertOperation
  | UpdateOperation
  | DeleteOperation;

export interface SqlExecutionResult {
  success: boolean;
  data?: Record<string, unknown>[];
  affected?: number;
  error?: string;
}

// Config limits
export interface SqlEngineConfig {
  MAX_RECORDS_PER_TABLE: number;
  MAX_RESULT_SIZE: number;
  MAX_JOIN_TABLES: number;
  ENABLE_COMPLEX_QUERIES: boolean;
  MAX_SQL_LENGTH: number;
  QUERY_TIMEOUT_MS: number;
  MAX_SUBQUERY_DEPTH: number;
  MAX_CTE_ITERATIONS: number;
  MAX_QUERIES_PER_MINUTE: number;
}

export const DEFAULT_SQL_CONFIG: SqlEngineConfig = {
  MAX_RECORDS_PER_TABLE: 10000,
  MAX_RESULT_SIZE: 50000,
  MAX_JOIN_TABLES: 5,
  ENABLE_COMPLEX_QUERIES: true,
  MAX_SQL_LENGTH: 100000,
  QUERY_TIMEOUT_MS: 30000,
  MAX_SUBQUERY_DEPTH: 10,
  MAX_CTE_ITERATIONS: 1000,
  MAX_QUERIES_PER_MINUTE: 60,
};
