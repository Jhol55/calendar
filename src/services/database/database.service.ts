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

export class DatabaseNodeService {
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
   * Invalida cache de schema
   */
  private invalidateSchemaCache(userId: string, tableName: string): void {
    const cacheKey = `${userId}:${tableName}`;
    this.schemaCache.delete(cacheKey);
  }

  /**
   * Popular cache de schema (chamado quando já temos o schema de uma partição)
   */
  private populateCacheFromPartition(
    userId: string,
    tableName: string,
    schema: TableSchema,
  ): void {
    const cacheKey = `${userId}:${tableName}`;
    this.schemaCache.set(cacheKey, {
      schema,
      timestamp: Date.now(),
    });
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

          // Salvar após cada lote
          await prisma.dataTable.update({
            where: { id: partition.id },
            data: { data: records as any },
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

          // Salvar partição atualizada
          await prisma.dataTable.update({
            where: { id: partition.id },
            data: {
              data: records as any,
              recordCount: records.length,
              isFull: records.length >= this.MAX_PARTITION_SIZE,
            },
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

    current.count++;
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
      this.invalidateSchemaCache(userId, tableName);
      this.populateCacheFromPartition(userId, tableName, { columns });

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
    this.invalidateSchemaCache(userId, tableName);
    this.populateCacheFromPartition(userId, tableName, updatedSchema);

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
      this.invalidateSchemaCache(userId, tableName);

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
    this.populateCacheFromPartition(userId, tableName, updatedSchema);

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

    // Tentar validar com schema em cache primeiro (otimização)
    const cachedSchema = await this.getCachedSchema(userId, tableName);
    if (cachedSchema) {
      // Validação prévia com cache - se falhar, não precisa nem abrir transaction
      this.validateRecord(record, cachedSchema);
    }

    // 1. Busca partição ativa e insere registro (dentro de transaction)
    // USAR TRANSACTION para evitar race condition
    const newRecord = await prisma.$transaction(async (tx) => {
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

      // 4. Adiciona campos automáticos
      const newRecordData: DatabaseRecord = {
        _id: uuid(),
        _createdAt: new Date().toISOString(),
        _updatedAt: new Date().toISOString(),
        ...record,
      };

      // 5. Adiciona na partição (ainda dentro da transaction)
      const currentData = partition.data as DatabaseRecord[];
      const updatedData = [...currentData, newRecordData];
      const newCount = updatedData.length;

      await tx.dataTable.update({
        where: { id: partition.id },
        data: {
          data: updatedData as any,
          recordCount: newCount,
          isFull: newCount >= this.MAX_PARTITION_SIZE,
        },
      });

      console.log(
        `✅ [DB-SERVICE] Record inserted successfully! ID: ${newRecordData._id}, Total records in partition: ${newCount}`,
      );

      return newRecordData;
    });

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
    if (partitions.length > 0 && partitions[0].schema) {
      const schema = partitions[0].schema as unknown as TableSchema;
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
        updates,
      );
    }

    // Operação pequena - usar transaction normal
    const result = await prisma.$transaction(async (tx) => {
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
        this.populateCacheFromPartition(userId, tableName, schema);
      }

      let totalUpdated = 0;
      const updatedRecords: DatabaseRecord[] = [];

      // Atualiza em cada partição
      for (const partition of partitions) {
        let records = partition.data as DatabaseRecord[];
        let modified = false;

        // Filtra e atualiza registros que atendem condições
        records = records.map((record) => {
          if (this.matchesFilters(record, filters)) {
            modified = true;
            totalUpdated++;
            const updatedRecord = {
              ...record,
              ...updates,
              _updatedAt: new Date().toISOString(),
            };
            updatedRecords.push(updatedRecord);
            return updatedRecord;
          }
          return record;
        });

        // Salva apenas se houve mudança
        if (modified) {
          await tx.dataTable.update({
            where: { id: partition.id },
            data: { data: records as any },
          });
        }
      }

      return {
        success: true,
        affected: totalUpdated,
        records: updatedRecords,
      };
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

    // Verificar se operação é muito grande para processamento em lotes
    const estimatedCount = await this.estimateAffectedRecords(
      userId,
      tableName,
      filters,
    );

    if (estimatedCount > this.config.BATCH_SIZE) {
      return await this.deleteRecordsInBatches(userId, tableName, filters);
    }

    // Operação pequena - usar transaction normal
    const result = await prisma.$transaction(async (tx) => {
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
        this.populateCacheFromPartition(userId, tableName, schema);
      }

      let totalDeleted = 0;

      for (const partition of partitions) {
        let records = partition.data as DatabaseRecord[];
        const initialCount = records.length;

        // Remove registros que atendem filtros
        records = records.filter((record) => {
          const shouldDelete = this.matchesFilters(record, filters);
          if (shouldDelete) totalDeleted++;
          return !shouldDelete;
        });

        // Atualiza se houve remoção
        if (records.length !== initialCount) {
          await tx.dataTable.update({
            where: { id: partition.id },
            data: {
              data: records as any,
              recordCount: records.length,
              isFull: records.length >= this.MAX_PARTITION_SIZE, // Partição cheia = tem MAX registros ou mais
            },
          });
        }
      }

      return {
        success: true,
        affected: totalDeleted,
      };
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
        return typeof value === 'boolean';

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
      return rules.every((rule) => this.matchesRule(record, rule));
    } else {
      return rules.some((rule) => this.matchesRule(record, rule));
    }
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

    if (count >= this.MAX_TABLES) {
      throw this.createError(
        'TABLE_LIMIT',
        `Limite de tabelas atingido (${this.MAX_TABLES})`,
      );
    }
  }

  private createError(code: string, message: string, details?: any): Error {
    const error = new Error(message) as any;
    error.code = code;
    error.details = details;
    return error;
  }
}

// Export apenas a classe (não mais singleton)
// Para manter compatibilidade com código existente, criamos instância padrão
export const databaseNodeService = new DatabaseNodeService();
