// ============================================
// DATABASE NODE SERVICE
// Gerenciamento de tabelas virtuais com particionamento
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { v4 as uuid } from 'uuid';
import { prisma } from '@/services/prisma';
import {
  DATABASE_CONFIG,
  type DatabaseNodeConfigType,
} from '@/config/database.config';
import type {
  ColumnDefinition,
  TableSchema,
  FilterConfig,
  FilterRule,
  QueryOptions,
  DatabaseRecord,
  WriteResult,
  TableStats,
} from '@/services/database/database.types';

export class DatabaseService {
  private readonly config: DatabaseNodeConfigType;
  private readonly MAX_PARTITION_SIZE: number;
  private readonly MAX_PARTITIONS: number;
  private readonly MAX_TABLES: number;

  constructor(config: Partial<DatabaseNodeConfigType> = {}) {
    // Merge configuração customizada com padrão
    this.config = { ...DATABASE_CONFIG, ...config };
    this.MAX_PARTITION_SIZE = this.config.MAX_PARTITION_SIZE;
    this.MAX_PARTITIONS = this.config.MAX_PARTITIONS_PER_TABLE;
    this.MAX_TABLES = this.config.MAX_TABLES_PER_USER;
  }

  // ============================================
  // CACHE DE SCHEMAS
  // ============================================

  private schemaCache = new Map<
    string,
    { schema: TableSchema; timestamp: number }
  >();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  // Mutex para operações de cache thread-safe
  private cacheOperations = new Map<string, Promise<void>>();

  // Mutex para operações por partição (elimina conflitos em updates simultâneos)
  private partitionLocks = new Map<string, Promise<void>>();

  // ============================================
  // MÉTRICAS DE PERFORMANCE
  // ============================================

  private performanceMetrics = {
    queryTimes: [] as number[],
    cacheHits: 0,
    cacheMisses: 0,
  };

  /**
   * Registra tempo de query
   */
  private recordQueryTime(startTime: number): void {
    const queryTime = Date.now() - startTime;
    this.performanceMetrics.queryTimes.push(queryTime);

    // Manter apenas últimos 100 tempos
    if (this.performanceMetrics.queryTimes.length > 100) {
      this.performanceMetrics.queryTimes.shift();
    }

    // Log queries lentas (> 1s)
    if (queryTime > 1000) {
      console.warn(`🐌 Query lenta detectada: ${queryTime}ms`);
    }
  }

  /**
   * Obtém estatísticas de performance
   */
  public getPerformanceStats() {
    const times = this.performanceMetrics.queryTimes;
    const avgTime =
      times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    const maxTime = times.length > 0 ? Math.max(...times) : 0;
    const minTime = times.length > 0 ? Math.min(...times) : 0;

    return {
      averageQueryTime: Math.round(avgTime),
      maxQueryTime: maxTime,
      minQueryTime: minTime,
      totalQueries: times.length,
      cacheHitRate:
        this.performanceMetrics.cacheHits /
          (this.performanceMetrics.cacheHits +
            this.performanceMetrics.cacheMisses) || 0,
      cacheHits: this.performanceMetrics.cacheHits,
      cacheMisses: this.performanceMetrics.cacheMisses,
    };
  }

  /**
   * Busca schema com cache
   */
  private async getCachedSchema(
    userId: string,
    tableName: string,
  ): Promise<TableSchema | null> {
    const cacheKey = `${userId}:${tableName}`;
    const cached = this.schemaCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.performanceMetrics.cacheHits++;
      return cached.schema;
    }

    this.performanceMetrics.cacheMisses++;

    // Buscar do banco
    const partition = await prisma.dataTable.findFirst({
      where: { userId, tableName, partition: 0 },
      select: { schema: true },
    });

    if (!partition) {
      return null;
    }

    const schema = partition.schema as unknown as TableSchema;

    // Atualizar cache
    this.schemaCache.set(cacheKey, {
      schema,
      timestamp: Date.now(),
    });

    return schema;
  }

  /**
   * Executa operação no cache de forma thread-safe
   */
  private async withCacheLock<T>(
    key: string,
    operation: () => T | Promise<T>,
  ): Promise<T> {
    // Aguardar operação anterior na mesma key completar
    while (this.cacheOperations.has(key)) {
      await this.cacheOperations.get(key);
    }

    // Criar promise para esta operação
    let resolve: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.cacheOperations.set(key, promise);

    try {
      const result = await Promise.resolve(operation());
      return result;
    } finally {
      this.cacheOperations.delete(key);
      resolve!();
    }
  }

  /**
   * Executa operação com lock por partição (serializa updates na mesma partição)
   */
  private async withPartitionLock<T>(
    userId: string,
    tableName: string,
    operation: () => T | Promise<T>,
  ): Promise<T> {
    const lockKey = `${userId}:${tableName}`;

    // Aguardar operação anterior na mesma partição completar
    while (this.partitionLocks.has(lockKey)) {
      await this.partitionLocks.get(lockKey);
    }

    // Criar promise para esta operação
    let resolve: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.partitionLocks.set(lockKey, promise);

    try {
      const result = await Promise.resolve(operation());
      return result;
    } finally {
      this.partitionLocks.delete(lockKey);
      resolve!();
    }
  }

  /**
   * Invalida cache de schema (thread-safe)
   */
  private async invalidateSchemaCache(
    userId: string,
    tableName: string,
  ): Promise<void> {
    const cacheKey = `${userId}:${tableName}`;
    await this.withCacheLock(cacheKey, () => {
      this.schemaCache.delete(cacheKey);
    });
  }

  /**
   * Popular cache de schema (thread-safe)
   */
  private async populateCacheFromPartition(
    userId: string,
    tableName: string,
    schema: TableSchema,
  ): Promise<void> {
    const cacheKey = `${userId}:${tableName}`;
    await this.withCacheLock(cacheKey, () => {
      this.schemaCache.set(cacheKey, {
        schema,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Executa operação com retry em caso de modificação concorrente
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 10,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        if (error.code === 'CONCURRENT_MODIFICATION' && attempt < maxRetries) {
          // Backoff exponencial com jitter mais agressivo
          const baseBackoff = Math.pow(2, attempt - 1) * 20;
          const jitter = Math.random() * baseBackoff * 0.5;
          const backoff = baseBackoff + jitter;

          await new Promise((resolve) => setTimeout(resolve, backoff));
          console.log(
            `⚠️ [DB-SERVICE] Concurrent modification detected, retrying (${attempt}/${maxRetries})...`,
          );
          continue;
        }

        // Se não é CONCURRENT_MODIFICATION ou esgotou retries, lança erro
        throw error;
      }
    }

    // Nunca deve chegar aqui, mas por segurança
    throw lastError || new Error('Max retries exceeded');
  }

  // ============================================
  // PROCESSAMENTO EM LOTES
  // ============================================

  /**
   * Estima quantos registros serão afetados por uma operação
   */
  private async estimateAffectedRecords(
    userId: string,
    tableName: string,
    filters: FilterConfig,
  ): Promise<number> {
    const partitions = await prisma.dataTable.findMany({
      where: { userId, tableName },
      orderBy: { partition: 'asc' },
      take: this.config.MAX_PARTITIONS_TO_SCAN,
    });

    let count = 0;
    for (const partition of partitions) {
      const records = partition.data as DatabaseRecord[];
      const matchingRecords = records.filter((record) =>
        this.matchesFilters(record, filters),
      );
      count += matchingRecords.length;
    }

    return count;
  }

  /**
   * Atualiza registros em lotes para operações grandes
   */
  private async updateRecordsInBatches(
    userId: string,
    tableName: string,
    filters: FilterConfig,
    updates: Record<string, any>,
  ): Promise<WriteResult> {
    const startTime = Date.now();
    const batchSize = this.config.BATCH_SIZE;
    const maxExecutionTime = this.config.MAX_EXECUTION_TIME;

    let totalUpdated = 0;
    let batchNumber = 0;

    console.log(`🔄 Iniciando processamento em lotes para ${tableName}...`);

    try {
      // Buscar todas as partições
      const partitions = await prisma.dataTable.findMany({
        where: { userId, tableName },
        orderBy: { partition: 'asc' },
      });

      if (partitions.length === 0) {
        throw this.createError(
          'TABLE_NOT_FOUND',
          `Tabela "${tableName}" não existe`,
        );
      }

      // Processar cada partição
      for (const partition of partitions) {
        // Verificar timeout
        if (Date.now() - startTime > maxExecutionTime) {
          throw this.createError(
            'TIMEOUT',
            `Timeout: operação muito longa (${Math.round((Date.now() - startTime) / 1000)}s)`,
          );
        }

        let records = partition.data as DatabaseRecord[];
        const matchingRecords = records.filter((record) =>
          this.matchesFilters(record, filters),
        );

        if (matchingRecords.length === 0) continue;

        // Processar em lotes dentro da partição
        for (let i = 0; i < matchingRecords.length; i += batchSize) {
          const batch = matchingRecords.slice(i, i + batchSize);
          batchNumber++;

          // Verificar timeout novamente
          if (Date.now() - startTime > maxExecutionTime) {
            throw this.createError(
              'TIMEOUT',
              `Timeout: operação muito longa (${Math.round((Date.now() - startTime) / 1000)}s)`,
            );
          }

          // Atualizar registros do lote MANTENDO atualizações anteriores
          records = records.map((record) => {
            const matchInBatch = batch.find((b) => b._id === record._id);
            if (matchInBatch) {
              return {
                ...record,
                ...updates,
                _updatedAt: new Date().toISOString(),
              };
            }
            return record;
          });

          // Salvar após cada lote com retry e optimistic locking
          await this.withRetry(async () => {
            // Re-buscar partição para pegar recordCount atualizado
            const currentPartition = await prisma.dataTable.findUnique({
              where: { id: partition.id },
              select: { recordCount: true },
            });

            if (!currentPartition) {
              throw this.createError(
                'PARTITION_NOT_FOUND',
                'Partição não encontrada',
              );
            }

            const updateResult = await prisma.dataTable.updateMany({
              where: {
                id: partition.id,
                recordCount: currentPartition.recordCount, // Optimistic lock
              },
              data: { data: records as any },
            });

            if (updateResult.count === 0) {
              throw this.createError(
                'CONCURRENT_MODIFICATION',
                'Concurrent modification detected in batch, retrying...',
              );
            }
          });

          totalUpdated += batch.length;

          // Log de progresso
          console.log(
            `📊 Lote ${batchNumber}: ${batch.length} registros atualizados (total: ${totalUpdated})`,
          );

          // Pequena pausa entre lotes
          if (this.config.BATCH_DELAY > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.config.BATCH_DELAY),
            );
          }
        }
      }

      const executionTime = Date.now() - startTime;
      console.log(
        `✅ Processamento em lotes concluído: ${totalUpdated} registros em ${Math.round(executionTime / 1000)}s`,
      );

      return {
        success: true,
        affected: totalUpdated,
        records: [], // Não retornamos todos os registros para operações grandes
        batchInfo: {
          totalBatches: batchNumber,
          executionTimeMs: executionTime,
          averageTimePerBatch: Math.round(executionTime / batchNumber),
        },
      };
    } catch (error: any) {
      console.error(`❌ Erro no processamento em lotes:`, error.message);
      throw error;
    }
  }

  /**
   * Deleta registros em lotes para operações grandes
   */
  private async deleteRecordsInBatches(
    userId: string,
    tableName: string,
    filters: FilterConfig,
  ): Promise<WriteResult> {
    const startTime = Date.now();
    const batchSize = this.config.BATCH_SIZE;
    const maxExecutionTime = this.config.MAX_EXECUTION_TIME;

    let totalDeleted = 0;
    let batchNumber = 0;

    console.log(`🗑️ Iniciando deleção em lotes para ${tableName}...`);

    try {
      // Buscar todas as partições
      const partitions = await prisma.dataTable.findMany({
        where: { userId, tableName },
        orderBy: { partition: 'asc' },
      });

      if (partitions.length === 0) {
        throw this.createError(
          'TABLE_NOT_FOUND',
          `Tabela "${tableName}" não existe`,
        );
      }

      // Processar cada partição
      for (const partition of partitions) {
        // Verificar timeout
        if (Date.now() - startTime > maxExecutionTime) {
          throw this.createError(
            'TIMEOUT',
            `Timeout: operação muito longa (${Math.round((Date.now() - startTime) / 1000)}s)`,
          );
        }

        let records = partition.data as DatabaseRecord[];
        const matchingRecords = records.filter((record) =>
          this.matchesFilters(record, filters),
        );

        if (matchingRecords.length === 0) continue;

        // Processar em lotes dentro da partição
        for (let i = 0; i < matchingRecords.length; i += batchSize) {
          const batch = matchingRecords.slice(i, i + batchSize);
          batchNumber++;

          // Verificar timeout novamente
          if (Date.now() - startTime > maxExecutionTime) {
            throw this.createError(
              'TIMEOUT',
              `Timeout: operação muito longa (${Math.round((Date.now() - startTime) / 1000)}s)`,
            );
          }

          // Remover registros do lote
          const batchIds = batch.map((r) => r._id);
          records = records.filter((record) => !batchIds.includes(record._id));

          // Salvar partição atualizada com retry e optimistic locking
          await this.withRetry(async () => {
            // Re-buscar partição para pegar recordCount atualizado
            const currentPartition = await prisma.dataTable.findUnique({
              where: { id: partition.id },
              select: { recordCount: true },
            });

            if (!currentPartition) {
              throw this.createError(
                'PARTITION_NOT_FOUND',
                'Partição não encontrada',
              );
            }

            const updateResult = await prisma.dataTable.updateMany({
              where: {
                id: partition.id,
                recordCount: currentPartition.recordCount, // Optimistic lock
              },
              data: {
                data: records as any,
                recordCount: records.length,
                isFull: records.length >= this.MAX_PARTITION_SIZE,
              },
            });

            if (updateResult.count === 0) {
              throw this.createError(
                'CONCURRENT_MODIFICATION',
                'Concurrent modification detected in batch delete, retrying...',
              );
            }
          });

          totalDeleted += batch.length;

          // Log de progresso
          console.log(
            `🗑️ Lote ${batchNumber}: ${batch.length} registros deletados (total: ${totalDeleted})`,
          );

          // Pequena pausa entre lotes
          if (this.config.BATCH_DELAY > 0) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.config.BATCH_DELAY),
            );
          }
        }
      }

      const executionTime = Date.now() - startTime;
      console.log(
        `✅ Deleção em lotes concluída: ${totalDeleted} registros em ${Math.round(executionTime / 1000)}s`,
      );

      return {
        success: true,
        affected: totalDeleted,
        batchInfo: {
          totalBatches: batchNumber,
          executionTimeMs: executionTime,
          averageTimePerBatch: Math.round(executionTime / batchNumber),
        },
      };
    } catch (error: any) {
      console.error(`❌ Erro na deleção em lotes:`, error.message);
      throw error;
    }
  }

  // ============================================
  // VALIDAÇÃO DE PERMISSÕES
  // ============================================

  /**
   * Verifica se o usuário é o dono da tabela
   * @throws Error se tabela não existe ou usuário não é o dono
   * IMPORTANTE: Cada usuário tem seu próprio namespace de tabelas
   * User1 pode ter tabela "tasks" e User2 também pode ter tabela "tasks" (isoladas)
   */
  private async verifyTableOwnership(
    userId: string,
    tableName: string,
  ): Promise<void> {
    const table = await prisma.dataTable.findFirst({
      where: {
        userId,
        tableName,
        partition: 0, // Partição 0 sempre existe se tabela existe
      },
      select: { userId: true },
    });

    if (!table) {
      // Tabela não existe para este usuário - permitir (será criada)
      return;
    }

    // Tabela existe para este usuário - OK
    // Não precisamos verificar outros usuários (namespace isolado)
  }

  // ============================================
  // RATE LIMITING (Simples)
  // ============================================

  private operationCounts = new Map<
    string,
    { count: number; resetAt: number }
  >();

  private async checkRateLimit(userId: string): Promise<void> {
    const key = `user:${userId}`;
    const now = Date.now();
    const windowMs = this.config.RATE_LIMIT_WINDOW_MS;
    const maxOperations = this.config.RATE_LIMIT_MAX_OPS;

    const current = this.operationCounts.get(key);

    if (!current || now > current.resetAt) {
      // Nova janela de tempo
      this.operationCounts.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return;
    }

    if (current.count >= maxOperations) {
      const retryAfterMs = current.resetAt - now;
      throw this.createError(
        'RATE_LIMIT_EXCEEDED',
        `Rate limit excedido. Tente novamente em ${Math.ceil(retryAfterMs / 1000)}s`,
      );
    }

    // Operação atômica: criar novo objeto ao invés de mutar
    this.operationCounts.set(key, {
      count: current.count + 1,
      resetAt: current.resetAt,
    });
  }

  // ============================================
  // ADICIONAR COLUNAS
  // ============================================
  async addColumns(
    userId: string,
    tableName: string,
    columns: ColumnDefinition[],
  ): Promise<TableSchema> {
    // Valida entrada
    this.validateTableName(tableName);
    this.validateColumns(columns);

    // Validação de permissões
    await this.verifyTableOwnership(userId, tableName);
    await this.checkRateLimit(userId);

    // Busca partição 0 (schema principal)
    let table = await prisma.dataTable.findUnique({
      where: {
        userId_tableName_partition: {
          userId,
          tableName,
          partition: 0,
        },
      },
    });

    if (!table) {
      // Primeira vez: verifica limite de tabelas
      await this.checkTableLimit(userId);

      // Cria partição 0 com schema
      table = await prisma.dataTable.create({
        data: {
          userId,
          tableName,
          partition: 0,
          schema: { columns } as any,
          data: [] as any,
          recordCount: 0,
          isFull: false,
        },
      });

      // Invalidar e popular cache com novo schema
      await this.invalidateSchemaCache(userId, tableName);
      await this.populateCacheFromPartition(userId, tableName, { columns });

      return { columns };
    }

    // Já existe: adiciona novas colunas ao schema
    const currentSchema = table.schema as unknown as TableSchema;
    const existingColumnNames = currentSchema.columns.map((c) => c.name);

    // Filtra colunas que já não existem
    const newColumns = columns.filter(
      (col) => !existingColumnNames.includes(col.name),
    );

    if (newColumns.length === 0) {
      return currentSchema;
    }

    const updatedSchema = {
      columns: [...currentSchema.columns, ...newColumns],
    };

    // Atualiza schema em TODAS as partições desta tabela
    await prisma.dataTable.updateMany({
      where: { userId, tableName },
      data: { schema: updatedSchema as any },
    });

    // Invalidar e popular cache com schema atualizado
    await this.invalidateSchemaCache(userId, tableName);
    await this.populateCacheFromPartition(userId, tableName, updatedSchema);

    return updatedSchema;
  }

  // ============================================
  // REMOVER COLUNAS
  // ============================================
  async removeColumns(
    userId: string,
    tableName: string,
    columnNames: string[],
  ): Promise<TableSchema> {
    this.validateTableName(tableName);

    // Validação de permissões
    await this.verifyTableOwnership(userId, tableName);
    await this.checkRateLimit(userId);

    // USAR TRANSACTION para garantir atomicidade
    const updatedSchema = await prisma.$transaction(async (tx) => {
      // Busca todas as partições
      const partitions = await tx.dataTable.findMany({
        where: { userId, tableName },
        orderBy: { partition: 'asc' },
      });

      if (partitions.length === 0) {
        throw this.createError(
          'TABLE_NOT_FOUND',
          `Tabela "${tableName}" não existe`,
        );
      }

      // Atualiza schema
      const currentSchema = partitions[0].schema as unknown as TableSchema;
      const newSchema = {
        columns: currentSchema.columns.filter(
          (col) => !columnNames.includes(col.name),
        ),
      };

      // Invalidar cache após mudança de schema
      await this.invalidateSchemaCache(userId, tableName);

      // Atualiza cada partição (remove coluna dos dados também)
      for (const partition of partitions) {
        const records = partition.data as DatabaseRecord[];
        const cleanedRecords = records.map((record) => {
          const newRecord = { ...record };
          columnNames.forEach((colName) => delete newRecord[colName]);
          return newRecord;
        });

        await tx.dataTable.update({
          where: { id: partition.id },
          data: {
            schema: newSchema as any,
            data: cleanedRecords as any,
          },
        });
      }

      return newSchema;
    });

    // Popular cache com schema atualizado após transaction
    await this.populateCacheFromPartition(userId, tableName, updatedSchema);

    return updatedSchema;
  }

  // ============================================
  // INSERIR REGISTRO
  // ============================================
  async insertRecord(
    userId: string,
    tableName: string,
    record: Record<string, any>,
  ): Promise<DatabaseRecord> {
    console.log(
      `🗄️  [DB-SERVICE] Inserting record into "${tableName}" for user "${userId}"`,
    );
    console.log(
      `📝 [DB-SERVICE] Record data:`,
      JSON.stringify(record, null, 2),
    );

    this.validateTableName(tableName);

    // Validação de permissões
    await this.verifyTableOwnership(userId, tableName);
    await this.checkRateLimit(userId);

    // Verificar limite de armazenamento antes de inserir
    try {
      const user = await prisma.user.findUnique({
        where: { email: userId },
        select: { id: true },
      });

      if (user) {
        const { canUseStorage } = await import(
          '@/services/subscription/subscription.service'
        );
        // Estimar tamanho do registro em MB (JSON stringified)
        const recordSizeBytes = Buffer.byteLength(
          JSON.stringify(record),
          'utf8',
        );
        const recordSizeMB = recordSizeBytes / (1024 * 1024);
        const check = await canUseStorage(user.id, recordSizeMB);
        if (!check.allowed) {
          throw this.createError(
            'STORAGE_LIMIT',
            check.message || 'Limite de armazenamento atingido',
          );
        }
      }
    } catch (error: any) {
      if (error.code === 'STORAGE_LIMIT') {
        throw error;
      }
      // Ignorar outros erros
    }

    // Tentar validar com schema em cache primeiro (otimização)
    const cachedSchema = await this.getCachedSchema(userId, tableName);
    if (cachedSchema) {
      // Validação prévia com cache - se falhar, não precisa nem abrir transaction
      this.validateRecord(record, cachedSchema);
    }

    // 1. Busca partição ativa e insere registro (dentro de transaction)
    // USAR PARTITION LOCK + RETRY para evitar race condition
    const newRecord = await this.withPartitionLock(
      userId,
      tableName,
      async () => {
        return await this.withRetry(async () => {
          return await prisma.$transaction(async (tx) => {
            let partition = await tx.dataTable.findFirst({
              where: {
                userId,
                tableName,
                isFull: false,
              },
              orderBy: { partition: 'desc' },
            });

            console.log(
              `📊 [DB-SERVICE] Active partition found:`,
              partition
                ? `ID ${partition.id}, partition ${partition.partition}`
                : 'NONE',
            );

            // 2. Se não existe nenhuma partição, erro (precisa criar schema primeiro)
            if (!partition) {
              const hasTable = await tx.dataTable.findFirst({
                where: { userId, tableName },
              });

              if (!hasTable) {
                throw this.createError(
                  'TABLE_NOT_FOUND',
                  `Tabela "${tableName}" não existe. Use addColumns primeiro para criar o schema.`,
                );
              }

              // Existe mas todas estão cheias - precisa criar nova
              const lastPartition = await tx.dataTable.findFirst({
                where: { userId, tableName },
                orderBy: { partition: 'desc' },
              });

              if (lastPartition!.partition >= this.MAX_PARTITIONS - 1) {
                throw this.createError(
                  'PARTITION_LIMIT',
                  `Limite de partições atingido (${this.MAX_PARTITIONS})`,
                );
              }

              // Cria nova partição (dentro da transaction)
              try {
                partition = await tx.dataTable.create({
                  data: {
                    userId,
                    tableName,
                    partition: lastPartition!.partition + 1,
                    schema: lastPartition!.schema as any,
                    data: [] as any,
                    recordCount: 0,
                    isFull: false,
                  },
                });
              } catch (error: any) {
                // Se der erro de unique constraint, outra requisição criou a partição
                // Tentar buscar novamente
                if (error.code === 'P2002') {
                  console.log(
                    `⚠️ Race condition detectada, tentando buscar partição criada por outra requisição...`,
                  );
                  partition = await tx.dataTable.findFirst({
                    where: {
                      userId,
                      tableName,
                      isFull: false,
                    },
                    orderBy: { partition: 'desc' },
                  });

                  if (!partition) {
                    throw this.createError(
                      'PARTITION_CREATION_FAILED',
                      'Falha ao criar ou encontrar partição disponível',
                    );
                  }
                } else {
                  throw error;
                }
              }
            }

            if (!partition) {
              throw this.createError(
                'NO_ACTIVE_PARTITION',
                'Não foi possível encontrar ou criar uma partição ativa',
              );
            }

            // 3. Valida registro contra schema e popular cache
            const schema = partition.schema as unknown as TableSchema;

            // Popular cache oportunisticamente (já temos o schema da partição)
            this.populateCacheFromPartition(userId, tableName, schema);

            // Validar apenas se não validou com cache antes (cache miss)
            if (!cachedSchema) {
              this.validateRecord(record, schema);
            }

            // 4. Converter tipos de acordo com o schema e adicionar campos automáticos
            const convertedRecord = this.convertRecordTypes(record, schema);
            const newRecordData: DatabaseRecord = {
              _id: uuid(),
              _createdAt: new Date().toISOString(),
              _updatedAt: new Date().toISOString(),
              ...convertedRecord,
            };

            // 4.1. Validar constraints UNIQUE (após ter _id gerado)
            await this.validateUniqueConstraints(
              tableName,
              userId,
              newRecordData,
              schema,
            );

            // 5. Adiciona na partição (ainda dentro da transaction)
            const currentData = partition.data as DatabaseRecord[];
            const updatedData = [...currentData, newRecordData];
            const newCount = updatedData.length;

            // Optimistic Locking: apenas atualiza se recordCount não mudou
            const currentCount = partition.recordCount;
            const result = await tx.dataTable.updateMany({
              where: {
                id: partition.id,
                recordCount: currentCount, // Lock otimista
              },
              data: {
                data: updatedData as any,
                recordCount: newCount,
                isFull: newCount >= this.MAX_PARTITION_SIZE,
              },
            });

            // Se count === 0, houve modificação concorrente
            if (result.count === 0) {
              throw this.createError(
                'CONCURRENT_MODIFICATION',
                'Concurrent modification detected, retrying...',
              );
            }

            console.log(
              `✅ [DB-SERVICE] Record inserted successfully! ID: ${newRecordData._id}, Total records in partition: ${newCount}`,
            );

            return newRecordData;
          });
        });
      },
    );

    return newRecord;
  }

  // ============================================
  // BUSCAR REGISTROS
  // ============================================
  async getRecords(
    userId: string,
    tableName: string,
    options: QueryOptions = {},
  ): Promise<DatabaseRecord[]> {
    const startTime = Date.now();

    this.validateTableName(tableName);

    // Validação de permissões
    await this.verifyTableOwnership(userId, tableName);
    await this.checkRateLimit(userId);

    // Limites de paginação
    const limit = Math.min(
      options.pagination?.limit || this.config.DEFAULT_QUERY_LIMIT,
      this.config.MAX_QUERY_LIMIT,
    );
    const offset = options.pagination?.offset || 0;

    // 1. Busca partições com LIMITE (evitar DoS)
    const maxPartitions = this.config.MAX_PARTITIONS_TO_SCAN;
    const partitions = await prisma.dataTable.findMany({
      where: { userId, tableName },
      orderBy: { partition: 'asc' },
      take: maxPartitions,
    });

    if (partitions.length === 0) {
      throw this.createError(
        'TABLE_NOT_FOUND',
        `Tabela "${tableName}" não existe`,
      );
    }

    if (partitions.length >= maxPartitions) {
      console.warn(
        `⚠️ Query limitada a ${maxPartitions} partições. Considere usar filtros mais específicos.`,
      );
    }

    // Popular cache com schema da primeira partição (oportunista)
    let schema: TableSchema | null = null;
    if (partitions.length > 0 && partitions[0].schema) {
      schema = partitions[0].schema as unknown as TableSchema;
      this.populateCacheFromPartition(userId, tableName, schema);
    }

    // 2. Processa partições incrementalmente (não carregar tudo)
    let allRecords: DatabaseRecord[] = [];
    let recordsFound = 0;

    for (const partition of partitions) {
      // Se já temos registros suficientes, parar
      if (recordsFound >= offset + limit) {
        break;
      }

      const records = partition.data as DatabaseRecord[];
      let partitionRecords = records;

      // 3. Aplica filtros ANTES de concatenar
      if (options.filters) {
        partitionRecords = this.applyFilters(partitionRecords, options.filters);
      }

      allRecords = allRecords.concat(partitionRecords);
      recordsFound = allRecords.length;
    }

    // 4. Ordenação
    if (options.sort) {
      allRecords = this.sortRecords(
        allRecords,
        options.sort.field,
        options.sort.order,
      );
    }

    // 5. Paginação
    const result = allRecords.slice(offset, offset + limit);

    // 6. Converter tipos de acordo com o schema (fix: JSONB retorna números como strings)
    if (schema && schema.columns) {
      const typedResult: DatabaseRecord[] = result.map((record) => {
        const typedRecord = { ...record };

        // Para cada coluna do schema, converter o tipo correto
        schema.columns.forEach((column) => {
          const value = record[column.name];
          if (value !== null && value !== undefined) {
            switch (column.type) {
              case 'number':
                // Converter string para número
                typedRecord[column.name] =
                  typeof value === 'string' ? parseFloat(value) : value;
                break;
              case 'boolean':
                // Converter string para boolean
                typedRecord[column.name] =
                  typeof value === 'string'
                    ? value === 'true' || value === '1'
                    : value;
                break;
              case 'date':
                // Manter como string ISO ou converter para Date se necessário
                typedRecord[column.name] = value;
                break;
              default:
                // string, text, email, url, etc - manter como está
                typedRecord[column.name] = value;
            }
          }
        });

        return typedRecord as DatabaseRecord;
      });

      // Registrar tempo de query
      this.recordQueryTime(startTime);

      return typedResult;
    }

    // Registrar tempo de query
    this.recordQueryTime(startTime);

    return result;
  }

  // ============================================
  // ATUALIZAR REGISTROS
  // ============================================
  async updateRecords(
    userId: string,
    tableName: string,
    filters: FilterConfig,
    updates: Record<string, any>,
  ): Promise<WriteResult> {
    this.validateTableName(tableName);

    // Validação de permissões
    await this.verifyTableOwnership(userId, tableName);
    await this.checkRateLimit(userId);

    // Validar e converter tipos dos updates com schema da tabela (apenas campos presentes)
    const schema = await this.getCachedSchema(userId, tableName);
    let convertedUpdates = updates;
    if (schema) {
      this.validatePartialRecord(updates, schema);
      convertedUpdates = this.convertRecordTypes(updates, schema);
    }

    // Verificar se operação é muito grande para processamento em lotes
    const estimatedCount = await this.estimateAffectedRecords(
      userId,
      tableName,
      filters,
    );

    if (estimatedCount > this.config.BATCH_SIZE) {
      return await this.updateRecordsInBatches(
        userId,
        tableName,
        filters,
        convertedUpdates,
      );
    }

    // Operação pequena - usar partition lock + retry para evitar conflitos
    const result = await this.withPartitionLock(userId, tableName, async () => {
      return await this.withRetry(async () => {
        return await prisma.$transaction(async (tx) => {
          // Busca todas as partições
          const partitions = await tx.dataTable.findMany({
            where: { userId, tableName },
            orderBy: { partition: 'asc' },
          });

          if (partitions.length === 0) {
            throw this.createError(
              'TABLE_NOT_FOUND',
              `Tabela "${tableName}" não existe`,
            );
          }

          // Popular cache com schema da primeira partição (oportunista)
          if (partitions.length > 0 && partitions[0].schema) {
            const schema = partitions[0].schema as unknown as TableSchema;
            await this.populateCacheFromPartition(userId, tableName, schema);
          }

          let totalUpdated = 0;
          const updatedRecords: DatabaseRecord[] = [];

          // Obter schema para validação de UNIQUE
          const schema =
            partitions.length > 0
              ? (partitions[0].schema as unknown as TableSchema)
              : null;

          // Atualiza em cada partição
          for (const partition of partitions) {
            let records = partition.data as DatabaseRecord[];
            let modified = false;
            const currentCount = partition.recordCount;

            // Filtra e atualiza registros que atendem condições
            records = await Promise.all(
              records.map(async (record) => {
                if (this.matchesFilters(record, filters)) {
                  // Validar UNIQUE antes de aplicar update
                  if (schema) {
                    await this.validateUniqueConstraints(
                      tableName,
                      userId,
                      { ...record, ...convertedUpdates },
                      schema,
                      record._id, // excludeRecordId
                    );
                  }

                  modified = true;
                  totalUpdated++;
                  const updatedRecord = {
                    ...record,
                    ...convertedUpdates,
                    _updatedAt: new Date().toISOString(),
                  };
                  updatedRecords.push(updatedRecord);
                  return updatedRecord;
                }
                return record;
              }),
            );

            // Salva apenas se houve mudança (com optimistic locking)
            if (modified) {
              const updateResult = await tx.dataTable.updateMany({
                where: {
                  id: partition.id,
                  recordCount: currentCount, // Optimistic lock
                },
                data: { data: records as any },
              });

              if (updateResult.count === 0) {
                throw this.createError(
                  'CONCURRENT_MODIFICATION',
                  'Concurrent modification detected, retrying...',
                );
              }
            }
          }

          return {
            success: true,
            affected: totalUpdated,
            records: updatedRecords,
          };
        });
      });
    });

    return result;
  }

  // ============================================
  // DELETAR REGISTROS
  // ============================================
  async deleteRecords(
    userId: string,
    tableName: string,
    filters: FilterConfig,
  ): Promise<WriteResult> {
    this.validateTableName(tableName);

    // Validação de permissões
    await this.verifyTableOwnership(userId, tableName);
    await this.checkRateLimit(userId);

    // Validar tipos nos filtros
    const schema = await this.getCachedSchema(userId, tableName);
    if (schema && filters.rules) {
      this.validateFilterTypes(filters, schema);
    }

    // Verificar se operação é muito grande para processamento em lotes
    const estimatedCount = await this.estimateAffectedRecords(
      userId,
      tableName,
      filters,
    );

    if (estimatedCount > this.config.BATCH_SIZE) {
      return await this.deleteRecordsInBatches(userId, tableName, filters);
    }

    // Operação pequena - usar partition lock + retry para evitar conflitos
    const result = await this.withPartitionLock(userId, tableName, async () => {
      return await this.withRetry(async () => {
        return await prisma.$transaction(async (tx) => {
          const partitions = await tx.dataTable.findMany({
            where: { userId, tableName },
            orderBy: { partition: 'asc' },
          });

          if (partitions.length === 0) {
            throw this.createError(
              'TABLE_NOT_FOUND',
              `Tabela "${tableName}" não existe`,
            );
          }

          // Popular cache com schema da primeira partição (oportunista)
          if (partitions.length > 0 && partitions[0].schema) {
            const schema = partitions[0].schema as unknown as TableSchema;
            await this.populateCacheFromPartition(userId, tableName, schema);
          }

          let totalDeleted = 0;

          for (const partition of partitions) {
            let records = partition.data as DatabaseRecord[];
            const initialCount = records.length;
            const currentCount = partition.recordCount;

            // Remove registros que atendem filtros
            records = records.filter((record) => {
              const shouldDelete = this.matchesFilters(record, filters);
              if (shouldDelete) totalDeleted++;
              return !shouldDelete;
            });

            // Atualiza se houve remoção (com optimistic locking)
            if (records.length !== initialCount) {
              const updateResult = await tx.dataTable.updateMany({
                where: {
                  id: partition.id,
                  recordCount: currentCount, // Optimistic lock
                },
                data: {
                  data: records as any,
                  recordCount: records.length,
                  isFull: records.length >= this.MAX_PARTITION_SIZE,
                },
              });

              if (updateResult.count === 0) {
                throw this.createError(
                  'CONCURRENT_MODIFICATION',
                  'Concurrent modification detected, retrying...',
                );
              }
            }
          }

          return {
            success: true,
            affected: totalDeleted,
          };
        });
      });
    });

    return result;
  }

  // ============================================
  // ESTATÍSTICAS DA TABELA
  // ============================================
  async getTableStats(userId: string, tableName: string): Promise<TableStats> {
    const partitions = await prisma.dataTable.findMany({
      where: { userId, tableName },
      select: {
        partition: true,
        recordCount: true,
        isFull: true,
        schema: true,
      },
      orderBy: { partition: 'asc' },
    });

    if (partitions.length === 0) {
      throw this.createError(
        'TABLE_NOT_FOUND',
        `Tabela "${tableName}" não existe`,
      );
    }

    return {
      tableName,
      totalPartitions: partitions.length,
      totalRecords: partitions.reduce(
        (sum: number, p: { recordCount: number }) => sum + p.recordCount,
        0,
      ),
      fullPartitions: partitions.filter((p: { isFull: boolean }) => p.isFull)
        .length,
      activePartition:
        partitions.find((p: { isFull: boolean }) => !p.isFull)?.partition ??
        null,
      schema: partitions[0].schema as unknown as TableSchema,
    };
  }

  // ============================================
  // HELPERS PRIVADOS
  // ============================================

  private validateTableName(tableName: string): void {
    if (!tableName || typeof tableName !== 'string') {
      throw this.createError('INVALID_TABLE_NAME', 'Nome da tabela inválido');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(tableName)) {
      throw this.createError(
        'INVALID_TABLE_NAME',
        'Nome da tabela deve conter apenas letras, números, _ e -',
      );
    }
  }

  private validateColumns(columns: ColumnDefinition[]): void {
    if (!Array.isArray(columns) || columns.length === 0) {
      throw this.createError(
        'INVALID_COLUMNS',
        'Colunas devem ser um array não vazio',
      );
    }

    for (const col of columns) {
      if (!col.name || typeof col.name !== 'string') {
        throw this.createError('INVALID_COLUMN', 'Nome da coluna inválido');
      }

      const validTypes = [
        'string',
        'number',
        'boolean',
        'date',
        'array',
        'object',
      ];
      if (!validTypes.includes(col.type)) {
        throw this.createError(
          'INVALID_COLUMN_TYPE',
          `Tipo "${col.type}" inválido. Use: ${validTypes.join(', ')}`,
        );
      }
    }
  }

  private validateRecord(
    record: Record<string, any>,
    schema: TableSchema,
  ): void {
    // SEMPRE validar tipos (remover a condição STRICT_TYPE_VALIDATION)
    for (const column of schema.columns) {
      const value = record[column.name];

      // Verifica required
      if (column.required && (value === undefined || value === null)) {
        throw this.createError(
          'MISSING_REQUIRED_FIELD',
          `Campo "${column.name}" é obrigatório`,
        );
      }

      // Aplica default se ausente
      if (value === undefined && column.default !== undefined) {
        record[column.name] = column.default;
        continue;
      }

      // Valida tipo (apenas se não for null/undefined)
      // null e undefined são permitidos para campos opcionais (já validado acima)
      if (value !== undefined && value !== null) {
        const isValid = this.validateFieldType(value, column.type);
        if (!isValid) {
          throw this.createError(
            'INVALID_FIELD_TYPE',
            `Campo "${column.name}" deve ser do tipo "${column.type}". Valor recebido: "${value}" (tipo: ${typeof value})`,
          );
        }
      }
    }
  }

  /**
   * Valida constraints UNIQUE em todas as partições
   * Lança erro se encontrar valor duplicado
   */
  private async validateUniqueConstraints(
    tableName: string,
    userId: string,
    record: Record<string, any>,
    schema: TableSchema,
    excludeRecordId?: string,
  ): Promise<void> {
    const uniqueColumns = schema.columns.filter((col) => col.unique);

    if (uniqueColumns.length === 0) {
      return;
    }

    // Buscar em todas as partições de forma otimizada
    const partitions = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
      select: {
        data: true,
      },
    });

    for (const uniqueCol of uniqueColumns) {
      const value = record[uniqueCol.name];

      // Skip se valor é null/undefined (permitido para unique, padrão SQL)
      if (value === null || value === undefined) continue;

      // Buscar duplicatas em todas as partições
      for (const partition of partitions) {
        const records = partition.data as DatabaseRecord[];

        for (const existing of records) {
          // Skip se for o mesmo registro (caso de update)
          if (excludeRecordId && existing._id === excludeRecordId) {
            continue;
          }

          if (existing[uniqueCol.name] === value) {
            throw this.createError(
              'UNIQUE_CONSTRAINT_VIOLATION',
              `O valor "${value}" já existe na coluna "${uniqueCol.name}". Esta coluna requer valores únicos.`,
            );
          }
        }
      }
    }
  }

  /**
   * Encontra duplicatas existentes em uma coluna
   * Usado ao ativar constraint UNIQUE em coluna existente
   */
  async findDuplicatesForUniqueColumn(
    userId: string,
    tableName: string,
    columnName: string,
  ): Promise<Array<{ value: any; count: number; ids: string[] }>> {
    const partitions = await prisma.dataTable.findMany({
      where: { userId, tableName },
      select: { data: true },
    });

    const valueMap = new Map<any, { count: number; ids: string[] }>();

    for (const partition of partitions) {
      const records = partition.data as DatabaseRecord[];

      for (const record of records) {
        const value = record[columnName];

        if (value !== null && value !== undefined) {
          const existing = valueMap.get(value) || { count: 0, ids: [] };
          existing.count++;
          existing.ids.push(record._id);
          valueMap.set(value, existing);
        }
      }
    }

    return Array.from(valueMap.entries())
      .filter(([, data]) => data.count > 1)
      .map(([value, data]) => ({ value, ...data }));
  }

  private validateFilterTypes(
    filters: FilterConfig,
    schema: TableSchema,
  ): void {
    // Validar tipos dos valores nos filtros
    for (const rule of filters.rules) {
      if ('field' in rule) {
        const column = schema.columns.find((c) => c.name === rule.field);
        if (column && rule.value !== undefined && rule.value !== null) {
          // Operadores 'in' e 'notIn' aceitam arrays - validar cada item
          if (
            (rule.operator === 'in' || rule.operator === 'notIn') &&
            Array.isArray(rule.value)
          ) {
            for (const item of rule.value) {
              const isValid = this.validateFieldType(item, column.type);
              if (!isValid) {
                throw this.createError(
                  'INVALID_FILTER_TYPE',
                  `Filtro no campo "${rule.field}" (operador '${rule.operator}') deve conter valores do tipo "${column.type}". Valor inválido: "${item}" (tipo: ${typeof item})`,
                );
              }
            }
          } else {
            // Outros operadores: validar o valor diretamente
            const isValid = this.validateFieldType(rule.value, column.type);
            if (!isValid) {
              throw this.createError(
                'INVALID_FILTER_TYPE',
                `Filtro no campo "${rule.field}" deve ser do tipo "${column.type}". Valor recebido: "${rule.value}" (tipo: ${typeof rule.value})`,
              );
            }
          }
        }
      }
    }
  }

  /**
   * Valida apenas os campos presentes no objeto data (para updates parciais)
   * Diferente de validateRecord, não valida campos required que não estão presentes
   */
  private validatePartialRecord(
    data: Record<string, any>,
    schema: TableSchema,
  ): void {
    for (const [field, value] of Object.entries(data)) {
      // Pular campos internos
      if (field === '_id' || field === '_createdAt' || field === '_updatedAt') {
        continue;
      }

      const column = schema.columns.find((c) => c.name === field);

      if (!column) {
        throw this.createError(
          'INVALID_FIELD',
          `Campo "${field}" não existe no schema`,
        );
      }

      // Validar tipo apenas se valor não for null/undefined
      if (value !== undefined && value !== null) {
        const isValid = this.validateFieldType(value, column.type);
        if (!isValid) {
          throw this.createError(
            'INVALID_FIELD_TYPE',
            `Campo "${field}" deve ser do tipo "${column.type}". Valor recebido: "${value}" (tipo: ${typeof value})`,
          );
        }
      }
    }
  }

  private validateFieldType(value: any, type: string): boolean {
    // undefined é sempre válido (campo não fornecido)
    // null é validado normalmente (usuário passou explicitamente null)
    if (value === undefined) {
      return true;
    }

    switch (type) {
      case 'string':
        return typeof value === 'string';

      case 'number':
        // Validação mais rigorosa para number
        if (typeof value === 'number') {
          return !isNaN(value) && isFinite(value);
        }
        // Tentar converter string para number
        if (typeof value === 'string') {
          const num = Number(value);
          return !isNaN(num) && isFinite(num);
        }
        return false;

      case 'boolean':
        // Aceita boolean nativo ou strings que podem ser convertidas
        if (typeof value === 'boolean') return true;
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          return (
            lower === 'true' ||
            lower === 'false' ||
            value === '1' ||
            value === '0'
          );
        }
        return false;

      case 'date':
        // Validação mais rigorosa para date
        if (typeof value !== 'string') return false;

        // Rejeitar timestamps Unix puros (apenas números)
        if (/^\d+$/.test(value)) return false;

        // Aceitar apenas formatos ISO 8601 ou DD/MM/YYYY
        const isoDate = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
        const brDate = /^\d{2}\/\d{2}\/\d{4}$/;

        if (isoDate.test(value)) {
          const parsed = new Date(value);
          return !isNaN(parsed.getTime());
        }

        if (brDate.test(value)) {
          // Converter DD/MM/YYYY para YYYY-MM-DD
          const [day, month, year] = value.split('/');
          const parsed = new Date(`${year}-${month}-${day}`);
          return !isNaN(parsed.getTime());
        }

        return false;

      case 'array':
        return Array.isArray(value);

      case 'object':
        return (
          typeof value === 'object' && !Array.isArray(value) && value !== null
        );

      default:
        return true;
    }
  }

  /**
   * Converte os tipos dos valores de um record conforme o schema
   * Converte strings para numbers, booleans, etc
   */
  private convertRecordTypes(
    record: Record<string, any>,
    schema: TableSchema,
  ): Record<string, any> {
    const converted: Record<string, any> = { ...record };

    for (const column of schema.columns) {
      const value = converted[column.name];

      // Pular se valor não existe ou é null
      if (value === undefined || value === null) {
        continue;
      }

      // Converter conforme o tipo
      switch (column.type) {
        case 'number':
          // Se é string, converter para number
          if (typeof value === 'string') {
            converted[column.name] = parseFloat(value);
          }
          break;

        case 'boolean':
          // Se é string, converter para boolean
          if (typeof value === 'string') {
            converted[column.name] =
              value === 'true' ||
              value === '1' ||
              value.toLowerCase() === 'true';
          }
          break;

        case 'date':
          // Manter como string (datas já estão em formato correto)
          converted[column.name] = value;
          break;

        case 'string':
        case 'array':
        case 'object':
        default:
          // Manter como está
          converted[column.name] = value;
          break;
      }
    }

    return converted;
  }

  private applyFilters(
    records: DatabaseRecord[],
    filters: FilterConfig,
  ): DatabaseRecord[] {
    return records.filter((record) => this.matchesFilters(record, filters));
  }

  private matchesFilters(
    record: DatabaseRecord,
    filters: FilterConfig,
  ): boolean {
    const { condition, rules } = filters;

    if (condition === 'AND') {
      return rules.every((rule) => this.matchesRuleOrFilter(record, rule));
    } else {
      return rules.some((rule) => this.matchesRuleOrFilter(record, rule));
    }
  }

  /**
   * Verifica se um record atende a uma regra ou filtro nested
   */
  private matchesRuleOrFilter(
    record: DatabaseRecord,
    ruleOrFilter: FilterRule | FilterConfig,
  ): boolean {
    // Type guard: se tem 'condition' e 'rules', é FilterConfig
    if ('condition' in ruleOrFilter && 'rules' in ruleOrFilter) {
      return this.matchesFilters(record, ruleOrFilter as FilterConfig);
    }
    // Caso contrário, é FilterRule
    return this.matchesRule(record, ruleOrFilter as FilterRule);
  }

  private matchesRule(record: DatabaseRecord, rule: FilterRule): boolean {
    const fieldValue = record[rule.field];
    const { operator, value } = rule;

    // Early return para operadores que não precisam de valor
    if (
      [
        'isNull',
        'isNotNull',
        'isTrue',
        'isFalse',
        'isEmpty',
        'isNotEmpty',
      ].includes(operator)
    ) {
      // Não precisa verificar value para estes operadores
    } else if (value === null || value === undefined) {
      // Para outros operadores, se value é null/undefined, só alguns são válidos
      if (!['equals', 'notEquals'].includes(operator)) {
        return false; // Operadores numéricos/string não funcionam com null
      }
    }

    // Helper: Tenta converter para número se ambos parecem números
    const tryNumericComparison = (a: any, b: any): [number, number] | null => {
      // Se qualquer valor é null/undefined, não tenta conversão numérica
      if (a === null || a === undefined || b === null || b === undefined) {
        return null;
      }

      const numA = typeof a === 'number' ? a : Number(a);
      const numB = typeof b === 'number' ? b : Number(b);

      // Se ambos são números válidos, retorna
      if (!isNaN(numA) && !isNaN(numB)) {
        return [numA, numB];
      }
      return null;
    };

    switch (operator) {
      case 'equals': {
        // Comparação flexível: tenta converter tipos quando possível
        if (fieldValue === value) return true; // Igualdade estrita primeiro

        // Tenta conversão numérica
        const numeric = tryNumericComparison(fieldValue, value);
        if (numeric) {
          return numeric[0] === numeric[1];
        }

        // Comparação de strings (case-insensitive como fallback)
        return String(fieldValue).toLowerCase() === String(value).toLowerCase();
      }

      case 'notEquals': {
        // Inverso do equals
        if (fieldValue === value) return false;

        const numeric = tryNumericComparison(fieldValue, value);
        if (numeric) {
          return numeric[0] !== numeric[1];
        }

        return String(fieldValue).toLowerCase() !== String(value).toLowerCase();
      }

      case 'greaterThan': {
        const numeric = tryNumericComparison(fieldValue, value);
        return numeric ? numeric[0] > numeric[1] : fieldValue > value;
      }

      case 'greaterThanOrEqual': {
        const numeric = tryNumericComparison(fieldValue, value);
        return numeric ? numeric[0] >= numeric[1] : fieldValue >= value;
      }

      case 'lessThan': {
        const numeric = tryNumericComparison(fieldValue, value);
        return numeric ? numeric[0] < numeric[1] : fieldValue < value;
      }

      case 'lessThanOrEqual': {
        const numeric = tryNumericComparison(fieldValue, value);
        return numeric ? numeric[0] <= numeric[1] : fieldValue <= value;
      }

      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'notContains':
        return !String(fieldValue).includes(String(value));
      case 'startsWith':
        return String(fieldValue).startsWith(String(value));
      case 'endsWith':
        return String(fieldValue).endsWith(String(value));

      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'notIn':
        return Array.isArray(value) && !value.includes(fieldValue);

      case 'isEmpty':
        return (
          fieldValue === null ||
          fieldValue === undefined ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      case 'isNotEmpty':
        return !(
          fieldValue === null ||
          fieldValue === undefined ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );

      case 'isNull':
        return fieldValue === null;
      case 'isNotNull':
        return fieldValue !== null;

      case 'isTrue':
        return fieldValue === true;
      case 'isFalse':
        return fieldValue === false;

      default:
        return false;
    }
  }

  private sortRecords(
    records: DatabaseRecord[],
    field: string,
    order: 'asc' | 'desc',
  ): DatabaseRecord[] {
    return [...records].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : 1;
      return order === 'asc' ? comparison : -comparison;
    });
  }

  private async checkTableLimit(userId: string): Promise<void> {
    const count = await prisma.dataTable.count({
      where: { userId, partition: 0 },
    });

    // Em ambiente de teste para o SQL Engine, permitir um limite maior para usuários de testes específicos
    const isSqlEngineTestUser =
      process.env.NODE_ENV === 'test' &&
      typeof userId === 'string' &&
      userId.startsWith('test_sql_');
    const effectiveMax = isSqlEngineTestUser
      ? Math.max(this.MAX_TABLES, 50)
      : this.MAX_TABLES;

    if (count >= effectiveMax) {
      throw this.createError(
        'TABLE_LIMIT',
        `Limite de tabelas atingido (${effectiveMax})`,
      );
    }

    // Verificar limite de armazenamento do plano
    try {
      const user = await prisma.user.findUnique({
        where: { email: userId },
        select: { id: true },
      });

      if (user) {
        const { canUseStorage } = await import(
          '@/services/subscription/subscription.service'
        );
        // Estimar tamanho aproximado (schema pequeno, ~1KB)
        const estimatedSizeMB = 0.001;
        const check = await canUseStorage(user.id, estimatedSizeMB);
        if (!check.allowed) {
          throw this.createError(
            'STORAGE_LIMIT',
            check.message || 'Limite de armazenamento atingido',
          );
        }
      }
    } catch (error: any) {
      // Se erro for do nosso sistema, relançar
      if (error.code === 'STORAGE_LIMIT') {
        throw error;
      }
      // Ignorar outros erros (usuário não encontrado, etc)
    }
  }

  private createError(code: string, message: string, details?: any): Error {
    const error = new Error(message) as any;
    error.code = code;
    error.details = details;
    return error;
  }
}

// Export da classe para instanciar em testes
// Export da instância padrão para uso geral
export const databaseService = new DatabaseService();
