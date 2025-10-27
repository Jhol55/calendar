/**
 * Testes E2E - Variable Resolution
 * Valida resolução de variáveis entre nodes
 */

import {
  cleanDatabase,
  cleanQueue,
  closeDatabaseConnection,
  createTestFlow,
  getNodeOutput,
  getNodeExecutions,
  generateTestId,
  createTestUser,
  testContext,
  createEdge,
} from '../../setup';
import { createWebhookNode, triggerAndWait } from '../../../helpers/webhook';
import { createDatabaseNode } from '../../nodes/database-node/setup';
import { createMemoryNode } from '../../nodes/memory-node/setup';
import { databaseService } from '@/services/database/database.service';

describe('Variables - $nodes', () => {
  it('deve resolver {{$nodes.webhook.output.field}}', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'test_name',
        '{{$nodes.' + webhookId + '.output.message.name}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { name: 'João Silva', age: 30 },
    });

    const nodeExecutions = await getNodeExecutions(executionId);

    // Validar que variável foi resolvida
    expect(nodeExecutions[webhookId].data.message.name).toBe('João Silva');
  });

  it('deve resolver variável de array com índice', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'test_item',
        '{{$nodes.' + webhookId + '.output.message.items.0.name}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: {
        items: [
          { name: 'Item A', price: 10 },
          { name: 'Item B', price: 20 },
        ],
      },
    });

    const nodeExecutions = await getNodeExecutions(executionId);

    expect(nodeExecutions[webhookId].data.message.items[0].name).toBe('Item A');
  });

  it('deve encadear variáveis de múltiplos nodes', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');
    const messageId = generateTestId('message');
    const userId = await createTestUser();

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        memoryId,
        'write',
        'userName',
        '{{$nodes.' + webhookId + '.output.message.name}}',
      ),
      createMemoryNode(
        messageId,
        'write',
        'final_greeting',
        '{{$nodes.' + memoryId + '.output.items.0.value}}',
      ),
    ];

    const edges = [
      createEdge('e1', webhookId, memoryId),
      createEdge('e2', memoryId, messageId),
    ];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { name: 'Maria' },
    });

    if (!result.executionId) {
      throw new Error(
        `ExecutionId is undefined. JobResult: ${JSON.stringify(result.jobResult)}`,
      );
    }

    const memoryOutput = await getNodeOutput(result.executionId, memoryId);

    // Memory save retorna: { action: 'save', items: [{ key, value }] }
    expect(memoryOutput.items).toBeDefined();
    expect(memoryOutput.items[0].key).toBe('userName');
    expect(memoryOutput.items[0].value).toBe('Maria');
  });
});

describe('Variables - Database Output', () => {
  it('deve usar output do database em node seguinte', async () => {
    const userId = testContext.userId!;
    const tableName = generateTestId('table');

    // Criar schema e inserir dados de teste
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'produto', type: 'string' },
      { name: 'preco', type: 'number' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      produto: 'Laptop',
      preco: 1500,
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, {
        operation: 'get',
        table: tableName,
      }),
      createMemoryNode(
        messageId,
        'write',
        'product_count',
        '{{$nodes.' + dbNodeId + '.output.count}}',
      ),
    ];

    const edges = [
      createEdge('e1', webhookId, dbNodeId),
      createEdge('e2', dbNodeId, messageId),
    ];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get products' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.count).toBe(1);
    expect(dbOutput.records[0].produto).toBe('Laptop');
  });

  it('deve acessar campo específico de record do database', async () => {
    const userId = testContext.userId!;
    const tableName = generateTestId('table');

    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'details', type: 'object' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      status: 'active',
      details: { priority: 'high', assignee: 'João' },
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, {
        operation: 'get',
        table: tableName,
      }),
      createMemoryNode(
        messageId,
        'write',
        'assignee',
        '{{$nodes.' + dbNodeId + '.output.records.0.details.assignee}}',
      ),
    ];

    const edges = [
      createEdge('e1', webhookId, dbNodeId),
      createEdge('e2', dbNodeId, messageId),
    ];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get details' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    // Validar que details foi parseado recursivamente
    expect(typeof dbOutput.records[0].details).toBe('object');
    expect(dbOutput.records[0].details.assignee).toBe('João');
  });
});

describe('Variables - Variável não encontrada', () => {
  it('deve manter placeholder quando variável não existe', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'non_existent',
        '{{$nodes.' + webhookId + '.output.message.nonExistent}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    const memoryOutput = await getNodeOutput(executionId, messageId);

    // Variável não resolvida deve manter o placeholder original (save retorna items[])
    expect(memoryOutput.items[0].value).toContain('{{$nodes.');
    expect(memoryOutput.items[0].value).toContain(
      '.output.message.nonExistent}}',
    );
  });
});

// ==============================================
// EDGE CASES - SINTAXE INVÁLIDA
// ==============================================

describe('Variables - Edge Cases (Invalid Syntax)', () => {
  it('should keep placeholder when variable has malformed brackets', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'malformed',
        '{{$nodes.' + webhookId + '.output.name}', // Falta fechar }}
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { name: 'Test' },
    });

    const memoryOutput = await getNodeOutput(executionId, messageId);

    // Variável mal formada deve ser mantida como está (save retorna items[])
    expect(memoryOutput.items[0].value).toContain('{{$nodes.');
  });

  it('should keep placeholder when variable has missing dots in path', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'missing_dots',
        '{{$nodes.' + webhookId + 'outputmessagename}}', // Faltam os dots
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { name: 'Test' },
    });

    const memoryOutput = await getNodeOutput(executionId, messageId);

    // Sintaxe inválida deve manter placeholder (save retorna items[])
    expect(memoryOutput.items[0].value).toContain('{{$nodes.');
  });
});

// ==============================================
// EDGE CASES - ACESSO A PROPRIEDADES
// ==============================================

describe('Variables - Edge Cases (Property Access)', () => {
  it('should keep placeholder when accessing property on null/undefined', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'nested_null',
        '{{$nodes.' + webhookId + '.output.message.nullField.nestedProperty}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { nullField: null },
    });

    const memoryOutput = await getNodeOutput(executionId, messageId);

    // Acessar propriedade de null deve manter placeholder (save retorna items[])
    expect(memoryOutput.items[0].value).toContain('{{$nodes.');
  });

  it('should handle very deep object nesting (10+ levels)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'deep_nested',
        '{{$nodes.' +
          webhookId +
          '.output.message.l1.l2.l3.l4.l5.l6.l7.l8.l9.l10.value}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: {
        l1: {
          l2: {
            l3: {
              l4: {
                l5: {
                  l6: {
                    l7: { l8: { l9: { l10: { value: 'deep value' } } } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const memoryOutput = await getNodeOutput(executionId, messageId);

    // Save retorna items[]
    expect(memoryOutput.items[0].value).toBe('deep value');
  });

  it('should keep placeholder when array index is out of bounds', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'out_of_bounds',
        '{{$nodes.' + webhookId + '.output.message.items.99.name}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: {
        items: [{ name: 'Item 1' }, { name: 'Item 2' }],
      },
    });

    const memoryOutput = await getNodeOutput(executionId, messageId);

    // Índice fora do limite deve manter placeholder (save retorna items[])
    expect(memoryOutput.items[0].value).toContain('{{$nodes.');
  });

  it('should keep placeholder when using negative array index', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'negative_index',
        '{{$nodes.' + webhookId + '.output.message.items.-1.name}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: {
        items: [{ name: 'Item 1' }, { name: 'Item 2' }],
      },
    });

    const memoryOutput = await getNodeOutput(executionId, messageId);

    // Índice negativo deve manter placeholder (save retorna items[])
    expect(memoryOutput.items[0].value).toContain('{{$nodes.');
  });

  it('should keep placeholder when treating string as object', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'string_property',
        '{{$nodes.' + webhookId + '.output.message.stringField.property}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { stringField: 'just a string' },
    });

    const memoryOutput = await getNodeOutput(executionId, messageId);

    // Acessar propriedade de string deve manter placeholder (save retorna items[])
    expect(memoryOutput.items[0].value).toContain('{{$nodes.');
  });
});

// ==============================================
// EDGE CASES - CARACTERES ESPECIAIS
// ==============================================

describe('Variables - Edge Cases (Special Characters)', () => {
  it('should handle property names with special characters', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'hyphen_key',
        '{{$nodes.' + webhookId + '.output.message.user-id}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { 'user-id': '12345' },
    });

    const memoryOutput = await getNodeOutput(executionId, messageId);

    // Propriedade com hífen deve ser resolvida (save retorna items[])
    expect(memoryOutput.items[0].value).toBe('12345');
  });

  it('should handle unicode and emoji in variable values', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        messageId,
        'write',
        'test_name',
        '{{$nodes.' + webhookId + '.output.message.name}}',
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { name: '🚀 João 世界 مرحبا' },
    });

    const memoryOutput = await getNodeOutput(executionId, messageId);

    // Unicode e emojis devem ser preservados (save retorna items[])
    expect(memoryOutput.items[0].value).toBe('🚀 João 世界 مرحبا');
  });
});
