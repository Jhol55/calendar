import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';

// Função auxiliar para validar autenticação
function validateAuth(
  request: NextRequest,
  authConfig?: {
    type: 'none' | 'basic' | 'bearer';
    username?: string;
    password?: string;
    token?: string;
  },
): boolean {
  if (!authConfig || authConfig.type === 'none') {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return false;
  }

  if (
    authConfig.type === 'basic' &&
    authConfig.username &&
    authConfig.password
  ) {
    const base64Credentials = authHeader.replace('Basic ', '');
    const credentials = Buffer.from(base64Credentials, 'base64').toString(
      'utf-8',
    );
    const [username, password] = credentials.split(':');
    return username === authConfig.username && password === authConfig.password;
  }

  if (authConfig.type === 'bearer' && authConfig.token) {
    const token = authHeader.replace('Bearer ', '');
    return token === authConfig.token;
  }

  return false;
}

// Função para buscar o webhook no banco de dados
async function findWebhookInFlows(webhookId: string) {
  console.log('🔍 Searching for webhook:', webhookId);

  // Buscar todos os fluxos
  const flows = await prisma.chatbot_flows.findMany();
  console.log(`📊 Found ${flows.length} flows in database`);

  for (const flow of flows) {
    console.log(`\n🔄 Checking flow: ${flow.name} (ID: ${flow.id})`);
    const nodes = flow.nodes as unknown[];
    console.log(
      `  - Total nodes: ${Array.isArray(nodes) ? nodes.length : 'Not an array!'}`,
    );

    if (Array.isArray(nodes)) {
      nodes.forEach((node, nodeIndex) => {
        const n = node as {
          type?: string;
          id?: string;
          data?: {
            webhookConfig?: { webhookId?: string; serviceType?: string };
          };
        };
        console.log(`  - Node ${nodeIndex}: type="${n.type}", id="${n.id}"`);
        if (n.type === 'webhook') {
          console.log(`    ✅ Webhook node found!`);
          console.log(`    - webhookId: ${n.data?.webhookConfig?.webhookId}`);
          console.log(
            `    - serviceType: ${n.data?.webhookConfig?.serviceType}`,
          );
          console.log(`    - Looking for: ${webhookId}`);
          console.log(
            `    - Match: ${n.data?.webhookConfig?.webhookId === webhookId}`,
          );
        }
      });
    }

    const webhookNode = nodes.find((node: unknown) => {
      const n = node as {
        type?: string;
        data?: { webhookConfig?: { webhookId?: string } };
      };
      const nodeWebhookId = n.data?.webhookConfig?.webhookId;

      // Comparar diretamente ou extrair ID de URL
      const directMatch = nodeWebhookId === webhookId;
      const urlMatch =
        nodeWebhookId?.includes('/api/webhooks/') &&
        nodeWebhookId.split('/api/webhooks/')[1] === webhookId;

      return n.type === 'webhook' && (directMatch || urlMatch);
    });

    if (webhookNode) {
      console.log('✅ MATCH FOUND!');
      const node = webhookNode as {
        id: string;
        data: { webhookConfig: unknown };
      };
      console.log('🎯 Returning webhook data:', {
        flowId: flow.id,
        flowName: flow.name,
        nodeId: node.id,
        webhookConfig: node.data.webhookConfig,
      });
      return {
        flow,
        node,
        config: node.data.webhookConfig,
      };
    }
  }

  console.log('❌ No webhook found with ID:', webhookId);
  console.log('📋 All webhook IDs found in database:');

  // Listar todos os webhookIds para debug
  for (const flow of flows) {
    const nodes = flow.nodes as unknown[];
    if (Array.isArray(nodes)) {
      nodes.forEach((node) => {
        const n = node as {
          type?: string;
          data?: { webhookConfig?: { webhookId?: string } };
        };
        if (n.type === 'webhook' && n.data?.webhookConfig?.webhookId) {
          console.log(
            `  - Flow "${flow.name}": ${n.data.webhookConfig.webhookId}`,
          );
        }
      });
    }
  }

  return null;
}

// Função para buscar webhook por instância WhatsApp
async function findWebhookByInstance(instanceToken: string) {
  console.log('🔍 Searching for WhatsApp instance webhook:', instanceToken);

  // Buscar todos os fluxos
  const flows = await prisma.chatbot_flows.findMany();
  console.log(`📊 Found ${flows.length} flows in database`);

  for (const flow of flows) {
    console.log(`\n🔄 Checking flow: ${flow.name} (ID: ${flow.id})`);
    const nodes = flow.nodes as unknown[];
    console.log(
      `  - Total nodes: ${Array.isArray(nodes) ? nodes.length : 'Not an array!'}`,
    );

    if (Array.isArray(nodes)) {
      nodes.forEach((node, index) => {
        const n = node as {
          type?: string;
          id?: string;
          data?: {
            webhookConfig?: { instanceToken?: string; serviceType?: string };
          };
        };
        console.log(`  - Node ${index}: type="${n.type}", id="${n.id}"`);
        if (n.type === 'webhook') {
          console.log(`    ✅ Webhook node found!`);
          console.log(
            `    - instanceToken: ${n.data?.webhookConfig?.instanceToken}`,
          );
          console.log(
            `    - serviceType: ${n.data?.webhookConfig?.serviceType}`,
          );
          console.log(`    - Looking for: ${instanceToken}`);
          console.log(
            `    - Match: ${n.data?.webhookConfig?.instanceToken === instanceToken}`,
          );
        }
      });
    }

    const webhookNode = nodes.find((node: unknown) => {
      const n = node as {
        type?: string;
        data?: {
          webhookConfig?: { instanceToken?: string; serviceType?: string };
        };
      };
      return (
        n.type === 'webhook' &&
        n.data?.webhookConfig?.serviceType === 'whatsapp' &&
        n.data?.webhookConfig?.instanceToken === instanceToken
      );
    });

    if (webhookNode) {
      console.log('✅ WHATSAPP WEBHOOK FOUND!');
      const node = webhookNode as {
        id: string;
        data: { webhookConfig: unknown };
      };
      return {
        flow,
        node,
        config: node.data.webhookConfig,
      };
    }
  }

  console.log('❌ No WhatsApp webhook found for instance:', instanceToken);
  return null;
}

async function handleWebhook(
  request: NextRequest,
  { params }: { params: { webhookId: string } },
) {
  let webhookId = params.webhookId;
  const method = request.method;
  let execution: { id: string } | null = null;

  try {
    // Se for uma URL completa, extrair apenas o ID
    if (webhookId.includes('/api/webhooks/')) {
      webhookId = webhookId.split('/api/webhooks/')[1];
      console.log('🔧 Extracted webhook ID from URL:', webhookId);
    }

    let webhookData;

    // Verificar se é webhook de instância WhatsApp (pode ser token direto ou webhook URL)
    const isInstanceWebhook = webhookId.includes('-') && webhookId.length > 20; // Token format

    if (isInstanceWebhook) {
      console.log('🔍 WhatsApp instance webhook:', webhookId);

      // Buscar instância no banco pelo token
      const instance = await prisma.instances.findFirst({
        where: {
          OR: [
            { token: webhookId },
            { webhook: webhookId },
            { webhook: { contains: webhookId } }, // Para URLs que contêm o ID
          ],
        },
      });

      if (!instance) {
        return NextResponse.json(
          { error: 'Instance not found' },
          { status: 404 },
        );
      }

      // Buscar fluxo que usa esta instância
      webhookData = await findWebhookByInstance(instance.token);
    } else {
      // Webhook manual
      webhookData = await findWebhookInFlows(webhookId);
    }

    console.log('Webhook data:', webhookData);

    if (!webhookData) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const { config, flow } = webhookData;

    // Validar método HTTP (apenas para webhooks manuais)
    const webhookConfig = config as {
      serviceType?: string;
      methods?: string[];
      authentication?: {
        type: 'none' | 'basic' | 'bearer';
        username?: string;
        password?: string;
        token?: string;
      };
    };

    if (webhookConfig.serviceType === 'manual') {
      if (!webhookConfig.methods || !webhookConfig.methods.includes(method)) {
        return NextResponse.json(
          { error: `Method ${method} not allowed for this webhook` },
          { status: 405 },
        );
      }

      // Validar autenticação (apenas para webhooks manuais)
      if (!validateAuth(request, webhookConfig.authentication)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Extrair dados da requisição
    let requestData: Record<string, unknown> = {};

    if (method !== 'GET') {
      try {
        requestData = await request.json();
      } catch {
        // Se não conseguir fazer parse do JSON, tenta pegar como texto
        requestData = { body: await request.text() };
      }
    }

    // Extrair query params
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams);

    // Extrair headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Criar registro do webhook recebido (você pode salvar em uma tabela de logs se quiser)
    const webhookEvent = {
      webhookId,
      method,
      timestamp: new Date().toISOString(),
      queryParams,
      headers,
      body: requestData,
    };

    console.log('Webhook received:', webhookEvent);

    // Criar execução no banco de dados
    execution = await prisma.flow_executions.create({
      data: {
        flowId: flow.id,
        status: 'running',
        triggerType: 'webhook',
        triggerData: {
          webhookId,
          method,
          headers,
          queryParams,
          timestamp: webhookEvent.timestamp,
        },
        data: JSON.parse(JSON.stringify(requestData)),
        nodeExecutions: JSON.parse(
          JSON.stringify({
            webhook: {
              nodeId: webhookData.node.id,
              status: 'completed',
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              data: requestData,
            },
          }),
        ),
      },
    });

    console.log('✅ Execution created:', execution.id);

    // TODO: Executar o fluxo associado ao webhook
    // O fluxo começa a partir do próximo nó conectado ao webhook
    console.log('Flow to execute:', {
      flowId: flow.id,
      flowName: flow.name,
      webhookNode: webhookData.node.id,
      executionId: execution.id,
    });

    // Preparar resposta
    const responseData = {
      status: 'success',
      message: 'Webhook received successfully',
      flowId: flow.id,
      flowName: flow.name,
      executionId: execution.id,
      data: requestData,
      timestamp: webhookEvent.timestamp,
    };

    // Finalizar execução
    const endTime = new Date();
    const duration = endTime.getTime() - new Date().getTime();

    await prisma.flow_executions.update({
      where: { id: execution.id },
      data: {
        status: 'success',
        endTime,
        duration,
      },
    });

    console.log('✅ Execution completed:', execution.id);

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);

    // Se houver execução criada, marcar como erro
    if (execution) {
      await prisma.flow_executions
        .update({
          where: { id: execution.id },
          data: {
            status: 'error',
            endTime: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
        .catch(() => {}); // Ignorar erro se não conseguir atualizar
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// Exportar handlers para todos os métodos HTTP
export async function GET(
  request: NextRequest,
  context: { params: { webhookId: string } },
) {
  return handleWebhook(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: { webhookId: string } },
) {
  return handleWebhook(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: { webhookId: string } },
) {
  return handleWebhook(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { webhookId: string } },
) {
  return handleWebhook(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: { webhookId: string } },
) {
  return handleWebhook(request, context);
}
