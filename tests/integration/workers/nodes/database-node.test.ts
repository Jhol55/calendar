/**
 * Testes de Integração: Database Node
 *
 * Testa TODAS as funcionalidades do database-helper.ts:
 * - Operações CRUD: get, insert, update, delete
 * - Tipos de dados: string, number, boolean, date, object, array
 * - Validações: tipos, campos obrigatórios, constraints
 * - Edge cases: valores vazios, null, estruturas complexas
 * - Resolução de variáveis em filtros e valores
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
import { createDatabaseNode, createEdge } from '../fixtures';
import { databaseNodeService } from '@/services/database/database.service';

// ==============================================
// OPERAÇÕES CRUD BÁSICAS
// ==============================================

describe('Database Node - Operações CRUD', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  afterEach(async () => {
    // Aguardar para garantir que todos os jobs concluíram antes do próximo teste
    await new Promise((resolve) => setTimeout(resolve, 500));
    await cleanQueue(); // Limpar novamente para garantir
  });

  describe('GET - Buscar Registros', () => {
    it('deve buscar registros e retornar count + records', async () => {
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'nome', type: 'string' },
        { name: 'metadata', type: 'object' },
      ]);
      await databaseNodeService.insertRecord(String(userId), tableName, {
        id: '1',
        nome: 'Produto A',
        metadata: { category: 'electronics', tags: ['new', 'sale'] },
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
        message: { text: 'Get data' },
      });

      const dbOutput = await getNodeOutput(executionId, dbNodeId);

      expect(dbOutput.success).toBe(true);
      expect(dbOutput.count).toBe(1);
      expect(dbOutput.records).toHaveLength(1);

      // Validar que metadata foi parseado corretamente
      const record = dbOutput.records[0];
      expect(typeof record.metadata).toBe('object');
      expect(record.metadata.category).toBe('electronics');
      expect(Array.isArray(record.metadata.tags)).toBe(true);
    });
  });

  describe('INSERT - Inserir Registros', () => {
    it('deve inserir registro com valores do webhook payload', async () => {
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'nome', type: 'string' },
        { name: 'preco', type: 'number' },
      ]);

      const webhookId = generateTestId('webhook');
      const dbNodeId = generateTestId('db');

      const nodes = [
        createWebhookNode(webhookId),
        createDatabaseNode(dbNodeId, 'insert', tableName, {
          userId,
          record: {
            id: '1',
            nome: '{{$nodes.' + webhookId + '.output.message.productName}}',
            preco: '{{$nodes.' + webhookId + '.output.message.price}}',
          },
        }),
      ];

      const edges = [createEdge('e1', webhookId, dbNodeId)];

      const flowId = await createTestFlow(nodes, edges, { userId });

      const { executionId } = await triggerAndWait(flowId, webhookId, {
        message: {
          productName: 'Novo Produto',
          price: 99.99,
        },
      });

      const dbOutput = await getNodeOutput(executionId, dbNodeId);

      expect(dbOutput.success).toBe(true);
      expect(dbOutput.record.nome).toBe('Novo Produto');
      expect(dbOutput.record.preco).toBe(99.99);
    });
  });

  describe('UPDATE - Atualizar Registros', () => {
    it('deve atualizar registro baseado em filtro do webhook', async () => {
      // Usar tabela única para este teste específico
      const uniqueTable = generateTestId('update_table');

      await databaseNodeService.addColumns(String(userId), uniqueTable, [
        { name: 'id', type: 'string' },
        { name: 'status', type: 'string' },
      ]);
      await databaseNodeService.insertRecord(String(userId), uniqueTable, {
        id: '1',
        status: 'pending',
      });

      const webhookId = generateTestId('webhook');
      const dbNodeId = generateTestId('db');

      const nodes = [
        createWebhookNode(webhookId),
        createDatabaseNode(dbNodeId, 'update', uniqueTable, {
          userId,
          filters: [
            {
              field: 'id',
              operator: 'equals',
              value: '{{$nodes.' + webhookId + '.output.message.recordId}}',
            },
          ],
          updates: {
            status: 'completed',
          },
        }),
      ];

      const edges = [createEdge('e1', webhookId, dbNodeId)];

      const flowId = await createTestFlow(nodes, edges, { userId });

      const { executionId } = await triggerAndWait(flowId, webhookId, {
        message: { recordId: '1' },
      });

      const dbOutput = await getNodeOutput(executionId, dbNodeId);

      expect(dbOutput.success).toBe(true);
      expect(dbOutput.affected).toBe(1);
    });
  });

  describe('DELETE - Deletar Registros', () => {
    it('deve deletar registro baseado em filtros', async () => {
      // Usar tabela única para este teste específico
      const uniqueTable = generateTestId('delete_table');

      await databaseNodeService.addColumns(String(userId), uniqueTable, [
        { name: 'id', type: 'string' },
        { name: 'status', type: 'string' },
      ]);
      await databaseNodeService.insertRecord(String(userId), uniqueTable, {
        id: '1',
        status: 'pending',
      });

      const webhookId = generateTestId('webhook');
      const dbNodeId = generateTestId('db');

      const nodes = [
        createWebhookNode(webhookId),
        createDatabaseNode(dbNodeId, 'delete', uniqueTable, {
          userId,
          filters: [
            {
              field: 'id',
              operator: 'equals',
              value: '1',
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
      expect(dbOutput.affected).toBe(1);
    });
  });
});

// ==============================================
// TIPOS DE DADOS: OBJECT & ARRAY (JSONB)
// ==============================================

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
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'config', type: 'object' },
      ]);
      await databaseNodeService.insertRecord(String(userId), tableName, {
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
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'data', type: 'object' },
      ]);
      await databaseNodeService.insertRecord(String(userId), tableName, {
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

      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'deepData', type: 'object' },
      ]);
      await databaseNodeService.insertRecord(String(userId), tableName, {
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
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'tags', type: 'array' },
      ]);
      await databaseNodeService.insertRecord(String(userId), tableName, {
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
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'items', type: 'array' },
      ]);
      await databaseNodeService.insertRecord(String(userId), tableName, {
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
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'price', type: 'string' },
      ]);
      await databaseNodeService.insertRecord(String(userId), tableName, {
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

// ==============================================
// VALIDAÇÕES DE TIPO
// ==============================================

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
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'config', type: 'object' },
      ]);

      // Tentando inserir string JSON em campo object deve falhar
      await expect(
        databaseNodeService.insertRecord(String(userId), tableName, {
          id: '1',
          config: '{"theme":"dark"}', // String, não objeto
        }),
      ).rejects.toThrow(/deve ser do tipo "object"/);
    });

    it('deve rejeitar número em campo object', async () => {
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'data', type: 'object' },
      ]);

      await expect(
        databaseNodeService.insertRecord(String(userId), tableName, {
          id: '1',
          data: 123, // Número, não objeto
        }),
      ).rejects.toThrow(/deve ser do tipo "object"/);
    });

    it('deve rejeitar boolean em campo object', async () => {
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'flag', type: 'object' },
      ]);

      await expect(
        databaseNodeService.insertRecord(String(userId), tableName, {
          id: '1',
          flag: true, // Boolean, não objeto
        }),
      ).rejects.toThrow(/deve ser do tipo "object"/);
    });
  });
});

// ==============================================
// EDGE CASES
// ==============================================

describe('Database Node - Edge Cases', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  it('deve aceitar null em campo object não obrigatório', async () => {
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'optional', type: 'object', required: false },
    ]);

    await databaseNodeService.insertRecord(String(userId), tableName, {
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
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'empty', type: 'object' },
    ]);

    await databaseNodeService.insertRecord(String(userId), tableName, {
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
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'items', type: 'array' },
    ]);

    await databaseNodeService.insertRecord(String(userId), tableName, {
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

// ==============================================
// FILTROS COMPLEXOS
// ==============================================

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
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'priority', type: 'string' },
    ]);
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '1',
      status: 'active',
      priority: 'high',
    });
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '2',
      status: 'active',
      priority: 'low',
    });
    await databaseNodeService.insertRecord(String(userId), tableName, {
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
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'price', type: 'number' },
    ]);
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '1',
      category: 'electronics',
      price: 100,
    });
    await databaseNodeService.insertRecord(String(userId), tableName, {
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

// ==============================================
// OPERADORES DE FILTRO
// ==============================================

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
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'description', type: 'string' },
      ]);
      await databaseNodeService.insertRecord(String(userId), tableName, {
        id: '1',
        description: 'Produto A com desconto',
      });
      await databaseNodeService.insertRecord(String(userId), tableName, {
        id: '2',
        description: 'Produto B sem desconto',
      });
      await databaseNodeService.insertRecord(String(userId), tableName, {
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
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'code', type: 'string' },
      ]);
      await databaseNodeService.insertRecord(String(userId), tableName, {
        id: '1',
        code: 'PROD-001',
      });
      await databaseNodeService.insertRecord(String(userId), tableName, {
        id: '2',
        code: 'PROD-002',
      });
      await databaseNodeService.insertRecord(String(userId), tableName, {
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
      await databaseNodeService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'price', type: 'number' },
      ]);
      await databaseNodeService.insertRecord(String(userId), tableName, {
        id: '1',
        price: 50,
      });
      await databaseNodeService.insertRecord(String(userId), tableName, {
        id: '2',
        price: 100,
      });
      await databaseNodeService.insertRecord(String(userId), tableName, {
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

// ==============================================
// SORTING (ORDENAÇÃO)
// ==============================================

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
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'price', type: 'number' },
    ]);
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '1',
      price: 150,
    });
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '2',
      price: 50,
    });
    await databaseNodeService.insertRecord(String(userId), tableName, {
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
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
    ]);
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '1',
      name: 'Alice',
    });
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '2',
      name: 'Charlie',
    });
    await databaseNodeService.insertRecord(String(userId), tableName, {
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

// ==============================================
// PAGINAÇÃO
// ==============================================

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
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'value', type: 'number' },
    ]);

    // Inserir 5 registros
    for (let i = 1; i <= 5; i++) {
      await databaseNodeService.insertRecord(String(userId), tableName, {
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
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'value', type: 'number' },
    ]);

    // Inserir 5 registros em ordem
    for (let i = 1; i <= 5; i++) {
      await databaseNodeService.insertRecord(String(userId), tableName, {
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
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'page', type: 'number' },
    ]);

    // Inserir 10 registros
    for (let i = 1; i <= 10; i++) {
      await databaseNodeService.insertRecord(String(userId), tableName, {
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

// ==============================================
// VARIÁVEIS EM UPDATE E DELETE
// ==============================================

describe('Database Node - Variáveis em UPDATE e DELETE', () => {
  let userId: number;
  let tableName: string;

  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
    userId = await createTestUser();
    tableName = generateTestId('table');
  });

  it('deve usar variáveis em campos de UPDATE', async () => {
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'updatedBy', type: 'string' },
    ]);
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '1',
      status: 'pending',
      updatedBy: 'system',
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
            value: '1',
          },
        ],
        updates: {
          status: '{{$nodes.' + webhookId + '.output.message.newStatus}}',
          updatedBy: '{{$nodes.' + webhookId + '.output.message.userName}}',
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: {
        newStatus: 'completed',
        userName: 'João Silva',
      },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.success).toBe(true);
    expect(dbOutput.affected).toBe(1);

    // Verificar se realmente atualizou com os valores corretos
    const verification = await databaseNodeService.getRecords(
      String(userId),
      tableName,
      {},
    );
    expect(verification[0].status).toBe('completed');
    expect(verification[0].updatedBy).toBe('João Silva');
  });

  it('deve usar variáveis em filtros de DELETE', async () => {
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'category', type: 'string' },
    ]);
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '1',
      category: 'temp',
    });
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '2',
      category: 'permanent',
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'delete', tableName, {
        userId,
        filters: [
          {
            field: 'category',
            operator: 'equals',
            value:
              '{{$nodes.' + webhookId + '.output.message.categoryToDelete}}',
          },
        ],
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { categoryToDelete: 'temp' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.success).toBe(true);
    expect(dbOutput.affected).toBe(1);

    // Verificar que apenas o registro 'temp' foi deletado
    const verification = await databaseNodeService.getRecords(
      String(userId),
      tableName,
      {},
    );
    expect(verification.length).toBe(1);
    expect(verification[0].category).toBe('permanent');
  });

  it('deve atualizar múltiplos registros baseado em filtro com variável', async () => {
    await databaseNodeService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'priority', type: 'string' },
      { name: 'processed', type: 'boolean' },
    ]);
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '1',
      priority: 'high',
      processed: false,
    });
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '2',
      priority: 'high',
      processed: false,
    });
    await databaseNodeService.insertRecord(String(userId), tableName, {
      id: '3',
      priority: 'low',
      processed: false,
    });

    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      createDatabaseNode(dbNodeId, 'update', tableName, {
        userId,
        filters: [
          {
            field: 'priority',
            operator: 'equals',
            value: '{{$nodes.' + webhookId + '.output.message.priorityLevel}}',
          },
        ],
        updates: {
          processed: true,
        },
      }),
    ];

    const edges = [createEdge('e1', webhookId, dbNodeId)];

    const flowId = await createTestFlow(nodes, edges, { userId });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { priorityLevel: 'high' },
    });

    const dbOutput = await getNodeOutput(executionId, dbNodeId);

    expect(dbOutput.success).toBe(true);
    expect(dbOutput.affected).toBe(2); // Atualizou 2 registros com priority 'high'

    // Verificar que apenas os registros 'high' foram marcados como processed
    const verification = await databaseNodeService.getRecords(
      String(userId),
      tableName,
      {},
    );
    const highPriorityRecords = verification.filter(
      (r) => r.priority === 'high',
    );
    const lowPriorityRecords = verification.filter((r) => r.priority === 'low');

    expect(highPriorityRecords.every((r) => r.processed === true)).toBe(true);
    expect(lowPriorityRecords.every((r) => r.processed === false)).toBe(true);
  });
});
