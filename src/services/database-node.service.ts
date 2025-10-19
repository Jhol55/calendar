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

    // Busca todas as partições
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

    // Atualiza schema
    const currentSchema = partitions[0].schema as unknown as TableSchema;
    const updatedSchema = {
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

      await prisma.dataTable.update({
        where: { id: partition.id },
        data: {
          schema: updatedSchema as any,
          data: cleanedRecords as any,
        },
      });
    }

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

    // 1. Busca partição ativa (não cheia)
    let activePartition = await prisma.dataTable.findFirst({
      where: {
        userId,
        tableName,
        isFull: false,
      },
      orderBy: { partition: 'desc' },
    });

    console.log(
      `📊 [DB-SERVICE] Active partition found:`,
      activePartition
        ? `ID ${activePartition.id}, partition ${activePartition.partition}`
        : 'NONE',
    );

    // 2. Se não existe nenhuma partição, erro (precisa criar schema primeiro)
    if (!activePartition) {
      const hasTable = await prisma.dataTable.findFirst({
        where: { userId, tableName },
      });

      if (!hasTable) {
        throw this.createError(
          'TABLE_NOT_FOUND',
          `Tabela "${tableName}" não existe. Use addColumns primeiro para criar o schema.`,
        );
      }

      // Existe mas todas estão cheias - precisa criar nova
      const lastPartition = await prisma.dataTable.findFirst({
        where: { userId, tableName },
        orderBy: { partition: 'desc' },
      });

      if (lastPartition!.partition >= this.MAX_PARTITIONS - 1) {
        throw this.createError(
          'PARTITION_LIMIT',
          `Limite de partições atingido (${this.MAX_PARTITIONS})`,
        );
      }

      // Cria nova partição
      activePartition = await prisma.dataTable.create({
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

    // 1. Busca TODAS as partições desta tabela
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

    // 2. Agrega dados de todas as partições
    let allRecords: DatabaseRecord[] = [];
    for (const partition of partitions) {
      const records = partition.data as DatabaseRecord[];
      allRecords = allRecords.concat(records);
    }

    // 3. Aplica filtros
    if (options.filters) {
      allRecords = this.applyFilters(allRecords, options.filters);
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
    const limit = Math.min(
      options.pagination?.limit || DATABASE_NODE_CONFIG.DEFAULT_QUERY_LIMIT,
      DATABASE_NODE_CONFIG.MAX_QUERY_LIMIT,
    );
    const offset = options.pagination?.offset || 0;

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

    // Busca todas as partições
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
        await prisma.dataTable.update({
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
        await prisma.dataTable.update({
          where: { id: partition.id },
          data: {
            data: records as any,
            recordCount: records.length,
            isFull: false, // Não está mais cheia após deletar
          },
        });
      }
    }

    return {
      success: true,
      affected: totalDeleted,
    };
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
    if (!DATABASE_NODE_CONFIG.STRICT_TYPE_VALIDATION) return;

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

      // Valida tipo
      if (value !== undefined && value !== null) {
        const isValid = this.validateFieldType(value, column.type);
        if (!isValid) {
          throw this.createError(
            'INVALID_FIELD_TYPE',
            `Campo "${column.name}" deve ser do tipo "${column.type}"`,
          );
        }
      }
    }
  }

  private validateFieldType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return typeof value === 'string' && !isNaN(Date.parse(value));
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value);
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

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'notEquals':
        return fieldValue !== value;
      case 'greaterThan':
        return fieldValue > value;
      case 'greaterThanOrEqual':
        return fieldValue >= value;
      case 'lessThan':
        return fieldValue < value;
      case 'lessThanOrEqual':
        return fieldValue <= value;

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
