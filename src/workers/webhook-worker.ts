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
import { processAgentNode as processAgentNodeHelper } from './agent-helper';
import { processLoopNode } from './loop-helper';
import { processCodeExecutionNode } from './code-execution-helper';
import type {
  MessageConfig,
  AgentConfig,
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

  // Se o nó for de condição ou loop e tiver selectedHandle, filtrar edges
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectedHandle = (result as any)?.selectedHandle;
  if (
    (currentNode.type === 'condition' || currentNode.type === 'loop') &&
    selectedHandle
  ) {
    console.log(
      `🔀 ${currentNode.type} node selected handle: ${selectedHandle}`,
    );
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
      // Permitir loops intencionais quando vêm de um Loop Node com handle 'loop'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      case 'http_request':
        result = await processHttpRequestNode(executionId, node, webhookData);
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

    // Usar helper para construir contexto de variáveis
    const variableContext = await buildVariableContext(
      executionId,
      webhookData,
    );

    // Debug: Log do contexto disponível
    console.log('🔍 Variable context available:', {
      hasNodeInput: !!variableContext.$node.input,
      availableNodes: Object.keys(variableContext.$nodes),
      hasLoop: !!variableContext.$loop,
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
        let resolvedMenuChoices = interactiveMenu.choices.map(
          (choice: string) => replaceVariables(choice, variableContext),
        );

        // Se o primeiro choice for uma variável de carousel (array de objetos), processar
        if (
          resolvedMenuChoices.length === 1 &&
          typeof resolvedMenuChoices[0] === 'string'
        ) {
          try {
            const parsedValue = JSON.parse(resolvedMenuChoices[0]);

            // Caso 1: Objeto único com 'category' (LIST de uma categoria)
            if (
              !Array.isArray(parsedValue) &&
              typeof parsedValue === 'object' &&
              parsedValue.category
            ) {
              console.log('📋 Detected single LIST category object');
              const listChoices: string[] = [];

              // Adicionar categoria
              if (parsedValue.category && parsedValue.category.trim() !== '') {
                listChoices.push(`[${parsedValue.category}]`);
                console.log(`✅ Added category: [${parsedValue.category}]`);
              }

              // Adicionar items
              if (parsedValue.items && Array.isArray(parsedValue.items)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                parsedValue.items.forEach((item: any, itemIndex: number) => {
                  console.log(`📋 Processing item ${itemIndex}:`, item);
                  if (item.text && item.text.trim() !== '') {
                    const choice = `${item.text}|${item.id || ''}|${item.description || ''}`;
                    listChoices.push(choice);
                    console.log(`✅ Added item: ${choice}`);
                  }
                });
              }

              resolvedMenuChoices = listChoices;
              console.log(
                `📋 Final: Converted single LIST category to ${listChoices.length} choices`,
              );
            }
            // Caso 2: Array de objetos
            else if (Array.isArray(parsedValue) && parsedValue.length > 0) {
              // Verificar se é um array de objetos (formato carousel)
              if (typeof parsedValue[0] === 'object' && parsedValue[0].title) {
                // FORMATO CAROUSEL
                const carouselChoices: string[] = [];
                parsedValue.forEach((card) => {
                  // Adicionar título e descrição
                  if (card.title && card.title.trim() !== '') {
                    const titleLine = card.description
                      ? `[${card.title}\n${card.description}]`
                      : `[${card.title}]`;
                    carouselChoices.push(titleLine);
                  }

                  // Adicionar imagem
                  if (card.imageUrl && card.imageUrl.trim() !== '') {
                    carouselChoices.push(`{${card.imageUrl}}`);
                  }

                  // Adicionar botões
                  if (card.buttons && Array.isArray(card.buttons)) {
                    card.buttons.forEach(
                      (button: {
                        text: string;
                        id: string;
                        actionType?: string;
                      }) => {
                        if (button.text && button.text.trim() !== '') {
                          let finalId = button.id || '';
                          if (button.actionType === 'copy') {
                            finalId = `copy:${button.id}`;
                          } else if (button.actionType === 'call') {
                            finalId = `call:${button.id}`;
                          } else if (button.actionType === 'return_id') {
                            finalId = `${button.id}`;
                          }
                          carouselChoices.push(`${button.text}|${finalId}`);
                        }
                      },
                    );
                  }
                });
                resolvedMenuChoices = carouselChoices;
                console.log(
                  `🎠 Converted carousel variable to ${carouselChoices.length} choices`,
                );
              } else if (
                typeof parsedValue[0] === 'object' &&
                parsedValue[0].category
              ) {
                // FORMATO LIST
                console.log('📋 Detected LIST format!');
                console.log(
                  '📋 Parsed value:',
                  JSON.stringify(parsedValue, null, 2),
                );

                const listChoices: string[] = [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                parsedValue.forEach((categoryObj: any, catIndex: number) => {
                  console.log(
                    `📋 Processing category ${catIndex}:`,
                    categoryObj.category,
                  );
                  console.log(
                    `📋 Category has ${categoryObj.items?.length || 0} items`,
                  );

                  // Adicionar categoria (com [])
                  if (
                    categoryObj.category &&
                    categoryObj.category.trim() !== ''
                  ) {
                    listChoices.push(`[${categoryObj.category}]`);
                    console.log(`✅ Added category: [${categoryObj.category}]`);
                  }

                  // Adicionar items da categoria
                  if (categoryObj.items && Array.isArray(categoryObj.items)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    categoryObj.items.forEach(
                      (item: any, itemIndex: number) => {
                        console.log(`📋 Processing item ${itemIndex}:`, item);
                        if (item.text && item.text.trim() !== '') {
                          const choice = `${item.text}|${item.id || ''}|${item.description || ''}`;
                          listChoices.push(choice);
                          console.log(`✅ Added item: ${choice}`);
                        } else {
                          console.log(
                            `⚠️ Item ${itemIndex} skipped - no text or empty`,
                          );
                        }
                      },
                    );
                  } else {
                    console.log('⚠️ Category has no items array');
                  }
                });
                resolvedMenuChoices = listChoices;
                console.log(
                  `📋 Final: Converted list variable to ${listChoices.length} choices`,
                );
                console.log('📋 Final choices:', listChoices);
              }
            }
          } catch {
            // Se não for JSON válido, manter como está
          }
        }
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

        // Se não encontrou, usar valor padrão
        if (!searchResult.found && defaultValue) {
          parsedValue = replaceVariables(defaultValue, variableContext);
        }

        // Parser inteligente para valores de memória
        if (searchResult.found && typeof searchResult.value === 'string') {
          const stringValue = searchResult.value as string;

          // Tentar parsear como JSON puro primeiro
          try {
            parsedValue = JSON.parse(stringValue);
            console.log(`✅ [NODE-MEMORY] Parsed as pure JSON`);
          } catch {
            // Se falhar, tentar converter formato JavaScript para JSON
            console.log(`⚠️ [NODE-MEMORY] Trying to convert JS format...`);
            try {
              let jsFormatted = stringValue.trim();

              // Substituir [Array] por []
              jsFormatted = jsFormatted.replace(/\[\s*\[Array\]\s*\]/g, '[]');

              // Adicionar aspas em chaves sem aspas
              jsFormatted = jsFormatted.replace(
                /(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
                '$1"$2":',
              );

              // Substituir aspas simples por duplas
              jsFormatted = jsFormatted.replace(/:\s*'([^']*)'/g, ': "$1"');
              jsFormatted = jsFormatted.replace(/\[\s*'([^']*)'/g, '["$1"');
              jsFormatted = jsFormatted.replace(/',\s*'/g, '", "');
              jsFormatted = jsFormatted.replace(/'\s*\]/g, '"]');

              parsedValue = JSON.parse(jsFormatted);
              console.log(
                `✅ [NODE-MEMORY] Converted from JS format successfully`,
              );
            } catch {
              console.log(`✅ [NODE-MEMORY] Keeping as string`);
              parsedValue = stringValue;
            }
          }
        }

        // Calcular metadados sobre o valor
        const valueType = Array.isArray(parsedValue)
          ? 'array'
          : parsedValue === null
            ? 'null'
            : typeof parsedValue;

        // Calcular itemCount de forma inteligente
        let itemCount: number | undefined = undefined;
        if (Array.isArray(parsedValue)) {
          // Se for array com 1 elemento que tem estrutura {key, value}
          // onde value é array, contar os items dentro de value
          if (
            parsedValue.length === 1 &&
            typeof parsedValue[0] === 'object' &&
            parsedValue[0] !== null &&
            'key' in parsedValue[0] &&
            'value' in parsedValue[0] &&
            Array.isArray(parsedValue[0].value)
          ) {
            itemCount = parsedValue[0].value.length;
            console.log(
              `📊 [NODE-MEMORY] Detected memory structure with nested value array`,
            );
          } else {
            itemCount = parsedValue.length;
          }
        }

        const isEmpty =
          parsedValue === null ||
          parsedValue === undefined ||
          (typeof parsedValue === 'string' && parsedValue.trim() === '') ||
          (Array.isArray(parsedValue) && parsedValue.length === 0) ||
          (typeof parsedValue === 'object' &&
            !Array.isArray(parsedValue) &&
            Object.keys(parsedValue).length === 0);

        console.log(`🔍 [NODE-MEMORY] Parsed value type: ${valueType}`);
        console.log(`🔍 [NODE-MEMORY] Item count: ${itemCount ?? 'N/A'}`);
        console.log(`🔍 [NODE-MEMORY] Is empty: ${isEmpty}`);

        return {
          action: 'fetch',
          name: resolvedMemoryName,
          value: parsedValue,
          valueType,
          itemCount,
          isEmpty,
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

        // Parser inteligente para valores de memória
        let parsedValue = searchResult.value;
        if (searchResult.found && typeof searchResult.value === 'string') {
          const stringValue = searchResult.value;

          // Tentar parsear como JSON puro primeiro
          try {
            parsedValue = JSON.parse(stringValue);
            console.log(`✅ [MEMORY] Parsed as pure JSON`);
          } catch {
            // Se falhar, tentar converter formato JavaScript para JSON
            console.log(`⚠️ [MEMORY] Trying to convert JS format...`);
            try {
              let jsFormatted = stringValue.trim();

              // Substituir [Array] por []
              jsFormatted = jsFormatted.replace(/\[\s*\[Array\]\s*\]/g, '[]');

              // Adicionar aspas em chaves sem aspas
              jsFormatted = jsFormatted.replace(
                /(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
                '$1"$2":',
              );

              // Substituir aspas simples por duplas
              jsFormatted = jsFormatted.replace(/:\s*'([^']*)'/g, ': "$1"');
              jsFormatted = jsFormatted.replace(/\[\s*'([^']*)'/g, '["$1"');
              jsFormatted = jsFormatted.replace(/',\s*'/g, '", "');
              jsFormatted = jsFormatted.replace(/'\s*\]/g, '"]');

              parsedValue = JSON.parse(jsFormatted);
              console.log(`✅ [MEMORY] Converted from JS format successfully`);
            } catch {
              console.log(`✅ [MEMORY] Keeping as string`);
              parsedValue = stringValue;
            }
          }
        }

        // Calcular metadados sobre o valor
        const valueType = Array.isArray(parsedValue)
          ? 'array'
          : parsedValue === null
            ? 'null'
            : typeof parsedValue;

        // Calcular itemCount de forma inteligente
        let itemCount: number | undefined = undefined;
        if (Array.isArray(parsedValue)) {
          // Se for array com 1 elemento que tem estrutura {key, value}
          // onde value é array, contar os items dentro de value
          if (
            parsedValue.length === 1 &&
            typeof parsedValue[0] === 'object' &&
            parsedValue[0] !== null &&
            'key' in parsedValue[0] &&
            'value' in parsedValue[0] &&
            Array.isArray(parsedValue[0].value)
          ) {
            itemCount = parsedValue[0].value.length;
            console.log(
              `📊 [MEMORY] Detected memory structure with nested value array`,
            );
          } else {
            itemCount = parsedValue.length;
          }
        }

        const isEmpty =
          parsedValue === null ||
          parsedValue === undefined ||
          (typeof parsedValue === 'string' && parsedValue.trim() === '') ||
          (Array.isArray(parsedValue) && parsedValue.length === 0) ||
          (typeof parsedValue === 'object' &&
            !Array.isArray(parsedValue) &&
            Object.keys(parsedValue).length === 0);

        console.log(
          `🔍 Memory search: ${resolvedMemoryName}, found: ${searchResult.found}`,
        );
        console.log(`🔍 Memory parsed value type: ${valueType}`);
        console.log(`🔍 Memory item count: ${itemCount ?? 'N/A'}`);
        console.log(`🔍 Memory is empty: ${isEmpty}`);

        return {
          type: 'memory',
          action: 'fetch',
          name: resolvedMemoryName,
          value: parsedValue,
          valueType,
          itemCount,
          isEmpty,
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

    // Parsear strings JSON nos resultados
    const parseJsonInObject = (obj: unknown): unknown => {
      if (obj === null || obj === undefined) {
        return obj;
      }

      if (typeof obj === 'string') {
        // Tentar parsear se for uma string que parece JSON
        if (
          (obj.startsWith('{') && obj.endsWith('}')) ||
          (obj.startsWith('[') && obj.endsWith(']'))
        ) {
          try {
            return parseJsonInObject(JSON.parse(obj));
          } catch {
            // Se falhar, retornar a string original
            return obj;
          }
        }
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map((item) => parseJsonInObject(item));
      }

      if (typeof obj === 'object') {
        const parsed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
          parsed[key] = parseJsonInObject(value);
        }
        return parsed;
      }

      return obj;
    };

    const parsedResult = parseJsonInObject(result);

    return parsedResult;
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

// ==================== HELPER: BUILD VARIABLE CONTEXT ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildVariableContext(
  executionId: string,
  webhookData: WebhookJobData,
): Promise<any> {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let $loop: any = null;
  Object.keys(nodeExecutions).forEach((nodeId) => {
    const nodeExec = nodeExecutions[nodeId];
    if (nodeExec?.result) {
      $nodes[nodeId] = {
        output: nodeExec.result,
      };

      // Se for um loop node, adicionar ao $loop
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((nodeExec.result as any)?.loopVariable) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        $loop = (nodeExec.result as any).loopVariable;
      }
    }
  });

  // Buscar todas as memórias do usuário para o contexto
  const userId = execution?.flow?.userId ? String(execution.flow.userId) : null;
  const $memory = userId ? await listarMemorias(userId) : {};

  console.log('🔹 [BUILD-CONTEXT] $nodes:', Object.keys($nodes));
  console.log(
    '🔹 [BUILD-CONTEXT] $nodes content:',
    JSON.stringify($nodes, null, 2).substring(0, 500),
  );

  // Preparar contexto para substituição de variáveis
  return {
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
    $loop,
  };
}

// ==================== LOOP NODE ====================

async function processLoopNodeWrapper(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log('🔁 Processing loop node');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loopConfig = node.data?.loopConfig as any;

  if (!loopConfig || !loopConfig.inputData) {
    throw new Error(
      'Loop node is not configured. Please configure the input data.',
    );
  }

  try {
    // Usar helper para construir contexto de variáveis
    const variableContext = await buildVariableContext(
      executionId,
      webhookData,
    );

    console.log('🔍 Loop variable context:', {
      hasLoop: !!variableContext.$loop,
      loopKeys: variableContext.$loop ? Object.keys(variableContext.$loop) : [],
      availableNodes: Object.keys(variableContext.$nodes),
    });

    // Processar o loop node usando o helper
    const result = await processLoopNode({
      executionId,
      nodeId: node.id,
      config: loopConfig,
      variableContext,
    });

    console.log('📤 Loop result:', {
      hasMore: result.hasMore,
      selectedHandle: result.selectedHandle,
      loopVariableKeys: Object.keys(result.loopVariable),
    });

    // Retornar resultado com selectedHandle para controlar o fluxo
    return {
      ...result,
      selectedHandle: result.selectedHandle, // 'loop' ou 'done'
    };
  } catch (error) {
    console.error(`❌ Error processing loop node:`, error);
    throw error;
  }
}

async function processCodeExecutionNodeWrapper(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log('💻 Processing code execution node');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const codeConfig = node.data?.codeExecutionConfig as any;

  if (!codeConfig || !codeConfig.code || !codeConfig.language) {
    throw new Error(
      'Code execution node is not configured. Please configure the code and language.',
    );
  }

  try {
    // Usar helper para construir contexto de variáveis
    const variableContext = await buildVariableContext(
      executionId,
      webhookData,
    );

    console.log('🔍 Code execution variable context:', {
      availableNodes: Object.keys(variableContext.$nodes),
      hasLoop: !!variableContext.$loop,
      hasMemory: !!variableContext.$memory,
    });

    // Processar o código usando o helper
    const result = await processCodeExecutionNode(codeConfig, variableContext);

    console.log('📤 Code execution result:', {
      success: result.success,
      hasOutput: !!result.output,
      hasError: !!result.error,
      executionTime: result.executionTime,
    });

    // Processar memória se configurada
    if (codeConfig.memoryConfig && result.success) {
      const memoryVariableContext = {
        ...variableContext,
        $node: {
          ...variableContext.$node,
          output: result.result,
        },
      };

      await processNodeMemory(
        codeConfig.memoryConfig,
        executionId,
        memoryVariableContext,
      );
    }

    return result.result;
  } catch (error) {
    console.error(`❌ Error processing code execution node:`, error);
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
    // Usar helper para construir contexto de variáveis
    const variableContext = await buildVariableContext(
      executionId,
      webhookData,
    );

    console.log('🔍 Condition variable context:', {
      hasLoop: !!variableContext.$loop,
      availableNodes: Object.keys(variableContext.$nodes),
    });

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
    case 'deleteKeys':
      if (!params.keysToDelete) {
        throw new Error('deleteKeys operation requires keysToDelete parameter');
      }
      return transformations.deleteKeys(input, params.keysToDelete);
    case 'renameKeys':
      if (!params.keyMappings) {
        throw new Error('renameKeys operation requires keyMappings parameter');
      }
      return transformations.renameKeys(input, params.keyMappings);
    case 'extractField':
      if (!params.fieldName) {
        throw new Error('extractField operation requires fieldName parameter');
      }
      return transformations.extractArrayField(input, params.fieldName);
    case 'flatMap':
      if (!params.template) {
        throw new Error('flatMap operation requires template parameter');
      }
      return transformations.flatMapArray(input, params.template);
    case 'mapObject':
      if (!params.objectTemplate) {
        throw new Error(
          'mapObject operation requires objectTemplate parameter',
        );
      }
      return transformations.mapObjectArray(input, params.objectTemplate);
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

// Interface para configuração de HTTP Request
interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  bodyType?: 'json' | 'text' | 'form';
  timeout?: number;
  followRedirects?: boolean;
  validateSSL?: boolean;
  saveResponse?: boolean;
  responseVariable?: string;
  memoryConfig?: MemoryConfig;
}

// Processador do HTTP Request Node
async function processHttpRequestNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log('🌐 Processing HTTP request node');

  const httpRequestConfig = node.data?.httpRequestConfig as
    | HttpRequestConfig
    | undefined;

  if (!httpRequestConfig) {
    throw new Error('HTTP request configuration not found');
  }

  const {
    url,
    method,
    headers,
    body,
    bodyType,
    timeout,
    followRedirects,
    saveResponse,
    responseVariable,
  } = httpRequestConfig;

  if (!url || !method) {
    throw new Error('URL and method are required');
  }

  try {
    console.log(`📤 Making ${method} request to ${url}`);

    // Usar helper para construir contexto de variáveis
    const variableContext = await buildVariableContext(
      executionId,
      webhookData,
    );

    console.log('🔍 HTTP Request variable context:', {
      hasLoop: !!variableContext.$loop,
      availableNodes: Object.keys(variableContext.$nodes),
    });

    // Substituir variáveis na URL
    const resolvedUrl = replaceVariables(url, variableContext);
    console.log(`📝 Original URL: ${url}`);
    console.log(`📝 Resolved URL: ${resolvedUrl}`);

    // Preparar headers
    const requestHeaders: Record<string, string> = {};
    if (headers && headers.length > 0) {
      headers.forEach((header) => {
        if (header.key && header.value) {
          const resolvedKey = replaceVariables(header.key, variableContext);
          const resolvedValue = replaceVariables(header.value, variableContext);
          requestHeaders[resolvedKey] = resolvedValue;
        }
      });
    }

    // Preparar body se necessário
    let requestBody: string | undefined = undefined;
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const resolvedBody = replaceVariables(body, variableContext);

      // Definir Content-Type baseado no bodyType
      if (bodyType === 'json') {
        requestHeaders['Content-Type'] = 'application/json';
        // Validar se é JSON válido
        try {
          JSON.parse(resolvedBody);
          requestBody = resolvedBody;
        } catch {
          throw new Error('Invalid JSON in request body');
        }
      } else if (bodyType === 'form') {
        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        requestBody = resolvedBody;
      } else {
        // text
        requestHeaders['Content-Type'] = 'text/plain';
        requestBody = resolvedBody;
      }
    }

    console.log(`📦 Request headers:`, requestHeaders);
    console.log(`📦 Request body:`, requestBody);

    // Fazer a requisição HTTP
    const controller = new AbortController();
    const timeoutId = timeout
      ? setTimeout(() => controller.abort(), timeout)
      : null;

    try {
      const response = await fetch(resolvedUrl, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal,
        redirect: followRedirects !== false ? 'follow' : 'manual',
        // Note: validateSSL não é suportado no fetch do Node.js padrão
        // Para produção, considere usar bibliotecas como node-fetch ou axios
      });

      if (timeoutId) clearTimeout(timeoutId);

      // Ler resposta
      const responseText = await response.text();
      console.log(`📄 Raw response text:`, responseText);
      console.log(`📄 Raw response text type:`, typeof responseText);

      let responseData: unknown;

      // Tentar parsear como JSON recursivamente até não ser mais string
      responseData = responseText;
      let parseAttempts = 0;
      const maxAttempts = 3; // Prevenir loop infinito

      while (typeof responseData === 'string' && parseAttempts < maxAttempts) {
        try {
          const parsed = JSON.parse(responseData);
          console.log(
            `🔄 Parse attempt ${parseAttempts + 1}: success, type = ${typeof parsed}`,
          );
          responseData = parsed;
          parseAttempts++;
        } catch {
          console.log(`🔄 Parse attempt ${parseAttempts + 1}: failed`);

          // Tentar corrigir JSONs malformados comuns apenas na primeira tentativa
          if (parseAttempts === 0 && typeof responseData === 'string') {
            console.log(`🔧 Attempting to fix malformed JSON...`);

            // Tentar corrigir padrões comuns de JSON malformado
            let fixedJson = responseData;

            // Corrigir: { "data:" "success" } -> { "data": "success" }
            // Remove os dois-pontos extras dentro das aspas e adiciona dois-pontos corretos
            fixedJson = fixedJson.replace(
              /"([^"]+):"\s+"([^"]+)"/g,
              '"$1": "$2"',
            );

            // Corrigir: :" " -> ": " (espaço extra após dois pontos)
            fixedJson = fixedJson.replace(/:\s*"\s+/g, ': "');

            try {
              const fixedParsed = JSON.parse(fixedJson);
              console.log(`✅ Fixed JSON successfully!`);
              responseData = fixedParsed;
              parseAttempts++;
              continue; // Tentar parsear novamente
            } catch {
              console.log(`❌ Could not fix malformed JSON, keeping as string`);
            }
          }

          break; // Não é JSON válido, manter como string
        }
      }

      console.log(`📋 Response status: ${response.status}`);
      console.log(`📋 Final response data:`, responseData);
      console.log(`📋 Final response data type:`, typeof responseData);
      console.log(`📋 Total parse attempts:`, parseAttempts);

      // Verificar se a resposta foi bem-sucedida
      if (!response.ok) {
        throw new Error(
          `HTTP request failed with status ${response.status}: ${responseText}`,
        );
      }

      const result = {
        type: 'http_request',
        status: 'success',
        statusCode: response.status,
        url: resolvedUrl,
        method,
        response: responseData,
        // Se saveResponse estiver ativo, incluir em variável específica
        ...(saveResponse && responseVariable
          ? { [responseVariable]: responseData }
          : {}),
      };

      // Processar memória se configurada
      let memoryResult = undefined;
      if (httpRequestConfig.memoryConfig) {
        const httpVariableContext = {
          ...variableContext,
          $node: {
            ...variableContext.$node,
            output: result,
          },
        };

        memoryResult = await processNodeMemory(
          httpRequestConfig.memoryConfig,
          executionId,
          httpVariableContext,
        );
      }

      console.log(
        `✅ HTTP request completed successfully to ${resolvedUrl} from node ${node.id}`,
      );

      return {
        ...result,
        memoryResult,
      };
    } catch (fetchError) {
      if (timeoutId) clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error(`HTTP request timed out after ${timeout}ms`);
      }

      throw fetchError;
    }
  } catch (error) {
    console.error(`❌ Error making HTTP request:`, error);
    throw error;
  }
}

async function processAgentNode(
  executionId: string,
  node: FlowNode,
  webhookData: WebhookJobData,
): Promise<unknown> {
  console.log('🤖 Processing agent node');

  const agentConfig = node.data?.agentConfig as AgentConfig | undefined;
  if (!agentConfig) {
    throw new Error('Agent configuration not found');
  }

  // Usar helper para construir contexto de variáveis
  const variableContext = await buildVariableContext(executionId, webhookData);

  console.log('🔍 Agent variable context:', {
    hasLoop: !!variableContext.$loop,
    availableNodes: Object.keys(variableContext.$nodes),
  });

  // Buscar execução para obter flowId
  const execution = await prisma.flow_executions.findUnique({
    where: { id: executionId },
    include: { flow: true },
  });

  // Extrair userId do WhatsApp (número do remetente)
  const whatsappUserId =
    webhookData.body?.data?.from ||
    webhookData.body?.data?.key?.remoteJid ||
    'unknown';

  // Processar agent node
  const result = await processAgentNodeHelper({
    config: agentConfig,
    userId: whatsappUserId,
    flowId: execution?.flowId,
    nodeId: node.id,
    variableContext,
    replaceVariables,
  });

  // Salvar resposta em memória se configurado
  if (agentConfig.memoryConfig) {
    const memoryValue = result.response || result;
    const memoryUserId = execution?.flow?.userId
      ? String(execution.flow.userId)
      : null;

    if (memoryUserId) {
      if (
        agentConfig.memoryConfig.action === 'save' ||
        agentConfig.memoryConfig.action === 'update'
      ) {
        await salvarMemoria(
          memoryUserId,
          agentConfig.memoryConfig.name,
          memoryValue,
          agentConfig.memoryConfig.ttl,
        );
      } else if (agentConfig.memoryConfig.action === 'delete') {
        await deletarMemoria(memoryUserId, agentConfig.memoryConfig.name);
      }
    }
  }

  console.log('✅ Agent node processed successfully');
  return result;
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
