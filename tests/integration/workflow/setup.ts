// ============================================
// SETUP PARA TESTES DE INTEGRAÇÃO - WEBHOOK WORKER
// ============================================

// Configurar Redis para usar porta de teste ANTES de qualquer import
process.env.REDIS_PORT = '6380';

import { prisma } from '@/services/prisma';
import { webhookQueue, addWebhookJob } from '@/services/queue';
import type { WebhookJobData } from '@/services/queue';

// Importar o webhook worker para iniciar o processamento
// Isso garante que o worker está rodando para processar os jobs de teste
import '@/workers/webhook-worker';

console.log('🚀 Webhook worker carregado globalmente para testes');

/**
 * Limpa o banco de dados de teste
 */
export async function cleanDatabase(): Promise<void> {
  try {
    await prisma.flow_executions.deleteMany({});
    await prisma.chatbot_flows.deleteMany({});
    await prisma.dataTable.deleteMany({});
    console.log('✅ Banco de dados limpo');
  } catch (error) {
    console.error('❌ Erro ao limpar banco:', error);
    throw error;
  }
}

/**
 * Limpa a fila de testes
 * Se o Redis não estiver disponível, apenas ignora
 */
export async function cleanQueue(): Promise<void> {
  try {
    await webhookQueue.empty();
    await webhookQueue.clean(0, 'completed');
    await webhookQueue.clean(0, 'failed');
    await webhookQueue.clean(0, 'delayed');
    await webhookQueue.clean(0, 'active');
    await webhookQueue.clean(0, 'wait');
    console.log('✅ Fila limpa');
  } catch (error) {
    // Ignorar erro se Redis não estiver disponível (testes de database)
    console.log('⚠️  Redis não disponível, pulando limpeza de fila');
  }
}

/**
 * Cria um flow de teste
 */
export async function createTestFlow(
  nodes: any[],
  edges: any[] = [],
  options: {
    name?: string;
    userId?: number;
    token?: string;
    isActive?: boolean;
  } = {},
): Promise<string> {
  const flow = await prisma.chatbot_flows.create({
    data: {
      name: options.name || 'Test Flow',
      description: 'Flow criado para testes',
      nodes: nodes,
      edges: edges,
      userId: options.userId || null,
      token: options.token || null,
      isActive: options.isActive !== undefined ? options.isActive : true,
    },
  });

  return flow.id;
}

/**
 * Cria um webhook node de teste
 */
export function createWebhookNode(nodeId: string, config: any = {}): any {
  return {
    id: nodeId,
    type: 'webhook',
    position: { x: 0, y: 0 },
    data: {
      label: 'Webhook Trigger',
      webhookConfig: {
        url: `/webhook/test/${nodeId}`,
        ...config,
      },
    },
  };
}

/**
 * Adiciona um job de webhook na fila de teste
 * NOTA: A execution será criada automaticamente pelo webhook-worker
 */
export async function triggerWebhook(
  flowId: string,
  nodeId: string,
  payload: any,
  options: Partial<WebhookJobData> = {},
): Promise<{ jobId: string }> {
  // Adicionar job na fila usando a função helper
  const job = await addWebhookJob({
    webhookId: `test-${Date.now()}`,
    method: 'POST',
    headers: {},
    queryParams: {},
    body: payload,
    timestamp: new Date().toISOString(),
    flowId: flowId,
    nodeId: nodeId,
    config: {},
    ...options,
  });

  return {
    jobId: String(job.id),
  };
}

/**
 * Aguarda a conclusão de um job e retorna o resultado
 */
export async function waitForJobCompletion(
  jobId: string,
  timeout: number = 10000,
): Promise<any> {
  const job = await webhookQueue.getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} não encontrado`);
  }

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const state = await job.getState();
    if (state === 'completed') {
      return await job.finished();
    }
    if (state === 'failed') {
      const failedReason = job.failedReason;
      throw new Error(`Job failed: ${failedReason}`);
    }
  }

  throw new Error(`Job ${jobId} timeout after ${timeout}ms`);
}

/**
 * Helper combinado: trigger webhook e aguarda conclusão
 */
export async function triggerAndWait(
  flowId: string,
  nodeId: string,
  payload: any,
  timeout?: number,
): Promise<{ executionId: string; jobResult: any }> {
  const { jobId } = await triggerWebhook(flowId, nodeId, payload);
  const jobResult = await waitForJobCompletion(jobId, timeout);

  return {
    executionId: jobResult.executionId,
    jobResult,
  };
}

/**
 * Obtém a execution completa
 */
export async function getFlowExecution(executionId: string): Promise<any> {
  if (!executionId) {
    throw new Error('ExecutionId is undefined or empty');
  }

  const execution = await prisma.flow_executions.findUnique({
    where: { id: executionId },
  });

  if (!execution) {
    throw new Error(`Execution ${executionId} não encontrada`);
  }

  return execution;
}

/**
 * Obtém os outputs de todos os nodes executados
 */
export async function getNodeExecutions(executionId: string): Promise<any> {
  const execution = await getFlowExecution(executionId);
  return (execution.nodeExecutions as any) || {};
}

/**
 * Obtém o output de um node específico
 */
export async function getNodeOutput(
  executionId: string,
  nodeId: string,
): Promise<any> {
  const nodeExecutions = await getNodeExecutions(executionId);
  const nodeExecution = nodeExecutions[nodeId];

  if (!nodeExecution) {
    throw new Error(`Node ${nodeId} não executado em ${executionId}`);
  }

  return nodeExecution.result || nodeExecution.data || null;
}

/**
 * Gera um ID de teste único
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Gera um userId de teste
 */
export function generateTestUserId(): number {
  return Math.floor(Math.random() * 1000000);
}

/**
 * Helper para criar um usuário de teste
 */
export async function createTestUser(): Promise<number> {
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      password: 'test123',
    },
  });

  return user.id;
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
 * Disconnect do Prisma e fecha a fila
 */
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await webhookQueue.close();
  } catch (error) {
    // Ignorar erro se Redis não estiver disponível
    console.log('⚠️  Fila já estava fechada ou não conectada');
  }
  await prisma.$disconnect();
}

// NOTA: Os hooks globais (beforeEach, afterAll) foram removidos
// Cada arquivo de teste deve gerenciar seu próprio setup/teardown
// Para usar, adicione no início do arquivo de teste:
//
// beforeEach(async () => {
//   await cleanDatabase();
//   await cleanQueue();
// });
//
afterAll(async () => {
  await closeDatabaseConnection();
});
