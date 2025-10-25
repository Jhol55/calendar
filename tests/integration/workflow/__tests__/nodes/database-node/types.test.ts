/**
 * Testes de Integração: Database Node - Data Types
 *
 * Testa tipos de dados e validações:
 * - Tipo Object (JSONB)
 * - Tipo Array (JSONB)
 * - Tipo String (não parsear JSON)
 * - Validações de tipo
 * - Edge cases com null, objetos vazios, arrays vazios
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

describe('Database Node - Tipos de Dados JSONB', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  describe('Tipo: Object - Cenários Positivos', () => {
    it('deve armazenar e recuperar objeto simples', async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'config', type: 'object' },
      ]);
      await databaseService.insertRecord(String(userId), tableName, {
        id: '1',
        config: { theme: 'dark', lang: 'pt-BR' },
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
      expect(typeof record.config).toBe('object');
      expect(record.config.theme).toBe('dark');
      expect(record.config.lang).toBe('pt-BR');
    });

    it('deve armazenar e recuperar objeto aninhado (múltiplos níveis)', async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'data', type: 'object' },
      ]);
      await databaseService.insertRecord(String(userId), tableName, {
        id: '1',
        data: {
          user: {
            name: 'João',
            address: { city: 'São Paulo', zipcode: '01234-567' },
          },
        },
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
      expect(record.data.user.name).toBe('João');
      expect(record.data.user.address.city).toBe('São Paulo');
    });

    it('deve armazenar e recuperar objetos profundamente aninhados (3+ níveis)', async () => {
      const deepData = {
        level1: {
          level2: {
            level3: 'valor final',
          },
        },
      };

      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'deepData', type: 'object' },
      ]);
      await databaseService.insertRecord(String(userId), tableName, {
        id: '1',
        deepData: deepData,
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
      expect(typeof record.deepData).toBe('object');
      expect(typeof record.deepData.level1).toBe('object');
      expect(typeof record.deepData.level1.level2).toBe('object');
      expect(record.deepData.level1.level2.level3).toBe('valor final');
    });
  });

  describe('Tipo: Array - Cenários Positivos', () => {
    it('deve armazenar e recuperar arrays simples', async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'tags', type: 'array' },
      ]);
      await databaseService.insertRecord(String(userId), tableName, {
        id: '1',
        tags: ['javascript', 'typescript', 'react'],
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
      expect(Array.isArray(record.tags)).toBe(true);
      expect(record.tags).toHaveLength(3);
      expect(record.tags[0]).toBe('javascript');
    });

    it('deve armazenar e recuperar array de objetos complexos', async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'items', type: 'array' },
      ]);
      await databaseService.insertRecord(String(userId), tableName, {
        id: '1',
        items: [
          { id: '1', metadata: { stock: 10, reserved: 2 } },
          { id: '2', metadata: { stock: 5, reserved: 1 } },
        ],
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
      expect(Array.isArray(record.items)).toBe(true);
      expect(record.items).toHaveLength(2);
      expect(typeof record.items[0].metadata).toBe('object');
      expect(record.items[0].metadata.stock).toBe(10);
      expect(record.items[0].metadata.reserved).toBe(2);
      expect(record.items[1].metadata.stock).toBe(5);
      expect(record.items[1].metadata.reserved).toBe(1);
    });
  });

  describe('Tipo: String - Não deve parsear JSON', () => {
    it('não deve parsear strings normais que não são JSON', async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'price', type: 'string' },
      ]);
      await databaseService.insertRecord(String(userId), tableName, {
        id: '1',
        description: 'Este é um texto normal sem JSON',
        price: '19.99',
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
      expect(typeof record.description).toBe('string');
      expect(record.description).toBe('Este é um texto normal sem JSON');
      expect(typeof record.price).toBe('string');
      expect(record.price).toBe('19.99');
    });
  });
});

describe('Database Node - Validações de Tipo', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  describe('Validações Negativas - Tipo Object', () => {
    it('deve rejeitar string JSON em campo object (validação de tipo)', async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'config', type: 'object' },
      ]);

      // Tentando inserir string JSON em campo object deve falhar
      await expect(
        databaseService.insertRecord(String(userId), tableName, {
          id: '1',
          config: '{"theme":"dark"}', // String, não objeto
        }),
      ).rejects.toThrow(/deve ser do tipo "object"/);
    });

    it('deve rejeitar número em campo object', async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'data', type: 'object' },
      ]);

      await expect(
        databaseService.insertRecord(String(userId), tableName, {
          id: '1',
          data: 123, // Número, não objeto
        }),
      ).rejects.toThrow(/deve ser do tipo "object"/);
    });

    it('deve rejeitar boolean em campo object', async () => {
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'flag', type: 'object' },
      ]);

      await expect(
        databaseService.insertRecord(String(userId), tableName, {
          id: '1',
          flag: true, // Boolean, não objeto
        }),
      ).rejects.toThrow(/deve ser do tipo "object"/);
    });
  });
});

describe('Database Node - Edge Cases (Types)', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  it('deve aceitar null em campo object não obrigatório', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'optional', type: 'object', required: false },
    ]);

    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      optional: null,
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
    expect(record.optional).toBeNull();
  });

  it('deve armazenar objeto vazio {}', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'empty', type: 'object' },
    ]);

    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      empty: {},
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
    expect(typeof record.empty).toBe('object');
    expect(Object.keys(record.empty)).toHaveLength(0);
  });

  it('deve armazenar array vazio []', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'items', type: 'array' },
    ]);

    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      items: [],
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
    expect(Array.isArray(record.items)).toBe(true);
    expect(record.items).toHaveLength(0);
  });
});
