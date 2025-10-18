import { webhookQueue, WebhookJobData } from '../services/queue';
import { prisma } from '../services/prisma';

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
          webhook: {
            nodeId: data.nodeId,
            status: 'completed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            data: data.body,
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeFlow(
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
        result = await processMessageNode(node, webhookData);
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

// Interfaces para configuração de mensagem
interface MessageConfig {
  token: string;
  phoneNumber: string;
  messageType?: 'text' | 'media' | 'contact' | 'location';
  text?: string;
  mediaUrl?: string;
  caption?: string;
  contactName?: string;
  contactPhone?: string;
  latitude?: number;
  longitude?: number;
}

// Processadores para diferentes tipos de nós
async function processMessageNode(
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
  } = messageConfig;

  if (!token || !phoneNumber) {
    throw new Error('Token and phoneNumber are required');
  }

  try {
    console.log(
      `📤 Sending ${messageType || 'text'} message to ${phoneNumber}`,
    );

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
    };

    // Substituir variáveis no número de telefone e texto
    const resolvedPhoneNumber = replaceVariables(phoneNumber, variableContext);
    const resolvedText = text ? replaceVariables(text, variableContext) : text;

    console.log(`📝 Resolved phone: ${resolvedPhoneNumber}`);
    if (resolvedText && resolvedText !== text) {
      console.log(`📝 Variables replaced in text`);
    }

    // Preparar dados baseado no tipo de mensagem
    const formData: Record<string, string | number> = {
      number: resolvedPhoneNumber,
    };

    switch (messageType) {
      case 'text':
        if (!resolvedText) throw new Error('Text message content is required');
        formData.text = resolvedText;
        break;

      case 'media':
        if (!mediaUrl) throw new Error('Media URL is required');
        formData.mediaUrl = mediaUrl;
        if (caption) formData.caption = caption;
        break;

      case 'contact':
        if (!contactName || !contactPhone)
          throw new Error('Contact name and phone are required');
        formData.contactName = contactName;
        formData.contactPhone = contactPhone;
        break;

      case 'location':
        if (!latitude || !longitude)
          throw new Error('Latitude and longitude are required');
        formData.latitude = latitude;
        formData.longitude = longitude;
        break;

      default:
        // Se não especificar tipo, assume texto
        if (!text) throw new Error('Text message content is required');
        formData.text = text;
    }

    console.log('📦 FormData:', formData);

    // Chamar API diretamente (sem usar Server Action)
    const response = await fetch(`${process.env.UAZAPI_URL}/send/text`, {
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
