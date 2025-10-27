/**
 * Testes de Tratamento de Erros - Webhook Node
 *
 * Valida comportamento do sistema em cenários de erro:
 * - Flows inexistentes ou inválidos
 * - Nodes inválidos
 * - Erros durante execução
 * - Cleanup de recursos
 */

import {
  createTestFlow,
  getFlowExecution,
  generateTestId,
  createEdge,
  testContext,
} from '../../../setup';
import {
  createWebhookNode,
  addWebhookJob,
  triggerAndWait,
  waitForJobCompletion,
} from '../../../../helpers/webhook';
import { createMemoryNode } from '../../memory-node/setup';

describe('Webhook Node - Error Handling', () => {
  // ❌ CENÁRIO NEGATIVO: Flow inexistente
  it('webhook para flow inexistente deve retornar erro específico', async () => {
    const webhookId = generateTestId('webhook');
    const fakeFlowId = 'non-existent-flow-12345';

    const payload = { message: 'test' };

    const result = await triggerAndWait(fakeFlowId, webhookId, payload, {
      throwOnError: false,
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.error).toBe(true);
    expect(result.jobResult.message).toMatch(/not found|não encontrado/i);
  });

  // ❌ CENÁRIO NEGATIVO: FlowId inválido
  it('webhook com flowId inválido deve falhar', async () => {
    const webhookId = generateTestId('webhook');
    const invalidFlowId = '';

    const payload = { message: 'test' };

    // Job é criado mas falha na execução
    const result = await triggerAndWait(invalidFlowId, webhookId, payload, {
      throwOnError: false,
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.error).toBe(true);
  });

  // ❌ CENÁRIO NEGATIVO: NodeId inválido
  it('webhook com nodeId vazio deve processar (node é criado na execution)', async () => {
    const webhookId = '';
    const memoryId = generateTestId('memory');

    const nodes = [
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges: any[] = [];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: 'test' };

    // Com nodeId vazio, ainda cria a execution
    const result = await triggerAndWait(flowId, webhookId, payload, {
      throwOnError: false,
    });

    expect(result.executionId).toBeDefined();
  });

  // ❌ CENÁRIO NEGATIVO: Erro no meio do flow
  it('execution com erro no meio do flow deve marcar status como error', async () => {
    const webhookId = generateTestId('webhook');
    const invalidDbId = generateTestId('invalid-db');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: invalidDbId,
        type: 'database',
        data: {
          label: 'Invalid DB',
          databaseConfig: {
            operation: 'invalid-operation',
            tableId: 'fake-table',
          },
        },
      },
    ];
    const edges = [createEdge('e1', webhookId, invalidDbId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: 'test' };
    const result = await triggerAndWait(flowId, webhookId, payload, {
      throwOnError: false,
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.executionId).toBeDefined();

    const execution = await getFlowExecution(result.executionId);
    expect(execution.status).toBe('error');
  });

  // ❌ CENÁRIO NEGATIVO: Job retry desabilitado
  it('job retry deve ser desabilitado (attempts: 1)', async () => {
    const webhookId = generateTestId('webhook');
    const fakeFlowId = 'non-existent-flow';

    const payload = { message: 'test' };
    const job = await addWebhookJob(fakeFlowId, webhookId, payload);

    // Aguardar falha
    const result = await waitForJobCompletion(job.id.toString(), 10000, false);

    expect(result.status).toBe('error');

    // Verificar que o job não foi retriado (attempts === 1)
    // Bull mantém o attemptsMade no job
    expect(job.attemptsMade).toBeLessThanOrEqual(1);
  });

  // ❌ CENÁRIO NEGATIVO: Timeout limpa recursos
  it('job com timeout deve ser tratado corretamente', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: 'test' };
    const job = await addWebhookJob(flowId, webhookId, payload);

    // Tentar aguardar com timeout muito curto (1ms)
    await expect(
      waitForJobCompletion(job.id.toString(), 1, true),
    ).rejects.toThrow(/timeout/i);
  });

  // ✅ CENÁRIO POSITIVO: ExecutionId incluído em erros
  it('erro deve incluir executionId mesmo quando job falha', async () => {
    const webhookId = generateTestId('webhook');
    const invalidNodeId = generateTestId('invalid');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: invalidNodeId,
        type: 'unknown-type',
        data: { label: 'Unknown' },
      },
    ];
    const edges = [createEdge('e1', webhookId, invalidNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: 'test' };
    const result = await triggerAndWait(flowId, webhookId, payload, {
      throwOnError: false,
    });

    // Mesmo com erro, executionId deve estar presente
    expect(result.executionId).toBeDefined();
    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.error).toBe(true);
  });

  // ❌ CENÁRIO NEGATIVO: Flow inativo
  it('webhook para flow inativo deve processar normalmente (validação na API)', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
      isActive: false, // Flow inativo
    });

    const payload = { message: 'test' };

    // Flow inativo ainda processa no worker (validação de isActive é feita na API)
    const result = await triggerAndWait(flowId, webhookId, payload, {
      throwOnError: false,
    });

    expect(result.executionId).toBeDefined();
    // Worker processa normalmente, validação de isActive é responsabilidade da API
    expect(result.jobResult.status).toBe('success');
    expect(result.jobResult.error).toBeUndefined();
  });

  // ❌ CENÁRIO NEGATIVO: Payload com valores especiais (null, undefined serializado)
  it('deve processar payload com valores especiais gracefully', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    // Payload com valores que podem ser serializados
    // (undefined será removido durante JSON.stringify)
    const weirdPayload = {
      nullValue: null,
      stringValue: 'weird-value',
      emptyString: '',
      zero: 0,
      falseBool: false,
    };

    const result = await triggerAndWait(flowId, webhookId, weirdPayload, {
      throwOnError: false,
    });

    // Deve processar com sucesso
    expect(result.executionId).toBeDefined();
    expect(result.jobResult.status).toBe('success');
    expect(result.jobResult.error).toBeUndefined();
  });

  // ❌ CENÁRIO NEGATIVO: Node desconhecido deve falhar gracefully
  it('deve falhar gracefully quando node subsequente tem tipo desconhecido', async () => {
    const webhookId = generateTestId('webhook');
    const unknownNodeId = generateTestId('unknown');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: unknownNodeId,
        type: 'non-existent-node-type',
        data: {
          label: 'Unknown Node',
          config: {},
        },
      },
    ];
    const edges = [createEdge('e1', webhookId, unknownNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: 'test' };
    const result = await triggerAndWait(flowId, webhookId, payload, {
      throwOnError: false,
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toBeDefined();
    expect(result.executionId).toBeDefined();
  });

  // ❌ CENÁRIO NEGATIVO: Edges inválidos
  it('flow com edge inválido deve processar apenas nodes alcançáveis', async () => {
    const webhookId = generateTestId('webhook');
    const msg1Id = generateTestId('msg1');
    const msg2Id = generateTestId('msg2');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(msg1Id, 'write', 'test_data', '{{$output}}'),
      createMemoryNode(msg2Id, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [
      createEdge('e1', webhookId, msg1Id),
      // msg2 não está conectado - é unreachable
    ];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: 'test' };
    const result = await triggerAndWait(flowId, webhookId, payload);

    expect(result.jobResult.status).toBe('success');

    const execution = await getFlowExecution(result.executionId);

    // msg1 deve ter executado
    expect(execution.nodeExecutions[msg1Id]).toBeDefined();

    // msg2 não deve ter executado (unreachable)
    expect(execution.nodeExecutions[msg2Id]).toBeUndefined();
  });

  // ❌ CENÁRIO NEGATIVO: Múltiplos erros em sequência
  it('deve reportar primeiro erro em flow com múltiplos erros', async () => {
    const webhookId = generateTestId('webhook');
    const invalid1 = generateTestId('invalid1');
    const invalid2 = generateTestId('invalid2');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: invalid1,
        type: 'unknown-type-1',
        data: { label: 'Unknown 1' },
      },
      {
        id: invalid2,
        type: 'unknown-type-2',
        data: { label: 'Unknown 2' },
      },
    ];
    const edges = [
      createEdge('e1', webhookId, invalid1),
      createEdge('e2', invalid1, invalid2),
    ];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: 'test' };
    const result = await triggerAndWait(flowId, webhookId, payload, {
      throwOnError: false,
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toBeDefined();

    // Primeiro erro deve parar a execução
    const execution = await getFlowExecution(result.executionId);
    expect(execution.status).toBe('error');
  });

  // ❌ CENÁRIO NEGATIVO: Flow não existe
  it('deve falhar quando flow não existe', async () => {
    const webhookId = generateTestId('webhook');
    const fakeFlowId = 'non-existent-flow-id-12345';

    const payload = { message: 'test' };

    await expect(
      triggerAndWait(fakeFlowId, webhookId, payload, { throwOnError: true }),
    ).rejects.toThrow();
  });

  // ❌ CENÁRIO NEGATIVO: Webhook node não existe no flow
  it('deve processar execution mesmo sem webhook node definido no flow', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      // Não incluir o webhook node nas definições
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges: any[] = [];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: 'test' };

    // O webhook worker ainda cria a execution
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      { throwOnError: false },
    );

    expect(executionId).toBeDefined();
    // Flow sem webhook node conectado DEVE falhar - comportamento correto
    expect(jobResult.status).toBe('error');
    expect(jobResult.message).toContain('Webhook node not found');
  });
});
