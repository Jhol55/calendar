'use server';

import { prisma } from '@/services/prisma';
import { getSession } from '@/utils/security/session';
import { DATABASE_NODE_CONFIG } from '@/config/database-node.config';
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

    return {
      success: true,
      message: 'Table data loaded successfully',
      code: 200,
      data: {
        data: allData,
        schema,
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

    // Encontrar a partição que contém o registro
    for (const record of dataRecords) {
      const data = record.data as Array<Record<string, unknown>>;
      const rowIndex = data.findIndex((row) => row._id === rowId);

      if (rowIndex !== -1) {
        // Atualizar o registro
        data[rowIndex][column] = value;
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

    // Buscar a partição ativa (não cheia)
    const activePartition = await prisma.dataTable.findFirst({
      where: {
        userId,
        tableName,
        isFull: false,
      },
      orderBy: {
        partition: 'desc',
      },
    });

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

    // Adicionar novo registro
    currentData.push(data);

    // Verificar se atingiu o limite
    const isFull =
      currentData.length >= DATABASE_NODE_CONFIG.MAX_PARTITION_SIZE;

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

    if (tableCount >= DATABASE_NODE_CONFIG.MAX_TABLES_PER_USER) {
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
