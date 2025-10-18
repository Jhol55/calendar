import { webhookQueue, WebhookJobData } from '../services/queue';
import { prisma } from '../services/prisma';
import {
  salvarMemoria,
  buscarMemoria,
  deletarMemoria,
  listarMemorias,
} from './memory-helper';
import * as transformations from './transformation-helper';
import type {
  MessageConfig,
  MessageType,
  InteractiveMenuConfig,
} from '../components/layout/chatbot-flow/types';

// Função para substituir variáveis no texto
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function replaceVariables(text: string, context: any): string {
  if (!text || typeof text !== 'string') return text;

  // Encontrar todas as variáveis no formato {{path}}
  return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    try {
      // Remover espaços e dividir o path
      const cleanPath = path.trim();
      const parts = cleanPath.split('.');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = context;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          // Se o path não existir, retornar o match original
          return match;
        }
      }

      // Converter para string se necessário
      return value !== null && value !== undefined ? String(value) : match;
    } catch (error) {
      console.error(`Error replacing variable ${path}:`, error);
      return match;
    }
  });
}

// Processar job de webhook
webhookQueue.process('process-webhook', async (job) => {
  const data = job.data as WebhookJobData;
  console.log(
    `🔄 Processing webhook job ${job.id} for webhook ${data.webhookId}`,
  );

  try {
    // Buscar o fluxo associado
    const flow = await prisma.chatbot_flows.findUnique({
      where: { id: data.flowId },
    });

    if (!flow) {
      throw new Error(`Flow ${data.flowId} not found`);
    }

    // Criar execução no banco
    const execution = await prisma.flow_executions.create({
      data: {
        flowId: data.flowId,
        status: 'running',
        triggerType: 'webhook',
        triggerData: {
          webhookId: data.webhookId,
          method: data.method,
          headers: data.headers,
          queryParams: data.queryParams,
          timestamp: data.timestamp,
        },
        data: data.body,
        nodeExecutions: {
          [data.nodeId]: {
            status: 'completed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            data: data.body,
            result: data.body, // Salvar o body como resultado para o próximo node
          },
        },
      },
    });

    console.log(
      `✅ Created execution ${execution.id} for webhook ${data.webhookId}`,
    );

    // TODO: Executar o fluxo completo
    // Aqui você implementaria a lógica para executar todos os nós do fluxo
    await executeFlow(execution.id, flow, data);

    // Atualizar status da execução
    await prisma.flow_executions.update({
      where: { id: execution.id },
      data: {
        status: 'success',
        endTime: new Date(),
      },
    });

    console.log(`✅ Webhook job ${job.id} completed successfully`);

    return {
      executionId: execution.id,
      status: 'success',
      message: 'Webhook processed successfully',
    };
  } catch (error) {
    console.error(`❌ Error processing webhook job ${job.id}:`, error);

    // Se houver execução criada, marcar como erro
    if (data.flowId) {
      try {
        await prisma.flow_executions.updateMany({
          where: {
            flowId: data.flowId,
            status: 'running',
            triggerType: 'webhook',
          },
          data: {
            status: 'error',
            endTime: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } catch (dbError) {
        console.error('Error updating execution status:', dbError);
      }
    }

    throw error; // Re-throw para que o Bull possa fazer retry
  }
});

// Tipos para o fluxo
interface FlowNode {
  id: string;
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

interface FlowEdge {
  id?: string;
  source: string;
  target: string;
}

// Função para executar o fluxo completo
async function executeFlow(
  executionId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flow: any,
  webhookData: WebhookJobData,
) {
  console.log(`🔄 Executing flow ${flow.id} for execution ${executionId}`);

  const nodes = flow.nodes as FlowNode[];
  const edges = flow.edges as FlowEdge[];

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new Error('Invalid flow structure');
  }

  // Encontrar o nó webhook
  const webhookNode = nodes.find((node) => node.id === webhookData.nodeId);
  if (!webhookNode) {
    throw new Error('Webhook node not found in flow');
  }

  // Encontrar próximos nós conectados ao webhook
  const connectedEdges = edges.filter(
    (edge) => edge.source === webhookData.nodeId,
  );

  console.log(`📊 Found ${connectedEdges.length} connected nodes from webhook`);

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

// Função para processar uma cadeia de nós recursivamente
async function processNodeChain(
  executionId: string,
  currentNodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  webhookData: WebhookJobData,
) {
  const currentNode = nodes.find((node) => node.id === currentNodeId);
  if (!currentNode) {
    console.log(`⚠️ Node ${currentNodeId} not found`);
    return;
  }

  // Processar o nó atual
  await processNode(executionId, currentNode, webhookData);

  // Encontrar próximos nós conectados
  const nextEdges = edges.filter((edge) => edge.source === currentNodeId);

  if (nextEdges.length > 0) {
    console.log(
      `➡️ Found ${nextEdges.length} next node(s) after ${currentNodeId}`,
    );

    // Processar cada nó seguinte
    for (const edge of nextEdges) {
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

// Tipos para execução de nó
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

// Função para processar um nó individual
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { nodeExecutions: nodeExecutions as any },
      });
    }

    // Processar baseado no tipo do nó
    let result: unknown = {};

    switch (node.type) {
      case 'message':
        result = await processMessageNode(executionId, node, webhookData);
        break;
      case 'memory':
        result = await processMemoryNode(executionId, node, webhookData);
        break;
      case 'transformation':
        result = await processTransformationNode(
          executionId,
          node,
          webhookData,
        );
        break;
      case 'condition':
        result = await processConditionNode();
        break;
      case 'api':
        result = await processApiNode();
        break;
      case 'delay':
        result = await processDelayNode(node);
        break;
      default:
        console.log(`⚠️ Unknown node type: ${node.type}`);
        result = { status: 'skipped', message: 'Unknown node type' };
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { nodeExecutions: nodeExecutions as any },
        });
      }
    } catch (updateError) {
      console.error('Error updating node execution status:', updateError);
    }

    throw error;
  }
}

// Processadores para diferentes tipos de nós
async function processMessageNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log('📝 Processing message node');
  console.log('📊 Node:', node);

  const messageConfig = node.data?.messageConfig as MessageConfig | undefined;
  if (!messageConfig) {
    throw new Error('Message configuration not found');
  }

  console.log('📋 Message config:', messageConfig);

  const {
    token,
    phoneNumber,
    text,
    messageType,
    mediaUrl,
    caption,
    contactName,
    contactPhone,
    latitude,
    longitude,
    interactiveMenu,
  } = messageConfig;

  if (!token || !phoneNumber) {
    throw new Error('Token and phoneNumber are required');
  }

  try {
    console.log(
      `📤 Sending ${messageType || 'text'} message to ${phoneNumber}`,
    );

    // Buscar execução para obter dados de todos os nodes
    const execution = await prisma.flow_executions.findUnique({
      where: { id: executionId },
      include: {
        flow: true,
      },
    });

    const nodeExecutions =
      (execution?.nodeExecutions as unknown as NodeExecutionsRecord) || {};

    // Criar objeto $nodes com saídas de todos os nodes anteriores
    const $nodes: Record<string, { output: unknown }> = {};
    Object.keys(nodeExecutions).forEach((nodeId) => {
      const nodeExec = nodeExecutions[nodeId];
      if (nodeExec?.result) {
        $nodes[nodeId] = {
          output: nodeExec.result,
        };
      }
    });

    // Buscar todas as memórias do usuário para o contexto
    const userId = execution?.flow?.userId
      ? String(execution.flow.userId)
      : null;
    const $memory = userId ? await listarMemorias(userId) : {};

    // Preparar contexto para substituição de variáveis
    const variableContext = {
      $node: {
        input: webhookData.body,
        webhook: {
          body: webhookData.body,
          headers: webhookData.headers,
          queryParams: webhookData.queryParams,
        },
      },
      $nodes, // Adicionar todos os nodes anteriores
      $memory, // Adicionar todas as memórias do usuário
    };

    // Debug: Log do contexto disponível
    console.log('🔍 Variable context available:', {
      hasNodeInput: !!variableContext.$node.input,
      availableNodes: Object.keys(variableContext.$nodes),
    });

    // Substituir variáveis em todos os campos
    const resolvedPhoneNumber = replaceVariables(phoneNumber, variableContext);
    const resolvedText = text ? replaceVariables(text, variableContext) : text;
    const resolvedMediaUrl = mediaUrl
      ? replaceVariables(mediaUrl, variableContext)
      : mediaUrl;
    const resolvedCaption = caption
      ? replaceVariables(caption, variableContext)
      : caption;
    const resolvedContactName = contactName
      ? replaceVariables(contactName, variableContext)
      : contactName;
    const resolvedContactPhone = contactPhone
      ? replaceVariables(contactPhone, variableContext)
      : contactPhone;

    console.log(`📝 Original text: ${text}`);
    console.log(`📝 Resolved text: ${resolvedText}`);
    console.log(`📝 Resolved phone: ${resolvedPhoneNumber}`);
    if (resolvedText && resolvedText !== text) {
      console.log(`📝 Variables replaced in text`);
    }

    // Preparar dados baseado no tipo de mensagem
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formData: Record<string, any> = {
      number: resolvedPhoneNumber,
    };

    switch (messageType) {
      case 'text':
        if (!resolvedText) throw new Error('Text message content is required');
        formData.text = resolvedText;
        break;

      case 'media':
        if (!resolvedMediaUrl) throw new Error('Media URL is required');
        formData.mediaUrl = resolvedMediaUrl;
        if (resolvedCaption) formData.caption = resolvedCaption;
        break;

      case 'contact':
        if (!resolvedContactName || !resolvedContactPhone)
          throw new Error('Contact name and phone are required');
        formData.contactName = resolvedContactName;
        formData.contactPhone = resolvedContactPhone;
        break;

      case 'location':
        if (!latitude || !longitude)
          throw new Error('Latitude and longitude are required');
        formData.latitude = latitude;
        formData.longitude = longitude;
        break;

      case 'interactive_menu':
        if (!interactiveMenu) {
          throw new Error('Interactive menu configuration is required');
        }

        // Resolver variáveis dinâmicas nos campos do menu
        const resolvedMenuText = replaceVariables(
          interactiveMenu.text,
          variableContext,
        );
        const resolvedMenuChoices = interactiveMenu.choices.map(
          (choice: string) => replaceVariables(choice, variableContext),
        );
        const resolvedMenuFooter = interactiveMenu.footerText
          ? replaceVariables(interactiveMenu.footerText, variableContext)
          : undefined;
        const resolvedMenuListButton = interactiveMenu.listButton
          ? replaceVariables(interactiveMenu.listButton, variableContext)
          : undefined;
        const resolvedMenuImageButton = interactiveMenu.imageButton
          ? replaceVariables(interactiveMenu.imageButton, variableContext)
          : undefined;

        // Montar payload conforme documentação UAZAPI
        formData.type = interactiveMenu.type;
        formData.text = resolvedMenuText;
        formData.choices = resolvedMenuChoices; // Array direto, não JSON string

        if (resolvedMenuFooter) {
          formData.footerText = resolvedMenuFooter;
        }
        if (resolvedMenuListButton) {
          formData.listButton = resolvedMenuListButton;
        }
        if (resolvedMenuImageButton) {
          formData.imageButton = resolvedMenuImageButton;
        }
        if (interactiveMenu.selectableCount) {
          formData.selectableCount = interactiveMenu.selectableCount;
        }

        console.log('📋 Interactive menu payload:', {
          type: formData.type,
          text: formData.text,
          choicesCount: resolvedMenuChoices.length,
        });
        break;

      default:
        // Se não especificar tipo, assume texto
        if (!resolvedText) throw new Error('Text message content is required');
        formData.text = resolvedText;
    }

    console.log('📦 FormData:', formData);

    // Determinar endpoint baseado no tipo de mensagem
    const endpoint =
      messageType === 'interactive_menu' ? '/send/menu' : '/send/text';

    console.log(`🔗 Using endpoint: ${endpoint}`);

    // Chamar API diretamente (sem usar Server Action)
    const response = await fetch(`${process.env.UAZAPI_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token: token,
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      throw new Error(
        `Failed to send message: ${errorData.error || response.statusText}`,
      );
    }

    const result = await response.json();
    console.log('📋 API Response:', result);
    console.log(`✅ Message sent successfully to ${resolvedPhoneNumber}`);

    return {
      type: 'message',
      status: 'sent',
      phoneNumber: resolvedPhoneNumber,
      text: resolvedText || text,
      messageType: messageType || 'text',
      originalConfig: {
        phoneNumber,
        text,
      },
      resolvedValues: {
        phoneNumber: resolvedPhoneNumber,
        text: resolvedText || text,
      },
      apiResponse: result,
    };
  } catch (error) {
    console.error(`❌ Error sending message:`, error);
    throw error;
  }
}

// Interface para configuração de memória
interface MemoryItem {
  key: string;
  value: string;
}

interface MemoryConfig {
  action: 'save' | 'fetch' | 'delete';
  memoryName: string;
  items?: MemoryItem[];
  ttl?: number;
  defaultValue?: string;
}

// Processador do Memory Node
async function processMemoryNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log('🧠 Processing memory node');

  const memoryConfig = node.data?.memoryConfig as MemoryConfig | undefined;

  if (!memoryConfig) {
    throw new Error('Memory configuration not found');
  }

  const { action, memoryName, items, ttl, defaultValue } = memoryConfig;

  if (!memoryName) {
    throw new Error('memoryName (memory name) is required');
  }

  try {
    // Buscar execução para obter flow e userId
    const execution = await prisma.flow_executions.findUnique({
      where: { id: executionId },
      include: {
        flow: true,
      },
    });

    if (!execution?.flow?.userId) {
      throw new Error('UserId not found in flow');
    }

    const userId = String(execution.flow.userId);

    // Buscar dados de todos os nodes anteriores
    const nodeExecutions =
      (execution.nodeExecutions as unknown as NodeExecutionsRecord) || {};

    // Criar objeto $nodes com saídas de todos os nodes anteriores
    const $nodes: Record<string, { output: unknown }> = {};
    Object.keys(nodeExecutions).forEach((nodeId) => {
      const nodeExec = nodeExecutions[nodeId];
      if (nodeExec?.result) {
        $nodes[nodeId] = {
          output: nodeExec.result,
        };
      }
    });

    // Buscar todas as memórias do usuário para o contexto
    const $memory = await listarMemorias(userId);

    // Preparar contexto para substituição de variáveis
    const variableContext = {
      $node: {
        input: webhookData.body,
      },
      $nodes,
      $memory,
    };

    // Resolver variáveis no nome da memória
    const resolvedMemoryName = replaceVariables(memoryName, variableContext);

    console.log(`🧠 Memory action: ${action} - name: ${resolvedMemoryName}`);

    // Processar baseado na ação
    switch (action) {
      case 'save': {
        if (!items || items.length === 0) {
          throw new Error('Items are required for action "save"');
        }

        // Processar cada item e substituir variáveis
        const resolvedItems = items.map((item) => ({
          key: replaceVariables(item.key, variableContext),
          value: replaceVariables(item.value, variableContext),
        }));

        // Salvar memória como array de objetos
        const saveResult = await salvarMemoria(
          userId,
          resolvedMemoryName,
          JSON.stringify(resolvedItems), // Salvar como JSON string
          ttl,
        );

        console.log(
          `💾 Memory saved: ${resolvedMemoryName} with ${resolvedItems.length} items`,
        );

        return {
          type: 'memory',
          action: 'save',
          name: resolvedMemoryName,
          items: resolvedItems,
          success: saveResult.success,
          expiresAt: saveResult.expiresAt,
        };
      }

      case 'fetch': {
        // Buscar memória
        const searchResult = await buscarMemoria(
          userId,
          resolvedMemoryName,
          defaultValue,
        );

        // Se encontrou, tentar parsear como JSON
        let parsedValue = searchResult.value;
        if (searchResult.found && typeof searchResult.value === 'string') {
          try {
            parsedValue = JSON.parse(searchResult.value);
          } catch {
            // Se não for JSON válido, manter como string
          }
        }

        console.log(
          `🔍 Memory search: ${resolvedMemoryName}, found: ${searchResult.found}`,
        );

        return {
          type: 'memory',
          action: 'fetch',
          name: resolvedMemoryName,
          value: parsedValue,
          found: searchResult.found,
          expired: searchResult.expired,
          usedDefault: !searchResult.found,
        };
      }

      case 'delete': {
        // Deletar memória
        const deleteResult = await deletarMemoria(userId, resolvedMemoryName);

        console.log(
          `🗑️ Memory deleted: ${resolvedMemoryName}, found: ${deleteResult.found}`,
        );

        return {
          type: 'memory',
          action: 'delete',
          name: resolvedMemoryName,
          success: deleteResult.success,
          found: deleteResult.found,
        };
      }

      default:
        throw new Error(`Unknown memory action: ${action}`);
    }
  } catch (error) {
    console.error(`❌ Error processing memory node:`, error);
    throw error;
  }
}

// Tipos para Transformation Node
interface TransformationStep {
  id: string;
  type: string;
  operation: string;
  input: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
}

interface TransformationConfig {
  steps: TransformationStep[];
  outputAs?: string;
}

// Processador do Transformation Node
async function processTransformationNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log('🔧 Processing transformation node');

  const transformationConfig = node.data?.transformationConfig as
    | TransformationConfig
    | undefined;

  if (!transformationConfig) {
    throw new Error('Transformation configuration not found');
  }

  const { steps, outputAs } = transformationConfig;

  if (!steps || steps.length === 0) {
    throw new Error('No transformation steps defined');
  }

  try {
    // Buscar execução para obter contexto de variáveis
    const execution = await prisma.flow_executions.findUnique({
      where: { id: executionId },
      include: {
        flow: true,
      },
    });

    if (!execution) {
      throw new Error('Execution not found');
    }

    // Preparar contexto de variáveis (igual ao processMessageNode)
    const nodeExecutions =
      (execution.nodeExecutions as unknown as NodeExecutionsRecord) || {};

    const $nodes: Record<string, { output: unknown }> = {};
    Object.keys(nodeExecutions).forEach((nodeId) => {
      const nodeExec = nodeExecutions[nodeId];
      if (nodeExec?.result) {
        $nodes[nodeId] = {
          output: nodeExec.result,
        };
      }
    });

    // Buscar memórias do usuário
    const userId = execution?.flow?.userId
      ? String(execution.flow.userId)
      : null;
    const $memory = userId ? await listarMemorias(userId) : {};

    const variableContext = {
      $node: {
        input: webhookData.body,
        webhook: {
          body: webhookData.body,
          headers: webhookData.headers,
          queryParams: webhookData.queryParams,
        },
      },
      $nodes,
      $memory,
    };

    // Executar pipeline de transformações
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentValue: any = null;

    for (let index = 0; index < steps.length; index++) {
      const step = steps[index];
      console.log(
        `📝 Executing step ${index + 1}/${steps.length}: ${step.operation}`,
      );

      // SEMPRE usar o input configurado no step (resolvendo variáveis dinâmicas)
      const inputValue = replaceVariables(step.input || '', variableContext);
      console.log(`  📥 Input for step ${index + 1}: "${inputValue}"`);

      // Executar transformação baseada no tipo e operação
      try {
        currentValue = await executeTransformation(
          step.type,
          step.operation,
          inputValue,
          step.params || {},
          variableContext,
        );

        results.push({
          step: index + 1,
          operation: step.operation,
          input: inputValue,
          output: currentValue,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error(`❌ Error in transformation step ${index + 1}:`, error);
        throw new Error(
          `Transformation step ${index + 1} failed: ${error.message}`,
        );
      }
    }

    // Retornar resultado final
    return {
      finalValue: currentValue,
      steps: results,
      outputAs: outputAs || 'transformation_result',
    };
  } catch (error) {
    console.error(`❌ Error processing transformation node:`, error);
    throw error;
  }
}

// Função auxiliar para executar uma transformação
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTransformation(
  type: string,
  operation: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableContext: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // Resolver parâmetros com variáveis dinâmicas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolvedParams: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      resolvedParams[key] = replaceVariables(value, variableContext);
    } else {
      resolvedParams[key] = value;
    }
  }

  switch (type) {
    case 'string':
      return executeStringTransformation(operation, input, resolvedParams);
    case 'number':
      return executeNumberTransformation(operation, input, resolvedParams);
    case 'date':
      return executeDateTransformation(operation, input, resolvedParams);
    case 'array':
      return executeArrayTransformation(operation, input, resolvedParams);
    case 'object':
      return executeObjectTransformation(operation, input, resolvedParams);
    case 'validation':
      return executeValidationTransformation(operation, input);
    default:
      throw new Error(`Unknown transformation type: ${type}`);
  }
}

// Executar transformações de string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function executeStringTransformation(
  operation: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  switch (operation) {
    case 'uppercase':
      return transformations.uppercase(input);
    case 'lowercase':
      return transformations.lowercase(input);
    case 'trim':
      return transformations.trim(input);
    case 'replace':
      return transformations.replace(
        input,
        params.searchValue,
        params.replaceValue,
      );
    case 'substring':
      return transformations.substring(input, params.start, params.end);
    case 'split':
      return transformations.split(input, params.separator);
    case 'concat':
      return transformations.concat(input, params.value);
    case 'capitalize':
      return transformations.capitalize(input);
    default:
      throw new Error(`Unknown string operation: ${operation}`);
  }
}

// Executar transformações de número
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function executeNumberTransformation(
  operation: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  switch (operation) {
    case 'add':
      return transformations.add(input, params.value);
    case 'subtract':
      return transformations.subtract(input, params.value);
    case 'multiply':
      return transformations.multiply(input, params.value);
    case 'divide':
      return transformations.divide(input, params.value);
    case 'round':
      return transformations.round(input, params.decimals);
    case 'formatCurrency':
      return transformations.formatCurrency(input);
    case 'toPercent':
      return transformations.toPercent(input);
    default:
      throw new Error(`Unknown number operation: ${operation}`);
  }
}

// Executar transformações de data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function executeDateTransformation(
  operation: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  switch (operation) {
    case 'format':
      return transformations.formatDate(input, params.format);
    case 'addDays':
      return transformations.addDays(input, params.days);
    case 'subtractDays':
      return transformations.subtractDays(input, params.days);
    case 'diffDays':
      return transformations.diffDays(input, params.compareDate);
    case 'extractPart':
      return transformations.extractPart(input, params.part);
    case 'now':
      return transformations.now();
    default:
      throw new Error(`Unknown date operation: ${operation}`);
  }
}

// Executar transformações de array
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function executeArrayTransformation(
  operation: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  switch (operation) {
    case 'filter':
      return transformations.filterArray(input, params.condition);
    case 'map':
      return transformations.mapArray(input, params.transformation);
    case 'sort':
      return transformations.sortArray(input, params.order);
    case 'first':
      return transformations.firstElement(input);
    case 'last':
      return transformations.lastElement(input);
    case 'join':
      return transformations.joinArray(input, params.separator);
    case 'unique':
      return transformations.uniqueArray(input);
    case 'length':
      return transformations.arrayLength(input);
    case 'sum':
      return transformations.sumArray(input);
    default:
      throw new Error(`Unknown array operation: ${operation}`);
  }
}

// Executar transformações de objeto
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function executeObjectTransformation(
  operation: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  switch (operation) {
    case 'extract':
      return transformations.extractField(input, params.field);
    case 'merge':
      return transformations.mergeObjects(input, params.mergeWith);
    case 'keys':
      return transformations.objectKeys(input);
    case 'values':
      return transformations.objectValues(input);
    case 'stringify':
      return transformations.stringifyObject(input);
    case 'parse':
      return transformations.parseJSON(input);
    default:
      throw new Error(`Unknown object operation: ${operation}`);
  }
}

// Executar transformações de validação
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function executeValidationTransformation(
  operation: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  switch (operation) {
    case 'validateEmail':
      return transformations.validateEmail(input);
    case 'validatePhone':
      return transformations.validatePhone(input);
    case 'formatPhone':
      return transformations.formatPhone(input);
    case 'removeMask':
      return transformations.removeMask(input);
    case 'sanitize':
      return transformations.sanitize(input);
    default:
      throw new Error(`Unknown validation operation: ${operation}`);
  }
}

async function processConditionNode(): Promise<unknown> {
  console.log(`🔀 Processing condition node`);
  // Implementar lógica de condição
  return { type: 'condition', result: true };
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

console.log('🚀 Webhook worker started');
