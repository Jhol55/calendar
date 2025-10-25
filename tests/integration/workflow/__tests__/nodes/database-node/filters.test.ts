/**
 * Testes de Integração: Database Node - Filters
 *
 * Testa filtros e operadores:
 * - Filtros complexos (múltiplos, AND)
 * - Operador contains
 * - Operador startsWith
 * - Operadores numéricos (greaterThan, lessThan, etc)
 * - Resolução de variáveis em filtros
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

describe('Database Node - Filtros Complexos', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  it('deve aplicar múltiplos filtros com operador AND implícito', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'priority', type: 'string' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      status: 'active',
      priority: 'high',
    });
    await databaseService.insertRecord(String(userId), tableName, {
      id: '2',
      status: 'active',
      priority: 'low',
    });
    await databaseService.insertRecord(String(userId), tableName, {
      id: '3',
      status: 'inactive',
      priority: 'high',
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', tableName, {
        userId,
        filters: [
          {
            field: 'status',
            operator: 'equals',
            value: 'active',
          },
          {
            field: 'priority',
            operator: 'equals',
            value: 'high',
          },
        ],
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get filtered' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    // Deve retornar apenas o registro que atende ambos os critérios
    expect(dbOutput.count).toBe(1);
    expect(dbOutput.records[0].id).toBe('1');
    expect(dbOutput.records[0].status).toBe('active');
    expect(dbOutput.records[0].priority).toBe('high');
  });

  it('deve aplicar filtros com variáveis resolvidas', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'price', type: 'number' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      category: 'electronics',
      price: 100,
    });
    await databaseService.insertRecord(String(userId), tableName, {
      id: '2',
      category: 'books',
      price: 50,
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', tableName, {
        userId,
        filters: [
          {
            field: 'category',
            operator: 'equals',
            value: '{{$nodes.' + webhookId + '.output.message.filterCategory}}',
          },
        ],
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { filterCategory: 'electronics' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.count).toBe(1);
    expect(dbOutput.records[0].category).toBe('electronics');
  });
});

describe('Database Node - Operadores de Filtro', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  describe('Operador: contains', () => {
    it('deve filtrar registros que contém substring', async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'description', type: 'string' },
      ]);
      await databaseService.insertRecord(String(userId), tableName, {
        id: '1',
        description: 'Produto A com desconto',
      });
      await databaseService.insertRecord(String(userId), tableName, {
        id: '2',
        description: 'Produto B sem desconto',
      });
      await databaseService.insertRecord(String(userId), tableName, {
        id: '3',
        description: 'Outro produto',
      });

      const webhookId = generateTestId('webhook');
      const dbNodeId = generateTestId('db');

      const nodes = [
        createWebhookNode(webhookId),
        createDatabaseNode(dbNodeId, 'get', tableName, {
          userId,
          filters: [
            {
              field: 'description',
              operator: 'contains',
              value: 'desconto',
            },
          ],
        }),
      ];

      const edges = [createEdge('e1', webhookId, dbNodeId)];

      const flowId = await createTestFlow(nodes, edges, { userId });

      const { executionId } = await triggerAndWait(flowId, webhookId, {
        message: { text: 'Get' },
      });

      const dbOutput = await getNodeOutput(executionId, dbNodeId);

      expect(dbOutput.count).toBe(2);
      expect(
        dbOutput.records.every((r: { description: string }) =>
          r.description.includes('desconto'),
        ),
      ).toBe(true);
    });
  });

  describe('Operador: starts_with', () => {
    it('deve filtrar registros que começam com prefixo', async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'code', type: 'string' },
      ]);
      await databaseService.insertRecord(String(userId), tableName, {
        id: '1',
        code: 'PROD-001',
      });
      await databaseService.insertRecord(String(userId), tableName, {
        id: '2',
        code: 'PROD-002',
      });
      await databaseService.insertRecord(String(userId), tableName, {
        id: '3',
        code: 'SRV-001',
      });

      const webhookId = generateTestId('webhook');
      const dbNodeId = generateTestId('db');

      const nodes = [
        createWebhookNode(webhookId),
        createDatabaseNode(dbNodeId, 'get', tableName, {
          userId,
          filters: [
            {
              field: 'code',
              operator: 'startsWith',
              value: 'PROD',
            },
          ],
        }),
      ];

      const edges = [createEdge('e1', webhookId, dbNodeId)];

      const flowId = await createTestFlow(nodes, edges, { userId });

      const { executionId } = await triggerAndWait(flowId, webhookId, {
        message: { text: 'Get' },
      });

      const dbOutput = await getNodeOutput(executionId, dbNodeId);

      expect(dbOutput.count).toBe(2);
      expect(
        dbOutput.records.every((r: { code: string }) =>
          r.code.startsWith('PROD'),
        ),
      ).toBe(true);
    });
  });

  describe('Operadores Numéricos', () => {
    beforeEach(async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'price', type: 'number' },
      ]);
      await databaseService.insertRecord(String(userId), tableName, {
        id: '1',
        price: 50,
      });
      await databaseService.insertRecord(String(userId), tableName, {
        id: '2',
        price: 100,
      });
      await databaseService.insertRecord(String(userId), tableName, {
        id: '3',
        price: 150,
      });
    });

    it('deve filtrar com greater_than', async () => {
      const webhookId = generateTestId('webhook');
      const dbNodeId = generateTestId('db');

      const nodes = [
        createWebhookNode(webhookId),
        createDatabaseNode(dbNodeId, 'get', tableName, {
          userId,
          filters: [
            {
              field: 'price',
              operator: 'greaterThan',
              value: '100',
            },
          ],
        }),
      ];

      const edges = [createEdge('e1', webhookId, dbNodeId)];

      const flowId = await createTestFlow(nodes, edges, { userId });

      const { executionId } = await triggerAndWait(flowId, webhookId, {
        message: { text: 'Get' },
      });

      const dbOutput = await getNodeOutput(executionId, dbNodeId);

      expect(dbOutput.count).toBe(1);
      expect(dbOutput.records[0].price).toBe(150);
    });

    it('deve filtrar com less_than', async () => {
      const webhookId = generateTestId('webhook');
      const dbNodeId = generateTestId('db');

      const nodes = [
        createWebhookNode(webhookId),
        createDatabaseNode(dbNodeId, 'get', tableName, {
          userId,
          filters: [
            {
              field: 'price',
              operator: 'lessThan',
              value: '100',
            },
          ],
        }),
      ];

      const edges = [createEdge('e1', webhookId, dbNodeId)];

      const flowId = await createTestFlow(nodes, edges, { userId });

      const { executionId } = await triggerAndWait(flowId, webhookId, {
        message: { text: 'Get' },
      });

      const dbOutput = await getNodeOutput(executionId, dbNodeId);

      expect(dbOutput.count).toBe(1);
      expect(dbOutput.records[0].price).toBe(50);
    });

    it('deve filtrar com greater_or_equal', async () => {
      const webhookId = generateTestId('webhook');
      const dbNodeId = generateTestId('db');

      const nodes = [
        createWebhookNode(webhookId),
        createDatabaseNode(dbNodeId, 'get', tableName, {
          userId,
          filters: [
            {
              field: 'price',
              operator: 'greaterThanOrEqual',
              value: '100',
            },
          ],
        }),
      ];

      const edges = [createEdge('e1', webhookId, dbNodeId)];

      const flowId = await createTestFlow(nodes, edges, { userId });

      const { executionId } = await triggerAndWait(flowId, webhookId, {
        message: { text: 'Get' },
      });

      const dbOutput = await getNodeOutput(executionId, dbNodeId);

      expect(dbOutput.count).toBe(2);
      expect(dbOutput.records[0].price).toBe(100);
      expect(dbOutput.records[1].price).toBe(150);
    });

    it('deve filtrar com less_or_equal', async () => {
      const webhookId = generateTestId('webhook');
      const dbNodeId = generateTestId('db');

      const nodes = [
        createWebhookNode(webhookId),
        createDatabaseNode(dbNodeId, 'get', tableName, {
          userId,
          filters: [
            {
              field: 'price',
              operator: 'lessThanOrEqual',
              value: '100',
            },
          ],
        }),
      ];

      const edges = [createEdge('e1', webhookId, dbNodeId)];

      const flowId = await createTestFlow(nodes, edges, { userId });

      const { executionId } = await triggerAndWait(flowId, webhookId, {
        message: { text: 'Get' },
      });

      const dbOutput = await getNodeOutput(executionId, dbNodeId);

      expect(dbOutput.count).toBe(2);
      expect(dbOutput.records[0].price).toBe(50);
      expect(dbOutput.records[1].price).toBe(100);
    });
  });
});
