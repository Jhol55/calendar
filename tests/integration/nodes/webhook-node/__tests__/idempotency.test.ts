/**
 * Testes de Idempotência - Webhook Node
 *
 * Valida comportamento de webhooks duplicados e idempotência:
 * - Detecção de webhooks duplicados
 * - Prevenção de executions múltiplas
 * - Webhook request IDs
 * - Time windows para deduplication
 * - Replay de webhooks
 *
 * NOTA: Estes testes dependem da implementação de idempotência no sistema.
 * Se ainda não implementado, os testes documentam o comportamento esperado.
 */

import {
  createTestFlow,
  getFlowExecution,
  countExecutions,
  generateTestId,
  createEdge,
  testContext,
} from '../../../setup';
import {
  createWebhookNode,
  triggerAndWait,
  createWebhookRequestId,
} from '../../../../helpers/webhook';
import { createMemoryNode } from '../../memory-node/setup';

describe('Webhook Node - Idempotency', () => {
  // ========================================
  // TESTES BÁSICOS DE IDEMPOTÊNCIA
  // ========================================

  // 🔁 IDEMPOTÊNCIA: Mesmo payload múltiplas vezes
  it('deve processar mesmo payload múltiplas vezes (sem idempotência por padrão)', async () => {
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

    const payload = { message: 'duplicate test', id: 123 };

    // Enviar mesmo payload 3 vezes
    const result1 = await triggerAndWait(flowId, webhookId, payload);
    const result2 = await triggerAndWait(flowId, webhookId, payload);
    const result3 = await triggerAndWait(flowId, webhookId, payload);

    // Sem idempotência, todos devem ser processados
    expect(result1.jobResult.status).toBe('success');
    expect(result2.jobResult.status).toBe('success');
    expect(result3.jobResult.status).toBe('success');

    // Todas as executions devem ser diferentes (por padrão)
    expect(result1.executionId).not.toBe(result2.executionId);
    expect(result2.executionId).not.toBe(result3.executionId);

    // 3 executions devem ter sido criadas
    const executionCount = await countExecutions();
    expect(executionCount).toBeGreaterThanOrEqual(3);
  });

  // 🔁 IDEMPOTÊNCIA: Webhooks em sequência rápida
  it('deve processar webhooks idênticos enviados em sequência rápida', async () => {
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

    const payload = { rapid: true, timestamp: Date.now() };

    // Enviar 5 webhooks idênticos em rápida sucessão
    const results = await Promise.all([
      triggerAndWait(flowId, webhookId, payload),
      triggerAndWait(flowId, webhookId, payload),
      triggerAndWait(flowId, webhookId, payload),
      triggerAndWait(flowId, webhookId, payload),
      triggerAndWait(flowId, webhookId, payload),
    ]);

    // Todos devem ser processados
    expect(results).toHaveLength(5);
    expect(results.every((r) => r.jobResult.status === 'success')).toBe(true);

    // Sem deduplication, todos devem ter executionIds únicos
    const executionIds = results.map((r) => r.executionId);
    const uniqueIds = new Set(executionIds);
    expect(uniqueIds.size).toBe(5);
  });

  // ========================================
  // TESTES COM WEBHOOK REQUEST ID
  // ========================================

  // 🔁 IDEMPOTÊNCIA: Webhook request ID único
  it('webhooks com request IDs diferentes devem criar executions separadas', async () => {
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

    // Mesmo payload mas request IDs diferentes
    const basePayload = { message: 'test' };

    const result1 = await triggerAndWait(flowId, webhookId, {
      ...basePayload,
      requestId: createWebhookRequestId(),
    });

    const result2 = await triggerAndWait(flowId, webhookId, {
      ...basePayload,
      requestId: createWebhookRequestId(),
    });

    const result3 = await triggerAndWait(flowId, webhookId, {
      ...basePayload,
      requestId: createWebhookRequestId(),
    });

    // Todos devem ser processados com executions diferentes
    expect(result1.jobResult.status).toBe('success');
    expect(result2.jobResult.status).toBe('success');
    expect(result3.jobResult.status).toBe('success');

    expect(result1.executionId).not.toBe(result2.executionId);
    expect(result2.executionId).not.toBe(result3.executionId);
  });

  // 🔁 IDEMPOTÊNCIA: Replay de webhook (mesmo request ID)
  it('deve documentar comportamento de replay com mesmo request ID', async () => {
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

    const requestId = createWebhookRequestId();
    const payload = {
      message: 'replay test',
      requestId: requestId,
    };

    // Enviar webhook pela primeira vez
    const result1 = await triggerAndWait(flowId, webhookId, payload);
    expect(result1.jobResult.status).toBe('success');

    // Aguardar um pouco
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Replay: enviar novamente com mesmo requestId
    const result2 = await triggerAndWait(flowId, webhookId, payload);

    // COMPORTAMENTO ATUAL: Sem idempotência implementada, cria nova execution
    // COMPORTAMENTO ESPERADO (futuro): Deveria retornar mesma executionId
    expect(result2.jobResult.status).toBe('success');

    // Documentar comportamento atual
    console.log('📝 Replay behavior:');
    console.log(`  First execution: ${result1.executionId}`);
    console.log(`  Replay execution: ${result2.executionId}`);
    console.log(`  Are same: ${result1.executionId === result2.executionId}`);

    // Atualmente, cria executions diferentes (sem idempotência)
    // No futuro, deveria retornar a mesma execution
  });

  // ========================================
  // TESTES DE TIMING E WINDOWS
  // ========================================

  // ⏱️ IDEMPOTÊNCIA: Webhooks espaçados no tempo
  it('deve processar webhooks idênticos espaçados por intervalo grande', async () => {
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

    const payload = { message: 'spaced webhooks', id: 999 };

    // Primeiro webhook
    const result1 = await triggerAndWait(flowId, webhookId, payload);
    expect(result1.jobResult.status).toBe('success');

    // Aguardar 2 segundos
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Segundo webhook (mesmo payload, mas após intervalo)
    const result2 = await triggerAndWait(flowId, webhookId, payload);
    expect(result2.jobResult.status).toBe('success');

    // Devem ser executions diferentes (fora da window de deduplication, se houver)
    expect(result1.executionId).not.toBe(result2.executionId);
  });

  // ========================================
  // TESTES DE COMPORTAMENTO ESPERADO
  // ========================================

  // 📋 IDEMPOTÊNCIA: Validar unicidade de executions
  it('deve garantir que cada execution tenha ID único', async () => {
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

    // Criar 20 webhooks com payloads variados
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        triggerAndWait(flowId, webhookId, { index: i, unique: Math.random() }),
      ),
    );

    expect(results).toHaveLength(20);
    expect(results.every((r) => r.jobResult.status === 'success')).toBe(true);

    // Todos os executionIds devem ser únicos
    const executionIds = results.map((r) => r.executionId);
    const uniqueIds = new Set(executionIds);
    expect(uniqueIds.size).toBe(20);

    // Nenhum ID deve ser vazio ou undefined
    expect(executionIds.every((id) => id && id.length > 0)).toBe(true);
  });

  // 📋 IDEMPOTÊNCIA: Payload idêntico mas headers diferentes
  it('webhooks com payload idêntico mas headers diferentes devem ser processados', async () => {
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

    const payload = { message: 'same payload' };

    // Mesmo payload, headers diferentes
    const result1 = await triggerAndWait(flowId, webhookId, payload, {
      headers: { 'X-Request': 'first' },
    });

    const result2 = await triggerAndWait(flowId, webhookId, payload, {
      headers: { 'X-Request': 'second' },
    });

    const result3 = await triggerAndWait(flowId, webhookId, payload, {
      headers: { 'X-Request': 'third' },
    });

    // Todos devem ser processados como requests diferentes
    expect(result1.jobResult.status).toBe('success');
    expect(result2.jobResult.status).toBe('success');
    expect(result3.jobResult.status).toBe('success');

    expect(result1.executionId).not.toBe(result2.executionId);
    expect(result2.executionId).not.toBe(result3.executionId);

    // Validar que headers foram capturados
    const exec1 = await getFlowExecution(result1.executionId);
    const exec2 = await getFlowExecution(result2.executionId);
    const exec3 = await getFlowExecution(result3.executionId);

    expect(exec1.triggerData.headers['X-Request']).toBe('first');
    expect(exec2.triggerData.headers['X-Request']).toBe('second');
    expect(exec3.triggerData.headers['X-Request']).toBe('third');
  });

  // 📋 IDEMPOTÊNCIA: Payload idêntico mas query params diferentes
  it('webhooks com payload idêntico mas query params diferentes devem ser processados', async () => {
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

    const payload = { data: 'identical' };

    // Mesmo payload, query params diferentes
    const result1 = await triggerAndWait(flowId, webhookId, payload, {
      queryParams: { source: 'api-v1' },
    });

    const result2 = await triggerAndWait(flowId, webhookId, payload, {
      queryParams: { source: 'api-v2' },
    });

    // Devem ser processados como requests diferentes
    expect(result1.jobResult.status).toBe('success');
    expect(result2.jobResult.status).toBe('success');
    expect(result1.executionId).not.toBe(result2.executionId);

    // Validar que query params foram capturados
    const exec1 = await getFlowExecution(result1.executionId);
    const exec2 = await getFlowExecution(result2.executionId);

    expect(exec1.triggerData.queryParams.source).toBe('api-v1');
    expect(exec2.triggerData.queryParams.source).toBe('api-v2');
  });

  // ========================================
  // TESTES DE DOCUMENTAÇÃO DE COMPORTAMENTO
  // ========================================

  // 📝 IDEMPOTÊNCIA: Documentar estratégia atual
  it('deve documentar estratégia de idempotência atual', async () => {
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

    const testScenarios = [
      {
        name: 'Payload idêntico',
        payload1: { id: 1, value: 'test' },
        payload2: { id: 1, value: 'test' },
      },
      {
        name: 'Payload com requestId',
        payload1: { requestId: 'req-123', data: 'test' },
        payload2: { requestId: 'req-123', data: 'test' },
      },
    ];

    console.log('\n📝 Estratégia de Idempotência Atual:\n');

    for (const scenario of testScenarios) {
      const result1 = await triggerAndWait(
        flowId,
        webhookId,
        scenario.payload1,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      const result2 = await triggerAndWait(
        flowId,
        webhookId,
        scenario.payload2,
      );

      const isDeduplicated = result1.executionId === result2.executionId;

      console.log(`${scenario.name}:`);
      console.log(`  Execution 1: ${result1.executionId}`);
      console.log(`  Execution 2: ${result2.executionId}`);
      console.log(`  Deduplicado: ${isDeduplicated ? 'SIM' : 'NÃO'}`);
      console.log('');

      expect(result1.jobResult.status).toBe('success');
      expect(result2.jobResult.status).toBe('success');
    }

    console.log('COMPORTAMENTO ATUAL: Não há deduplicação por padrão');
    console.log(
      'RECOMENDAÇÃO: Implementar idempotência baseada em requestId/hash do payload',
    );
  });
});
