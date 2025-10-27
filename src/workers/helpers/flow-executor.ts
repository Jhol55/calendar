/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '../../services/prisma';
import type { WebhookJobData } from '../../services/queue';
import { processMessageNode } from '../helpers/node-processors/message-helper';
import { processConditionNode } from '../helpers/node-processors/condition-helper';
import { processHttpRequestNode } from '../helpers/node-processors/http-helper';
import { buildVariableContext } from '../helpers/context-helper';
import {
  processNodeMemory,
  processMemoryNode,
} from '../helpers/node-processors/memory-helper';
import executeDatabaseNode from '../helpers/node-processors/database-helper';
import { processAgentNode as processAgentNodeHelper } from '../helpers/node-processors/agent-helper';
import { processLoopNode } from '../helpers/node-processors/loop-helper';
import { processCodeExecutionNode } from '../helpers/node-processors/code-execution-helper';
import * as transformations from '../helpers/node-processors/transformation-helper';

// Tipos principais
interface FlowNode {
  id: string;
  type: string;
  data?: any;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface NodeExecution {
  nodeId?: string;
  status: 'running' | 'completed' | 'error';
  startTime: string;
  endTime?: string;
  data?: unknown;
  result?: unknown;
  error?: string;
}

type NodeExecutionsRecord = Record<string, NodeExecution>;

/**
 * Ponto de entrada principal para executar um fluxo
 *
 * Busca o nó webhook inicial e processa recursivamente
 * todos os nós conectados seguindo as edges do fluxo
 */
export async function executeFlow(
  executionId: string,
  flow: any,
  webhookData: WebhookJobData,
) {
  console.log(`🔄 Executing flow ${flow.id} for execution ${executionId}`);

  const nodes = flow.nodes as FlowNode[];
  const edges = flow.edges as FlowEdge[];

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new Error('Invalid flow structure');
  }

  console.log(`📊 Flow has ${nodes.length} nodes and ${edges.length} edges`);

  // Encontrar o nó webhook
  const webhookNode = nodes.find((node) => node.id === webhookData.nodeId);
  if (!webhookNode) {
    throw new Error('Webhook node not found in flow');
  }

  // IMPORTANTE: Salvar dados do webhook node ANTES de processar os próximos nós
  // para que os próximos nós possam acessar {{$nodes.webhookNodeId.output.*}}
  const execution = await prisma.flow_executions.findUnique({
    where: { id: executionId },
  });

  if (execution) {
    const nodeExecutions = (execution.nodeExecutions as any) || {};
    nodeExecutions[webhookData.nodeId] = {
      status: 'completed',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      data: webhookData.body,
      result: webhookData.body, // ✅ Adicionar result para consistência
    };

    await prisma.flow_executions.update({
      where: { id: executionId },
      data: {
        nodeExecutions: nodeExecutions as any,
      },
    });

    console.log(
      `✅ Webhook node ${webhookData.nodeId} data saved to nodeExecutions`,
    );
    console.log(
      `🔍 [WEBHOOK-SAVE] Saved data keys:`,
      Object.keys(webhookData.body || {}),
    );
    console.log(
      `🔍 [WEBHOOK-SAVE] nodeExecutions now has:`,
      Object.keys(nodeExecutions),
    );
  }

  // Encontrar próximos nós conectados ao webhook
  const connectedEdges = edges.filter(
    (edge) => edge.source === webhookData.nodeId,
  );

  // Processar cada cadeia de nós conectados
  for (const edge of connectedEdges) {
    const nextNode = nodes.find((node) => node.id === edge.target);
    if (nextNode) {
      await processNodeChain(
        executionId,
        nextNode.id,
        nodes,
        edges,
        webhookData,
      );
    }
  }
}

/**
 * Processa uma cadeia de nós recursivamente
 *
 * Segue as edges do fluxo, processando cada nó sequencialmente
 * e decidindo o próximo nó baseado no resultado (para condições/loops)
 */
async function processNodeChain(
  executionId: string,
  currentNodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  webhookData: WebhookJobData,
) {
  // 🛑 VERIFICAR SE A EXECUÇÃO FOI PARADA
  const execution = await prisma.flow_executions.findUnique({
    where: { id: executionId },
    select: { status: true },
  });

  if (execution?.status === 'stopped') {
    console.log(`🛑 Execution ${executionId} was stopped by user. Aborting.`);
    throw new Error('Execution stopped by user');
  }

  const currentNode = nodes.find((node) => node.id === currentNodeId);
  if (!currentNode) {
    console.log(`⚠️ Node ${currentNodeId} not found`);
    return;
  }

  // Processar o nó atual
  let result: unknown;
  try {
    result = await processNode(executionId, currentNode, webhookData);
  } catch (error) {
    // 🛑 Se o node falhar, NÃO continuar para os próximos nodes
    console.error(`🛑 Node ${currentNode.id} failed. Stopping execution.`);
    console.error(
      `   Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );

    // Atualizar status da execução para 'error'
    try {
      const execution = await prisma.flow_executions.findUnique({
        where: { id: executionId },
        select: { startTime: true },
      });

      const duration = execution?.startTime
        ? Date.now() - new Date(execution.startTime).getTime()
        : undefined;

      await prisma.flow_executions.update({
        where: { id: executionId },
        data: {
          status: 'error',
          endTime: new Date(),
          duration,
          error:
            error instanceof Error ? error.message : 'Node execution failed',
        },
      });
    } catch (updateError) {
      console.error('Error updating execution status:', updateError);
    }

    // Re-lançar o erro para parar completamente
    throw error;
  }

  // Encontrar próximos nós conectados
  let nextEdges = edges.filter((edge) => edge.source === currentNodeId);

  console.log(
    `🔍 Next edges from ${currentNodeId}:`,
    JSON.stringify(nextEdges, null, 2),
  );

  // Se o nó for de condição ou loop e tiver selectedHandle, filtrar edges
  const selectedHandle = (result as any)?.selectedHandle;
  if (
    (currentNode.type === 'condition' || currentNode.type === 'loop') &&
    selectedHandle
  ) {
    console.log(
      `🔀 ${currentNode.type} node selected handle: ${selectedHandle}`,
    );
    // Filtrar edges baseado no sourceHandle
    nextEdges = nextEdges.filter(
      (edge: any) => edge.sourceHandle === selectedHandle,
    );
    console.log(
      `🔀 Filtered to ${nextEdges.length} edge(s) matching handle "${selectedHandle}"`,
    );
  }

  if (nextEdges.length > 0) {
    console.log(
      `➡️ Found ${nextEdges.length} next node(s) after ${currentNodeId}`,
    );

    // Processar cada nó seguinte
    for (const edge of nextEdges) {
      const targetNode = nodes.find((n) => n.id === edge.target);
      console.log(`  ↪️ Following edge to node: ${edge.target}`);
      console.log(`     Node type: ${targetNode?.type}, ID: ${targetNode?.id}`);

      // 🚨 DETECÇÃO DE LOOP CIRCULAR
      // Permitir loops intencionais quando vêm de um Loop Node com handle 'loop'
      const isIntentionalLoop =
        (edge as any).sourceHandle === 'loop' && currentNode.type === 'loop';

      if (edge.target === currentNodeId && !isIntentionalLoop) {
        console.error(
          `🔴 LOOP DETECTED! Node ${currentNodeId} connects to itself!`,
        );
        throw new Error(
          `Circular loop detected: node ${currentNodeId} connects back to itself`,
        );
      }

      if (isIntentionalLoop) {
        console.log(
          `🔁 Intentional loop detected from Loop Node - allowing loop back`,
        );
      }

      await processNodeChain(
        executionId,
        edge.target,
        nodes,
        edges,
        webhookData,
      );
    }
  } else {
    console.log(`🏁 End of chain at node ${currentNodeId}`);
  }
}

/**
 * Processa um nó individual baseado em seu tipo
 *
 * Dispatcher central que chama o processador específico para cada tipo de nó
 * e gerencia o estado da execução no banco de dados
 */
async function processNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log(`🔄 Processing node ${node.id} of type ${node.type}`);

  const startTime = new Date().toISOString();

  try {
    // Atualizar nodeExecutions com o nó atual
    const execution = await prisma.flow_executions.findUnique({
      where: { id: executionId },
    });

    if (execution) {
      const nodeExecutions =
        (execution.nodeExecutions as unknown as NodeExecutionsRecord) || {};
      nodeExecutions[node.id] = {
        status: 'running',
        startTime,
        data: webhookData.body,
      };

      await prisma.flow_executions.update({
        where: { id: executionId },
        data: { nodeExecutions: nodeExecutions as any },
      });
    }

    // Processar baseado no tipo do nó
    let result: unknown = {};

    // Construir contexto de variáveis para os processadores que precisam
    const variableContext = await buildVariableContext(
      executionId,
      webhookData,
    );

    switch (node.type) {
      case 'message':
        result = await processMessageNode(
          executionId,
          node,
          webhookData,
          variableContext,
          processNodeMemory,
        );
        break;
      case 'memory':
        result = await processMemoryNode(
          executionId,
          node,
          webhookData,
          variableContext,
        );
        break;
      case 'database':
        result = await processDatabaseNode(executionId, node, webhookData);
        break;
      case 'transformation':
        result = await processTransformationNode(
          executionId,
          node,
          webhookData,
        );
        break;
      case 'condition':
        result = await processConditionNode(
          executionId,
          node,
          webhookData,
          variableContext,
          processNodeMemory,
        );
        break;
      case 'http_request':
        result = await processHttpRequestNode(
          executionId,
          node,
          webhookData,
          variableContext,
          processNodeMemory,
        );
        break;
      case 'agent':
        result = await processAgentNode(executionId, node, webhookData);
        break;
      case 'loop':
        result = await processLoopNodeWrapper(executionId, node, webhookData);
        break;
      case 'code_execution':
        result = await processCodeExecutionNodeWrapper(
          executionId,
          node,
          webhookData,
        );
        break;
      case 'api':
        result = await processApiNode();
        break;
      case 'delay':
        result = await processDelayNode(node);
        break;
      default:
        console.log(`⚠️ Unknown node type: ${node.type}`);
        throw new Error(`Tipo de nó não suportado: ${node.type}`);
    }

    // Atualizar status do nó
    if (execution) {
      const nodeExecutions =
        (execution.nodeExecutions as unknown as NodeExecutionsRecord) || {};
      nodeExecutions[node.id] = {
        ...nodeExecutions[node.id],
        status: 'completed',
        endTime: new Date().toISOString(),
        result,
      };

      await prisma.flow_executions.update({
        where: { id: executionId },
        data: { nodeExecutions: nodeExecutions as any },
      });
    }

    console.log(`✅ Node ${node.id} processed successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Error processing node ${node.id}:`, error);

    // Atualizar status do nó como erro
    try {
      const execution = await prisma.flow_executions.findUnique({
        where: { id: executionId },
      });

      if (execution) {
        const nodeExecutions =
          (execution.nodeExecutions as unknown as NodeExecutionsRecord) || {};
        nodeExecutions[node.id] = {
          ...nodeExecutions[node.id],
          status: 'error',
          endTime: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };

        await prisma.flow_executions.update({
          where: { id: executionId },
          data: { nodeExecutions: nodeExecutions as any },
        });
      }
    } catch (updateError) {
      console.error('Error updating node execution status:', updateError);
    }

    throw error;
  }
}

// ==================== NODE PROCESSORS ====================

async function processDatabaseNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  // Buscar execution para obter userId e flowId
  const execution = await prisma.flow_executions.findUnique({
    where: { id: executionId },
    include: { flow: true },
  });

  if (!execution?.flow?.userId) {
    throw new Error('UserId not found in flow');
  }

  const variableContext = await buildVariableContext(executionId, webhookData);

  const context = {
    userId: String(execution.flow.userId),
    flowId: execution.flowId,
    executionId,
    variables: variableContext,
  };

  return await executeDatabaseNode(node as any, webhookData.body, context);
}

async function processTransformationNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log('🔄 Processing transformation node');
  const variableContext = await buildVariableContext(executionId, webhookData);

  const transformationConfig = node.data?.transformationConfig;
  if (!transformationConfig) {
    throw new Error('Transformation configuration not found');
  }

  const { operation, type, ...operationConfig } = transformationConfig;

  // Delegar para o helper de transformações (cada operação tem sua própria assinatura)
  const transformationFn =
    transformations[operation as keyof typeof transformations];
  let result;

  if (typeof transformationFn === 'function') {
    // Tentar chamar com config e context (a maioria dos helpers espera isso)
    result = await (transformationFn as any)(
      transformationConfig,
      variableContext,
      executionId,
    );
  } else {
    throw new Error(`Transformation operation not found: ${operation}`);
  }

  return {
    type: 'transformation',
    operation,
    transformationType: type,
    result,
  };
}

async function processAgentNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  // Buscar execution para obter flowId e userId
  const execution = await prisma.flow_executions.findUnique({
    where: { id: executionId },
    include: { flow: true },
  });

  if (!execution?.flow?.userId) {
    throw new Error('UserId not found in flow');
  }

  const variableContext = await buildVariableContext(executionId, webhookData);
  const agentConfig = node.data?.agentConfig;

  if (!agentConfig) {
    throw new Error('Agent configuration not found');
  }

  // Importar replaceVariables
  const { replaceVariables } = await import('../helpers/variable-replacer');

  return await processAgentNodeHelper({
    config: agentConfig,
    userId: String(execution.flow.userId),
    flowId: execution.flowId,
    nodeId: node.id,
    variableContext,
    replaceVariables,
  });
}

async function processLoopNodeWrapper(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  const variableContext = await buildVariableContext(executionId, webhookData);
  const loopConfig = node.data?.loopConfig;

  if (!loopConfig) {
    throw new Error('Loop configuration not found');
  }

  return await processLoopNode({
    executionId,
    nodeId: node.id,
    config: loopConfig,
    variableContext,
  });
}

async function processCodeExecutionNodeWrapper(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  const variableContext = await buildVariableContext(executionId, webhookData);
  const codeConfig = node.data?.codeExecutionConfig;

  if (!codeConfig) {
    throw new Error('Code execution configuration not found');
  }

  return await processCodeExecutionNode(codeConfig, variableContext);
}

async function processApiNode(): Promise<unknown> {
  console.log(`🌐 Processing API node`);
  // Implementar chamada de API
  return { type: 'api', result: 'API call completed' };
}

async function processDelayNode(node: FlowNode): Promise<unknown> {
  const delayMs = (node.data?.delay as number) || 1000;
  console.log(`⏱️ Processing delay node: ${delayMs}ms`);

  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return { type: 'delay', duration: delayMs };
}
