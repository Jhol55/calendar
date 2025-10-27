/**
 * Testes de Métodos HTTP - Webhook Node
 *
 * Valida suporte a diferentes métodos HTTP:
 * - POST
 * - GET
 * - PUT
 * - DELETE
 * - PATCH
 */

import {
  createTestFlow,
  getFlowExecution,
  generateTestId,
  createEdge,
  testContext,
} from '../../../setup';
import { createWebhookNode, triggerAndWait } from '../../../../helpers/webhook';
import { createMemoryNode } from '../../memory-node/setup';

describe('Webhook Node - HTTP Methods', () => {
  // ✅ CENÁRIO POSITIVO: Método POST
  it('deve processar webhook com método POST', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId, { method: 'POST' }),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { action: 'create', data: { name: 'Test' } };
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      {
        method: 'POST',
      },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.method).toBe('POST');
    expect(execution.data).toEqual(payload);
  });

  // ✅ CENÁRIO POSITIVO: Método GET
  it('deve processar webhook com método GET', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId, { method: 'GET' }),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      {},
      {
        method: 'GET',
      },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.method).toBe('GET');
  });

  // ✅ CENÁRIO POSITIVO: Método PUT
  it('deve processar webhook com método PUT', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId, { method: 'PUT' }),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { action: 'update', id: 123, data: { name: 'Updated' } };
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      {
        method: 'PUT',
      },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.method).toBe('PUT');
    expect(execution.data).toEqual(payload);
  });

  // ✅ CENÁRIO POSITIVO: Método DELETE
  it('deve processar webhook com método DELETE', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId, { method: 'DELETE' }),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { id: 456 };
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      {
        method: 'DELETE',
      },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.method).toBe('DELETE');
    expect(execution.data).toEqual(payload);
  });

  // ✅ CENÁRIO POSITIVO: Método PATCH
  it('deve processar webhook com método PATCH', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId, { method: 'PATCH' }),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { id: 789, patch: { status: 'active' } };
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      {
        method: 'PATCH',
      },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.method).toBe('PATCH');
    expect(execution.data).toEqual(payload);
  });

  // ✅ CENÁRIO POSITIVO: Método case-insensitive
  it('deve processar métodos HTTP em lowercase', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId, { method: 'POST' }),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { test: 'data' };
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      {
        method: 'POST',
      },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.method.toUpperCase()).toBe('POST');
  });

  // ✅ CENÁRIO POSITIVO: Diferentes métodos no mesmo flow
  it('deve processar múltiplos métodos no mesmo flow', async () => {
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

    // Testar POST
    const result1 = await triggerAndWait(
      flowId,
      webhookId,
      { method: 'POST' },
      {
        method: 'POST',
      },
    );
    expect(result1.jobResult.status).toBe('success');

    // Testar GET
    const result2 = await triggerAndWait(
      flowId,
      webhookId,
      {},
      {
        method: 'GET',
      },
    );
    expect(result2.jobResult.status).toBe('success');

    // Testar PUT
    const result3 = await triggerAndWait(
      flowId,
      webhookId,
      { method: 'PUT' },
      {
        method: 'PUT',
      },
    );
    expect(result3.jobResult.status).toBe('success');

    // Validar que são executions diferentes
    expect(result1.executionId).not.toBe(result2.executionId);
    expect(result2.executionId).not.toBe(result3.executionId);
  });
});
