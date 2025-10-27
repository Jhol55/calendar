/**
 * Testes de Resiliência - Webhook Node
 *
 * Valida comportamento do sistema em cenários de falha:
 * - Jobs com timeout
 * - Cleanup de recursos
 * - Recuperação após falhas
 * - Tratamento de jobs órfãos
 * - Retry logic (desabilitado, mas validar comportamento)
 */

import {
  createTestFlow,
  getFlowExecution,
  generateTestId,
  createEdge,
  getQueueJobCounts,
  testContext,
} from '../../../setup';
import {
  createWebhookNode,
  addWebhookJob,
  waitForJobCompletion,
  getJobState,
  triggerAndWait,
} from '../../../../helpers/webhook';
import { createMemoryNode } from '../../memory-node/setup';

describe('Webhook Node - Resilience', () => {
  // ========================================
  // TESTES DE TIMEOUT
  // ========================================

  // ⏱️ RESILIÊNCIA: Timeout de job
  it('deve lançar erro quando job excede timeout', async () => {
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

    const job = await addWebhookJob(flowId, webhookId, { test: 'timeout' });

    // Tentar aguardar com timeout muito curto (1ms)
    await expect(
      waitForJobCompletion(job.id.toString(), 1, true),
    ).rejects.toThrow(/timeout/i);

    // Job ainda deve estar na fila (não foi removido)
    const state = await getJobState(job.id.toString());
    expect(['waiting', 'active', 'completed']).toContain(state);
  });

  // ⏱️ RESILIÊNCIA: Múltiplos jobs com timeouts diferentes
  it('deve respeitar timeouts individuais de cada job', async () => {
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

    // Adicionar jobs
    const job1 = await addWebhookJob(flowId, webhookId, { id: 1 });
    const job2 = await addWebhookJob(flowId, webhookId, { id: 2 });
    const job3 = await addWebhookJob(flowId, webhookId, { id: 3 });

    // Job com timeout curto deve falhar
    await expect(
      waitForJobCompletion(job1.id.toString(), 1, true),
    ).rejects.toThrow();

    // Jobs com timeout adequado devem completar
    const result2 = await waitForJobCompletion(
      job2.id.toString(),
      30000,
      false,
    );
    const result3 = await waitForJobCompletion(
      job3.id.toString(),
      30000,
      false,
    );

    expect(result2.status).toBe('success');
    expect(result3.status).toBe('success');
  }, 30000);

  // ========================================
  // TESTES DE CLEANUP
  // ========================================

  // 🧹 RESILIÊNCIA: Recursos devem ser liberados após execution
  it('deve limpar recursos após execution bem-sucedida', async () => {
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

    const { executionId, jobResult } = await triggerAndWait(flowId, webhookId, {
      test: 'cleanup',
    });

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    const execution = await getFlowExecution(executionId);
    expect(execution.status).toBe('success');
    expect(execution.nodeExecutions[webhookId]).toBeDefined();
    expect(execution.nodeExecutions[webhookId].endTime).toBeDefined();

    // Validar que execution foi salva corretamente e tem timestamps
    expect(execution.startTime).toBeDefined();
    expect(execution.endTime).toBeDefined();
    expect(new Date(execution.endTime!).getTime()).toBeGreaterThanOrEqual(
      new Date(execution.startTime).getTime(),
    );
  });

  // 🧹 RESILIÊNCIA: Recursos devem ser liberados após erro
  it('deve limpar recursos após execution com erro', async () => {
    const webhookId = generateTestId('webhook');
    const invalidNodeId = generateTestId('invalid');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: invalidNodeId,
        type: 'unknown-node-type',
        data: { label: 'Invalid Node' },
      },
    ];
    const edges = [createEdge('e1', webhookId, invalidNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const result = await triggerAndWait(
      flowId,
      webhookId,
      { test: 'error-cleanup' },
      {
        throwOnError: false,
      },
    );

    expect(result.jobResult.status).toBe('error');
    expect(result.executionId).toBeDefined();

    const execution = await getFlowExecution(result.executionId);
    expect(execution.status).toBe('error');

    // Mesmo com erro, execution deve ter timestamps
    expect(execution.startTime).toBeDefined();
    expect(execution.endTime).toBeDefined();
  });

  // ========================================
  // TESTES DE RETRY LOGIC
  // ========================================

  // 🔄 RESILIÊNCIA: Retry deve estar desabilitado
  it('jobs falhados não devem ser retriados automaticamente', async () => {
    const webhookId = generateTestId('webhook');
    const fakeFlowId = 'non-existent-flow-12345';

    const payload = { test: 'no-retry' };
    const job = await addWebhookJob(fakeFlowId, webhookId, payload);

    // Aguardar falha
    const result = await waitForJobCompletion(job.id.toString(), 10000, false);

    expect(result.status).toBe('error');
    expect(result.error).toBe(true);

    // Verificar que attemptsMade é 1 (sem retry)
    const updatedJob = await job.queue.getJob(job.id);
    expect(updatedJob?.attemptsMade).toBeLessThanOrEqual(1);
  });

  // 🔄 RESILIÊNCIA: Múltiplos jobs falhados não devem ser retriados
  it('múltiplos jobs falhados devem falhar sem retry', async () => {
    const webhookId = generateTestId('webhook');
    const fakeFlowId = 'non-existent-flow';

    // Criar 5 jobs que vão falhar
    const jobs = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        addWebhookJob(fakeFlowId, webhookId, { index: i }),
      ),
    );

    // Aguardar todos falharem
    const results = await Promise.all(
      jobs.map((job) => waitForJobCompletion(job.id.toString(), 10000, false)),
    );

    // Todos devem ter falhado
    expect(results.every((r) => r.status === 'error')).toBe(true);

    // Nenhum deve ter sido retriado
    for (const job of jobs) {
      const updatedJob = await job.queue.getJob(job.id);
      expect(updatedJob?.attemptsMade).toBeLessThanOrEqual(1);
    }
  });

  // ========================================
  // TESTES DE RECUPERAÇÃO
  // ========================================

  // 💪 RESILIÊNCIA: Sistema deve se recuperar após série de falhas
  it('deve processar normalmente após série de falhas', async () => {
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

    // Fase 1: Causar falhas
    console.log('❌ Fase 1: Causando falhas...');
    const failingJobs = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        addWebhookJob(invalidFlowId, webhookId, { index: i }),
      ),
    );

    const failingResults = await Promise.all(
      failingJobs.map((job) =>
        waitForJobCompletion(job.id.toString(), 10000, false),
      ),
    );

    expect(failingResults.every((r) => r.status === 'error')).toBe(true);

    // Fase 2: Validar recuperação
    console.log('✅ Fase 2: Validando recuperação...');
    const recoveryJobs = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        addWebhookJob(validFlowId, webhookId, { index: i }),
      ),
    );

    const recoveryResults = await Promise.all(
      recoveryJobs.map((job) =>
        waitForJobCompletion(job.id.toString(), 30000, false),
      ),
    );

    // Todos devem ter sucesso após recuperação
    expect(recoveryResults.every((r) => r.status === 'success')).toBe(true);
  }, 45000);

  // ========================================
  // TESTES DE ESTADO DA FILA
  // ========================================

  // 📊 RESILIÊNCIA: Fila não deve acumular jobs órfãos
  it('fila deve ser limpa após processamento', async () => {
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

    // Adicionar e processar jobs
    const jobs = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        addWebhookJob(flowId, webhookId, { index: i }),
      ),
    );

    await Promise.all(
      jobs.map((job) => waitForJobCompletion(job.id.toString(), 30000)),
    );

    // Verificar estado da fila
    const counts = await getQueueJobCounts();

    // Não deve haver jobs waiting ou active (todos processados)
    expect(counts.waiting).toBe(0);
    expect(counts.active).toBe(0);

    console.log('📊 Estado da fila após processamento:', counts);
  }, 30000);

  // 📊 RESILIÊNCIA: Mix de sucesso e falha não deve corromper fila
  it('mix de jobs bem-sucedidos e falhados não deve corromper fila', async () => {
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

    // Adicionar mix de jobs válidos e inválidos
    const validJobs = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        addWebhookJob(validFlowId, webhookId, { type: 'valid', index: i }),
      ),
    );

    const invalidJobs = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        addWebhookJob(invalidFlowId, webhookId, { type: 'invalid', index: i }),
      ),
    );

    // Processar todos
    const allResults = await Promise.all([
      ...validJobs.map((job) =>
        waitForJobCompletion(job.id.toString(), 30000, false),
      ),
      ...invalidJobs.map((job) =>
        waitForJobCompletion(job.id.toString(), 10000, false),
      ),
    ]);

    const successes = allResults.filter((r) => r.status === 'success');
    const errors = allResults.filter((r) => r.status === 'error');

    expect(successes).toHaveLength(10);
    expect(errors).toHaveLength(10);

    // Fila deve estar limpa
    const counts = await getQueueJobCounts();
    expect(counts.waiting).toBe(0);
    expect(counts.active).toBe(0);
  }, 45000);

  // ========================================
  // TESTES DE ISOLAMENTO
  // ========================================

  // 🔒 RESILIÊNCIA: Erro em um job não deve afetar outros
  it('erro em um job não deve afetar processamento de outros jobs', async () => {
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

    // Adicionar job inválido primeiro
    const invalidJob = await addWebhookJob(invalidFlowId, webhookId, {
      type: 'invalid',
    });

    // Adicionar jobs válidos depois
    const validJobs = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        addWebhookJob(validFlowId, webhookId, { type: 'valid', index: i }),
      ),
    );

    // Processar todos
    const invalidResult = await waitForJobCompletion(
      invalidJob.id.toString(),
      10000,
      false,
    );
    expect(invalidResult.status).toBe('error');

    const validResults = await Promise.all(
      validJobs.map((job) =>
        waitForJobCompletion(job.id.toString(), 30000, false),
      ),
    );

    // Jobs válidos não devem ser afetados pelo erro do primeiro
    expect(validResults.every((r) => r.status === 'success')).toBe(true);
  }, 30000);

  // 🔒 RESILIÊNCIA: Executions devem ser independentes
  it('executions simultâneas devem ser completamente isoladas', async () => {
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

    // Criar executions com payloads diferentes
    const payloads = [
      { id: 1, value: 'first' },
      { id: 2, value: 'second' },
      { id: 3, value: 'third' },
    ];

    const results = await Promise.all(
      payloads.map((payload) => triggerAndWait(flowId, webhookId, payload)),
    );

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.jobResult.status === 'success')).toBe(true);

    // Validar que cada execution tem seus próprios dados
    for (let i = 0; i < results.length; i++) {
      const execution = await getFlowExecution(results[i].executionId);
      expect(execution.data).toEqual(payloads[i]);
      expect(execution.data.id).toBe(i + 1);
    }

    // Todos os executionIds devem ser únicos
    const executionIds = results.map((r) => r.executionId);
    const uniqueIds = new Set(executionIds);
    expect(uniqueIds.size).toBe(3);
  });
});
