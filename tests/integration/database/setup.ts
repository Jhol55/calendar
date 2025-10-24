// ============================================
// SETUP PARA TESTES DE INTEGRAÇÃO
// ============================================

import { prisma } from '@/services/prisma';
import { DatabaseNodeService } from '@/services/database/database.service';
import type { DatabaseNodeConfigType } from '@/config/database.config';

/**
 * Mock da configuração do banco de dados com valores reduzidos para testes
 */
jest.mock('@/config/database.config', () => ({
  DATABASE_CONFIG: {
    MAX_PARTITION_SIZE: 5,
    MAX_PARTITIONS_PER_TABLE: 3,
    MAX_TABLES_PER_USER: 2,
    BATCH_SIZE: 2,
    BATCH_DELAY: 0,
    MAX_EXECUTION_TIME: 5000,
    DEFAULT_QUERY_LIMIT: 100,
    MAX_QUERY_LIMIT: 1000,
    MAX_PARTITIONS_TO_SCAN: 100,
    RATE_LIMIT_MAX_OPS: 1000000,
    RATE_LIMIT_WINDOW_MS: 60 * 60 * 1000,
    CACHE_ACTIVE_PARTITION: false,
    PARALLEL_QUERY_PARTITIONS: false,
    AUTO_COMPRESS_FULL_PARTITIONS: false,
    STRICT_TYPE_VALIDATION: true,
  },
}));

/**
 * Factory: Cria uma nova instância isolada do DatabaseNodeService
 */
export function createTestService(): DatabaseNodeService {
  return new DatabaseNodeService();
}

/**
 * Factory: Cria uma nova instância com configuração customizada
 * Útil para testar comportamentos específicos (ex: rate limiting com limite baixo)
 */
export function createTestServiceWithConfig(
  config: Partial<DatabaseNodeConfigType>,
): DatabaseNodeService {
  return new DatabaseNodeService(config);
}

/**
 * Limpa todas as tabelas do banco de dados de teste
 */
export async function cleanDatabase(): Promise<void> {
  try {
    await prisma.dataTable.deleteMany({});
    console.log('✅ Banco de dados limpo');
  } catch (error) {
    console.error('❌ Erro ao limpar banco:', error);
    throw error;
  }
}

/**
 * Disconnect do Prisma ao finalizar todos os testes
 */
export async function closeDatabaseConnection(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Gera um userId único para testes
 */
export function generateTestUserId(): string {
  return `test-user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Helper para validar código de erro
 */
export async function expectErrorCode(
  promise: Promise<any>,
  expectedCode: string,
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject but it resolved');
  } catch (error: any) {
    expect(error.code).toBe(expectedCode);
  }
}

/**
 * Setup global executado antes de cada teste
 */
beforeEach(async () => {
  await cleanDatabase();
});

/**
 * Teardown global executado após cada suite de testes
 * IMPORTANTE: Cada arquivo de teste precisa fechar suas conexões
 */
afterAll(async () => {
  await closeDatabaseConnection();
});

/**
 * Garantir que processos não fiquem pendurados
 */
afterEach(() => {
  // Limpar qualquer timer/interval que possa ter sido criado
  jest.clearAllTimers();
});
