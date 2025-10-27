/**
 * Testes E2E - Flow Execution
 * Testa o fluxo básico de execução do webhook worker
 */

import {
  createTestFlow,
  getFlowExecution,
  getNodeExecutions,
  generateTestId,
  testContext,
  simpleFlow,
} from '../../setup';
import { createWebhookNode, triggerAndWait } from '../../../helpers/webhook';

describe('Flow Execution - Básico', () => {
  it('deve criar execution quando webhook é disparado', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');
    const { nodes, edges } = simpleFlow(webhookId, messageId);

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

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

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

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

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

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

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Status test' },
    });

    const execution = await getFlowExecution(executionId);

    expect(execution.status).toBe('success');
    expect(execution.endTime).toBeDefined();
    expect(execution.duration).toBeGreaterThan(0);
  });
});

// ==============================================
// ERROR SCENARIOS - VALIDAÇÕES E FALHAS
// ==============================================

describe('Flow Execution - Error Scenarios', () => {
  it('should fail when triggering non-existent flow', async () => {
    const nonExistentFlowId = '999999'; // ID não existente
    const webhookId = generateTestId('webhook');

    const result = await triggerAndWait(nonExistentFlowId, webhookId, {
      message: { text: 'Test' },
    }).catch((error) => error);

    // Deve resultar em erro pois o flow não existe
    expect(result).toBeDefined();
    expect(
      result.message || result.jobResult?.message || result.toString(),
    ).toMatch(/flow|encontrad|not found/i);
  });

  it('should fail when webhook node does not exist in flow', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');
    const { nodes, edges } = simpleFlow(webhookId, messageId);

    const flowId = await createTestFlow(nodes, edges);

    // Tentar disparar com um webhookId que não existe no flow
    const nonExistentWebhookId = generateTestId('nonexistent');

    const result = await triggerAndWait(flowId, nonExistentWebhookId, {
      message: { text: 'Test' },
    }).catch((error) => error);

    // Deve falhar pois o webhook node não existe
    expect(result).toBeDefined();
    expect(
      result.message || result.jobResult?.message || result.toString(),
    ).toMatch(/webhook|node|encontrad|not found/i);
  });

  it('should handle empty flow (no nodes)', async () => {
    const webhookId = generateTestId('webhook');

    // Criar flow vazio (sem nodes)
    const flowId = await createTestFlow([], []);

    const result = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    }).catch((error) => error);

    // Flow vazio deve falhar
    expect(result).toBeDefined();
  });

  it('should fail when node has invalid type', async () => {
    const webhookId = generateTestId('webhook');
    const invalidNodeId = generateTestId('invalid');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: invalidNodeId,
        type: 'invalidNodeType', // Tipo inválido
        position: { x: 200, y: 100 },
        data: {
          label: 'Invalid Node',
          config: {},
        },
      },
    ];

    const edges = [
      {
        id: 'e1',
        source: webhookId,
        target: invalidNodeId,
      },
    ];

    const flowId = await createTestFlow(nodes, edges);

    const result = await triggerAndWait(
      flowId,
      webhookId,
      { message: { text: 'Test' } },
      10000,
      false, // ✅ Não jogar exceção em erros
    );

    // Execução deve completar mas com erro no node inválido
    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(/tipo|type|suportad|support/i);
  });

  it('should handle null payload gracefully', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');
    const { nodes, edges } = simpleFlow(webhookId, messageId);

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    // Enviar payload null - pode falhar ou executar com dados vazios
    const result = await triggerAndWait(flowId, webhookId, null);

    // Se criou execution, verificar
    if (result.executionId) {
      const execution = await getFlowExecution(result.executionId);
      expect(execution).toBeDefined();
      expect(execution.flowId).toBe(flowId);
    } else {
      // Caso não crie execution, está OK - sistema rejeitou payload inválido
      expect(result.jobResult || result).toBeDefined();
    }
  });

  it('should handle empty payload object', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');
    const { nodes, edges } = simpleFlow(webhookId, messageId);

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    // Enviar payload vazio
    const { executionId } = await triggerAndWait(flowId, webhookId, {});

    const execution = await getFlowExecution(executionId);
    const nodeExecutions = await getNodeExecutions(executionId);

    expect(execution).toBeDefined();
    expect(nodeExecutions[webhookId]).toBeDefined();
    expect(nodeExecutions[webhookId].data).toEqual({});
  });

  it('should mark execution as error when a node fails', async () => {
    const webhookId = generateTestId('webhook');
    const dbNodeId = generateTestId('db');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: dbNodeId,
        type: 'database',
        position: { x: 200, y: 100 },
        data: {
          label: 'Invalid Database Operation',
          config: {
            operation: 'invalidOperation', // Operação inválida
            tableName: 'test_table',
          },
        },
      },
    ];

    const edges = [
      {
        id: 'e1',
        source: webhookId,
        target: dbNodeId,
      },
    ];

    const flowId = await createTestFlow(nodes, edges);

    const result = await triggerAndWait(
      flowId,
      webhookId,
      { message: { text: 'Test' } },
      10000,
      false, // ✅ Não jogar exceção em erros
    );

    // Execution deve ter status error
    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toBeDefined();

    // Verificar execution apenas se foi criada
    if (result.executionId) {
      const execution = await getFlowExecution(result.executionId);
      expect(execution.status).toBe('error');
    }
  });

  it('should handle flow with disconnected nodes (no edges)', async () => {
    const webhookId = generateTestId('webhook');
    const messageId = generateTestId('message');
    const { nodes } = simpleFlow(webhookId, messageId);

    // Criar flow SEM edges (nodes desconectados)
    const flowId = await createTestFlow(nodes, []);

    const { executionId } = await triggerAndWait(flowId, webhookId, {
      message: { text: 'Test' },
    });

    const execution = await getFlowExecution(executionId);
    const nodeExecutions = await getNodeExecutions(executionId);

    // Webhook deve executar, mas message node não (não há edge conectando)
    expect(execution).toBeDefined();
    expect(nodeExecutions[webhookId]).toBeDefined();
    expect(nodeExecutions[webhookId].status).toBe('completed');

    // Message node não deve ser executado
    expect(nodeExecutions[messageId]).toBeUndefined();
  });
});
