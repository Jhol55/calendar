/**
 * Testes E2E - Flow Execution
 * Testa o fluxo básico de execução do webhook worker
 */

import './setup';
import {
  cleanDatabase,
  cleanQueue,
  closeDatabaseConnection,
  createTestFlow,
  createWebhookNode,
  triggerAndWait,
  getFlowExecution,
  getNodeExecutions,
  generateTestId,
} from './setup';
import { simpleFlow } from './fixtures';

describe('Flow Execution - Básico', () => {
  beforeEach(async () => {
    await cleanDatabase();
    await cleanQueue();
  });

  it('deve criar execution quando webhook é disparado', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');
    const { nodes, edges } = simpleFlow(webhookId, messageId);

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Hello!' },
    });

    const execution = await getFlowExecution(executionId);

    expect(execution).toBeDefined();
    expect(execution.flowId).toBe(flowId);
    expect(execution.status).toBe('success');
    expect(execution.triggerType).toBe('webhook');
  });

  it('deve salvar webhook data em nodeExecutions', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');
    const { nodes, edges } = simpleFlow(webhookId, messageId);

    const flowId = await createTestFlow(nodes, edges);

    const payload = {
      message: {
        text: 'Test message',
        from: '+5519971302477',
      },
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);

    expect(nodeExecutions[webhookId]).toBeDefined();
    expect(nodeExecutions[webhookId].data).toEqual(payload);
    expect(nodeExecutions[webhookId].status).toBe('completed');
  });

  it('deve processar payload complexo com JSON aninhado', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');
    const { nodes, edges } = simpleFlow(webhookId, messageId);

    const flowId = await createTestFlow(nodes, edges);

    const payload = {
      message: {
        text: 'Complex data',
        metadata: {
          orderId: '123',
          items: [
            { id: '1', name: 'Product A' },
            { id: '2', name: 'Product B' },
          ],
        },
      },
    };

    const { executionId } = await triggerAndWait(flowId, webhookId, payload);

    const nodeExecutions = await getNodeExecutions(executionId);

    expect(nodeExecutions[webhookId].data).toEqual(payload);
    expect(nodeExecutions[webhookId].data.message.metadata.items).toHaveLength(
      2,
    );
  });

  it('deve atualizar status de pending → running → success', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');
    const { nodes, edges } = simpleFlow(webhookId, messageId);

    const flowId = await createTestFlow(nodes, edges);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Status test' },
    });

    const execution = await getFlowExecution(executionId);

    expect(execution.status).toBe('success');
    expect(execution.endTime).toBeDefined();
    expect(execution.duration).toBeGreaterThan(0);
  });
});
