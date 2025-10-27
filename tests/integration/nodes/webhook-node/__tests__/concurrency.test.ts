/**
 * Testes de Concorrência - Webhook Node
 *
 * Valida processamento paralelo de webhooks em diferentes escalas
 */

import {
  createTestFlow,
  generateTestId,
  createEdge,
  testContext,
} from '../../../setup';
import {
  createWebhookNode,
  addWebhookJob,
  waitForMultipleJobs,
} from '../../../../helpers/webhook';
import { createMemoryNode } from '../../memory-node/setup';

describe('Webhook Node - Concurrency', () => {
  // ✅ CENÁRIO POSITIVO: 10 webhooks em paralelo
  it('deve processar 10 webhooks em paralelo', async () => {
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

    const startTime = Date.now();

    const jobs = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        addWebhookJob(flowId, webhookId, { index: i }),
      ),
    );

    const jobIds = jobs.map((job) => job.id.toString());
    const results = await waitForMultipleJobs(jobIds);

    const duration = Date.now() - startTime;

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.executionId)).toBeTruthy();
    expect(results.every((r) => r.status === 'success')).toBe(true);

    console.log(`⏱️  10 webhooks processados em ${duration}ms`);
  });

  // ✅ CENÁRIO POSITIVO: 20 webhooks em paralelo
  it('deve processar 20 webhooks em paralelo', async () => {
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

    const startTime = Date.now();

    const jobs = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        addWebhookJob(flowId, webhookId, { index: i }),
      ),
    );

    const jobIds = jobs.map((job) => job.id.toString());
    const results = await waitForMultipleJobs(jobIds, 30000);

    const duration = Date.now() - startTime;

    expect(results).toHaveLength(20);
    expect(results.every((r) => r.executionId)).toBeTruthy();
    expect(results.every((r) => r.status === 'success')).toBe(true);

    // Todos os executionIds devem ser únicos
    const executionIds = results.map((r) => r.executionId);
    const uniqueIds = new Set(executionIds);
    expect(uniqueIds.size).toBe(20);

    console.log(`⏱️  20 webhooks processados em ${duration}ms`);
  }, 45000);

  // ✅ CENÁRIO POSITIVO: Payloads diferentes processados corretamente
  it('deve processar diferentes payloads simultaneamente', async () => {
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

    const payloads = [
      { type: 'user', data: { name: 'John' } },
      { type: 'order', data: { total: 100 } },
      { type: 'notification', data: { message: 'Alert' } },
      { type: 'analytics', data: { event: 'click', count: 5 } },
      { type: 'webhook', data: { source: 'external' } },
    ];

    const jobs = await Promise.all(
      payloads.map((payload) => addWebhookJob(flowId, webhookId, payload)),
    );

    const jobIds = jobs.map((job) => job.id.toString());
    const results = await waitForMultipleJobs(jobIds);

    expect(results).toHaveLength(5);
    expect(results.every((r) => r.status === 'success')).toBe(true);
  });

  // ✅ CENÁRIO POSITIVO: Mix de sucesso e falha
  it('deve processar mix de flows válidos e inválidos', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const validFlowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });
    const invalidFlowId = 'non-existent-flow';

    const jobs = await Promise.all([
      ...Array.from({ length: 5 }, () =>
        addWebhookJob(validFlowId, webhookId, { status: 'valid' }),
      ),
      ...Array.from({ length: 5 }, () =>
        addWebhookJob(invalidFlowId, webhookId, { status: 'invalid' }),
      ),
    ]);

    const jobIds = jobs.map((job) => job.id.toString());
    const results = await waitForMultipleJobs(jobIds, 30000, false);

    expect(results).toHaveLength(10);

    const successes = results.filter((r) => r.status === 'success');
    expect(successes).toHaveLength(5);

    const errors = results.filter((r) => r.status === 'error');
    expect(errors).toHaveLength(5);
  }, 60000);

  // ✅ CENÁRIO POSITIVO: 30 webhooks em paralelo com validação de performance
  it('deve processar 30 webhooks em paralelo com boa performance', async () => {
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

    const startTime = Date.now();
    const batchSize = 30;

    const jobs = await Promise.all(
      Array.from({ length: batchSize }, (_, i) =>
        addWebhookJob(flowId, webhookId, { index: i, timestamp: Date.now() }),
      ),
    );

    const jobIds = jobs.map((job) => job.id.toString());
    const results = await waitForMultipleJobs(jobIds, 45000);

    const duration = Date.now() - startTime;

    expect(results).toHaveLength(batchSize);
    expect(results.every((r) => r.executionId)).toBeTruthy();
    expect(results.every((r) => r.status === 'success')).toBe(true);

    // Todos os executionIds devem ser únicos
    const executionIds = results.map((r) => r.executionId);
    const uniqueIds = new Set(executionIds);
    expect(uniqueIds.size).toBe(batchSize);

    const avgDuration = duration / batchSize;
    console.log(
      `⏱️  ${batchSize} webhooks processados em ${duration}ms (${avgDuration.toFixed(0)}ms/webhook)`,
    );
  }, 60000);

  // ✅ CENÁRIO POSITIVO: 50 webhooks em paralelo
  it('deve processar 50 webhooks em paralelo com alta taxa de sucesso', async () => {
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

    const startTime = Date.now();
    const batchSize = 50;

    console.log(`🚀 Iniciando batch de ${batchSize} webhooks...`);

    const jobs = await Promise.all(
      Array.from({ length: batchSize }, (_, i) =>
        addWebhookJob(flowId, webhookId, { index: i, batch: 'parallel' }),
      ),
    );

    const jobIds = jobs.map((job) => job.id.toString());
    const results = await waitForMultipleJobs(jobIds, 60000, false);

    const duration = Date.now() - startTime;

    expect(results).toHaveLength(batchSize);

    const successes = results.filter((r) => r.status === 'success');
    const errors = results.filter((r) => r.status === 'error');

    console.log(`✅ Sucessos: ${successes.length}/${batchSize}`);
    console.log(`❌ Erros: ${errors.length}/${batchSize}`);
    console.log(
      `⏱️  Duração total: ${duration}ms (${(duration / batchSize).toFixed(0)}ms/webhook)`,
    );

    // Pelo menos 95% devem ter sucesso
    const successRate = (successes.length / batchSize) * 100;
    expect(successRate).toBeGreaterThanOrEqual(95);

    // Validar unicidade de executionIds (apenas dos sucessos)
    const executionIds = successes.map((r) => r.executionId).filter(Boolean);
    const uniqueIds = new Set(executionIds);
    expect(uniqueIds.size).toBe(successes.length);
  }, 75000);

  // ✅ CENÁRIO POSITIVO: Batches sucessivos
  it('deve processar 3 batches de 15 webhooks cada (45 total)', async () => {
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

    const batchSize = 15;
    const numBatches = 3;
    const allResults: { executionId: string; status: string }[] = [];

    console.log(
      `📦 Processando ${numBatches} batches de ${batchSize} webhooks...`,
    );

    for (let batchNum = 0; batchNum < numBatches; batchNum++) {
      const startTime = Date.now();

      const jobs = await Promise.all(
        Array.from({ length: batchSize }, (_, i) =>
          addWebhookJob(flowId, webhookId, {
            batch: batchNum,
            index: i,
          }),
        ),
      );

      const jobIds = jobs.map((job) => job.id.toString());
      const results = await waitForMultipleJobs(jobIds, 30000);

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(batchSize);
      expect(results.every((r) => r.status === 'success')).toBe(true);

      allResults.push(...results);

      console.log(`  Batch ${batchNum + 1}: ${duration}ms`);
    }

    // Validar total
    expect(allResults).toHaveLength(batchSize * numBatches);

    // Todos os executionIds devem ser únicos
    const executionIds = allResults.map((r) => r.executionId);
    const uniqueIds = new Set(executionIds);
    expect(uniqueIds.size).toBe(batchSize * numBatches);

    console.log(
      `✅ Total: ${allResults.length} webhooks processados com sucesso`,
    );
  }, 90000);

  // ✅ CENÁRIO POSITIVO: Webhooks concorrentes com payloads diferentes
  it('deve processar 30 webhooks concorrentes com payloads variados', async () => {
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

    const payloadTypes = [
      { type: 'simple', data: { value: 'test' } },
      { type: 'complex', data: { nested: { deep: { value: 'test' } } } },
      { type: 'array', data: { items: [1, 2, 3, 4, 5] } },
      { type: 'large-string', data: { content: 'x'.repeat(500) } },
    ];

    const jobs = await Promise.all(
      Array.from({ length: 30 }, (_, i) => {
        const payload = {
          index: i,
          ...payloadTypes[i % payloadTypes.length],
        };
        return addWebhookJob(flowId, webhookId, payload);
      }),
    );

    const jobIds = jobs.map((job) => job.id.toString());
    const results = await waitForMultipleJobs(jobIds, 45000);

    expect(results).toHaveLength(30);
    expect(results.every((r) => r.status === 'success')).toBe(true);

    // Validar que todos os tipos de payload foram processados
    const executionIds = results.map((r) => r.executionId);
    const uniqueIds = new Set(executionIds);
    expect(uniqueIds.size).toBe(30);
  }, 60000);

  // ✅ CENÁRIO POSITIVO: Performance metrics detalhadas
  it('deve fornecer métricas de performance para 25 webhooks', async () => {
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

    const batchSize = 25;
    const startTime = Date.now();

    const jobs = await Promise.all(
      Array.from({ length: batchSize }, (_, i) =>
        addWebhookJob(flowId, webhookId, { index: i }),
      ),
    );

    const jobIds = jobs.map((job) => job.id.toString());
    const results = await waitForMultipleJobs(jobIds, 45000);

    const duration = Date.now() - startTime;

    expect(results).toHaveLength(batchSize);
    expect(results.every((r) => r.status === 'success')).toBe(true);

    // Calcular métricas
    const avgDuration = duration / batchSize;
    const throughput = (batchSize / duration) * 1000; // webhooks/segundo

    console.log('📊 Métricas de Performance:');
    console.log(`  Total: ${batchSize} webhooks`);
    console.log(`  Duração total: ${duration}ms`);
    console.log(`  Duração média: ${avgDuration.toFixed(2)}ms/webhook`);
    console.log(`  Throughput: ${throughput.toFixed(2)} webhooks/segundo`);

    // Validar throughput mínimo (pelo menos 3 webhooks/segundo)
    expect(throughput).toBeGreaterThanOrEqual(3);
  }, 45000);
});
