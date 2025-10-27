/**
 * Testes de Headers e Query Parameters - Webhook Node
 *
 * Valida captura e processamento de:
 * - Headers HTTP
 * - Query parameters
 * - Casos especiais e edge cases
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

describe('Webhook Node - Headers and Query Parameters', () => {
  // ========================================
  // TESTES DE HEADERS
  // ========================================

  // ✅ CENÁRIO POSITIVO: Captura de headers básicos
  it('deve capturar headers do webhook', async () => {
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
      Authorization: 'Bearer test-token-12345',
    };

    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      {
        headers,
      },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.headers).toEqual(headers);
  });

  // ✅ CENÁRIO POSITIVO: Headers case-insensitive
  it('deve preservar case dos headers', async () => {
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
    const headers = {
      'content-type': 'application/json',
      'X-CUSTOM-HEADER': 'VALUE',
      Authorization: 'Bearer token',
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload, {
      headers,
    });

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.headers).toEqual(headers);
  });

  // ✅ CENÁRIO POSITIVO: Múltiplos headers customizados
  it('deve capturar múltiplos headers customizados', async () => {
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
    const headers = {
      'X-API-Key': 'api-key-123',
      'X-Request-ID': 'req-456',
      'X-Signature': 'hmac-signature',
      'X-Timestamp': '1234567890',
      'User-Agent': 'TestAgent/1.0',
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload, {
      headers,
    });

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.headers).toEqual(headers);
  });

  // ✅ CENÁRIO POSITIVO: Headers vazios
  it('deve processar webhook sem headers customizados', async () => {
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
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      {
        headers: {},
      },
    );

    expect(jobResult.status).toBe('success');

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.headers).toEqual({});
  });

  // ✅ CENÁRIO POSITIVO: Headers com valores especiais
  it('deve capturar headers com caracteres especiais', async () => {
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
    const headers = {
      'X-Special': 'value with spaces',
      'X-Unicode': 'Olá Mundo 你好',
      'X-Symbols': '!@#$%^&*()_+-=[]{}|;:,.<>?',
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload, {
      headers,
    });

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.headers).toEqual(headers);
  });

  // ========================================
  // TESTES DE QUERY PARAMETERS
  // ========================================

  // ✅ CENÁRIO POSITIVO: Captura de queryParams básicos
  it('deve capturar queryParams do webhook', async () => {
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
    const queryParams = {
      source: 'api',
      version: 'v1',
      debug: 'true',
    };

    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      {
        queryParams,
      },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.queryParams).toEqual(queryParams);
  });

  // ✅ CENÁRIO POSITIVO: Query params com múltiplos valores
  it('deve capturar múltiplos query parameters', async () => {
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
    const queryParams = {
      id: '123',
      name: 'Test User',
      active: 'true',
      score: '95.5',
      tags: 'tag1,tag2,tag3',
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload, {
      queryParams,
    });

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.queryParams).toEqual(queryParams);
  });

  // ✅ CENÁRIO POSITIVO: Query params vazios
  it('deve processar webhook sem query parameters', async () => {
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
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      {
        queryParams: {},
      },
    );

    expect(jobResult.status).toBe('success');

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.queryParams).toEqual({});
  });

  // ✅ CENÁRIO POSITIVO: Query params com caracteres especiais
  it('deve capturar query params com URL encoding', async () => {
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
    const queryParams = {
      name: 'John Doe',
      email: 'john+test@example.com',
      url: 'https://example.com/path?query=value',
      special: '!@#$%',
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload, {
      queryParams,
    });

    const execution = await getFlowExecution(executionId);
    expect(execution.triggerData.queryParams).toEqual(queryParams);
  });

  // ========================================
  // TESTES COMBINADOS
  // ========================================

  // ✅ CENÁRIO POSITIVO: Headers + Query params + Payload
  it('deve capturar headers, query params e payload simultaneamente', async () => {
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
      message: 'Complete webhook test',
      data: { id: 123, name: 'Test' },
    };
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': 'api-key-123',
      Authorization: 'Bearer token',
    };
    const queryParams = {
      source: 'external',
      version: 'v2',
      timestamp: '1234567890',
    };

    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      {
        method: 'POST',
        headers,
        queryParams,
      },
    );

    expect(jobResult.status).toBe('success');

    const execution = await getFlowExecution(executionId);
    expect(execution.data).toEqual(payload);
    expect(execution.triggerData.method).toBe('POST');
    expect(execution.triggerData.headers).toEqual(headers);
    expect(execution.triggerData.queryParams).toEqual(queryParams);
    expect(execution.triggerData.webhookId).toBe(webhookId);
    expect(execution.triggerData.timestamp).toBeDefined();
  });
});
