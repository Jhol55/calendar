// ============================================
// DATABASE NODE SERVICE
// Gerenciamento de tabelas virtuais com particionamento
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { v4 as uuid } from 'uuid';
import { prisma } from '@/services/prisma';
import { DATABASE_NODE_CONFIG } from '@/config/database-node.config';
import type {
  ColumnDefinition,
  TableSchema,
  FilterConfig,
  FilterRule,
  QueryOptions,
  DatabaseRecord,
  WriteResult,
  TableStats,
} from '@/types/database-node.types';

export class DatabaseNodeService {
  private readonly MAX_PARTITION_SIZE = DATABASE_NODE_CONFIG.MAX_PARTITION_SIZE;
  private readonly MAX_PARTITIONS =
    DATABASE_NODE_CONFIG.MAX_PARTITIONS_PER_TABLE;
  private readonly MAX_TABLES = DATABASE_NODE_CONFIG.MAX_TABLES_PER_USER;

  // ============================================
  // VALIDAÇÃO DE PERMISSÕES
  // ============================================

  /**
   * Verifica se o usuário é o dono da tabela
   * @throws Error se tabela não existe ou usuário não é o dono
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
      // Tabela não existe - permitir (será criada pelo usuário)
      return;
    }

    if (table.userId !== userId) {
      console.error(
        `🚨 Tentativa não autorizada: userId ${userId} tentou acessar tabela ${tableName} de outro usuário`,
      );
      throw this.createError(
        'UNAUTHORIZED',
        `Acesso negado: você não tem permissão para acessar a tabela "${tableName}"`,
      );
    }
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
    const windowMs = 60 * 60 * 1000; // 1 hora
    const maxOperations = 1000000; // 1M operações por hora

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

    // 1. Busca partição ativa (não cheia)
    // USAR TRANSACTION para evitar race condition
    const activePartition = await prisma.$transaction(async (tx) => {
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

      return partition;
    });

    if (!activePartition) {
      throw this.createError(
        'NO_ACTIVE_PARTITION',
        'Não foi possível encontrar ou criar uma partição ativa',
      );
    }

    // 3. Valida registro contra schema
    const schema = activePartition.schema as unknown as TableSchema;
    this.validateRecord(record, schema);

    // 4. Adiciona campos automáticos
    const newRecord: DatabaseRecord = {
      _id: uuid(),
      _createdAt: new Date().toISOString(),
      _updatedAt: new Date().toISOString(),
      ...record,
    };

    // 5. Adiciona na partição
    const currentData = activePartition.data as DatabaseRecord[];
    const updatedData = [...currentData, newRecord];
    const newCount = updatedData.length;

    await prisma.dataTable.update({
      where: { id: activePartition.id },
      data: {
        data: updatedData as any,
        recordCount: newCount,
        isFull: newCount >= this.MAX_PARTITION_SIZE,
      },
    });

    console.log(
      `✅ [DB-SERVICE] Record inserted successfully! ID: ${newRecord._id}, Total records in partition: ${newCount}`,
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
    this.validateTableName(tableName);

    // Validação de permissões
    await this.verifyTableOwnership(userId, tableName);
    await this.checkRateLimit(userId);

    // Limites de paginação
    const limit = Math.min(
      options.pagination?.limit || DATABASE_NODE_CONFIG.DEFAULT_QUERY_LIMIT,
      DATABASE_NODE_CONFIG.MAX_QUERY_LIMIT,
    );
    const offset = options.pagination?.offset || 0;

    // 1. Busca partições com LIMITE (evitar DoS)
    const maxPartitions = DATABASE_NODE_CONFIG.MAX_PARTITIONS_TO_SCAN;
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
    return allRecords.slice(offset, offset + limit);
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

    // USAR TRANSACTION para garantir atomicidade
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

    // USAR TRANSACTION para garantir atomicidade
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
              isFull: records.length < this.MAX_PARTITION_SIZE, // Recalcula isFull
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
        partitions.find((p: { isFull: boolean }) => !p.isFull)?.partition ||
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

      // Valida tipo (sempre, mesmo se não required)
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
    // Se valor é null/undefined, só é válido se não for required
    if (value === null || value === undefined) {
      return true; // Será tratado pelo validateRecord
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

        if (isoDate.test(value) || brDate.test(value)) {
          const parsed = new Date(value);
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

    // Helper: Tenta converter para número se ambos parecem números
    const tryNumericComparison = (a: any, b: any): [number, number] | null => {
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

// Singleton instance
export const databaseNodeService = new DatabaseNodeService();
