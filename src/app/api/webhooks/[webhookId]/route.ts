import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';
import { addWebhookJob, WebhookJobData } from '@/services/queue';

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

// Função para buscar o webhook no banco de dados - RETORNA TODOS OS MATCHES
async function findWebhookInFlows(webhookId: string) {
  console.log('🔍 Searching for webhook:', webhookId);

  // Buscar apenas fluxos ATIVOS
  const flows = await prisma.chatbot_flows.findMany({
    where: {
      isActive: true, // ✅ Apenas fluxos ativos
    },
  });
  console.log(`📊 Found ${flows.length} ACTIVE flows in database`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches: Array<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    flow: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any;
  }> = [];

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
      console.log('🎯 Found webhook match:', {
        flowId: flow.id,
        flowName: flow.name,
        nodeId: node.id,
        webhookConfig: node.data.webhookConfig,
      });

      matches.push({
        flow,
        node,
        config: node.data.webhookConfig,
      });
    }
  }

  if (matches.length === 0) {
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
  } else {
    console.log(`✅ Found ${matches.length} flow(s) with webhook ${webhookId}`);
  }

  return matches;
}

// Função para buscar webhook por instância WhatsApp - RETORNA TODOS OS MATCHES
async function findWebhookByInstance(instanceToken: string) {
  console.log('🔍 Searching for WhatsApp instance webhook:', instanceToken);

  // Buscar apenas fluxos ATIVOS
  const flows = await prisma.chatbot_flows.findMany({
    where: {
      isActive: true, // ✅ Apenas fluxos ativos
    },
  });
  console.log(`📊 Found ${flows.length} ACTIVE flows in database`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches: Array<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    flow: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any;
  }> = [];

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
      matches.push({
        flow,
        node,
        config: node.data.webhookConfig,
      });
    }
  }

  if (matches.length === 0) {
    console.log('❌ No WhatsApp webhook found for instance:', instanceToken);
  } else {
    console.log(
      `✅ Found ${matches.length} flow(s) with WhatsApp instance ${instanceToken}`,
    );
  }

  return matches;
}

async function handleWebhook(
  request: NextRequest,
  { params }: { params: { webhookId: string } },
) {
  let webhookId = params.webhookId;
  const method = request.method;

  try {
    // Se for uma URL completa, extrair apenas o ID
    if (webhookId.includes('/api/webhooks/')) {
      webhookId = webhookId.split('/api/webhooks/')[1];
      console.log('🔧 Extracted webhook ID from URL:', webhookId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let webhookMatches: Array<{ flow: any; node: any; config: any }> = [];

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

      // Buscar todos os fluxos que usam esta instância
      webhookMatches = await findWebhookByInstance(instance.token);
    } else {
      // Webhook manual - buscar todos os fluxos com este webhookId
      webhookMatches = await findWebhookInFlows(webhookId);
    }

    console.log('Webhook matches:', webhookMatches);

    if (!webhookMatches || webhookMatches.length === 0) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    console.log(`🔥 Found ${webhookMatches.length} flow(s) to execute`);

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

    // Criar registro do webhook recebido
    const webhookEvent = {
      webhookId,
      method,
      timestamp: new Date().toISOString(),
      queryParams,
      headers,
      body: requestData,
    };

    console.log('Webhook received:', webhookEvent);

    // Processar cada fluxo encontrado
    const jobs = [];
    const flowResults = [];

    for (const webhookData of webhookMatches) {
      const { config, flow, node } = webhookData;

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

      // Validação apenas se for manual
      if (webhookConfig.serviceType === 'manual') {
        if (!webhookConfig.methods || !webhookConfig.methods.includes(method)) {
          console.log(
            `⚠️ Method ${method} not allowed for flow ${flow.name}, skipping...`,
          );
          continue;
        }

        // Validar autenticação (apenas para webhooks manuais)
        if (!validateAuth(request, webhookConfig.authentication)) {
          console.log(`⚠️ Auth failed for flow ${flow.name}, skipping...`);
          continue;
        }
      }

      // Preparar dados para a fila
      const webhookJobData: WebhookJobData = {
        webhookId,
        method,
        headers,
        queryParams,
        body: requestData,
        timestamp: webhookEvent.timestamp,
        flowId: flow.id,
        nodeId: node.id,
        config: webhookConfig,
      };

      // Adicionar job à fila
      const job = await addWebhookJob(webhookJobData, {
        priority: 1, // Prioridade alta
        delay: 0, // Processar imediatamente
      });

      console.log(
        `📋 Webhook job ${job.id} added to queue for flow: ${flow.name}`,
      );

      jobs.push(job);
      flowResults.push({
        flowId: flow.id,
        flowName: flow.name,
        jobId: job.id,
      });
    }

    // Se nenhum job foi criado (por validação/auth)
    if (jobs.length === 0) {
      return NextResponse.json(
        { error: 'No valid flows found for this webhook' },
        { status: 403 },
      );
    }

    // Resposta imediata (não bloqueia)
    const responseData = {
      status: 'received',
      message: `Webhook received and queued for ${jobs.length} flow(s)`,
      flows: flowResults,
      data: requestData,
      timestamp: webhookEvent.timestamp,
    };

    console.log(`✅ ${jobs.length} webhook job(s) queued successfully`);

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to queue webhook for processing',
        timestamp: new Date().toISOString(),
      },
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
