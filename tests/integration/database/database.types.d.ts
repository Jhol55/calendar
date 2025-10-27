// ============================================
// DATABASE TEST TYPES
// ============================================
// Re-exports e extensões dos tipos de database para uso em testes

// Re-export all types from the main database service
export type {
  ColumnType,
  FilterOperator,
  FilterCondition,
  DatabaseOperation,
  ColumnDefinition,
  TableSchema,
  FilterRule,
  FilterConfig,
  SortConfig,
  PaginationConfig,
  QueryOptions,
  DatabaseNodeConfig,
  DatabaseRecord,
  WriteResult,
  TableStats,
} from '@/services/database/database.types.d';

export { DatabaseNodeError } from '@/services/database/database.types.d';

// ============================================
// TEST-SPECIFIC TYPES
// ============================================

/**
 * Configuração de teste para DatabaseService
 */
export interface TestDatabaseConfig {
  MAX_PARTITION_SIZE?: number;
  MAX_PARTITIONS_PER_TABLE?: number;
  MAX_TABLES_PER_USER?: number;
  BATCH_SIZE?: number;
  BATCH_DELAY?: number;
  MAX_EXECUTION_TIME?: number;
  DEFAULT_QUERY_LIMIT?: number;
  MAX_QUERY_LIMIT?: number;
  MAX_PARTITIONS_TO_SCAN?: number;
  RATE_LIMIT_MAX_OPS?: number;
  RATE_LIMIT_WINDOW_MS?: number;
  CACHE_ACTIVE_PARTITION?: boolean;
  PARALLEL_QUERY_PARTITIONS?: boolean;
  AUTO_COMPRESS_FULL_PARTITIONS?: boolean;
  STRICT_TYPE_VALIDATION?: boolean;
}

/**
 * Resultado de execução paralela
 */
export interface ParallelExecutionResult<T = unknown> {
  success: T[];
  errors: Error[];
  duration: number;
}

/**
 * Opções para execução paralela
 */
export interface ParallelExecutionOptions {
  maxConcurrency?: number;
  throwOnError?: boolean;
  collectErrors?: boolean;
}

/**
 * Informações sobre batch processing
 */
export interface BatchInfo {
  totalBatches: number;
  executionTimeMs: number;
  averageTimePerBatch: number;
}

/**
 * Mock de erro de database
 */
export interface MockDatabaseError {
  code: string;
  message: string;
  trigger?: () => void;
  restore?: () => void;
}

/**
 * Dados de teste para stress tests
 */
export interface StressTestData {
  totalOperations: number;
  successCount: number;
  errorCount: number;
  duration: number;
  averageTimePerOperation: number;
  throughput: number; // ops/s
}

/**
 * Resultado de teste de concorrência
 */
export interface ConcurrencyTestResult {
  totalThreads: number;
  successfulThreads: number;
  failedThreads: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  conflicts: number;
}

/**
 * Snapshot de estado de tabela para recovery tests
 */
export interface TableSnapshot {
  tableName: string;
  recordCount: number;
  schema: import('@/services/database/database.types.d').TableSchema;
  records: import('@/services/database/database.types.d').DatabaseRecord[];
  timestamp: Date;
}

/**
 * Métrica de performance
 */
export interface PerformanceMetric {
  operation: string;
  duration: number;
  recordCount?: number;
  timestamp: Date;
}

/**
 * Resultado de teste de segurança
 */
export interface SecurityTestResult {
  passed: boolean;
  vulnerabilityDetected?: string;
  errorMessage?: string;
  blockedAt?: string;
}

/**
 * Configuração de filtro de teste simplificada
 */
export interface SimpleFilter {
  field: string;
  operator: import('@/services/database/database.types.d').FilterOperator;
  value: unknown;
}

/**
 * Record de teste genérico
 */
export interface TestRecord {
  [key: string]: unknown;
}

/**
 * Resultado esperado em assertions
 */
export interface ExpectedResult {
  success?: boolean;
  affected?: number;
  recordCount?: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Contexto de teste
 */
export interface TestContext {
  userId: string;
  tableName: string;
  service: import('@/services/database/database.service').DatabaseService;
  createdAt: Date;
}

/**
 * Helper para geração de dados de teste
 */
export type DataGenerator<T = unknown> = (index: number) => T;

/**
 * Opções para cleanup de teste
 */
export interface CleanupOptions {
  dropTables?: boolean;
  closeConnections?: boolean;
  clearCache?: boolean;
}
