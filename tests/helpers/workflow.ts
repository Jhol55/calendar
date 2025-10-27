// ============================================
// HELPER FUNCTIONS PARA TESTES DE WORKFLOW
// ============================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from '@/services/prisma';
import { webhookQueue } from '@/services/queue';

/**
 * Limpa o banco de dados de teste
 * ✅ OTIMIZAÇÃO: Usa Promise.all para executar deleteMany em paralelo
 */
export async function cleanDatabase(): Promise<void> {
  try {
    const startTime = Date.now();

    // Executar todas as limpezas em paralelo ao invés de sequencial
    await Promise.all([
      prisma.flow_executions.deleteMany({}),
      prisma.chatbot_flows.deleteMany({}),
      prisma.chatbot_memories.deleteMany({}),
      prisma.dataTable.deleteMany({}),
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ Banco de dados limpo em ${duration}ms`);
  } catch (error) {
    console.error('❌ Erro ao limpar banco:', error);
    throw error;
  }
}

/**
 * Limpa a fila de testes
 * Se o Redis não estiver disponível, apenas ignora
 * ✅ OTIMIZAÇÃO: Executa operações em paralelo
 */
export async function cleanQueue(): Promise<void> {
  try {
    const startTime = Date.now();

    // Executar todas as limpezas em paralelo
    await Promise.all([
      webhookQueue.empty(),
      webhookQueue.clean(0, 'completed'),
      webhookQueue.clean(0, 'failed'),
      webhookQueue.clean(0, 'delayed'),
      webhookQueue.clean(0, 'active'),
      webhookQueue.clean(0, 'wait'),
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ Fila limpa em ${duration}ms`);
  } catch {
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
 * Gera um ID de teste único (string com prefixo)
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Gera um userId de teste do tipo NUMBER (para workflows)
 */
export function generateNumericUserId(): number {
  return Math.floor(Math.random() * 1000000);
}

/**
 * Cria um usuário real no banco de dados para testes
 * @returns O ID (number) do usuário criado
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
 * Conta o número total de executions no banco
 */
export async function countExecutions(): Promise<number> {
  return await prisma.flow_executions.count();
}

/**
 * Conta o número de jobs na fila por status
 */
export async function getQueueJobCounts(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  return await webhookQueue.getJobCounts();
}

/**
 * Disconnect do Prisma e fecha a fila
 */
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await webhookQueue.close();
  } catch {
    // Ignorar erro se Redis não estiver disponível
    console.log('⚠️  Fila já estava fechada ou não conectada');
  }
  await prisma.$disconnect();
}

/**
 * Cria uma edge (conexão) entre nodes
 */
export function createEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
): any {
  return {
    id,
    source,
    target,
    ...(sourceHandle && { sourceHandle }),
  };
}

// ============================================
// FLOW FACTORIES
// ============================================
// Factory functions para criar flows de teste reutilizáveis

/**
 * Flow simples: webhook -> memory
 */
export function simpleFlow(
  webhookId: string,
  memoryId: string,
): {
  nodes: any[];
  edges: any[];
} {
  const nodes = [
    {
      id: webhookId,
      type: 'webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Webhook Trigger',
        webhookConfig: {
          url: `/webhook/test/${webhookId}`,
        },
      },
    },
    {
      id: memoryId,
      type: 'memory',
      position: { x: 0, y: 100 },
      data: {
        label: 'Save to Memory',
        memoryConfig: {
          action: 'save',
          memoryName: 'test_flow_memory',
          items: [
            {
              key: 'test_output',
              value: `{{$nodes.${webhookId}.output}}`,
            },
          ],
        },
      },
    },
  ];

  const edges = [
    {
      id: `${webhookId}-${memoryId}`,
      source: webhookId,
      target: memoryId,
    },
  ];

  return { nodes, edges };
}

/**
 * Flow com memória: webhook -> memory
 */
export function memoryFlow(
  webhookId: string,
  memoryId: string,
): {
  nodes: any[];
  edges: any[];
} {
  const nodes = [
    {
      id: webhookId,
      type: 'webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Webhook Trigger',
        webhookConfig: {
          url: `/webhook/test/${webhookId}`,
        },
      },
    },
    {
      id: memoryId,
      type: 'memory',
      position: { x: 0, y: 100 },
      data: {
        label: 'Save Memory',
        memoryConfig: {
          action: 'save',
          key: 'test_memory',
          value: '{{$output}}',
        },
      },
    },
  ];

  const edges = [
    {
      id: `${webhookId}-${memoryId}`,
      source: webhookId,
      target: memoryId,
    },
  ];

  return { nodes, edges };
}

/**
 * Flow com condição: webhook -> condition -> memory (true/false)
 */
export function conditionalFlow(
  webhookId: string,
  conditionId: string,
  memoryTrueId: string,
  memoryFalseId: string,
): {
  nodes: any[];
  edges: any[];
} {
  const nodes = [
    {
      id: webhookId,
      type: 'webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Webhook Trigger',
      },
    },
    {
      id: conditionId,
      type: 'condition',
      position: { x: 0, y: 100 },
      data: {
        label: 'Check Condition',
        conditionConfig: {
          conditions: [
            {
              field: '{{$output.value}}',
              operator: 'greater_than',
              value: '50',
            },
          ],
          operator: 'AND',
        },
      },
    },
    {
      id: memoryTrueId,
      type: 'memory',
      position: { x: -100, y: 200 },
      data: {
        label: 'Save True Branch',
        memoryConfig: {
          action: 'write',
          key: 'condition_result',
          value: 'true',
        },
      },
    },
    {
      id: memoryFalseId,
      type: 'memory',
      position: { x: 100, y: 200 },
      data: {
        label: 'Save False Branch',
        memoryConfig: {
          action: 'write',
          key: 'condition_result',
          value: 'false',
        },
      },
    },
  ];

  const edges = [
    {
      id: `${webhookId}-${conditionId}`,
      source: webhookId,
      target: conditionId,
    },
    {
      id: `${conditionId}-${memoryTrueId}`,
      source: conditionId,
      target: memoryTrueId,
      sourceHandle: 'true',
    },
    {
      id: `${conditionId}-${memoryFalseId}`,
      source: conditionId,
      target: memoryFalseId,
      sourceHandle: 'false',
    },
  ];

  return { nodes, edges };
}
