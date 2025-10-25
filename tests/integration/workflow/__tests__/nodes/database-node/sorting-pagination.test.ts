/**
 * Testes de Integração: Database Node - Sorting & Pagination
 *
 * Testa ordenação e paginação:
 * - Sorting ASC/DESC
 * - Limit
 * - Offset
 * - Paginação completa (LIMIT + OFFSET)
 */

import '../../../setup';
import {
  cleanDatabase,
  cleanQueue,
  createTestFlow,
  createWebhookNode,
  triggerAndWait,
  getNodeOutput,
  generateTestId,
  createTestUser,
} from '../../../setup';
import { createDatabaseNode, createEdge } from '../../../fixtures';
import { databaseService } from '@/services/database/database.service';

describe('Database Node - Sorting', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  it('deve ordenar registros em ordem crescente (ASC)', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'price', type: 'number' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      price: 150,
    });
    await databaseService.insertRecord(String(userId), tableName, {
      id: '2',
      price: 50,
    });
    await databaseService.insertRecord(String(userId), tableName, {
      id: '3',
      price: 100,
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', tableName, {
        userId,
        sort: {
          field: 'price',
          order: 'asc',
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get sorted' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.count).toBe(3);
    expect(dbOutput.records[0].price).toBe(50);
    expect(dbOutput.records[1].price).toBe(100);
    expect(dbOutput.records[2].price).toBe(150);
  });

  it('deve ordenar registros em ordem decrescente (DESC)', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      name: 'Alice',
    });
    await databaseService.insertRecord(String(userId), tableName, {
      id: '2',
      name: 'Charlie',
    });
    await databaseService.insertRecord(String(userId), tableName, {
      id: '3',
      name: 'Bob',
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', tableName, {
        userId,
        sort: {
          field: 'name',
          order: 'desc',
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get sorted' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.count).toBe(3);
    expect(dbOutput.records[0].name).toBe('Charlie');
    expect(dbOutput.records[1].name).toBe('Bob');
    expect(dbOutput.records[2].name).toBe('Alice');
  });
});

describe('Database Node - Paginação', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  it('deve limitar número de registros retornados (LIMIT)', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'value', type: 'number' },
    ]);

    // Inserir 5 registros
    for (let i = 1; i <= 5; i++) {
      await databaseService.insertRecord(String(userId), tableName, {
        id: String(i),
        value: i * 10,
      });
    }

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', tableName, {
        userId,
        limit: 2,
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get paginated' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.count).toBe(5); // Total de registros
    expect(dbOutput.records).toHaveLength(2); // Mas só retornou 2
  });

  it('deve pular registros iniciais (OFFSET)', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'value', type: 'number' },
    ]);

    // Inserir 5 registros em ordem
    for (let i = 1; i <= 5; i++) {
      await databaseService.insertRecord(String(userId), tableName, {
        id: String(i),
        value: i * 10,
      });
    }

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', tableName, {
        userId,
        sort: {
          field: 'value',
          order: 'asc',
        },
        offset: 2,
        limit: 2,
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get paginated' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.count).toBe(5);
    expect(dbOutput.records).toHaveLength(2);
    // Pulou os 2 primeiros (10, 20), pegou os próximos 2 (30, 40)
    expect(dbOutput.records[0].value).toBe(30);
    expect(dbOutput.records[1].value).toBe(40);
  });

  it('deve combinar LIMIT e OFFSET para paginação completa', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'page', type: 'number' },
    ]);

    // Inserir 10 registros
    for (let i = 1; i <= 10; i++) {
      await databaseService.insertRecord(String(userId), tableName, {
        id: String(i),
        page: i,
      });
    }

    // Simular paginação: página 2, com 3 itens por página
    const pageSize = 3;
    const pageNumber = 2; // Segunda página
    const offset = (pageNumber - 1) * pageSize; // offset = 3

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', tableName, {
        userId,
        sort: {
          field: 'page',
          order: 'asc',
        },
        limit: pageSize,
        offset: offset,
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get page 2' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.count).toBe(10);
    expect(dbOutput.records).toHaveLength(3);
    // Página 2 deve conter itens 4, 5, 6
    expect(dbOutput.records[0].page).toBe(4);
    expect(dbOutput.records[1].page).toBe(5);
    expect(dbOutput.records[2].page).toBe(6);
  });
});
