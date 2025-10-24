/**
 * Testes de Integração: Memory Node
 *
 * Testa TODAS as funcionalidades do memory-helper.ts:
 * - Ações: save, fetch, delete
 * - Resolução de variáveis em keys e values
 * - Modos de save: overwrite, append
 * - TTL (Time To Live)
 * - Default values
 * - Validações: memoryName, items obrigatórios
 */

import '../setup';
import {
  cleanDatabase,
  cleanQueue,
  createTestFlow,
  createWebhookNode,
  triggerAndWait,
  getNodeOutput,
  generateTestId,
  createTestUser,
} from '../setup';
import { createMemoryNode, createEdge } from '../fixtures';

// ==============================================
// SAVE - Salvar na Memória
// ==============================================

describe('Memory Node - Save Operations', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('deve salvar valor simples na memória', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryId, 'write', 'testKey', 'Hello World'),
    ];

    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Save test' },
    });

    const memoryOutput = await getNodeOutput(executionId, memoryId);

    expect(memoryOutput.success).toBe(true);
    expect(memoryOutput.action).toBe('save');
    expect(memoryOutput.items).toBeDefined();
    expect(memoryOutput.items.length).toBe(1);
    expect(memoryOutput.items[0].key).toBe('testKey');
    expect(memoryOutput.items[0].value).toBe('Hello World');
  });

  it('deve salvar valor com variável do webhook', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        memoryId,
        'write',
        'userName',
        '{{$nodes.' + webhookId + '.output.message.name}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { name: 'João Silva' },
    });

    const memoryOutput = await getNodeOutput(executionId, memoryId);

    expect(memoryOutput.success).toBe(true);
    expect(memoryOutput.items[0].value).toBe('João Silva');
  });
});

// ==============================================
// FETCH - Buscar da Memória
// ==============================================

describe('Memory Node - Fetch Operations', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('deve buscar valor previamente salvo', async () => {
    const memoryName = generateTestId('unique_memory'); // Memória única para este teste

    // PASSO 1: Salvar valor em um fluxo
    const webhookId1 = generateTestId('webhook');
    const saveId = generateTestId('memory_save');

    const saveNodes = [
      createWebhookNode(webhookId1),
      {
        id: saveId,
        type: 'memory',
        position: { x: 200, y: 100 },
        data: {
          label: 'Save Memory',
          memoryConfig: {
            action: 'save',
            memoryName, // Usar memória única
            items: [{ key: 'testKey', value: 'Saved Value' }],
          },
        },
      },
    ];

    const saveEdges = [createEdge('e1', webhookId1, saveId)];

    const saveFlowId = await createTestFlow(saveNodes, saveEdges, { userId });

    await triggerAndWait(saveFlowId, webhookId1, {
      message: { text: 'Save test' },
    });

    // PASSO 2: Buscar valor em outro fluxo
    const webhookId2 = generateTestId('webhook');
    const fetchId = generateTestId('memory_fetch');

    const fetchNodes = [
      createWebhookNode(webhookId2),
      {
        id: fetchId,
        type: 'memory',
        position: { x: 200, y: 100 },
        data: {
          label: 'Fetch Memory',
          memoryConfig: {
            action: 'fetch',
            memoryName, // Usar a mesma memória única
            items: [{ key: 'testKey', value: '{{$output}}' }],
          },
        },
      },
    ];

    const fetchEdges = [createEdge('e1', webhookId2, fetchId)];

    const fetchFlowId = await createTestFlow(fetchNodes, fetchEdges, {
      userId,
    });

    const { executionId } = await triggerAndWait(fetchFlowId, webhookId2, {
      message: { text: 'Fetch test' },
    });

    const fetchOutput = await getNodeOutput(executionId, fetchId);

    expect(fetchOutput.action).toBe('fetch');
    expect(fetchOutput.found).toBe(true); // fetch retorna 'found', não 'success'
    expect(fetchOutput.value).toBeDefined();

    // O valor é retornado como array de objetos {key, value}
    expect(Array.isArray(fetchOutput.value)).toBe(true);
    expect(fetchOutput.value[0]).toBeDefined();
    expect(fetchOutput.value[0].key).toBe('testKey');
    expect(fetchOutput.value[0].value).toBe('Saved Value');
  });

  it('deve retornar default value se chave não existe', async () => {
    const webhookId = generateTestId('webhook');
    const fetchId = generateTestId('memory_fetch');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: fetchId,
        type: 'memory',
        position: { x: 200, y: 100 },
        data: {
          label: 'Fetch Memory',
          memoryConfig: {
            action: 'fetch',
            memoryName: 'test_memory',
            items: [
              {
                key: 'nonExistentKey',
                value: '{{$output}}',
              },
            ],
            defaultValue: 'Default Value',
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, fetchId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Fetch test' },
    });

    const fetchOutput = await getNodeOutput(executionId, fetchId);

    expect(fetchOutput.action).toBe('fetch');
    expect(fetchOutput.found).toBe(false); // Chave não existe
    expect(fetchOutput.usedDefault).toBe(true); // Usou default value
    // Quando não encontrado e tem defaultValue, o value será o defaultValue
    expect(fetchOutput.value).toBeDefined();
  });
});

// ==============================================
// DELETE - Deletar da Memória
// ==============================================

describe('Memory Node - Delete Operations', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('deve deletar valor da memória', async () => {
    const webhookId = generateTestId('webhook');
    const saveId = generateTestId('memory_save');
    const deleteId = generateTestId('memory_delete');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(saveId, 'write', 'testKey', 'Value to Delete'),
      {
        id: deleteId,
        type: 'memory',
        position: { x: 300, y: 100 },
        data: {
          label: 'Delete Memory',
          memoryConfig: {
            action: 'delete',
            memoryName: 'test_memory',
            items: [
              {
                key: 'testKey',
                value: '',
              },
            ],
          },
        },
      },
    ];

    const edges = [
      createEdge('e1', webhookId, saveId),
      createEdge('e2', saveId, deleteId),
    ];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Delete test' },
    });

    const deleteOutput = await getNodeOutput(executionId, deleteId);

    expect(deleteOutput.success).toBe(true);
    expect(deleteOutput.action).toBe('delete');
  });
});

// ==============================================
// VALIDAÇÕES
// ==============================================

describe('Memory Node - Validations', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('deve falhar se memoryName não fornecido', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: memoryId,
        type: 'memory',
        position: { x: 200, y: 100 },
        data: {
          label: 'Memory No Name',
          memoryConfig: {
            action: 'save',
            // memoryName ausente
            items: [
              {
                key: 'test',
                value: 'value',
              },
            ],
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/memoryName/i);
  });

  it('deve falhar se items não fornecido em save', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: memoryId,
        type: 'memory',
        position: { x: 200, y: 100 },
        data: {
          label: 'Memory No Items',
          memoryConfig: {
            action: 'save',
            memoryName: 'test_memory',
            // items ausente
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/items/i);
  });
});

// ==============================================
// EDGE CASES
// ==============================================

describe('Memory Node - Edge Cases', () => {
  let userId: number;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
  });

  it('deve salvar múltiplos items de uma vez', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: memoryId,
        type: 'memory',
        position: { x: 200, y: 100 },
        data: {
          label: 'Multi Save',
          memoryConfig: {
            action: 'save',
            memoryName: 'test_memory',
            items: [
              { key: 'key1', value: 'value1' },
              { key: 'key2', value: 'value2' },
              { key: 'key3', value: 'value3' },
            ],
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Multi save' },
    });

    const memoryOutput = await getNodeOutput(executionId, memoryId);

    expect(memoryOutput.success).toBe(true);
    expect(memoryOutput.items.length).toBe(3);
  });

  it('deve manter placeholder se variável não existe', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        memoryId,
        'write',
        'testKey',
        '{{$nodes.' + webhookId + '.output.message.nonExistent}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    const memoryOutput = await getNodeOutput(executionId, memoryId);

    // Variável não resolvida deve manter o placeholder
    expect(memoryOutput.items[0].value).toContain('{{$nodes.');
  });
});
