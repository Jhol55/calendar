/**
 * Testes Básicos - Webhook Node
 * 
 * Smoke test fundamental do webhook node:
 * - Recepção de webhook e criação de execution
 * - Validação do fluxo end-to-end mais simples
 *

 */

import {
  createTestFlow,
  getFlowExecution,
  generateTestId,
  createEdge,
  testContext,
} from '../../../setup';
import { createWebhookNode, triggerAndWait } from '../../../../helpers/webhook';
import { createMemoryNode } from '../../memory-node/setup';

describe('Webhook Node - Basic Smoke Test', () => {
  // ✅ SMOKE TEST: Funcionamento fundamental end-to-end
  it('deve receber webhook, criar execution e processar flow completo', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(memoryId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: { text: 'Hello World' } };
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
    );

    // Validar job concluído com sucesso
    expect(jobResult.status).toBe('success');
    expect(jobResult.error).toBeUndefined();
    expect(jobResult.executionId).toBe(executionId);
    expect(executionId).toBeDefined();

    // Validar execution criada corretamente
    const execution = await getFlowExecution(executionId);
    expect(execution.flowId).toBe(flowId);
    expect(execution.status).toBe('success');
    expect(execution.triggerType).toBe('webhook');
    expect(execution.data).toEqual(payload);

    // Validar que ambos os nodes foram executados
    expect(execution.nodeExecutions[webhookId]).toBeDefined();
    expect(execution.nodeExecutions[webhookId].status).toBe('completed');
    expect(execution.nodeExecutions[memoryId]).toBeDefined();
    expect(execution.nodeExecutions[memoryId].status).toBe('completed');
  });
});
