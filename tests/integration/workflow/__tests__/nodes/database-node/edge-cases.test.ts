/**
 * Testes de Integração: Database Node - Edge Cases
 *
 * Testa cenários negativos e casos extremos:
 * - Validações negativas (operações inválidas, tabelas inexistentes)
 * - Resultados vazios (filtros sem match)
 * - Datasets grandes e concorrência
 * - Estruturas complexas (JSONB profundo)
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

describe('Database Node - Negative Scenarios', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  it('should fail when operation type is invalid', async () => {
    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: dbNodeId,
        type: 'database',
        position: { x: 200, y: 100 },
        data: {
          label: 'Invalid Operation',
          config: {
            operation: 'invalidOperation', // Operação inválida
            tableName: tableName,
            userId,
          },
        },
      },
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/não suportada|not supported/i);
  });

  it('should fail when trying to operate on non-existent table', async () => {
    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', 'non_existent_table_12345', {
        userId,
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/não encontrad|not found/i);
  });

  it('should fail when column type is invalid in addColumns', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
    ]);

    // Tentar adicionar coluna com tipo inválido deve falhar
    await expect(
      databaseService.addColumns(String(userId), tableName, [
        // @ts-expect-error - Testing invalid type
        { name: 'invalidField', type: 'invalidType' },
      ]),
    ).rejects.toThrow();
  });

  it('should fail when required field is missing in insert', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string', required: true },
      { name: 'name', type: 'string', required: true },
    ]);

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'insert', tableName, {
        userId,
        record: {
          id: '1',
          // name ausente - campo obrigatório
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/obrigatório|required/i);
  });

  it('should fail when type mismatch in update (string to number field)', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'price', type: 'number' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      price: 100,
    });

    // Tentar atualizar campo number com string deve falhar (string em campo number)
    await expect(
      databaseService.updateRecords(
        String(userId),
        tableName,
        { condition: 'AND', rules: [] },
        { price: 'not a number' },
      ),
    ).rejects.toThrow(/tipo|type/i);
  });

  it('should fail when using invalid filter operator', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'value', type: 'number' },
    ]);

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', tableName, {
        userId,
        filters: [
          {
            field: 'value',
            operator: 'invalidOperator', // Operador inválido
            value: '10',
          },
        ],
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/operador|operator/i);
  });

  it('should fail when adding duplicate column names', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
    ]);

    // Tentar adicionar coluna com nome duplicado deve falhar
    await expect(
      databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' }, // Coluna já existe
      ]),
    ).rejects.toThrow(/já existe|already exists|duplicad/i);
  });
});

describe('Database Node - Edge Cases (Empty Results)', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  it('should return empty results when get with filters matches nothing', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'status', type: 'string' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      status: 'active',
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
            value: 'non_existent_status',
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

    expect(dbOutput.success).toBe(true);
    expect(dbOutput.count).toBe(0);
    expect(dbOutput.records).toHaveLength(0);
  });

  it('should return zero affected when update matches no records', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'status', type: 'string' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      status: 'active',
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'update', tableName, {
        userId,
        filters: [
          {
            field: 'id',
            operator: 'equals',
            value: 'non_existent_id',
          },
        ],
        updates: {
          status: 'updated',
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Update' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.success).toBe(true);
    expect(dbOutput.affected).toBe(0);
  });

  it('should return zero affected when delete matches no records', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'status', type: 'string' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      status: 'active',
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'delete', tableName, {
        userId,
        filters: [
          {
            field: 'id',
            operator: 'equals',
            value: 'non_existent_id',
          },
        ],
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Delete' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.success).toBe(true);
    expect(dbOutput.affected).toBe(0);
  });
});

describe('Database Node - Edge Cases (Large Datasets)', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  it('should handle large dataset query with pagination', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'value', type: 'number' },
    ]);

    // Inserir 100 registros
    const insertPromises = [];
    for (let i = 1; i <= 100; i++) {
      insertPromises.push(
        databaseService.insertRecord(String(userId), tableName, {
          id: String(i),
          value: i,
        }),
      );
    }
    await Promise.all(insertPromises);

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', tableName, {
        userId,
        limit: 20,
        offset: 40,
        sort: {
          field: 'value',
          order: 'asc',
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.success).toBe(true);
    expect(dbOutput.count).toBe(100); // Total de registros
    expect(dbOutput.records).toHaveLength(20); // Apenas 20 retornados
    // Com offset 40, deve retornar registros 41-60
    expect(dbOutput.records[0].value).toBe(41);
    expect(dbOutput.records[19].value).toBe(60);
  });

  it('should handle concurrent inserts to same table', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'timestamp', type: 'string' },
    ]);

    // Executar 5 inserts concorrentes
    const insertPromises = [];
    for (let i = 1; i <= 5; i++) {
      insertPromises.push(
        databaseService.insertRecord(String(userId), tableName, {
          id: `concurrent-${i}`,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    await expect(Promise.all(insertPromises)).resolves.toBeDefined();

    // Verificar que todos foram inseridos
    const records = await databaseService.getRecords(
      String(userId),
      tableName,
      {},
    );
    expect(records).toHaveLength(5);
  });

  it('should allow schema update while data exists', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
    ]);

    // Inserir dados
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      name: 'Test',
    });

    // Adicionar nova coluna
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'email', type: 'string' },
    ]);

    // Verificar que schema foi atualizado
    const stats = await databaseService.getTableStats(
      String(userId),
      tableName,
    );
    expect(stats.schema.columns.length).toBe(3); // id, name, email

    // Dados antigos ainda devem estar acessíveis
    const records = await databaseService.getRecords(
      String(userId),
      tableName,
      {},
    );
    expect(records[0].name).toBe('Test');
  });
});

describe('Database Node - Edge Cases (Complex Structures)', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  it('should handle complex nested JSONB structure (5+ levels)', async () => {
    const deepStructure = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                value: 'deep value',
                array: [1, 2, 3],
                nested: { key: 'final' },
              },
            },
          },
        },
      },
    };

    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'data', type: 'object' },
    ]);

    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      data: deepStructure,
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'get', tableName, { userId }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Get' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    const record = dbOutput.records[0];
    expect(typeof record.data).toBe('object');
    expect(record.data.level1.level2.level3.level4.level5.value).toBe(
      'deep value',
    );
    expect(
      Array.isArray(record.data.level1.level2.level3.level4.level5.array),
    ).toBe(true);
    expect(record.data.level1.level2.level3.level4.level5.nested.key).toBe(
      'final',
    );
  });
});
