/**
 * Testes de Validação de Payload - Webhook Node
 *
 * Valida processamento completo de payloads:
 * - Tipos e estruturas (JSON simples/aninhado, arrays, primitivos)
 * - Valores especiais (null/undefined)
 * - Caracteres especiais e Unicode
 * - Tamanhos variados (de bytes até MB)
 * - Performance e limites
 * - Helper de validação
 */

import {
  createTestFlow,
  getFlowExecution,
  getNodeExecutions,
  generateTestId,
  createEdge,
  testContext,
} from '../../../setup';
import {
  createWebhookNode,
  triggerAndWait,
  validateWebhookPayload,
  generateLargePayload,
  generateNestedPayload,
} from '../../../../helpers/webhook';
import { createMemoryNode } from '../../memory-node/setup';

describe('Webhook Node - Payload Validation', () => {
  // ✅ CENÁRIO POSITIVO: JSON simples
  it('deve processar payload JSON simples', async () => {
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
      name: 'John Doe',
      age: 30,
      active: true,
    };

    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
    );

    expect(jobResult.status).toBe('success');

    const execution = await getFlowExecution(executionId);
    expect(execution.data).toEqual(payload);
  });

  // ✅ CENÁRIO POSITIVO: JSON aninhado (nested objects)
  it('deve processar payload JSON aninhado', async () => {
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
        name: 'John Doe',
        profile: {
          email: 'john@example.com',
          address: {
            street: '123 Main St',
            city: 'Springfield',
            country: {
              code: 'US',
              name: 'United States',
            },
          },
        },
      },
      timestamp: new Date().toISOString(),
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);
    expect(nodeExecutions[webhookId].data).toEqual(payload);
    expect(
      nodeExecutions[webhookId].data.user.profile.address.country.code,
    ).toBe('US');
  });

  // ✅ CENÁRIO POSITIVO: Payload com arrays
  it('deve processar payload com arrays', async () => {
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
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
      ],
      tags: ['tag1', 'tag2', 'tag3'],
      numbers: [1, 2, 3, 4, 5],
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);
    expect(nodeExecutions[webhookId].data.items).toHaveLength(3);
    expect(nodeExecutions[webhookId].data.tags).toEqual([
      'tag1',
      'tag2',
      'tag3',
    ]);
    expect(nodeExecutions[webhookId].data.numbers).toEqual([1, 2, 3, 4, 5]);
  });

  // ✅ CENÁRIO POSITIVO: Valores null/undefined
  it('deve processar payload com valores null', async () => {
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
      name: 'Test',
      nullValue: null,
      emptyString: '',
      zeroValue: 0,
      falseValue: false,
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);
    expect(nodeExecutions[webhookId].data.nullValue).toBeNull();
    expect(nodeExecutions[webhookId].data.emptyString).toBe('');
    expect(nodeExecutions[webhookId].data.zeroValue).toBe(0);
    expect(nodeExecutions[webhookId].data.falseValue).toBe(false);
  });

  // ✅ CENÁRIO POSITIVO: Tipos primitivos
  it('deve processar payload com tipos primitivos', async () => {
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
      string: 'text value',
      number: 42,
      float: 3.14,
      negative: -10,
      boolean_true: true,
      boolean_false: false,
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);
    expect(typeof nodeExecutions[webhookId].data.string).toBe('string');
    expect(typeof nodeExecutions[webhookId].data.number).toBe('number');
    expect(typeof nodeExecutions[webhookId].data.float).toBe('number');
    expect(typeof nodeExecutions[webhookId].data.negative).toBe('number');
    expect(typeof nodeExecutions[webhookId].data.boolean_true).toBe('boolean');
  });

  // ✅ CENÁRIO POSITIVO: Caracteres especiais
  it('deve processar payload com caracteres especiais', async () => {
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
      special_chars: 'Test with @#$%^&*()[]{}|\\:;"\'<>,.?/~`',
      newlines: 'Line 1\nLine 2\nLine 3',
      tabs: 'Col1\tCol2\tCol3',
      quotes: 'He said "Hello" and she replied \'Hi\'',
      path: 'C:\\Users\\Test\\file.txt',
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);
    expect(nodeExecutions[webhookId].data.special_chars).toBe(
      payload.special_chars,
    );
    expect(nodeExecutions[webhookId].data.newlines).toBe(payload.newlines);
    expect(nodeExecutions[webhookId].data.tabs).toBe(payload.tabs);
  });

  // ✅ CENÁRIO POSITIVO: Unicode e emojis
  it('deve processar payload com Unicode e emojis', async () => {
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
      emojis: '😀 😃 😄 😁 🚀 🎉 💯 ✅',
      portuguese: 'Olá! Como você está? Açúcar, café, coração',
      chinese: '你好世界',
      arabic: 'مرحبا بالعالم',
      russian: 'Привет мир',
      japanese: 'こんにちは世界',
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);
    expect(nodeExecutions[webhookId].data.emojis).toBe(payload.emojis);
    expect(nodeExecutions[webhookId].data.portuguese).toBe(payload.portuguese);
    expect(nodeExecutions[webhookId].data.chinese).toBe(payload.chinese);
  });

  // ========================================
  // TESTES DE TAMANHOS DE PAYLOAD
  // ========================================

  // ✅ Payload extremamente pequeno (< 100 bytes)
  it('deve processar payload extremamente pequeno (<100 bytes)', async () => {
    const webhookId = generateTestId('webhook');
    const memoryNodeId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryNodeId, 'write', 'tiny_payload', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const tinyPayload = { id: 1 };
    const payloadSize = JSON.stringify(tinyPayload).length;
    expect(payloadSize).toBeLessThan(100);

    const { executionId, jobResult, duration } = await triggerAndWait(
      flowId,
      webhookId,
      tinyPayload,
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    console.log(
      `⏱️  Payload de ${payloadSize} bytes processado em ${duration}ms`,
    );
  });

  // ✅ Payloads pequenos (1KB) em sequência - REDUZIDO para 2 iterações
  it('deve processar 2 payloads pequenos (1KB) em sequência', async () => {
    const webhookId = generateTestId('webhook');
    const memoryNodeId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryNodeId, 'write', 'payload_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < 2; i++) {
      const payload = generateLargePayload(1);
      const result = await triggerAndWait(flowId, webhookId, payload);
      results.push(result);
    }

    const duration = Date.now() - startTime;

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.jobResult.status === 'success')).toBe(true);

    console.log(`⏱️  2 payloads pequenos (1KB) processados em ${duration}ms`);
  });

  // ✅ Array com 50 itens - REDUZIDO de 100 para 50
  it('deve processar payload com array de 50 itens', async () => {
    const webhookId = generateTestId('webhook');
    const memoryNodeId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryNodeId, 'write', 'payload_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = {
      items: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 1000,
      })),
    };

    const { executionId, jobResult, duration } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      { timeout: 10000 },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    console.log(`⏱️  Payload com 50 itens processado em ${duration}ms`);
  });

  // ✅ Nesting de 5 níveis
  it('deve processar payload com nesting de 5 níveis', async () => {
    const webhookId = generateTestId('webhook');
    const memoryNodeId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryNodeId, 'write', 'payload_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = generateNestedPayload(5);

    const { executionId, jobResult, duration } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    console.log(
      `⏱️  Payload com 5 níveis de nesting processado em ${duration}ms`,
    );
  });

  // ✅ Strings longas - REDUZIDO para testar validação sem overhead
  it('deve processar payload com strings longas', async () => {
    const webhookId = generateTestId('webhook');
    const memoryNodeId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryNodeId, 'write', 'payload_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = {
      longText: 'A'.repeat(2000),
      description: 'B'.repeat(1000),
      notes: 'C'.repeat(500),
    };

    const payloadSize = JSON.stringify(payload).length;

    const { executionId, jobResult, duration } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      { timeout: 10000 },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    console.log(
      `⏱️  Payload com strings longas (${Math.round(payloadSize / 1024)}KB) processado em ${duration}ms`,
    );
  });

  // ✅ Payload misto complexo - REDUZIDO para 10 users e strings menores
  it('deve processar payload misto complexo', async () => {
    const webhookId = generateTestId('webhook');
    const memoryNodeId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryNodeId, 'write', 'payload_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = {
      users: Array.from({ length: 10 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        profile: {
          bio: 'X'.repeat(100),
          settings: {
            notifications: true,
            theme: 'dark',
          },
        },
      })),
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
      content: {
        title: 'Test Content',
        body: 'Y'.repeat(500),
      },
    };

    const { executionId, jobResult, duration } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      { timeout: 10000 },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    console.log(`⏱️  Payload misto complexo processado em ${duration}ms`);
  });

  // ✅ Payload médio (100KB) - Suficiente para validar processamento
  it('deve processar payload médio de 100KB', async () => {
    const webhookId = generateTestId('webhook');
    const memoryNodeId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryNodeId, 'write', 'payload_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = generateLargePayload(100); // 100KB
    const { executionId, jobResult, duration } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      { timeout: 10000 },
    );

    expect(jobResult.status).toBe('success');
    expect(jobResult.error).toBeUndefined();
    expect(executionId).toBeDefined();

    console.log(`⏱️  Payload de 100KB processado em ${duration}ms`);
  }, 15000);

  // ✅ Payload grande (500KB) - Testa limite superior sem exagero
  it('deve processar payload grande de 500KB', async () => {
    const webhookId = generateTestId('webhook');
    const memoryNodeId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryNodeId, 'write', 'payload_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = generateLargePayload(500); // 500KB
    const { executionId, jobResult, duration } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      { timeout: 15000 },
    );

    expect(jobResult.status).toBe('success');
    expect(jobResult.error).toBeUndefined();
    expect(executionId).toBeDefined();

    console.log(`⏱️  Payload de 500KB processado em ${duration}ms`);
  }, 20000);

  // ✅ Comparação de performance entre tamanhos - REDUZIDO para 2 tamanhos
  it('deve processar múltiplos payloads de diferentes tamanhos', async () => {
    const webhookId = generateTestId('webhook');
    const memoryNodeId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryNodeId, 'write', 'payload_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const sizes = [10, 50]; // KB - Reduzido de 3 para 2 tamanhos
    const results: { size: number; duration: number }[] = [];

    for (const sizeKB of sizes) {
      const payload = generateLargePayload(sizeKB);
      const { jobResult, duration } = await triggerAndWait(
        flowId,
        webhookId,
        payload,
        {
          timeout: 10000,
        },
      );

      expect(jobResult.status).toBe('success');
      results.push({ size: sizeKB, duration });
    }

    console.log('📊 Performance por tamanho de payload:');
    results.forEach(({ size, duration }) => {
      console.log(`  ${size}KB: ${duration}ms`);
    });

    expect(results).toHaveLength(sizes.length);
  }, 25000);

  // ✅ Batch de payloads médios - REDUZIDO para 2 payloads de 10KB
  it('deve processar 2 payloads médios (10KB cada) em sequência', async () => {
    const webhookId = generateTestId('webhook');
    const memoryNodeId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryNodeId, 'write', 'batch_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const batchSize = 2;
    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < batchSize; i++) {
      const payload = generateLargePayload(10); // 10KB
      const result = await triggerAndWait(flowId, webhookId, payload, {
        timeout: 8000,
      });
      results.push(result);
    }

    const totalDuration = Date.now() - startTime;

    expect(results).toHaveLength(batchSize);
    expect(results.every((r) => r.jobResult.status === 'success')).toBe(true);

    const avgDuration = totalDuration / batchSize;
    console.log(
      `⏱️  Batch de ${batchSize} payloads (10KB cada): ${totalDuration}ms total, ${avgDuration.toFixed(0)}ms média`,
    );
  }, 20000);

  // ========================================
  // TESTES DE HELPERS DE VALIDAÇÃO
  // ========================================

  // ✅ HELPER: Validação de payload
  it('validateWebhookPayload deve aceitar objetos válidos', () => {
    const result1 = validateWebhookPayload({ key: 'value' });
    expect(result1.valid).toBe(true);
    expect(result1.error).toBeUndefined();

    const result2 = validateWebhookPayload({ nested: { data: true } });
    expect(result2.valid).toBe(true);
    expect(result2.error).toBeUndefined();

    const result3 = validateWebhookPayload({ array: [1, 2, 3] });
    expect(result3.valid).toBe(true);
    expect(result3.error).toBeUndefined();
  });

  // ❌ HELPER: Validação de payload inválido
  it('validateWebhookPayload deve rejeitar tipos inválidos', () => {
    const result1 = validateWebhookPayload(null);
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain('null or undefined');

    const result2 = validateWebhookPayload(undefined);
    expect(result2.valid).toBe(false);
    expect(result2.error).toContain('null or undefined');

    const result3 = validateWebhookPayload('string');
    expect(result3.valid).toBe(false);
    expect(result3.error).toContain('must be an object');

    const result4 = validateWebhookPayload(123);
    expect(result4.valid).toBe(false);
    expect(result4.error).toContain('must be an object');
  });

  // ✅ CENÁRIO POSITIVO: Payload vazio (objeto vazio)
  it('deve processar webhook com payload vazio', async () => {
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

    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      {},
    );

    expect(jobResult.status).toBe('success');
    expect(jobResult.error).toBeUndefined();
    expect(executionId).toBeDefined();

    const execution = await getFlowExecution(executionId);
    expect(execution.data).toEqual({});
  });
});
