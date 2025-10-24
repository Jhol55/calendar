// ============================================
// DATABASE NODE CONFIGURATION
// ============================================

export const DATABASE_CONFIG = {
  /**
   * Número máximo de registros por partição
   * Quando atingir esse limite, uma nova partição é criada
   */
  MAX_PARTITION_SIZE: 1000,

  /**
   * Número máximo de partições por tabela
   * Limite total de registros = MAX_PARTITION_SIZE * MAX_PARTITIONS_PER_TABLE
   * Ex: 1000 * 1000 = 1 milhão de registros por tabela
   */
  MAX_PARTITIONS_PER_TABLE: 1000,

  /**
   * Número máximo de tabelas por usuário
   */
  MAX_TABLES_PER_USER: 50,

  /**
   * Cache da partição ativa em memória (futura otimização)
   */
  CACHE_ACTIVE_PARTITION: false,

  /**
   * Query paralela em múltiplas partições (futura otimização)
   */
  PARALLEL_QUERY_PARTITIONS: false,

  /**
   * Auto-compressão de partições cheias (futura otimização)
   */
  AUTO_COMPRESS_FULL_PARTITIONS: false,

  /**
   * Validação estrita de tipos
   */
  STRICT_TYPE_VALIDATION: true,

  /**
   * Limite padrão para queries sem paginação
   */
  DEFAULT_QUERY_LIMIT: 100,

  /**
   * Limite máximo para queries (evita sobrecarga)
   */
  MAX_QUERY_LIMIT: 10000,

  /**
   * Máximo de partições a escanear por query (evita DoS)
   */
  MAX_PARTITIONS_TO_SCAN: 100,

  /**
   * Tamanho do lote para processamento em lotes (batch processing)
   * Usado em operações de update/delete em massa
   */
  BATCH_SIZE: 100,

  /**
   * Tempo máximo de execução para operações em lote (em ms)
   * 30 segundos
   */
  MAX_EXECUTION_TIME: 30000,

  /**
   * Delay entre lotes (em ms)
   * Pequena pausa para não sobrecarregar o banco
   */
  BATCH_DELAY: 10,

  /**
   * Rate limiting - máximo de operações permitidas por janela de tempo
   */
  RATE_LIMIT_MAX_OPS: 1000000, // 1M operações por janela

  /**
   * Rate limiting - janela de tempo em ms (padrão: 1 hora)
   */
  RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000, // 1 hora
};

export type DatabaseNodeConfigType = typeof DATABASE_CONFIG;
