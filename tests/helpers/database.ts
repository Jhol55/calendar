// ============================================
// HELPER FUNCTIONS PARA TESTES DE DATABASE
// ============================================
// Funções específicas para testes do DatabaseService

import { DatabaseService } from '@/services/database/database.service';
import type { DatabaseNodeConfigType } from '@/config/database.config';

/**
 * Factory: Cria uma nova instância isolada do DatabaseService
 */
export function createTestService(): DatabaseService {
  return new DatabaseService();
}

/**
 * Factory: Cria uma nova instância com configuração customizada
 * Útil para testar comportamentos específicos (ex: rate limiting com limite baixo)
 */
export function createTestServiceWithConfig(
  config: Partial<DatabaseNodeConfigType>,
): DatabaseService {
  return new DatabaseService(config);
}

/**
 * Gera um userId único para testes de database (formato string)
 */
export function generateStringUserId(): string {
  return `test-user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// ============================================
// RE-EXPORT: Funções de workflow.ts
// ============================================
export {
  cleanDatabase,
  cleanQueue,
  closeDatabaseConnection,
  expectErrorCode,
} from './workflow';

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
 * Criar múltiplos usuários de teste (string IDs para database)
 */
export function generateMultipleUsers(count: number): string[] {
  return Array.from({ length: count }, () => generateStringUserId());
}

/**
 * Mock de erro controlado no DatabaseService
 * @returns SpyInstance que pode ser restaurado com .mockRestore()
 */
export function mockDatabaseError(
  service: DatabaseService,
  method: keyof DatabaseService,
  errorMessage: string,
): jest.SpyInstance {
  const error = new Error(errorMessage) as Error & { code: string };
  error.code = 'MOCK_ERROR';

  return jest.spyOn(service, method).mockRejectedValueOnce(error);
}
