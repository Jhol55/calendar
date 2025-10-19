import { webhookQueue, WebhookJobData } from '../services/queue';
import { prisma } from '../services/prisma';
import {
  salvarMemoria,
  buscarMemoria,
  deletarMemoria,
  listarMemorias,
} from './memory-helper';
import * as transformations from './transformation-helper';
import executeDatabaseNode from './database-helper';
import type { MessageConfig } from '../components/layout/chatbot-flow/types';

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
      if (value === null || value === undefined) {
        return match;
      }

      // Se for objeto ou array, converter para JSON
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      }

      return String(value);
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
    const duration = Date.now() - new Date(execution.startTime).getTime();
    await prisma.flow_executions.update({
      where: { id: execution.id },
      data: {
        status: 'success',
        endTime: new Date(),
        duration,
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
        // Buscar execução para calcular duração
        const runningExecution = await prisma.flow_executions.findFirst({
          where: {
            flowId: data.flowId,
            status: 'running',
            triggerType: 'webhook',
          },
          select: { startTime: true },
        });

        const duration = runningExecution?.startTime
          ? Date.now() - new Date(runningExecution.startTime).getTime()
          : undefined;

        await prisma.flow_executions.updateMany({
          where: {
            flowId: data.flowId,
            status: 'running',
            triggerType: 'webhook',
          },
          data: {
            status: 'error',
            endTime: new Date(),
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } catch (dbError) {
        console.error('Error updating execution status:', dbError);
      }
    }

    console.log(
      `❌ Webhook job ${job.id} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );

    // NÃO fazer throw para evitar retry automático
    // Retornar erro mas marcar job como "processado"
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Execution failed',
      error: true,
    };
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
  sourceHandle?: string; // Para identificar qual handle de saída foi usado
  targetHandle?: string; // Para identificar qual handle de entrada foi usado
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

  console.log(`📊 Flow has ${nodes.length} nodes and ${edges.length} edges`);

  // Encontrar o nó webhook
  const webhookNode = nodes.find((node) => node.id === webhookData.nodeId);
  if (!webhookNode) {
    throw new Error('Webhook node not found in flow');
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

// Função para processar uma cadeia de nós recursivamente
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

  // Se o nó for de condição e tiver selectedHandle, filtrar edges
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedHandle = (result as any)?.selectedHandle;
  if (currentNode.type === 'condition' && selectedHandle) {
    console.log(`🔀 Condition node selected handle: ${selectedHandle}`);
    // Filtrar edges baseado no sourceHandle (ReactFlow usa sourceHandle para identificar handles)
    nextEdges = nextEdges.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      if (edge.target === currentNodeId) {
        console.error(
          `🔴 LOOP DETECTED! Node ${currentNodeId} connects to itself!`,
        );
        throw new Error(
          `Circular loop detected: node ${currentNodeId} connects back to itself`,
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
        result = await processConditionNode(executionId, node, webhookData);
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
    // Opções avançadas
    linkPreview,
    linkPreviewTitle,
    linkPreviewDescription,
    linkPreviewImage,
    linkPreviewLarge,
    replyId,
    mentions,
    readChat,
    readMessages,
    delay,
    forward,
    trackSource,
    trackId,
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

    // Adicionar opções avançadas ao formData (se fornecidas)
    if (linkPreview !== undefined) {
      formData.linkPreview = linkPreview;
    }
    if (linkPreviewTitle) {
      formData.linkPreviewTitle = replaceVariables(
        linkPreviewTitle,
        variableContext,
      );
    }
    if (linkPreviewDescription) {
      formData.linkPreviewDescription = replaceVariables(
        linkPreviewDescription,
        variableContext,
      );
    }
    if (linkPreviewImage) {
      formData.linkPreviewImage = replaceVariables(
        linkPreviewImage,
        variableContext,
      );
    }
    if (linkPreviewLarge !== undefined) {
      formData.linkPreviewLarge = linkPreviewLarge;
    }
    if (replyId) {
      formData.replyid = replaceVariables(replyId, variableContext);
    }
    if (mentions) {
      formData.mentions = replaceVariables(mentions, variableContext);
    }
    if (readChat !== undefined) {
      formData.readchat = readChat;
    }
    if (readMessages !== undefined) {
      formData.readmessages = readMessages;
    }
    if (delay !== undefined) {
      formData.delay = delay;
    }
    if (forward !== undefined) {
      formData.forward = forward;
    }
    if (trackSource) {
      formData.track_source = replaceVariables(trackSource, variableContext);
    }
    if (trackId) {
      formData.track_id = replaceVariables(trackId, variableContext);
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
    console.log(
      `✅ Message sent successfully to ${resolvedPhoneNumber} from node ${node.id}`,
    );

    // Processar memória se configurada
    // Adicionar a resposta da API ao contexto para poder usar em variáveis de memória
    let memoryResult = undefined;
    if (messageConfig.memoryConfig) {
      const memoryVariableContext = {
        ...variableContext,
        $node: {
          ...variableContext.$node,
          output: {
            apiResponse: result,
            phoneNumber: resolvedPhoneNumber,
            text: resolvedText || text,
            messageType: messageType || 'text',
          },
        },
      };

      console.log('🔍 Memory Variable Context:', {
        apiResponse: result,
        availableKeys: Object.keys(result || {}),
      });

      memoryResult = await processNodeMemory(
        messageConfig.memoryConfig,
        executionId,
        memoryVariableContext,
      );
    }

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
      memoryResult, // Adicionar resultado da memória
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
  saveMode?: 'overwrite' | 'append';
}

/**
 * Função reutilizável para processar memória em qualquer node
 *
 * @param memoryConfig - Configuração de memória do node
 * @param executionId - ID da execução atual
 * @param variableContext - Contexto de variáveis para substituição
 * @returns Resultado da operação de memória
 *
 * @example
 * // Em qualquer processador de node:
 * const memoryResult = nodeConfig.memoryConfig
 *   ? await processNodeMemory(
 *       nodeConfig.memoryConfig,
 *       executionId,
 *       variableContext,
 *     )
 *   : undefined;
 *
 * // Adicionar ao retorno do node:
 * return {
 *   ...otherResults,
 *   memoryResult,
 * };
 */
async function processNodeMemory(
  memoryConfig: MemoryConfig,
  executionId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variableContext: any,
): Promise<unknown> {
  console.log('🧠 Processing memory configuration');
  console.log('📦 Variable Context received:', {
    hasNode: !!variableContext.$node,
    hasOutput: !!variableContext.$node?.output,
    outputKeys: variableContext.$node?.output
      ? Object.keys(variableContext.$node.output)
      : [],
    apiResponseKeys: variableContext.$node?.output?.apiResponse
      ? Object.keys(variableContext.$node.output.apiResponse)
      : [],
  });

  try {
    // Buscar execução para obter userId
    const execution = await prisma.flow_executions.findUnique({
      where: { id: executionId },
      include: {
        flow: true,
      },
    });

    const userId = execution?.flow?.userId
      ? String(execution.flow.userId)
      : null;

    if (!userId) {
      console.warn('⚠️ UserId not found, skipping memory processing');
      return {
        error: true,
        message: 'UserId not found',
      };
    }

    const { action, memoryName, items, ttl, defaultValue, saveMode } =
      memoryConfig;

    // Resolver variáveis no memoryName
    const resolvedMemoryName = replaceVariables(memoryName, variableContext);

    switch (action) {
      case 'save': {
        if (!items || items.length === 0) {
          console.warn('⚠️ No items to save in memory');
          return {
            error: true,
            message: 'No items to save',
          };
        }

        // Resolver variáveis em cada item
        const resolvedItems: Record<string, string> = {};
        items.forEach((item) => {
          console.log('🔍 Resolving memory item:', {
            originalKey: item.key,
            originalValue: item.value,
            contextKeys: Object.keys(variableContext),
            hasNodeOutput: !!variableContext.$node?.output,
            nodeOutputKeys: variableContext.$node?.output
              ? Object.keys(variableContext.$node.output)
              : [],
          });

          const resolvedKey = replaceVariables(item.key, variableContext);
          const resolvedValue = replaceVariables(item.value, variableContext);

          console.log('✅ Resolved memory item:', {
            resolvedKey,
            resolvedValue,
          });

          resolvedItems[resolvedKey] = resolvedValue;
        });

        // Implementar lógica de saveMode
        let finalValue: unknown = resolvedItems;
        if (saveMode === 'append') {
          // Buscar valor existente e adicionar à lista
          const existingMemory = await buscarMemoria(
            userId,
            resolvedMemoryName,
          );
          if (existingMemory.found && existingMemory.value) {
            // Se já existe, adicionar o novo valor à lista
            const existingArray = Array.isArray(existingMemory.value)
              ? existingMemory.value
              : [existingMemory.value];
            finalValue = [...existingArray, resolvedItems];
          } else {
            // Se não existe, criar nova lista
            finalValue = [resolvedItems];
          }
        }

        // Salvar na memória
        const saveResult = await salvarMemoria(
          userId,
          resolvedMemoryName,
          finalValue,
          ttl,
        );

        return {
          action: 'save',
          name: resolvedMemoryName,
          items: resolvedItems,
          saveMode: saveMode || 'overwrite',
          success: saveResult.success,
          expiresAt: saveResult.expiresAt,
        };
      }

      case 'fetch': {
        // Buscar memória
        const searchResult = await buscarMemoria(userId, resolvedMemoryName);

        let parsedValue = searchResult.value;
        if (!searchResult.found && defaultValue) {
          parsedValue = replaceVariables(defaultValue, variableContext);
        }

        return {
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

        return {
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
    console.error('❌ Error processing memory:', error);
    return {
      error: true,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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

  const { action, memoryName, items, ttl, defaultValue, saveMode } =
    memoryConfig as MemoryConfig & { saveMode?: 'overwrite' | 'append' };

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

        let finalValue: string;

        if (saveMode === 'append') {
          // Modo APPEND: Adicionar à lista existente
          const existingMemory = await buscarMemoria(
            userId,
            resolvedMemoryName,
          );
          let existingItems: Array<{ key: string; value: string }> = [];

          if (
            existingMemory.found &&
            existingMemory.value &&
            typeof existingMemory.value === 'string'
          ) {
            try {
              existingItems = JSON.parse(existingMemory.value);
              if (!Array.isArray(existingItems)) {
                existingItems = [];
              }
            } catch {
              // Se não for JSON válido, começar com array vazio
              existingItems = [];
            }
          }

          // Adicionar novos items à lista existente
          const combinedItems = [...existingItems, ...resolvedItems];
          finalValue = JSON.stringify(combinedItems);

          console.log(
            `➕ Memory append: ${resolvedMemoryName} - added ${resolvedItems.length} items to existing ${existingItems.length} items`,
          );
        } else {
          // Modo OVERWRITE: Substituir completamente
          finalValue = JSON.stringify(resolvedItems);

          console.log(
            `🔄 Memory overwrite: ${resolvedMemoryName} with ${resolvedItems.length} items`,
          );
        }

        // Salvar memória
        const saveResult = await salvarMemoria(
          userId,
          resolvedMemoryName,
          finalValue,
          ttl,
        );

        return {
          type: 'memory',
          action: 'save',
          name: resolvedMemoryName,
          items: resolvedItems,
          saveMode: saveMode || 'overwrite',
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

// Processador do Database Node
async function processDatabaseNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log('🗄️ Processing database node');

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

    // Preparar contexto de execução
    const executionContext = {
      userId,
      flowId: execution.flowId,
      executionId: execution.id,
      variables: {
        input: webhookData.body,
        nodes: $nodes,
        memory: $memory,
      },
    };

    // Executar database node
    const result = await executeDatabaseNode(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node as any,
      webhookData.body,
      executionContext,
    );

    console.log(
      `✅ Database node completed: ${result.operation} - ${result.message}`,
    );

    return result;
  } catch (error) {
    console.error(`❌ Error processing database node:`, error);
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
  memoryConfig?: MemoryConfig;
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
      console.log(`  📥 Input type: ${typeof inputValue}`);
      console.log(`  📥 Input is array: ${Array.isArray(inputValue)}`);
      if (typeof inputValue === 'object' && inputValue !== null) {
        console.log(`  📥 Input object keys: ${Object.keys(inputValue)}`);
      }

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

    // Processar memória se configurada
    let memoryResult = undefined;
    if (transformationConfig.memoryConfig) {
      // Adicionar o resultado da transformação ao contexto
      const transformationVariableContext = {
        ...variableContext,
        $node: {
          ...variableContext.$node,
          output: {
            finalValue: currentValue,
            steps: results,
            outputAs: outputAs || 'transformation_result',
          },
        },
      };

      memoryResult = await processNodeMemory(
        transformationConfig.memoryConfig,
        executionId,
        transformationVariableContext,
      );
    }

    // Retornar resultado final
    return {
      finalValue: currentValue,
      steps: results,
      outputAs: outputAs || 'transformation_result',
      memoryResult,
    };
  } catch (error) {
    console.error(`❌ Error processing transformation node:`, error);
    throw error;
  }
}

// Condition Node Types
interface ConditionRule {
  id: string;
  variable: string;
  operator: string;
  value: string;
  logicOperator?: 'AND' | 'OR';
}

interface SwitchCase {
  id: string;
  label: string;
  rules: ConditionRule[]; // Múltiplas regras para este caso
  // Campos antigos mantidos para compatibilidade
  variable?: string;
  operator?: string;
  value?: string;
}

interface ConditionConfig {
  conditionType: 'if' | 'switch';
  rules?: ConditionRule[];
  variable?: string;
  cases?: SwitchCase[];
  useDefaultCase?: boolean;
  memoryConfig?: MemoryConfig;
}

// Processador do Condition Node
async function processConditionNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log('🔀 Processing condition node');

  const conditionConfig = node.data?.conditionConfig as
    | ConditionConfig
    | undefined;

  console.log('🔍 Condition config:', JSON.stringify(conditionConfig, null, 2));

  if (!conditionConfig || !conditionConfig.conditionType) {
    throw new Error(
      'Condition node is not configured. Please double-click the node and configure it.',
    );
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

    // Preparar contexto de variáveis
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

    // Processar baseado no tipo de condição
    if (conditionConfig.conditionType === 'if') {
      // Processar IF
      const rules = conditionConfig.rules || [];
      if (rules.length === 0) {
        throw new Error('No rules defined for IF condition');
      }

      console.log(`🔀 Evaluating ${rules.length} IF rule(s)`);

      // Avaliar cada regra
      const evaluationResults: boolean[] = [];
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        const resolvedVariable = replaceVariables(
          rule.variable,
          variableContext,
        );
        const resolvedValue = replaceVariables(
          rule.value || '',
          variableContext,
        );

        const result = evaluateCondition(
          resolvedVariable,
          rule.operator,
          resolvedValue,
        );
        evaluationResults.push(result);

        console.log(
          `  Rule ${i + 1}: "${resolvedVariable}" ${rule.operator} "${resolvedValue}" = ${result}`,
        );
      }

      // Combinar resultados baseado em operadores lógicos
      let finalResult = evaluationResults[0];
      for (let i = 1; i < evaluationResults.length; i++) {
        const logicOperator = rules[i].logicOperator || 'AND';
        if (logicOperator === 'AND') {
          finalResult = finalResult && evaluationResults[i];
        } else {
          // OR
          finalResult = finalResult || evaluationResults[i];
        }
      }

      console.log(`🔀 Final IF result: ${finalResult}`);

      // Processar memória se configurada
      let memoryResult = undefined;
      if (conditionConfig.memoryConfig) {
        memoryResult = await processNodeMemory(
          conditionConfig.memoryConfig,
          executionId,
          variableContext,
        );
      }

      return {
        type: 'condition',
        conditionType: 'if',
        result: finalResult,
        selectedHandle: finalResult ? 'true' : 'false',
        evaluations: evaluationResults,
        memoryResult,
      };
    } else if (conditionConfig.conditionType === 'switch') {
      // Processar SWITCH
      const cases = conditionConfig.cases || [];
      if (cases.length === 0) {
        throw new Error('No cases defined for SWITCH condition');
      }

      console.log(`🔀 Evaluating SWITCH with ${cases.length} case(s)`);

      // Avaliar cada caso com suas múltiplas regras
      let matchedCase: SwitchCase | undefined;
      const evaluationResults: Array<{
        caseId: string;
        label: string;
        rules: Array<{
          variable: string;
          operator: string;
          value: string;
          result: boolean;
        }>;
        finalResult: boolean;
      }> = [];

      for (const caseItem of cases) {
        // Se o caso tem rules (novo formato), avaliar múltiplas regras
        if (caseItem.rules && caseItem.rules.length > 0) {
          const ruleResults: boolean[] = [];
          const ruleDetails: Array<{
            variable: string;
            operator: string;
            value: string;
            result: boolean;
          }> = [];

          // Avaliar cada regra do caso
          for (const rule of caseItem.rules) {
            const resolvedVariable = replaceVariables(
              rule.variable,
              variableContext,
            );
            const resolvedValue = replaceVariables(
              rule.value || '',
              variableContext,
            );

            const result = evaluateCondition(
              resolvedVariable,
              rule.operator,
              resolvedValue,
            );

            ruleResults.push(result);
            ruleDetails.push({
              variable: resolvedVariable,
              operator: rule.operator,
              value: resolvedValue,
              result,
            });

            console.log(
              `    Rule: "${resolvedVariable}" ${rule.operator} "${resolvedValue}" = ${result}`,
            );
          }

          // Aplicar operadores lógicos entre as regras
          let finalResult = ruleResults[0];
          for (let i = 0; i < caseItem.rules.length - 1; i++) {
            const rule = caseItem.rules[i];
            if (rule.logicOperator === 'AND') {
              finalResult = finalResult && ruleResults[i + 1];
            } else if (rule.logicOperator === 'OR') {
              finalResult = finalResult || ruleResults[i + 1];
            }
          }

          evaluationResults.push({
            caseId: caseItem.id,
            label: caseItem.label,
            rules: ruleDetails,
            finalResult,
          });

          console.log(`  Case "${caseItem.label}": ${finalResult}`);

          // Primeiro caso que der match é selecionado
          if (!matchedCase && finalResult) {
            matchedCase = caseItem;
          }
        } else {
          // Formato antigo (compatibilidade): avaliar com variable, operator, value
          const resolvedVariable = replaceVariables(
            caseItem.variable || '',
            variableContext,
          );
          const resolvedValue = replaceVariables(
            caseItem.value || '',
            variableContext,
          );

          const result = evaluateCondition(
            resolvedVariable,
            caseItem.operator || 'equals',
            resolvedValue,
          );

          evaluationResults.push({
            caseId: caseItem.id,
            label: caseItem.label,
            rules: [
              {
                variable: resolvedVariable,
                operator: caseItem.operator || 'equals',
                value: resolvedValue,
                result,
              },
            ],
            finalResult: result,
          });

          console.log(
            `  Case "${caseItem.label}": "${resolvedVariable}" ${caseItem.operator} "${resolvedValue}" = ${result}`,
          );

          // Primeiro caso que der match é selecionado
          if (!matchedCase && result) {
            matchedCase = caseItem;
          }
        }
      }

      let selectedHandle: string;
      if (matchedCase) {
        selectedHandle = `case_${matchedCase.id}`;
        console.log(
          `🔀 Matched case: "${matchedCase.label}" (ID: ${matchedCase.id})`,
        );
      } else if (conditionConfig.useDefaultCase !== false) {
        selectedHandle = 'default';
        console.log(`🔀 No match found, using DEFAULT case`);
      } else {
        throw new Error(`No matching case found and no default case defined`);
      }

      // Processar memória se configurada
      let memoryResult = undefined;
      if (conditionConfig.memoryConfig) {
        memoryResult = await processNodeMemory(
          conditionConfig.memoryConfig,
          executionId,
          variableContext,
        );
      }

      return {
        type: 'condition',
        conditionType: 'switch',
        matchedCase: matchedCase?.label,
        selectedHandle,
        totalCases: cases.length,
        evaluations: evaluationResults,
        memoryResult,
      };
    } else {
      throw new Error(
        `Unknown condition type: ${conditionConfig.conditionType}`,
      );
    }
  } catch (error) {
    console.error(`❌ Error processing condition node:`, error);
    throw error;
  }
}

// Função auxiliar para avaliar uma condição individual
function evaluateCondition(
  variable: string,
  operator: string,
  value: string,
): boolean {
  const varStr = String(variable || '').trim();
  const valStr = String(value || '').trim();

  switch (operator) {
    case 'equals':
      return varStr === valStr;

    case 'not_equals':
      return varStr !== valStr;

    case 'contains':
      return varStr.includes(valStr);

    case 'not_contains':
      return !varStr.includes(valStr);

    case 'starts_with':
      return varStr.startsWith(valStr);

    case 'ends_with':
      return varStr.endsWith(valStr);

    case 'greater_than': {
      const varNum = parseFloat(varStr);
      const valNum = parseFloat(valStr);
      return !isNaN(varNum) && !isNaN(valNum) && varNum > valNum;
    }

    case 'less_than': {
      const varNum = parseFloat(varStr);
      const valNum = parseFloat(valStr);
      return !isNaN(varNum) && !isNaN(valNum) && varNum < valNum;
    }

    case 'greater_or_equal': {
      const varNum = parseFloat(varStr);
      const valNum = parseFloat(valStr);
      return !isNaN(varNum) && !isNaN(valNum) && varNum >= valNum;
    }

    case 'less_or_equal': {
      const varNum = parseFloat(varStr);
      const valNum = parseFloat(valStr);
      return !isNaN(varNum) && !isNaN(valNum) && varNum <= valNum;
    }

    case 'is_empty':
      return varStr === '';

    case 'is_not_empty':
      return varStr !== '';

    case 'regex_match':
      try {
        const regex = new RegExp(valStr);
        return regex.test(varStr);
      } catch (error) {
        console.error(`❌ Invalid regex pattern: ${valStr}`, error);
        return false;
      }

    default:
      console.warn(`⚠️ Unknown operator: ${operator}`);
      return false;
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
