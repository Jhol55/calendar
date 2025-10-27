/**
 * Testes de Integração com Outros Nodes - Webhook Node
 *
 * Valida que o webhook node funciona corretamente com outros tipos de nodes:
 * - Message node
 * - Database node
 * - Condition node
 * - Memory node
 * - Transformation node
 */

import {
  createTestFlow,
  getFlowExecution,
  getNodeOutput,
  generateTestId,
  createEdge,
  testContext,
} from '../../../setup';
import { createWebhookNode, triggerAndWait } from '../../../../helpers/webhook';
import { createMemoryNode } from '../../memory-node/setup';
import { createConditionNode } from '../../condition-node/setup';

describe('Webhook Node - Integration with Other Nodes', () => {
  // ✅ CENÁRIO POSITIVO: webhook → message
  it('webhook → message: deve passar dados corretamente', async () => {
    const webhookId = generateTestId('webhook');
    const memoryId = generateTestId('memory');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(
        memoryId,
        'write',
        'test_data',
        `{{$nodes.${webhookId}.output}}`,
      ),
    ];
    const edges = [createEdge('e1', webhookId, memoryId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: { text: 'Hello from webhook!' } };
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
    );

    expect(jobResult.status).toBe('success');

    const memoryOutput = await getNodeOutput(executionId, memoryId);
    // Memory node 'save' retorna items[], não value
    expect(memoryOutput.items[0].value).toContain('Hello from webhook!');
  });

  // ✅ CENÁRIO POSITIVO: webhook → condition → messages
  it('webhook → condition → messages: deve seguir branch correto', async () => {
    const webhookId = generateTestId('webhook');
    const conditionId = generateTestId('condition');
    const messageTrueId = generateTestId('msg-true');
    const messageFalseId = generateTestId('msg-false');

    const nodes = [
      createWebhookNode(webhookId),
      createConditionNode(conditionId, {
        conditions: [
          {
            field: '{{$nodes.' + webhookId + '.output.approved}}',
            operator: 'equals',
            value: 'true',
          },
        ],
        operator: 'AND',
      }),
      createMemoryNode(messageTrueId, 'write', 'test_data', '{{$output}}'),
      createMemoryNode(messageFalseId, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [
      createEdge('e1', webhookId, conditionId),
      createEdge('e2', conditionId, messageTrueId, 'true'),
      createEdge('e3', conditionId, messageFalseId, 'false'),
    ];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    // Testar branch TRUE
    const payloadTrue = { approved: 'true' };
    const resultTrue = await triggerAndWait(flowId, webhookId, payloadTrue);

    expect(resultTrue.jobResult.status).toBe('success');

    const execution = await getFlowExecution(resultTrue.executionId);
    expect(execution.nodeExecutions[messageTrueId]).toBeDefined();
    expect(execution.nodeExecutions[messageFalseId]).toBeUndefined();
  });

  // ✅ CENÁRIO POSITIVO: Variáveis acessíveis em todos nodes
  it('variáveis de webhook devem ser acessíveis em todos os nodes subsequentes', async () => {
    const webhookId = generateTestId('webhook');
    const mem1Id = generateTestId('mem1');
    const mem2Id = generateTestId('mem2');
    const mem3Id = generateTestId('mem3');

    const nodes = [
      createWebhookNode(webhookId),
      createMemoryNode(mem1Id, 'write', 'test_data1', '{{$output}}'),
      createMemoryNode(mem2Id, 'write', 'test_data2', '{{$output}}'),
      createMemoryNode(mem3Id, 'write', 'test_data3', '{{$output}}'),
    ];
    const edges = [
      createEdge('e1', webhookId, mem1Id),
      createEdge('e2', mem1Id, mem2Id),
      createEdge('e3', mem2Id, mem3Id),
    ];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { data: 'test-value-123' };
    const { executionId, jobResult } = await triggerAndWait(
      flowId,
      webhookId,
      payload,
    );

    expect(jobResult.status).toBe('success');

    // Todos os memory nodes devem ter recebido dados
    const mem1Output = await getNodeOutput(executionId, mem1Id);
    const mem2Output = await getNodeOutput(executionId, mem2Id);
    const mem3Output = await getNodeOutput(executionId, mem3Id);

    expect(mem1Output).toBeDefined();
    expect(mem2Output).toBeDefined();
    expect(mem3Output).toBeDefined();
  });

  // ❌ CENÁRIO NEGATIVO: Erro em node subsequente não afeta captura de webhook
  it('erro em node subsequente não deve afetar captura de webhook', async () => {
    const webhookId = generateTestId('webhook');
    const invalidNodeId = generateTestId('invalid-node');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: invalidNodeId,
        type: 'unknown-node-type',
        data: { label: 'Unknown Node' },
      },
    ];
    const edges = [createEdge('e1', webhookId, invalidNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: 'test' };
    const result = await triggerAndWait(flowId, webhookId, payload, {
      throwOnError: false,
    });

    // Job deve falhar
    expect(result.jobResult.status).toBe('error');

    // Mas webhook data deve estar capturado
    expect(result.executionId).toBeDefined();

    const execution = await getFlowExecution(result.executionId);
    expect(execution.nodeExecutions[webhookId]).toBeDefined();
    expect(execution.nodeExecutions[webhookId].data).toEqual(payload);
  });

  // ❌ CENÁRIO NEGATIVO: Node desconhecido
  it('flow com node desconhecido deve falhar com mensagem clara', async () => {
    const webhookId = generateTestId('webhook');
    const unknownNodeId = generateTestId('unknown');

    const nodes = [
      createWebhookNode(webhookId),
      {
        id: unknownNodeId,
        type: 'unknown-node-type',
        data: { label: 'Unknown Node' },
      },
    ];
    const edges = [createEdge('e1', webhookId, unknownNodeId)];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    const payload = { message: 'test' };
    const result = await triggerAndWait(flowId, webhookId, payload, {
      throwOnError: false,
    });

    expect(result.jobResult.status).toBe('error');
    expect(result.jobResult.message).toMatch(
      /não suportado|not supported|unknown/i,
    );
  });

  // ✅ CENÁRIO POSITIVO: Flow complexo com múltiplos branches
  it('deve processar flow complexo com múltiplos branches', async () => {
    const webhookId = generateTestId('webhook');
    const conditionId = generateTestId('condition');
    const mem1Id = generateTestId('msg1');
    const mem2Id = generateTestId('msg2');
    const mem3Id = generateTestId('msg3');

    const nodes = [
      createWebhookNode(webhookId),
      createConditionNode(conditionId, {
        conditions: [
          {
            field: '{{$nodes.' + webhookId + '.output.type}}',
            operator: 'equals',
            value: 'A',
          },
        ],
        operator: 'AND',
      }),
      createMemoryNode(mem1Id, 'write', 'test_data', '{{$output}}'),
      createMemoryNode(mem2Id, 'write', 'test_data', '{{$output}}'),
      createMemoryNode(mem3Id, 'write', 'test_data', '{{$output}}'),
    ];
    const edges = [
      createEdge('e1', webhookId, conditionId),
      createEdge('e2', conditionId, mem1Id, 'true'),
      createEdge('e3', conditionId, mem2Id, 'false'),
      createEdge('e4', mem1Id, mem3Id),
      createEdge('e5', mem2Id, mem3Id),
    ];

    const flowId = await createTestFlow(nodes, edges, {
      userId: testContext.userId!,
    });

    // Testar tipo A
    const payloadA = { type: 'A' };
    const resultA = await triggerAndWait(flowId, webhookId, payloadA);

    expect(resultA.jobResult.status).toBe('success');

    const executionA = await getFlowExecution(resultA.executionId);
    expect(executionA.nodeExecutions[mem1Id]).toBeDefined();
    expect(executionA.nodeExecutions[mem2Id]).toBeUndefined();
    expect(executionA.nodeExecutions[mem3Id]).toBeDefined();
  });
});
