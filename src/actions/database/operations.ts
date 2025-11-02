'use server';

import { prisma } from '@/services/prisma';
import { getSession } from '@/utils/security/session';
import { DATABASE_CONFIG } from '@/config/database.config';
import { Prisma } from '../../../generated/prisma';

interface SessionUser {
  user: {
    email: string;
  };
  expires: Date;
  remember: boolean;
}

type DatabaseResponse = {
  success: boolean;
  message?: string;
  code?: number;
  data?: unknown;
};

async function getUserIdFromSession(): Promise<string | null> {
  const session = (await getSession()) as SessionUser | null;

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  return user?.id ? String(user.id) : null;
}

export async function getAvailableTables(): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    const tables = await prisma.dataTable.findMany({
      where: {
        userId,
      },
      select: {
        tableName: true,
      },
      distinct: ['tableName'],
    });

    const tableNames = tables.map((t) => t.tableName);

    return {
      success: true,
      message: 'Tables loaded successfully',
      code: 200,
      data: tableNames,
    };
  } catch (error) {
    console.error('Error fetching tables:', error);
    return {
      success: false,
      message: 'Failed to fetch tables',
      code: 500,
    };
  }
}

export async function getTableData(
  tableName: string,
  options?: {
    offset?: number;
    limit?: number;
  },
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    if (!tableName) {
      return {
        success: false,
        message: 'tableName is required',
        code: 400,
      };
    }

    // Parâmetros de paginação
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;

    // Buscar todas as partições da tabela
    const dataRecords = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
      orderBy: {
        partition: 'asc',
      },
    });

    if (dataRecords.length === 0) {
      return {
        success: true,
        message: 'No data found',
        code: 200,
        data: {
          data: [],
          schema: null,
          totalCount: 0,
          hasMore: false,
        },
      };
    }

    // Pegar o schema da primeira partição
    const schema = dataRecords[0].schema;

    // Extrair todos os dados (campo data é JSONB com array)
    const allData: unknown[] = [];
    dataRecords.forEach((record) => {
      const data = record.data as unknown;
      if (Array.isArray(data)) {
        allData.push(...data);
      }
    });

    // Calcular total e verificar se há mais dados
    const totalCount = allData.length;
    const hasMore = offset + limit < totalCount;

    // Aplicar paginação
    const paginatedData = allData.slice(offset, offset + limit);

    return {
      success: true,
      message: 'Table data loaded successfully',
      code: 200,
      data: {
        data: paginatedData,
        schema,
        totalCount,
        hasMore,
      },
    };
  } catch (error) {
    console.error('Error fetching table data:', error);
    return {
      success: false,
      message: 'Failed to fetch table data',
      code: 500,
    };
  }
}

export async function updateCell(
  tableName: string,
  rowId: string,
  column: string,
  value: string,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    if (!tableName || !rowId || !column) {
      return {
        success: false,
        message: 'tableName, rowId, and column are required',
        code: 400,
      };
    }

    // Buscar todas as partições da tabela
    const dataRecords = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
    });

    if (dataRecords.length === 0) {
      return {
        success: false,
        message: 'Table not found',
        code: 404,
      };
    }

    // Buscar schema da tabela (partição 0)
    const schemaPartition = dataRecords.find((r) => r.partition === 0);
    if (!schemaPartition) {
      return {
        success: false,
        message: 'Table schema not found',
        code: 404,
      };
    }

    const schema = schemaPartition.schema as {
      columns: Array<{
        name: string;
        type: string;
        unique?: boolean;
        required?: boolean;
      }>;
    };
    const columnDef = schema.columns.find((col) => col.name === column);

    if (columnDef) {
      // VALIDAÇÃO DE TIPO ANTES DE ATUALIZAR
      const validationError = validateCellValue(value, columnDef.type);
      if (validationError) {
        return {
          success: false,
          message: validationError,
          code: 400,
        };
      }

      // VALIDAÇÃO DE UNIQUE ANTES DE ATUALIZAR
      if (columnDef.unique && value && value.trim() !== '') {
        // Converter o valor para o tipo correto da coluna antes de validar
        let typedValue: any = value;
        if (columnDef.type === 'number') {
          typedValue = Number(value);
        } else if (columnDef.type === 'boolean') {
          typedValue = value === 'true' || value === true;
        }

        // Verificar se já existe outro registro com esse valor
        for (const record of dataRecords) {
          const data = record.data as Array<Record<string, unknown>>;
          for (const row of data) {
            // Skip o próprio registro que está sendo atualizado
            if (row._id === rowId) continue;

            if (row[column] === typedValue) {
              return {
                success: false,
                message: `O valor "${value}" já existe na coluna "${column}". Esta coluna requer valores únicos.`,
                code: 400,
              };
            }
          }
        }
      }
    }

    // Encontrar a partição que contém o registro
    for (const record of dataRecords) {
      const data = record.data as Array<Record<string, unknown>>;
      const rowIndex = data.findIndex((row) => row._id === rowId);

      if (rowIndex !== -1) {
        // Converter o valor para o tipo correto da coluna antes de salvar
        let typedValue: any = value;
        if (columnDef.type === 'number') {
          typedValue = value.trim() === '' ? null : Number(value);
        } else if (columnDef.type === 'boolean') {
          typedValue = value === 'true' || value === true;
        } else if (columnDef.type === 'date') {
          typedValue = value.trim() === '' ? null : value;
        }

        // Atualizar o registro com o valor tipado
        data[rowIndex][column] = typedValue;
        data[rowIndex]._updatedAt = new Date().toISOString();

        // Salvar de volta no banco
        await prisma.dataTable.update({
          where: { id: record.id },
          data: {
            data: data as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        });

        return {
          success: true,
          message: 'Cell updated successfully',
          code: 200,
        };
      }
    }

    return {
      success: false,
      message: 'Row not found',
      code: 404,
    };
  } catch (error) {
    console.error('Error updating cell:', error);
    return {
      success: false,
      message: 'Failed to update cell',
      code: 500,
    };
  }
}

/**
 * Valida se um valor é compatível com o tipo da coluna
 */
function validateCellValue(value: string, columnType: string): string | null {
  if (!value || value.trim() === '') {
    return null; // Valores vazios são permitidos
  }

  switch (columnType) {
    case 'string':
      return null; // Strings sempre são válidas

    case 'number':
      // Tentar converter para number
      const num = Number(value);
      if (isNaN(num) || !isFinite(num)) {
        return `Valor "${value}" não é um número válido`;
      }
      return null;

    case 'boolean':
      const lowerValue = value.toLowerCase();
      if (
        !['true', 'false', '1', '0', 'sim', 'não', 'yes', 'no'].includes(
          lowerValue,
        )
      ) {
        return `Valor "${value}" não é um booleano válido (true/false)`;
      }
      return null;

    case 'date':
      // Rejeitar timestamps Unix puros
      if (/^\d+$/.test(value)) {
        return `Valor "${value}" não é uma data válida (use formato DD/MM/AAAA ou AAAA-MM-DD)`;
      }

      // Aceitar formatos ISO 8601 ou DD/MM/YYYY
      const isoDate = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
      const brDate = /^\d{2}\/\d{2}\/\d{4}$/;

      if (isoDate.test(value) || brDate.test(value)) {
        const parsed = new Date(value);
        if (isNaN(parsed.getTime())) {
          return `Valor "${value}" não é uma data válida`;
        }
        return null;
      }

      return `Valor "${value}" não é uma data válida (use formato DD/MM/AAAA ou AAAA-MM-DD)`;

    case 'array':
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
          return `Valor "${value}" não é um array válido`;
        }
        return null;
      } catch {
        return `Valor "${value}" não é um array JSON válido`;
      }

    case 'object':
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          return `Valor "${value}" não é um objeto válido`;
        }
        return null;
      } catch {
        return `Valor "${value}" não é um objeto JSON válido`;
      }

    default:
      return null;
  }
}

export async function addRow(
  tableName: string,
  data: Record<string, unknown>,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    if (!tableName || !data) {
      return {
        success: false,
        message: 'tableName and data are required',
        code: 400,
      };
    }

    // Buscar todas as partições da tabela para obter schema
    const dataRecords = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
    });

    if (dataRecords.length === 0) {
      return {
        success: false,
        message: 'Table not found',
        code: 404,
      };
    }

    // Buscar schema da tabela (partição 0)
    const schemaPartition = dataRecords.find((r) => r.partition === 0);
    if (!schemaPartition) {
      return {
        success: false,
        message: 'Table schema not found',
        code: 404,
      };
    }

    const schema = schemaPartition.schema as {
      columns: Array<{
        name: string;
        type: string;
        unique?: boolean;
        required?: boolean;
      }>;
    };

    // VALIDAÇÃO DE TIPOS PARA CADA CAMPO
    for (const column of schema.columns) {
      const value = data[column.name];

      if (value !== undefined && value !== null) {
        const validationError = validateCellValue(String(value), column.type);
        if (validationError) {
          return {
            success: false,
            message: `Campo "${column.name}": ${validationError}`,
            code: 400,
          };
        }
      }
    }

    // VALIDAÇÃO DE UNIQUE PARA CADA CAMPO
    for (const column of schema.columns) {
      if (column.unique) {
        const value = data[column.name];

        // Skip se valor é null/undefined (permitido para unique)
        if (
          value === null ||
          value === undefined ||
          String(value).trim() === ''
        )
          continue;

        // Converter o valor para o tipo correto da coluna antes de validar
        let typedValue: any = value;
        if (column.type === 'number') {
          typedValue = Number(value);
        } else if (column.type === 'boolean') {
          typedValue = value === 'true' || value === true;
        }

        // Verificar se já existe em todas as partições
        for (const record of dataRecords) {
          const existingData = record.data as Array<Record<string, unknown>>;
          for (const row of existingData) {
            if (row[column.name] === typedValue) {
              return {
                success: false,
                message: `O valor "${value}" já existe na coluna "${column.name}". Esta coluna requer valores únicos.`,
                code: 400,
              };
            }
          }
        }
      }
    }

    // Buscar a partição ativa (não cheia)
    const activePartition = dataRecords.find((record) => !record.isFull);

    if (!activePartition) {
      return {
        success: false,
        message: 'No active partition found. Create a table first.',
        code: 404,
      };
    }

    // Pegar os dados atuais
    const currentData =
      (activePartition.data as Array<Record<string, unknown>>) || [];

    // Converter os valores para os tipos corretos antes de adicionar
    const typedData: Record<string, unknown> = { ...data };
    for (const column of schema.columns) {
      const value = typedData[column.name];
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ''
      ) {
        if (column.type === 'number') {
          typedData[column.name] = Number(value);
        } else if (column.type === 'boolean') {
          typedData[column.name] = value === 'true' || value === true;
        }
      }
    }

    // Adicionar novo registro com valores tipados
    currentData.push(typedData);

    // Verificar se atingiu o limite
    const isFull = currentData.length >= DATABASE_CONFIG.MAX_PARTITION_SIZE;

    // Atualizar a partição
    await prisma.dataTable.update({
      where: { id: activePartition.id },
      data: {
        data: currentData as Prisma.InputJsonValue,
        recordCount: currentData.length,
        isFull,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Row added successfully',
      code: 200,
      data,
    };
  } catch (error) {
    console.error('Error adding row:', error);
    return {
      success: false,
      message: 'Failed to add row',
      code: 500,
    };
  }
}

export async function createTable(
  tableName: string,
  columns: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    default: unknown;
    required: boolean;
  }>,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Validar nome da tabela
    if (!tableName || !/^[a-zA-Z0-9_-]+$/.test(tableName)) {
      return {
        success: false,
        message: 'Invalid table name. Use only letters, numbers, _ and -',
        code: 400,
      };
    }

    // Verificar se tabela já existe
    const existingTable = await prisma.dataTable.findFirst({
      where: {
        userId,
        tableName,
      },
    });

    if (existingTable) {
      return {
        success: false,
        message: 'Table already exists',
        code: 400,
      };
    }

    // Verificar limite de tabelas
    const tableCount = await prisma.dataTable.count({
      where: { userId },
    });

    if (tableCount >= DATABASE_CONFIG.MAX_TABLES_PER_USER) {
      return {
        success: false,
        message: `Maximum number of tables reached (${DATABASE_NODE_CONFIG.MAX_TABLES_PER_USER})`,
        code: 400,
      };
    }

    // Criar schema da tabela
    const schema = {
      columns: columns.map((col) => ({
        name: col.name,
        type: col.type,
        default: col.default,
        required: col.required,
      })),
    };

    // Criar tabela com partição inicial
    await prisma.dataTable.create({
      data: {
        userId,
        tableName,
        partition: 0,
        recordCount: 0,
        isFull: false,
        schema: schema as Prisma.InputJsonValue,
        data: [] as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      message: 'Table created successfully',
      data: { tableName, schema },
    };
  } catch (error) {
    console.error('Error creating table:', error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Failed to create table',
      code: 500,
    };
  }
}

export async function deleteRow(
  tableName: string,
  rowId: string,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    if (!tableName || !rowId) {
      return {
        success: false,
        message: 'tableName and rowId are required',
        code: 400,
      };
    }

    // Buscar todas as partições da tabela
    const dataRecords = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
    });

    // Encontrar a partição que contém o registro
    for (const record of dataRecords) {
      const data = record.data as Array<Record<string, unknown>>;
      const rowIndex = data.findIndex((row) => row._id === rowId);

      if (rowIndex !== -1) {
        // Remover o registro
        data.splice(rowIndex, 1);

        // Salvar de volta no banco
        await prisma.dataTable.update({
          where: { id: record.id },
          data: {
            data: data as Prisma.InputJsonValue,
            recordCount: data.length,
            isFull: false, // Ao deletar, a partição não está mais cheia
            updatedAt: new Date(),
          },
        });

        return {
          success: true,
          message: 'Row deleted successfully',
          code: 200,
        };
      }
    }

    return {
      success: false,
      message: 'Row not found',
      code: 404,
    };
  } catch (error) {
    console.error('Error deleting row:', error);
    return {
      success: false,
      message: 'Failed to delete row',
      code: 500,
    };
  }
}

export async function addColumnsToTable(
  tableName: string,
  columns: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    required: boolean;
    default: string;
  }>,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Buscar a tabela existente
    const existingTable = await prisma.dataTable.findFirst({
      where: {
        tableName: tableName,
        userId,
      },
    });

    if (!existingTable) {
      return {
        success: false,
        message: 'Tabela não encontrada',
        code: 404,
      };
    }

    // Obter schema atual
    const currentSchema = existingTable.schema as {
      columns: Array<{
        name: string;
        type: string;
        default: unknown;
        required: boolean;
      }>;
    };

    // Verificar se alguma coluna já existe
    const existingColumnNames = currentSchema.columns.map((col) => col.name);
    const duplicateColumns = columns.filter((col) =>
      existingColumnNames.includes(col.name),
    );

    if (duplicateColumns.length > 0) {
      return {
        success: false,
        message: `Colunas já existem: ${duplicateColumns.map((col) => col.name).join(', ')}`,
        code: 409,
      };
    }

    // Adicionar novas colunas ao schema
    const newColumns = columns.map((col) => ({
      name: col.name,
      type: col.type,
      default: col.default,
      required: col.required,
    }));

    const updatedSchema = {
      columns: [...currentSchema.columns, ...newColumns],
    };

    // Atualizar a tabela com o novo schema
    const updatedTable = await prisma.dataTable.update({
      where: {
        id: existingTable.id,
      },
      data: {
        schema: updatedSchema as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      data: updatedTable,
    };
  } catch (error) {
    console.error('Error adding columns to table:', error);
    return {
      success: false,
      message: 'Erro interno do servidor',
      code: 500,
    };
  }
}

export async function updateColumnMetadata(
  tableName: string,
  columnName: string,
  metadata: {
    type?: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
    required?: boolean;
    default?: unknown;
    unique?: boolean;
  },
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Buscar todas as partições da tabela
    const dataRecords = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
    });

    if (dataRecords.length === 0) {
      return {
        success: false,
        message: 'Tabela não encontrada',
        code: 404,
      };
    }

    // Obter schema atual da primeira partição
    const currentSchema = dataRecords[0].schema as {
      columns: Array<{
        name: string;
        type: string;
        default: unknown;
        required: boolean;
      }>;
    };

    // Verificar se a coluna existe
    const columnIndex = currentSchema.columns.findIndex(
      (col) => col.name === columnName,
    );

    if (columnIndex === -1) {
      return {
        success: false,
        message: 'Coluna não encontrada',
        code: 404,
      };
    }

    // Atualizar schema com os novos metadados
    const updatedSchema = {
      columns: currentSchema.columns.map((col) =>
        col.name === columnName
          ? {
              ...col,
              ...(metadata.type !== undefined && { type: metadata.type }),
              ...(metadata.required !== undefined && {
                required: metadata.required,
              }),
              ...(metadata.default !== undefined && {
                default: metadata.default,
              }),
              ...(metadata.unique !== undefined && { unique: metadata.unique }),
            }
          : col,
      ),
    };

    // Atualizar todas as partições
    for (const record of dataRecords) {
      await prisma.dataTable.update({
        where: { id: record.id },
        data: {
          schema: updatedSchema as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      message: 'Metadados da coluna atualizados com sucesso',
      code: 200,
    };
  } catch (error) {
    console.error('Error updating column metadata:', error);
    return {
      success: false,
      message: 'Erro ao atualizar metadados da coluna',
      code: 500,
    };
  }
}

export async function renameColumn(
  tableName: string,
  oldColumnName: string,
  newColumnName: string,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Validar novo nome da coluna
    if (!newColumnName || !/^[a-zA-Z0-9_-]+$/.test(newColumnName)) {
      return {
        success: false,
        message: 'Nome de coluna inválido. Use apenas letras, números, _ e -',
        code: 400,
      };
    }

    // Buscar todas as partições da tabela
    const dataRecords = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
    });

    if (dataRecords.length === 0) {
      return {
        success: false,
        message: 'Tabela não encontrada',
        code: 404,
      };
    }

    // Obter schema atual da primeira partição
    const currentSchema = dataRecords[0].schema as {
      columns: Array<{
        name: string;
        type: string;
        default: unknown;
        required: boolean;
      }>;
    };

    // Verificar se a coluna antiga existe
    const columnIndex = currentSchema.columns.findIndex(
      (col) => col.name === oldColumnName,
    );

    if (columnIndex === -1) {
      return {
        success: false,
        message: 'Coluna não encontrada',
        code: 404,
      };
    }

    // Verificar se o novo nome já existe
    const newNameExists = currentSchema.columns.some(
      (col) => col.name === newColumnName,
    );

    if (newNameExists) {
      return {
        success: false,
        message: 'Já existe uma coluna com esse nome',
        code: 409,
      };
    }

    // Atualizar schema
    const updatedSchema = {
      columns: currentSchema.columns.map((col) =>
        col.name === oldColumnName ? { ...col, name: newColumnName } : col,
      ),
    };

    // Atualizar todas as partições
    for (const record of dataRecords) {
      const data = record.data as Array<Record<string, unknown>>;

      // Renomear a propriedade em todos os registros
      const updatedData = data.map((row) => {
        const newRow = { ...row };
        if (oldColumnName in newRow) {
          newRow[newColumnName] = newRow[oldColumnName];
          delete newRow[oldColumnName];
        }
        return newRow;
      });

      // Atualizar a partição
      await prisma.dataTable.update({
        where: { id: record.id },
        data: {
          schema: updatedSchema as Prisma.InputJsonValue,
          data: updatedData as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      message: 'Coluna renomeada com sucesso',
      code: 200,
    };
  } catch (error) {
    console.error('Error renaming column:', error);
    return {
      success: false,
      message: 'Erro ao renomear coluna',
      code: 500,
    };
  }
}

export async function deleteColumn(
  tableName: string,
  columnName: string,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Buscar todas as partições da tabela
    const dataRecords = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
    });

    if (dataRecords.length === 0) {
      return {
        success: false,
        message: 'Tabela não encontrada',
        code: 404,
      };
    }

    // Obter schema atual da primeira partição
    const currentSchema = dataRecords[0].schema as {
      columns: Array<{
        name: string;
        type: string;
        default: unknown;
        required: boolean;
      }>;
    };

    // Verificar se a coluna existe
    const columnExists = currentSchema.columns.some(
      (col) => col.name === columnName,
    );

    if (!columnExists) {
      return {
        success: false,
        message: 'Coluna não encontrada',
        code: 404,
      };
    }

    // Verificar se é a última coluna
    if (currentSchema.columns.length === 1) {
      return {
        success: false,
        message: 'Não é possível excluir a última coluna da tabela',
        code: 400,
      };
    }

    // Atualizar schema (remover coluna)
    const updatedSchema = {
      columns: currentSchema.columns.filter((col) => col.name !== columnName),
    };

    // Atualizar todas as partições
    for (const record of dataRecords) {
      const data = record.data as Array<Record<string, unknown>>;

      // Remover a propriedade de todos os registros
      const updatedData = data.map((row) => {
        const newRow = { ...row };
        delete newRow[columnName];
        return newRow;
      });

      // Atualizar a partição
      await prisma.dataTable.update({
        where: { id: record.id },
        data: {
          schema: updatedSchema as Prisma.InputJsonValue,
          data: updatedData as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      message: 'Coluna excluída com sucesso',
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting column:', error);
    return {
      success: false,
      message: 'Erro ao excluir coluna',
      code: 500,
    };
  }
}

export async function reorderColumns(
  tableName: string,
  newColumnOrder: Array<{
    name: string;
    type: string;
    default: unknown;
    required: boolean;
  }>,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Buscar todas as partições da tabela
    const dataRecords = await prisma.dataTable.findMany({
      where: {
        userId,
        tableName,
      },
    });

    if (dataRecords.length === 0) {
      return {
        success: false,
        message: 'Tabela não encontrada',
        code: 404,
      };
    }

    // Atualizar schema com a nova ordem
    const updatedSchema = {
      columns: newColumnOrder,
    };

    // Atualizar todas as partições
    for (const record of dataRecords) {
      const data = record.data as Array<Record<string, unknown>>;

      // Reordenar as propriedades de cada registro
      const reorderedData = data.map((row) => {
        const newRow: Record<string, unknown> = {};
        newColumnOrder.forEach((col) => {
          newRow[col.name] = row[col.name];
        });
        // Manter campos do sistema
        newRow._id = row._id;
        newRow._createdAt = row._createdAt;
        newRow._updatedAt = row._updatedAt;
        return newRow;
      });

      // Atualizar a partição
      await prisma.dataTable.update({
        where: { id: record.id },
        data: {
          schema: updatedSchema as Prisma.InputJsonValue,
          data: reorderedData as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      message: 'Colunas reordenadas com sucesso',
      code: 200,
    };
  } catch (error) {
    console.error('Error reordering columns:', error);
    return {
      success: false,
      message: 'Erro ao reordenar colunas',
      code: 500,
    };
  }
}

export async function renameTable(
  oldTableName: string,
  newTableName: string,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Validar novo nome da tabela
    if (!newTableName || !/^[a-zA-Z0-9_-]+$/.test(newTableName)) {
      return {
        success: false,
        message: 'Nome de tabela inválido. Use apenas letras, números, _ e -',
        code: 400,
      };
    }

    // Verificar se a tabela antiga existe
    const oldTableExists = await prisma.dataTable.findFirst({
      where: {
        userId,
        tableName: oldTableName,
      },
    });

    if (!oldTableExists) {
      return {
        success: false,
        message: 'Tabela não encontrada',
        code: 404,
      };
    }

    // Verificar se o novo nome já existe
    const newTableExists = await prisma.dataTable.findFirst({
      where: {
        userId,
        tableName: newTableName,
      },
    });

    if (newTableExists) {
      return {
        success: false,
        message: 'Já existe uma tabela com esse nome',
        code: 409,
      };
    }

    // Renomear todas as partições da tabela
    await prisma.dataTable.updateMany({
      where: {
        userId,
        tableName: oldTableName,
      },
      data: {
        tableName: newTableName,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Tabela renomeada com sucesso',
      code: 200,
    };
  } catch (error) {
    console.error('Error renaming table:', error);
    return {
      success: false,
      message: 'Erro ao renomear tabela',
      code: 500,
    };
  }
}

export async function deleteTable(
  tableName: string,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();

    if (!userId) {
      return {
        success: false,
        message: 'Unauthorized',
        code: 401,
      };
    }

    // Verificar se a tabela existe
    const tableExists = await prisma.dataTable.findFirst({
      where: {
        userId,
        tableName,
      },
    });

    if (!tableExists) {
      return {
        success: false,
        message: 'Tabela não encontrada',
        code: 404,
      };
    }

    // Deletar todas as partições da tabela
    await prisma.dataTable.deleteMany({
      where: {
        userId,
        tableName,
      },
    });

    return {
      success: true,
      message: 'Tabela deletada com sucesso',
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting table:', error);
    return {
      success: false,
      message: 'Erro ao deletar tabela',
      code: 500,
    };
  }
}

/**
 * Verifica se há duplicatas em uma coluna
 * Usado ao ativar constraint UNIQUE
 */
export async function checkDuplicatesForUniqueColumn(
  tableName: string,
  columnName: string,
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return { success: false, message: 'Unauthorized', code: 401 };
    }

    const { DatabaseService } = await import(
      '@/services/database/database.service'
    );
    const service = new DatabaseService();
    const duplicates = await service.findDuplicatesForUniqueColumn(
      userId,
      tableName,
      columnName,
    );

    return {
      success: true,
      data: duplicates,
      code: 200,
    };
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return {
      success: false,
      message: String(error),
      code: 500,
    };
  }
}

/**
 * Remove registros duplicados de uma coluna
 * Usado ao ativar constraint UNIQUE após confirmação do usuário
 */
export async function removeDuplicates(
  tableName: string,
  columnName: string,
  idsToRemove: string[],
): Promise<DatabaseResponse> {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return { success: false, message: 'Unauthorized', code: 401 };
    }

    const { DatabaseService } = await import(
      '@/services/database/database.service'
    );
    const service = new DatabaseService();

    // Deletar cada ID duplicado
    for (const id of idsToRemove) {
      await service.deleteRecords(userId, tableName, {
        condition: 'AND',
        rules: [{ field: '_id', operator: 'equals', value: id }],
      });
    }

    return {
      success: true,
      message: `${idsToRemove.length} registros duplicados removidos`,
      code: 200,
    };
  } catch (error) {
    console.error('Error removing duplicates:', error);
    return {
      success: false,
      message: String(error),
      code: 500,
    };
  }
}
