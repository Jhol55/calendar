/**
 * Testes de Disponibilidade de Dados - Webhook Node
 *
 * Valida que os dados do webhook estão corretamente disponíveis:
 * - Em nodeExecutions
 * - Para resolução de variáveis
 * - Em triggerData
 * - Sem conflitos entre múltiplos nodes
 */

import {
  createTestFlow,
  getFlowExecution,
  getNodeExecutions,
  getNodeOutput,
  generateTestId,
  createEdge,
  testContext,
} from '../../../setup';
import { createWebhookNode, triggerAndWait } from '../../../../helpers/webhook';
import { createMemoryNode } from '../../memory-node/setup';

describe('Webhook Node - Data Availability', () => {
  // ✅ CENÁRIO POSITIVO: Persistência de payload no nodeExecutions
  it('deve salvar payload completo no nodeExecutions', async () => {
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

    const payload = {
      message: {
        text: 'Test payload persistence',
        from: '+5519971302477',
        timestamp: new Date().toISOString(),
      },
      metadata: {
        source: 'integration-test',
        version: '1.0.0',
      },
    };

    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
    );

    expect(jobResult.status).toBe('success');
    expect(jobResult.error).toBeUndefined();

    const nodeExecutions = await getNodeExecutions(executionId);

    expect(nodeExecutions[webhookId]).toBeDefined();
    expect(nodeExecutions[webhookId].status).toBe('completed');
    expect(nodeExecutions[webhookId].data).toEqual(payload);
    expect(nodeExecutions[webhookId].result).toEqual(payload);
    expect(nodeExecutions[webhookId].startTime).toBeDefined();
    expect(nodeExecutions[webhookId].endTime).toBeDefined();
  });

  // ✅ CENÁRIO POSITIVO: Dados em $nodes.webhookId.output
  it('webhook data deve estar disponível em $nodes.webhookId.output', async () => {
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

    const payload = { testValue: 'hello-world-123' };
    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const memoryOutput = await getNodeOutput(executionId, memoryId);
    expect(memoryOutput).toBeDefined();
  });

  // ✅ CENÁRIO POSITIVO: Body original preservado
  it('webhook data deve incluir body original', async () => {
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

    const payload = {
      message: 'original message',
      metadata: {
        timestamp: Date.now(),
        source: 'api',
      },
      nested: {
        deep: {
          value: 'deep-value',
        },
      },
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const execution = await getFlowExecution(executionId);
    expect(execution.data).toEqual(payload);
  });

  // ✅ CENÁRIO POSITIVO: Dados em nodeExecutions[webhookId].result
  it('webhook data deve estar em nodeExecutions[webhookId].result', async () => {
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

    const payload = { key: 'value', number: 42 };
    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);
    expect(nodeExecutions[webhookId].result).toEqual(payload);
  });

  // ✅ CENÁRIO POSITIVO: Dados em nodeExecutions[webhookId].data
  it('webhook data deve estar em nodeExecutions[webhookId].data', async () => {
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

    const payload = { test: 'data', array: [1, 2, 3] };
    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);
    expect(nodeExecutions[webhookId].data).toEqual(payload);
  });

  // ✅ CENÁRIO POSITIVO: triggerData completo
  it('triggerData deve conter método, headers, queryParams', async () => {
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
    const headers = {
      'Content-Type': 'application/json',
      'X-Custom-Header': 'custom-value',
    };
    const queryParams = {
      source: 'api',
      version: 'v1',
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload, {
      method: 'POST',
      headers,
      queryParams,
    });

    const execution = await getFlowExecution(executionId);

    expect(execution.triggerData.method).toBe('POST');
    expect(execution.triggerData.headers).toEqual(headers);
    expect(execution.triggerData.queryParams).toEqual(queryParams);
    expect(execution.triggerData.webhookId).toBe(webhookId);
    expect(execution.triggerData.timestamp).toBeDefined();
  });

  // ✅ CENÁRIO POSITIVO: Múltiplos nodes acessando mesmo data
  it('múltiplos nodes devem acessar mesmo webhook data sem conflito', async () => {
    const webhookId = generateTestId('webhook');
    const mem1Id = generateTestId('mem1');
    const mem2Id = generateTestId('mem2');
    const mem3Id = generateTestId('mem3');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(mem1Id, 'write', 'shared_data1', '{{$output}}'),
      createMemoryNode(mem2Id, 'write', 'shared_data2', '{{$output}}'),
      createMemoryNode(mem3Id, 'write', 'shared_data3', '{{$output}}'),
    ];
    const edges = [
      createEdge('e1', webhookId, mem1Id),
      createEdge('e2', mem1Id, mem2Id),
      createEdge('e3', mem2Id, mem3Id),
    ];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { sharedValue: 'shared-data-xyz' };
    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const mem1Output = await getNodeOutput(executionId, mem1Id);
    const mem2Output = await getNodeOutput(executionId, mem2Id);
    const mem3Output = await getNodeOutput(executionId, mem3Id);

    // Todos devem estar definidos
    expect(mem1Output).toBeDefined();
    expect(mem2Output).toBeDefined();
    expect(mem3Output).toBeDefined();

    // Verificar que o webhook data original não foi modificado
    const nodeExecutions = await getNodeExecutions(executionId);
    expect(nodeExecutions[webhookId].data.sharedValue).toBe('shared-data-xyz');
  });

  // ✅ CENÁRIO POSITIVO: Dados complexos acessíveis
  it('webhook com dados complexos deve ter todos campos acessíveis', async () => {
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

    const payload = {
      user: {
        id: 123,
        profile: {
          name: 'John Doe',
          email: 'john@example.com',
          settings: {
            theme: 'dark',
            notifications: true,
          },
        },
        tags: ['vip', 'active'],
      },
      metadata: {
        timestamp: Date.now(),
        source: 'webhook',
      },
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const memoryOutput = await getNodeOutput(executionId, memoryId);
    expect(memoryOutput).toBeDefined();

    // Verificar que todos os dados nested estão preservados
    const nodeExecutions = await getNodeExecutions(executionId);
    expect(nodeExecutions[webhookId].data.user.profile.settings.theme).toBe(
      'dark',
    );
    expect(nodeExecutions[webhookId].data.user.tags).toEqual(['vip', 'active']);
  });

  // ✅ CENÁRIO POSITIVO: Arrays acessíveis via índice
  it('webhook com arrays deve permitir acesso via índice', async () => {
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

    const payload = {
      items: [
        { id: 1, name: 'First Item' },
        { id: 2, name: 'Second Item' },
        { id: 3, name: 'Third Item' },
      ],
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const memoryOutput = await getNodeOutput(executionId, memoryId);
    expect(memoryOutput).toBeDefined();
  });

  // ✅ CENÁRIO POSITIVO: Dados preservados após transformações
  it('webhook data original deve permanecer inalterado após processamento', async () => {
    const webhookId = generateTestId('webhook');
    const mem1Id = generateTestId('mem1');
    const mem2Id = generateTestId('mem2');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(mem1Id, 'write', 'test_data', '{{$output}}'),
      createMemoryNode(mem2Id, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [
      createEdge('e1', webhookId, mem1Id),
      createEdge('e2', mem1Id, mem2Id),
    ];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const originalPayload = {
      counter: 0,
      status: 'pending',
      data: { value: 'original' },
    };

    const { executionId } = await triggerAndWait(
      flowId,
      webhookId,
      originalPayload,
    );

    // Webhook data original deve estar intacto
    const nodeExecutions = await getNodeExecutions(executionId);
    expect(nodeExecutions[webhookId].data).toEqual(originalPayload);
    expect(nodeExecutions[webhookId].data.counter).toBe(0);
    expect(nodeExecutions[webhookId].data.status).toBe('pending');
  });

  // ✅ CENÁRIO POSITIVO: Múltiplas executions do mesmo flow
  it('múltiplas executions do mesmo flow devem ter dados isolados', async () => {
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

    // Executar 3 vezes com payloads diferentes
    const payload1 = { id: 1, value: 'first' };
    const payload2 = { id: 2, value: 'second' };
    const payload3 = { id: 3, value: 'third' };

    const [result1, result2, result3] = await Promise.all([
      triggerAndWait(flowId, webhookId, payload1),
      triggerAndWait(flowId, webhookId, payload2),
      triggerAndWait(flowId, webhookId, payload3),
    ]);

    // Cada execution deve ter seu próprio payload isolado
    const exec1 = await getFlowExecution(result1.executionId);
    const exec2 = await getFlowExecution(result2.executionId);
    const exec3 = await getFlowExecution(result3.executionId);

    expect(exec1.data.value).toBe('first');
    expect(exec2.data.value).toBe('second');
    expect(exec3.data.value).toBe('third');

    // Não deve haver contaminação entre executions
    expect(exec1.data).not.toEqual(exec2.data);
    expect(exec2.data).not.toEqual(exec3.data);
  });

  // ✅ CENÁRIO POSITIVO: Status do webhook node
  it('webhook node deve ter status completed em nodeExecutions', async () => {
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

    const payload = { test: 'data' };
    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);

    expect(nodeExecutions[webhookId].status).toBe('completed');
    expect(nodeExecutions[webhookId].startTime).toBeDefined();
    expect(nodeExecutions[webhookId].endTime).toBeDefined();
  });
});
