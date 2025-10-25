/**
 * Testes E2E - Variable Resolution
 * Valida resolução de variáveis entre nodes
 */

import '../setup';
import {
  cleanDatabase,
  cleanQueue,
  closeDatabaseConnection,
  createTestFlow,
  createWebhookNode,
  triggerAndWait,
  getNodeOutput,
  getNodeExecutions,
  generateTestId,
  createTestUser,
} from '../setup';
import {
  createMessageNode,
  createDatabaseNode,
  createMemoryNode,
  createEdge,
} from '../fixtures';
import { databaseService } from '@/services/database/database.service';

describe('Variables - $nodes', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
  });

  it('deve resolver {{$nodes.webhook.output.field}}', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Nome: {{$nodes.' + webhookId + '.output.message.name}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

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
      createMessageNode(
        messageId,
        'Primeiro: {{$nodes.' + webhookId + '.output.message.items.0.name}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

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
      createMessageNode(
        messageId,
        'Olá {{$nodes.' + memoryId + '.output.items.0.value}}!',
        { useTestCredentials: true },
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
    const userId = await createTestUser();
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
      createDatabaseNode(dbNodeId, 'get', tableName, { userId }),
      createMessageNode(
        messageId,
        'Total de produtos: {{$nodes.' + dbNodeId + '.output.count}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [
      createEdge('e1', webhookId, dbNodeId),
      createEdge('e2', dbNodeId, messageId),
    ];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get products' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.count).toBe(1);
    expect(dbOutput.records[0].produto).toBe('Laptop');
  });

  it('deve acessar campo específico de record do database', async () => {
    const userId = await createTestUser();
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
      createDatabaseNode(dbNodeId, 'get', tableName, { userId }),
      createMessageNode(
        messageId,
        'Responsável: {{$nodes.' +
          dbNodeId +
          '.output.records.0.details.assignee}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [
      createEdge('e1', webhookId, dbNodeId),
      createEdge('e2', dbNodeId, messageId),
    ];

    const flowId = await createTestFlow(nodes, edges, { userId });

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
      createMessageNode(
        messageId,
        'Valor: {{$nodes.' + webhookId + '.output.message.nonExistent}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    // Variável não resolvida deve manter o placeholder original
    expect(messageOutput.text).toContain('{{$nodes.');
    expect(messageOutput.text).toContain('.output.message.nonExistent}}');

    // A mensagem enviada deve conter o placeholder não resolvido
    expect(messageOutput.text).toBe(
      `Valor: {{$nodes.${webhookId}.output.message.nonExistent}}`,
    );
  });
});

// ==============================================
// EDGE CASES - SINTAXE INVÁLIDA
// ==============================================

describe('Variables - Edge Cases (Invalid Syntax)', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
  });

  it('should keep placeholder when variable has malformed brackets', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Test: {{$nodes.' + webhookId + '.output.name}', // Falta fechar }}
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { name: 'Test' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    // Variável mal formada deve ser mantida como está
    expect(messageOutput.text).toContain('{{$nodes.');
  });

  it('should keep placeholder when variable has missing dots in path', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Test: {{$nodes.' + webhookId + 'outputmessagename}}', // Faltam os dots
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { name: 'Test' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    // Sintaxe inválida deve manter placeholder
    expect(messageOutput.text).toContain('{{$nodes.');
  });
});

// ==============================================
// EDGE CASES - ACESSO A PROPRIEDADES
// ==============================================

describe('Variables - Edge Cases (Property Access)', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
  });

  it('should keep placeholder when accessing property on null/undefined', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Test: {{$nodes.' +
          webhookId +
          '.output.message.nullField.nestedProperty}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { nullField: null },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    // Acessar propriedade de null deve manter placeholder
    expect(messageOutput.text).toContain('{{$nodes.');
  });

  it('should handle very deep object nesting (10+ levels)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Value: {{$nodes.' +
          webhookId +
          '.output.message.l1.l2.l3.l4.l5.l6.l7.l8.l9.l10.value}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

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

    const messageOutput = await getNodeOutput(executionId, messageId);

    expect(messageOutput.text).toBe('Value: deep value');
  });

  it('should keep placeholder when array index is out of bounds', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Item: {{$nodes.' + webhookId + '.output.message.items.99.name}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: {
        items: [{ name: 'Item 1' }, { name: 'Item 2' }],
      },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    // Índice fora do limite deve manter placeholder
    expect(messageOutput.text).toContain('{{$nodes.');
  });

  it('should keep placeholder when using negative array index', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Item: {{$nodes.' + webhookId + '.output.message.items.-1.name}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: {
        items: [{ name: 'Item 1' }, { name: 'Item 2' }],
      },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    // Índice negativo deve manter placeholder
    expect(messageOutput.text).toContain('{{$nodes.');
  });

  it('should keep placeholder when treating string as object', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Value: {{$nodes.' +
          webhookId +
          '.output.message.stringField.property}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { stringField: 'just a string' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    // Acessar propriedade de string deve manter placeholder
    expect(messageOutput.text).toContain('{{$nodes.');
  });
});

// ==============================================
// EDGE CASES - CARACTERES ESPECIAIS
// ==============================================

describe('Variables - Edge Cases (Special Characters)', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
  });

  it('should handle property names with special characters', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Value: {{$nodes.' + webhookId + '.output.message.user-id}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { 'user-id': '12345' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    // Propriedade com hífen deve ser resolvida
    expect(messageOutput.text).toBe('Value: 12345');
  });

  it('should handle unicode and emoji in variable values', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');

    const nodes = [
      createWebhookNode(webhookId),
      createMessageNode(
        messageId,
        'Name: {{$nodes.' + webhookId + '.output.message.name}}',
        { useTestCredentials: true },
      ),
    ];

    const edges = [createEdge('e1', webhookId, messageId)];

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { name: '🚀 João 世界 مرحبا' },
    });

    const messageOutput = await getNodeOutput(executionId, messageId);

    // Unicode e emojis devem ser preservados
    expect(messageOutput.text).toBe('Name: 🚀 João 世界 مرحبا');
  });
});
