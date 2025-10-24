// ============================================
// SETUP PARA TESTES DE INTEGRAÇÃO
// ============================================

import { prisma } from '@/services/prisma';
import { DatabaseNodeService } from '@/services/database/database.service';
import type { DatabaseNodeConfigType } from '@/config/database.config';

/**
 * Mock da configuração do banco de dados otimizada para testes
 * Valores ajustados para permitir testes de stress realistas
 */
jest.mock('@/config/database.config', () => ({
  DATABASE_CONFIG: {
    MAX_PARTITION_SIZE: 50, // ✅ Aumentado de 5 para 50 (10x)
    MAX_PARTITIONS_PER_TABLE: 20, // ✅ Aumentado de 3 para 20 (permite até 1000 registros)
    MAX_TABLES_PER_USER: 10, // ✅ Aumentado de 2 para 10 (múltiplas tabelas por teste)
    BATCH_SIZE: 10, // ✅ Aumentado de 2 para 10 (batch processing mais eficiente)
    BATCH_DELAY: 0,
    MAX_EXECUTION_TIME: 120000, // ✅ Aumentado para 120s (testes de stress com partition locks)
    DEFAULT_QUERY_LIMIT: 10000, // ✅ Aumentado de 100 para 10000 (permite buscar grandes volumes)
    MAX_QUERY_LIMIT: 10000, // ✅ Aumentado de 1000 para 10000 (limite máximo de registros por query)
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
  promise: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject but it resolved');
  } catch (error: unknown) {
    expect((error as { code: string }).code).toBe(expectedCode);
  }
}

/**
 * Executar promises em paralelo e coletar métricas
 */
export async function executeInParallel<T>(
  operations: (() => Promise<T>)[],
  maxConcurrency?: number,
): Promise<{ results: T[]; duration: number; errors: Error[] }> {
  const start = Date.now();
  const errors: Error[] = [];
  const results: T[] = [];

  if (maxConcurrency && maxConcurrency > 0) {
    // Executar com limite de concorrência
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      const batchResults = await Promise.allSettled(batch.map((op) => op()));

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push(result.reason);
        }
      });
    }
  } else {
    // Executar todas simultaneamente
    const allResults = await Promise.allSettled(operations.map((op) => op()));

    allResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push(result.reason);
      }
    });
  }

  const duration = Date.now() - start;

  return { results, duration, errors };
}

/**
 * Criar múltiplos usuários de teste
 */
export function generateMultipleUsers(count: number): string[] {
  return Array.from({ length: count }, () => generateTestUserId());
}

/**
 * Mock de erro controlado no DatabaseNodeService
 * @returns SpyInstance que pode ser restaurado com .mockRestore()
 */
export function mockDatabaseError(
  service: DatabaseNodeService,
  method: keyof DatabaseNodeService,
  errorMessage: string,
): jest.SpyInstance {
  const error = new Error(errorMessage) as Error & { code: string };
  error.code = 'MOCK_ERROR';

  return jest.spyOn(service, method).mockRejectedValueOnce(error);
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
