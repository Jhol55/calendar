/**
 * Testes E2E - Variable Resolution
 * Valida resolução de variáveis entre nodes
 */

import './setup';
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
} from './setup';
import {
  createMessageNode,
  createDatabaseNode,
  createMemoryNode,
  createEdge,
} from './fixtures';
import { databaseNodeService } from '@/services/database/database.service';

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
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'produto', type: 'string' },
      { name: 'preco', type: 'number' },
    ]);
    await databaseNodeService.insertRecord(String(userId), tableName, {
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

    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'details', type: 'object' },
    ]);
    await databaseNodeService.insertRecord(String(userId), tableName, {
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
