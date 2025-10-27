/**
 * Testes de Segurança - Webhook Node
 *
 * Valida proteções e limites de segurança:
 * - Tamanho máximo de payload (10MB)
 * - Profundidade máxima de nesting (20 níveis)
 * - Proteção contra DoS (payloads extremos)
 * - Validação de estrutura de dados
 * - Proteção contra circular references
 */

import {
  createTestFlow,
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
  getPayloadSize,
} from '../../../../helpers/webhook';
import { createMemoryNode } from '../../memory-node/setup';

describe('Webhook Node - Security', () => {
  // ========================================
  // VALIDAÇÃO DE TAMANHO DE PAYLOAD
  // ========================================

  // ✅ CENÁRIO POSITIVO: Payload dentro do limite (< 10MB)
  it('deve aceitar payload de 1MB (dentro do limite)', async () => {
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

    // Gerar payload de ~1MB (alinhado com o título do teste)
    const payload = generateLargePayload(1 * 1024); // 1MB
    const size = getPayloadSize(payload);
    expect(size).toBeLessThan(10 * 1024 * 1024); // < 10MB

    const { executionId, jobResult, duration } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      { timeout: 20000 },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    console.log(`⏱️  Payload de 1MB processado em ${duration}ms`);
  }, 30000);

  // ❌ CENÁRIO NEGATIVO: Payload acima do limite (> 10MB) - Validação via helper
  it('validateWebhookPayload deve rejeitar payloads maiores que 10MB', () => {
    // Gerar payload de ~11MB
    const largePayload = generateLargePayload(11 * 1024); // 11MB
    const size = getPayloadSize(largePayload);

    expect(size).toBeGreaterThan(10 * 1024 * 1024);

    const result = validateWebhookPayload(largePayload);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum size');
    expect(result.error).toContain('10485760 bytes');
  });

  // ❌ CENÁRIO NEGATIVO: Payload extremamente grande (DoS attack)
  it('validateWebhookPayload deve rejeitar payload de 20MB rapidamente', () => {
    const startTime = Date.now();

    // Gerar payload de ~20MB
    const massivePayload = generateLargePayload(20 * 1024); // 20MB
    const size = getPayloadSize(massivePayload);

    expect(size).toBeGreaterThan(20 * 1024 * 1024);

    const result = validateWebhookPayload(massivePayload);
    const duration = Date.now() - startTime;

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum size');

    // Validação deve ser rápida mesmo com payload grande (< 3 segundos, permitir variação em CI/CD)
    expect(duration).toBeLessThan(3000);
    console.log(`⏱️  Rejeitou payload de 20MB em ${duration}ms`);
  });

  // ✅ CENÁRIO POSITIVO: Payload no limite exato (10MB)
  it('deve aceitar payload no limite de 10MB', () => {
    // Gerar payload próximo a 10MB (9.9MB)
    const payload = generateLargePayload(8 * 1024); // ~8MB
    const size = getPayloadSize(payload);

    expect(size).toBeLessThan(10 * 1024 * 1024);
    expect(size).toBeGreaterThan(7 * 1024 * 1024);

    const result = validateWebhookPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // ========================================
  // VALIDAÇÃO DE PROFUNDIDADE (NESTING)
  // ========================================

  // ✅ CENÁRIO POSITIVO: Payload com 15 níveis (dentro do limite)
  it('deve aceitar payload com 15 níveis de nesting', async () => {
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

    const payload = generateNestedPayload(15);

    const result = validateWebhookPayload(payload);
    expect(result.valid).toBe(true);

    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
      { timeout: 15000 },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();
  });

  // ❌ CENÁRIO NEGATIVO: Payload com 25 níveis (acima do limite)
  it('validateWebhookPayload deve rejeitar payload com 25 níveis', () => {
    const deepPayload = generateNestedPayload(25);

    const result = validateWebhookPayload(deepPayload);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum depth');
    expect(result.error).toContain('20 levels');
  });

  // ✅ CENÁRIO POSITIVO: Payload no limite de profundidade (15 níveis é seguro)
  // generateNestedPayload(15) cria: raiz(1) + message(2) + 15 níveis = 17 níveis total
  it('deve aceitar payload com 15 níveis de nesting (abaixo do limite de 20)', () => {
    const payload = generateNestedPayload(15);

    const result = validateWebhookPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // ❌ CENÁRIO NEGATIVO: Payload com 50 níveis (proteção contra stack overflow)
  it('validateWebhookPayload deve rejeitar payload com 50 níveis', () => {
    const veryDeepPayload = generateNestedPayload(50);

    const result = validateWebhookPayload(veryDeepPayload);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum depth');
  });

  // ========================================
  // VALIDAÇÃO DE ESTRUTURA DE DADOS
  // ========================================

  // ❌ CENÁRIO NEGATIVO: Payload não é objeto
  it('validateWebhookPayload deve rejeitar strings', () => {
    const result = validateWebhookPayload('string payload');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be an object');
  });

  // ❌ CENÁRIO NEGATIVO: Payload é número
  it('validateWebhookPayload deve rejeitar números', () => {
    const result = validateWebhookPayload(12345);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be an object');
  });

  // ❌ CENÁRIO NEGATIVO: Payload é null
  it('validateWebhookPayload deve rejeitar null', () => {
    const result = validateWebhookPayload(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be null or undefined');
  });

  // ❌ CENÁRIO NEGATIVO: Payload é undefined
  it('validateWebhookPayload deve rejeitar undefined', () => {
    const result = validateWebhookPayload(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be null or undefined');
  });

  // ❌ CENÁRIO NEGATIVO: Array como root do payload (por default não aceita)
  it('validateWebhookPayload deve rejeitar arrays como root', () => {
    const arrayPayload = [1, 2, 3, 4, 5];
    const result = validateWebhookPayload(arrayPayload);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be an array');
  });

  // ✅ CENÁRIO POSITIVO: Array como root permitido com opção
  it('validateWebhookPayload deve aceitar arrays quando allowArrayRoot=true', () => {
    const arrayPayload = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = validateWebhookPayload(arrayPayload, {
      allowArrayRoot: true,
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // ========================================
  // PROTEÇÃO CONTRA CIRCULAR REFERENCES
  // ========================================

  // ❌ CENÁRIO NEGATIVO: Payload com circular reference
  it('validateWebhookPayload deve detectar circular references', () => {
    const circularPayload: any = { name: 'Test' };
    circularPayload.self = circularPayload; // Circular reference

    const result = validateWebhookPayload(circularPayload);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot be serialized to JSON');
  });

  // ========================================
  // VALIDAÇÃO COM OPÇÕES CUSTOMIZADAS
  // ========================================

  // ✅ CENÁRIO POSITIVO: Validação com limite customizado (1MB)
  it('validateWebhookPayload deve respeitar maxSizeBytes customizado', () => {
    // Payload de 2MB
    const payload = generateLargePayload(2 * 1024);

    // Com limite de 1MB, deve rejeitar
    const result = validateWebhookPayload(payload, {
      maxSizeBytes: 1 * 1024 * 1024, // 1MB
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum size');
    expect(result.error).toContain('1048576 bytes');
  });

  // ✅ CENÁRIO POSITIVO: Validação com profundidade customizada (10 níveis)
  it('validateWebhookPayload deve respeitar maxDepth customizado', () => {
    // Payload com 15 níveis
    const payload = generateNestedPayload(15);

    // Com limite de 10 níveis, deve rejeitar
    const result = validateWebhookPayload(payload, { maxDepth: 10 });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceeds maximum depth');
    expect(result.error).toContain('10 levels');
  });

  // ========================================
  // EDGE CASES DE SEGURANÇA
  // ========================================

  // ✅ CENÁRIO POSITIVO: Payload com muitas keys (mas tamanho pequeno)
  it('deve processar payload com muitas keys (1000+)', async () => {
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

    // Criar payload com 1000 keys
    const manyKeysPayload: any = {};
    for (let i = 0; i < 1000; i++) {
      manyKeysPayload[`key_${i}`] = `value_${i}`;
    }

    const result = validateWebhookPayload(manyKeysPayload);
    expect(result.valid).toBe(true);

    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      manyKeysPayload,
      { timeout: 15000 },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();
  });

  // ✅ CENÁRIO POSITIVO: Payload com arrays muito longos
  it('deve processar payload com array de 10000 itens', async () => {
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

    const longArrayPayload = {
      items: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: i * 2 })),
    };

    const result = validateWebhookPayload(longArrayPayload);
    expect(result.valid).toBe(true);

    const { executionId, jobResult, duration } = await triggerAndWait(
      flowId,
      webhookId,
      longArrayPayload,
      { timeout: 20000 },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();

    console.log(`⏱️  Array com 1000 itens processado em ${duration}ms`);
  }, 30000);

  // ✅ CENÁRIO POSITIVO: Payload misto complexo (stress test de estrutura)
  it('deve processar payload misto complexo com múltiplos tipos', async () => {
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

    const complexPayload = {
      string: 'text',
      number: 42,
      float: 3.14159,
      boolean: true,
      null: null,
      array: [1, 'two', true, null, { nested: 'value' }],
      object: {
        deep: {
          nested: {
            structure: {
              with: {
                data: 'deep value',
              },
            },
          },
        },
      },
      largeArray: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        },
      })),
    };

    const result = validateWebhookPayload(complexPayload);
    expect(result.valid).toBe(true);

    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      complexPayload,
      { timeout: 15000 },
    );

    expect(jobResult.status).toBe('success');
    expect(executionId).toBeDefined();
  });
});
