// ============================================
// HELPER FUNCTIONS PARA TESTES DE SQL ENGINE
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { sqlEngine } from '@/services/database/sql-engine.service';
import { prisma } from '@/services/prisma';

/**
 * Tipos e Interfaces
 */
export interface PostgresSnapshot {
  tableNames: string[];
  dataTableCount: number;
}

export interface TestUser {
  userId: string;
  cleanup: () => Promise<void>;
}

/**
 * Gera um userId de teste único
 */
export function generateTestUserId(): string {
  return `test_sql_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Captura snapshot do estado do PostgreSQL
 * Para validar que operações SQL não afetam o banco real
 */
export async function capturePostgresSnapshot(): Promise<PostgresSnapshot> {
  // Capturar todas as tabelas do schema public
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  // Capturar metadados das DataTables (tabelas virtuais JSONB)
  const dataTableCount = await prisma.dataTable.count();

  return {
    tableNames: tables.map((t) => t.table_name),
    dataTableCount,
  };
}

/**
 * Compara dois snapshots do PostgreSQL
 * Garante que o banco real não foi modificado
 */
export function compareSnapshots(
  before: PostgresSnapshot,
  after: PostgresSnapshot,
): void {
  // Validar que nenhuma tabela PostgreSQL foi criada/deletada
  expect(before.tableNames.sort()).toEqual(after.tableNames.sort());
}

/**
 * Executa SQL via SqlEngine
 * Extrai automaticamente o array de dados da resposta { data: [...], success: true }
 */
/**
 * Converte undefined para null em objetos (para compatibilidade SQL)
 */
function convertUndefinedToNull(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertUndefinedToNull(item));
  }
  if (obj && typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] =
        value === undefined ? null : convertUndefinedToNull(value);
    }
    return converted;
  }
  return obj === undefined ? null : obj;
}

export async function executeSql(
  userId: string,
  sql: string,
  variables?: Record<string, any>,
): Promise<any> {
  const result = await sqlEngine.execute(sql, userId, variables);

  // Se o resultado indica erro, lançar exceção
  if (
    result &&
    typeof result === 'object' &&
    'success' in result &&
    result.success === false
  ) {
    throw new Error(result.error || 'SQL execution failed');
  }

  // Se o resultado tem a estrutura { data, success }, extrair apenas data
  let data;
  if (result && typeof result === 'object' && 'data' in result) {
    data = result.data;
  } else {
    data = result;
  }

  // Converter undefined para null (para compatibilidade SQL)
  return convertUndefinedToNull(data);
}

/**
 * Cria usuário de teste com função de cleanup
 */
export async function setupTestUser(): Promise<TestUser> {
  const userId = generateTestUserId();

  const cleanup = async () => {
    try {
      // Aguardar um pouco para garantir que todas as operações assíncronas terminaram
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Limpar todas as DataTables do usuário
      await prisma.dataTable.deleteMany({
        where: { userId },
      });
    } catch (error: any) {
      // Ignorar erros de cleanup (Prisma connection issues em testes paralelos)
      console.warn(`⚠️  Cleanup warning for user ${userId}:`, error.message);
    }
  };

  return { userId, cleanup };
}

/**
 * Verifica se uma tabela virtual existe para o usuário
 */
export async function tableExists(
  userId: string,
  tableName: string,
): Promise<boolean> {
  const count = await prisma.dataTable.count({
    where: { userId, tableName },
  });
  return count > 0;
}

/**
 * Conta quantos registros existem em uma tabela virtual
 */
export async function countRecords(
  userId: string,
  tableName: string,
): Promise<number> {
  const partitions = await prisma.dataTable.findMany({
    where: { userId, tableName },
    select: { data: true },
  });

  let total = 0;
  for (const partition of partitions) {
    total += (partition.data as any[]).length;
  }
  return total;
}

/**
 * Obtém todos os registros de uma tabela virtual
 */
export async function getAllRecords(
  userId: string,
  tableName: string,
): Promise<any[]> {
  const partitions = await prisma.dataTable.findMany({
    where: { userId, tableName },
    select: { data: true, schema: true },
    orderBy: { partition: 'asc' },
  });

  const allRecords: any[] = [];

  // Obter schema da partição 0 (principal)
  const schemaPartition = partitions.find((p) => p.schema);
  const schema = schemaPartition?.schema as any;
  const columnNames = schema?.columns?.map((c: any) => c.name) || [];

  for (const partition of partitions) {
    const records = partition.data as any[];
    // Garantir que todos os registros tenham todas as colunas (com null se ausente)
    const normalizedRecords = records.map((record) => {
      const normalized: any = { ...record };
      for (const colName of columnNames) {
        if (!(colName in normalized)) {
          normalized[colName] = null;
        }
      }
      return normalized;
    });
    allRecords.push(...normalizedRecords);
  }

  // Converter undefined para null
  return convertUndefinedToNull(allRecords);
}

/**
 * Obtém o schema de uma tabela virtual
 */
export async function getTableSchema(
  userId: string,
  tableName: string,
): Promise<any> {
  const table = await prisma.dataTable.findFirst({
    where: { userId, tableName },
    select: { schema: true },
  });

  return table?.schema || null;
}

/**
 * Expectativa: operação SQL deve falhar
 */
export async function expectSqlError(
  userId: string,
  sql: string,
  expectedMessagePattern?: string | RegExp,
): Promise<void> {
  await expect(executeSql(userId, sql)).rejects.toThrow(expectedMessagePattern);
}

/**
 * Expectativa: operação SQL deve ter sucesso
 */
export async function expectSqlSuccess(
  userId: string,
  sql: string,
  variables?: Record<string, any>,
): Promise<any> {
  const result = await executeSql(userId, sql, variables);
  expect(result).toBeDefined();
  return result;
}

/**
 * Helper para criar tabela de teste
 */
export async function createTestTable(
  userId: string,
  tableName: string,
  columns: string = 'id INT, name VARCHAR(100)',
): Promise<void> {
  await executeSql(userId, `CREATE TABLE ${tableName} (${columns})`);
}

/**
 * Helper para inserir dados de teste
 */
export async function insertTestData(
  userId: string,
  tableName: string,
  values: string,
): Promise<void> {
  await executeSql(userId, `INSERT INTO ${tableName} VALUES ${values}`);
}
