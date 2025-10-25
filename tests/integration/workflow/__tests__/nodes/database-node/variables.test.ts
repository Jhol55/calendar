/**
 * Testes de Integração: Database Node - Variables
 *
 * Testa resolução de variáveis:
 * - Variáveis em UPDATE
 * - Variáveis em DELETE
 * - Variáveis em filtros
 * - Atualização em lote com variáveis
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
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'updatedBy', type: 'string' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
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
    const verification = await databaseService.getRecords(
      String(userId),
      tableName,
      {},
    );
    expect(verification[0].status).toBe('completed');
    expect(verification[0].updatedBy).toBe('João Silva');
  });

  it('deve usar variáveis em filtros de DELETE', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'category', type: 'string' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      category: 'temp',
    });
    await databaseService.insertRecord(String(userId), tableName, {
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
    const verification = await databaseService.getRecords(
      String(userId),
      tableName,
      {},
    );
    expect(verification.length).toBe(1);
    expect(verification[0].category).toBe('permanent');
  });

  it('deve atualizar múltiplos registros baseado em filtro com variável', async () => {
    await databaseService.addColumns(String(userId), tableName, [
      { name: 'id', type: 'string' },
      { name: 'priority', type: 'string' },
      { name: 'processed', type: 'boolean' },
    ]);
    await databaseService.insertRecord(String(userId), tableName, {
      id: '1',
      priority: 'high',
      processed: false,
    });
    await databaseService.insertRecord(String(userId), tableName, {
      id: '2',
      priority: 'high',
      processed: false,
    });
    await databaseService.insertRecord(String(userId), tableName, {
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
    const verification = await databaseService.getRecords(
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
