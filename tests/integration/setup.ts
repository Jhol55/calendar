// ============================================
// SETUP UNIFICADO PARA TESTES DE INTEGRAÇÃO
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

// Configurar Redis para usar porta de teste ANTES de qualquer import
process.env.REDIS_PORT = '6380';

// Aumentar concurrency do worker para testes
process.env.WEBHOOK_CONCURRENCY = '50';

// Importar o webhook worker para iniciar o processamento
import '@/workers/webhook-worker';

console.log('🚀 Webhook worker carregado globalmente para testes');

import { cleanDatabase, closeDatabaseConnection } from '../helpers/database';
import { cleanQueue, createTestUser } from '../helpers/workflow';

// ============================================
// RE-EXPORT: Database Helpers
// ============================================
export {
  createTestService,
  createTestServiceWithConfig,
  generateStringUserId, // string - para database
  expectErrorCode,
  executeInParallel,
  generateMultipleUsers,
  mockDatabaseError,
} from '../helpers/database';

// ============================================
// RE-EXPORT: Workflow Helpers
// ============================================
export {
  cleanDatabase,
  cleanQueue,
  createTestFlow,
  getFlowExecution,
  getNodeExecutions,
  getNodeOutput,
  generateTestId,
  generateNumericUserId, // number - para workflows
  createTestUser,
  countExecutions,
  getQueueJobCounts,
  closeDatabaseConnection,
  createEdge,
  simpleFlow,
  memoryFlow,
  conditionalFlow,
} from '../helpers/workflow';

// ============================================
// RE-EXPORT: Webhook Helpers
// ============================================
export {
  createWebhookNode,
  addWebhookJob,
  triggerAndWait,
  waitForJobCompletion,
  getJobResult,
  getJobState,
  validateWebhookPayload,
  generateWebhookPayload,
  waitForMultipleJobs,
  calculateJobDuration,
  generateLargePayload,
  generateNestedPayload,
  getPayloadSize,
  createWebhookRequestId,
  simulateSlowWebhook,
} from '../helpers/webhook';

export type {
  WebhookTestResult,
  TriggerOptions,
  PayloadValidationResult,
  PayloadValidationOptions,
} from '../helpers/webhook';

/**
 * Mock da configuração do banco de dados otimizada para testes
 * Valores ajustados para permitir testes de stress realistas
 */
jest.mock('@/config/database.config', () => ({
  DATABASE_CONFIG: {
    MAX_PARTITION_SIZE: 50,
    MAX_PARTITIONS_PER_TABLE: 20,
    MAX_TABLES_PER_USER: 10,
    BATCH_SIZE: 10,
    BATCH_DELAY: 0,
    MAX_EXECUTION_TIME: 120000,
    DEFAULT_QUERY_LIMIT: 10000,
    MAX_QUERY_LIMIT: 10000,
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
 * Timeout padrão para testes de webhook (10 segundos)
 */
export const DEFAULT_WEBHOOK_TIMEOUT = 10000;

/**
 * Timeout para testes de stress (30 segundos)
 */
export const STRESS_TEST_TIMEOUT = 30000;

/**
 * Contexto global de teste
 * Contém dados compartilhados entre testes (como userId)
 */
export const testContext: { userId?: number } = {};

/**
 * Setup executado uma vez antes de todos os testes de workflow/nodes
 * Cria um usuário de teste que será reutilizado
 */
beforeAll(async () => {
  const testPath = (expect.getState().testPath || '').replace(/\\/g, '/');

  if (testPath.includes('/workflow/') || testPath.includes('/nodes/')) {
    testContext.userId = await createTestUser();
  }
});

/**
 * Setup global executado antes de CADA teste
 * Limpa o ambiente de acordo com o tipo de teste
 */
beforeEach(async () => {
  const testPath = (expect.getState().testPath || '').replace(/\\/g, '/');

  // Determinar tipo de teste baseado no caminho
  if (testPath.includes('/database/')) {
    // 🗄️  Testes de Database: apenas limpar banco
    await cleanDatabase();
  } else if (testPath.includes('/nodes/')) {
    // 🔌 Testes de TODOS os Nodes: limpar banco + fila (usuário já criado no beforeAll)
    await cleanDatabase();
    await cleanQueue();
  } else if (testPath.includes('/workflow/')) {
    // 🔄 Testes de Workflow: limpar banco + fila (usuário já criado no beforeAll)
    await cleanDatabase();
    await cleanQueue();
  }
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
afterEach(async () => {
  // Limpar qualquer timer/interval que possa ter sido criado
  jest.clearAllTimers();
});
