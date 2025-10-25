/**
 * Testes de Integração: Database Node - CRUD Operations
 *
 * Testa operações básicas de CRUD:
 * - GET: Buscar registros
 * - INSERT: Inserir registros
 * - UPDATE: Atualizar registros
 * - DELETE: Deletar registros
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
      await databaseService.addColumns(String(userId), tableName, [
        { name: 'id', type: 'string' },
        { name: 'nome', type: 'string' },
        { name: 'metadata', type: 'object' },
      ]);
      await databaseService.insertRecord(String(userId), tableName, {
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
      await databaseService.addColumns(String(userId), tableName, [
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

      await databaseService.addColumns(String(userId), uniqueTable, [
        { name: 'id', type: 'string' },
        { name: 'status', type: 'string' },
      ]);
      await databaseService.insertRecord(String(userId), uniqueTable, {
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

      await databaseService.addColumns(String(userId), uniqueTable, [
        { name: 'id', type: 'string' },
        { name: 'status', type: 'string' },
      ]);
      await databaseService.insertRecord(String(userId), uniqueTable, {
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
