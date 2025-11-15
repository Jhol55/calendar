/**
 * API Route para execução parcial de workflows
 * Executa o workflow do início até um node específico
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';
import { executeFlow } from '@/workers/helpers/flow-executor';
import { getSession } from '@/utils/security/session';
import type { WebhookJobData } from '@/services/queue';
// Type helper para Prisma JSON fields - necessário usar any devido à tipagem do Prisma
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaJsonValue = any;

interface FlowNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface PartialExecutionRequest {
  flowId: string;
  targetNodeId: string;
  triggerData?: Record<string, unknown>;
  flow?: {
    id: string;
    name: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    originalFlowId?: string | null;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: PartialExecutionRequest = await request.json();
    const { flowId, targetNodeId, triggerData = {}, flow: inlineFlow } = body;

    if (!targetNodeId) {
      return NextResponse.json(
        { error: 'targetNodeId é obrigatório' },
        { status: 400 },
      );
    }

    console.log(
      `🎯 Execução parcial solicitada: flowId=${flowId}, targetNodeId=${targetNodeId}, inline=${!!inlineFlow}`,
    );

    // Obter userId da sessão (necessário para flows temporários)
    const session = await getSession();
    const sessionData = session as { user?: { email?: string } } | null;
    let currentUserId: number | null = null;

    if (sessionData?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: sessionData.user.email },
        select: { id: true },
      });
      if (user) {
        currentUserId = user.id;
      }
    }

    // Usar flow inline (sem salvar) ou buscar do banco
    let flow: {
      id: string;
      name: string;
      nodes: FlowNode[];
      edges: FlowEdge[];
      userId: number | null;
    };
    let nodes: FlowNode[];
    let edges: FlowEdge[];

    if (inlineFlow) {
      // Executar flow sem salvar (modo preview)
      console.log('📦 Executando flow inline (não salvo)');

      flow = {
        id: inlineFlow.id,
        name: inlineFlow.name,
        nodes: inlineFlow.nodes,
        edges: inlineFlow.edges,
        userId: currentUserId,
      };
      nodes = inlineFlow.nodes || [];
      edges = inlineFlow.edges || [];
    } else {
      // Buscar flow do banco
      if (!flowId) {
        return NextResponse.json(
          { error: 'flowId é obrigatório quando flow não é fornecido' },
          { status: 400 },
        );
      }

      const dbFlow = await prisma.chatbot_flows.findUnique({
        where: { id: flowId },
      });

      if (!dbFlow) {
        return NextResponse.json(
          { error: 'Flow não encontrado' },
          { status: 404 },
        );
      }

      const dbNodes = Array.isArray(dbFlow.nodes)
        ? (dbFlow.nodes as unknown as FlowNode[])
        : [];
      const dbEdges = Array.isArray(dbFlow.edges)
        ? (dbFlow.edges as unknown as FlowEdge[])
        : [];

      flow = {
        id: dbFlow.id,
        name: dbFlow.name,
        nodes: dbNodes,
        edges: dbEdges,
        userId: dbFlow.userId,
      };
      nodes = dbNodes;
      edges = dbEdges;
    }

    // Identificar o caminho do início até o targetNode (será usado depois)
    // Não precisa validar aqui - pode ser node isolado

    // Se for flow inline, criar ou atualizar flow temporário no banco
    let actualFlowId = flowId;
    let isTemporaryFlow = false;

    // ✅ IMPORTANTE: Sempre usar originalFlowId se fornecido (flow salvo)
    if (inlineFlow?.originalFlowId && inlineFlow.originalFlowId !== 'temp') {
      actualFlowId = inlineFlow.originalFlowId;
      console.log(`✅ Usando originalFlowId fornecido: ${actualFlowId}`);
    }

    // ✅ Se ainda não tem flowId válido, criar flow temporário
    if (!actualFlowId || actualFlowId === 'temp') {
      if (currentUserId) {
        const existingTempFlow = await prisma.chatbot_flows.findFirst({
          where: {
            userId: currentUserId,
            isTemporary: true,
          },
        });

        if (existingTempFlow) {
          actualFlowId = existingTempFlow.id;
          console.log(`✅ Usando flow temporário existente: ${actualFlowId}`);
        } else {
          // Criar novo flow temporário
          const tempFlow = await prisma.chatbot_flows.create({
            data: {
              name: `Preview - User ${currentUserId}`,
              nodes: nodes as PrismaJsonValue,
              edges: edges as PrismaJsonValue,
              userId: currentUserId,
              isActive: false,
              isTemporary: true,
            },
          });
          actualFlowId = tempFlow.id;
          console.log(`✅ Flow temporário criado: ${actualFlowId}`);
        }
        isTemporaryFlow = true;
      } else {
        return NextResponse.json(
          { error: 'Usuário não autenticado e flowId não fornecido' },
          { status: 401 },
        );
      }
    }

    if (inlineFlow) {
      // ✅ Usar UM único flow temporário por usuário (evita poluição)
      const existingTempFlow = await prisma.chatbot_flows.findFirst({
        where: {
          userId: currentUserId,
          isTemporary: true,
        },
      });

      if (existingTempFlow) {
        // Atualizar flow temporário existente com nodes/edges atuais
        console.log('🔄 Atualizando flow temporário existente...');
        await prisma.chatbot_flows.update({
          where: { id: existingTempFlow.id },
          data: {
            nodes: inlineFlow.nodes as PrismaJsonValue,
            edges: inlineFlow.edges as PrismaJsonValue,
            updatedAt: new Date(),
          },
        });
        actualFlowId = existingTempFlow.id;
        console.log(`✅ Flow temporário atualizado: ${actualFlowId}`);
      } else {
        // Criar novo flow temporário
        console.log('💾 Criando flow temporário no banco...');
        const tempFlow = await prisma.chatbot_flows.create({
          data: {
            name: `Preview - User ${currentUserId}`,
            nodes: inlineFlow.nodes as PrismaJsonValue,
            edges: inlineFlow.edges as PrismaJsonValue,
            userId: currentUserId,
            isActive: false,
            isTemporary: true, // ✅ Marcar explicitamente como temporário
          },
        });
        actualFlowId = tempFlow.id;
        console.log(`✅ Flow temporário criado: ${actualFlowId}`);
      }

      isTemporaryFlow = true;
    }

    // Buscar TODAS as execuções recentes deste flow E do flow original (se houver)
    const flowIdsToSearch = [actualFlowId];

    // Se for flow inline e tem originalFlowId, buscar execuções do flow original também
    if (
      inlineFlow?.originalFlowId &&
      inlineFlow.originalFlowId !== actualFlowId
    ) {
      flowIdsToSearch.push(inlineFlow.originalFlowId);
      console.log(
        `🔗 Buscando execuções do flow original também: ${inlineFlow.originalFlowId}`,
      );
    }

    const recentExecutions = await prisma.flow_executions.findMany({
      where: {
        flowId: { in: flowIdsToSearch }, // ✅ Buscar em múltiplos flows
        status: { in: ['success', 'completed'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, flowId: true, nodeExecutions: true, createdAt: true },
    });

    console.log(
      `📊 Encontradas ${recentExecutions.length} execuções anteriores em ${flowIdsToSearch.length} flow(s): ${flowIdsToSearch.join(', ')}`,
    );

    // Mesclar nodeExecutions de todas as execuções recentes (mais recente tem prioridade)
    let mergedNodeExecutions: Record<string, unknown> = {};
    for (let i = recentExecutions.length - 1; i >= 0; i--) {
      const exec = recentExecutions[i];
      const nodeExecs = exec.nodeExecutions as Record<string, unknown> | null;
      if (
        nodeExecs &&
        typeof nodeExecs === 'object' &&
        !Array.isArray(nodeExecs)
      ) {
        mergedNodeExecutions = { ...mergedNodeExecutions, ...nodeExecs };
        console.log(
          `📦 Mesclando nodeExecutions da execution ${exec.id} (flow: ${exec.flowId}):`,
          Object.keys(nodeExecs),
        );
      }
    }

    console.log(
      `🔗 nodeExecutions mesclados (total de ${Object.keys(mergedNodeExecutions).length} nodes):`,
      Object.keys(mergedNodeExecutions),
    );
    if (Object.keys(mergedNodeExecutions).length > 0) {
      console.log(
        '📝 Dados disponíveis para novos nodes:',
        JSON.stringify(mergedNodeExecutions, null, 2).substring(0, 500) + '...',
      );
    }

    // ✅ Criar execution record ANTES de executar (para retornar imediatamente)
    // IMPORTANTE: Usar o flowId ORIGINAL para que a execução apareça na lista correta
    const flowIdForExecution = inlineFlow?.originalFlowId || actualFlowId;

    console.log(`📝 Criando execução:`);
    console.log(`   - actualFlowId (flow temporário): ${actualFlowId}`);
    console.log(
      `   - originalFlowId (flow real): ${inlineFlow?.originalFlowId}`,
    );
    console.log(`   - flowIdForExecution (será usado): ${flowIdForExecution}`);

    const startTime = new Date();
    const execution = await prisma.flow_executions.create({
      data: {
        flowId: flowIdForExecution, // ✅ Usar flowId original se existir
        status: 'running',
        triggerType: inlineFlow ? 'manual_partial_preview' : 'manual_partial',
        triggerData: triggerData as PrismaJsonValue,
        startTime,
        data: triggerData as PrismaJsonValue,
        nodeExecutions: mergedNodeExecutions as PrismaJsonValue,
      },
    });

    console.log(
      `✅ Execution criada: ${execution.id} (${Object.keys(mergedNodeExecutions).length} nodes herdados)`,
    );

    // ✅ RETORNAR IMEDIATAMENTE após criar a execução
    // A execução do flow acontece em background
    // O frontend fará polling para verificar quando terminar
    const executeInBackground = async () => {
      try {
        // Verificar se o targetNode está isolado (sem edges conectando ele)
        const hasIncomingEdges = edges.some(
          (edge) => edge.target === targetNodeId,
        );
        const hasOutgoingEdges = edges.some(
          (edge) => edge.source === targetNodeId,
        );
        const isIsolated = !hasIncomingEdges && !hasOutgoingEdges;

        // ✅ LÓGICA CORRETA: Se o node tem incoming edges, SEMPRE executar o caminho completo
        // Apenas executar o node isolado se ele NÃO tem nenhuma conexão
        const shouldExecuteOnlyTarget = isIsolated;

        let startNode: FlowNode | undefined;
        let webhookData: WebhookJobData;

        if (shouldExecuteOnlyTarget) {
          // Node está isolado ou não há caminho conectado - executar apenas ele
          const targetNode = nodes.find((node) => node.id === targetNodeId);
          if (!targetNode) {
            throw new Error(`Node ${targetNodeId} não encontrado no flow`);
          }

          startNode = targetNode;
          webhookData = {
            nodeId: targetNodeId, // Começar diretamente no node isolado
            flowId: actualFlowId,
            body: triggerData,
            stopAtNodeId: targetNodeId, // Parar imediatamente após executar
            webhookId: 'manual_partial_execution_isolated',
            method: 'POST',
            headers: {},
            queryParams: {},
            timestamp: new Date().toISOString(),
            config: {},
          };
        } else {
          // Há caminho conectado - executar desde o primeiro node até o targetNode
          // ✅ BUSCAR O PRIMEIRO NODE DO CAMINHO ATÉ O TARGET
          // Fazer busca reversa a partir do targetNode, seguindo incoming edges
          const findStartNodeInPath = (
            nodeId: string,
            visited: Set<string> = new Set(),
          ): string => {
            if (visited.has(nodeId)) return nodeId;
            visited.add(nodeId);

            // Buscar edges que chegam neste node
            const incomingEdges = edges.filter(
              (edge) => edge.target === nodeId,
            );

            // Se não tem incoming edges, este é o startNode do caminho
            if (incomingEdges.length === 0) {
              return nodeId;
            }

            // Se tem incoming edges, seguir recursivamente
            // Usar o primeiro source node encontrado
            const sourceNodeId = incomingEdges[0].source;
            return findStartNodeInPath(sourceNodeId, visited);
          };

          const startNodeId = findStartNodeInPath(targetNodeId);
          startNode = nodes.find((node) => node.id === startNodeId);

          if (!startNode) {
            throw new Error(
              `Não foi possível encontrar o node inicial do caminho até ${targetNodeId}`,
            );
          }

          webhookData = {
            nodeId: startNode.id, // Começar do primeiro node
            flowId: actualFlowId,
            body: triggerData,
            stopAtNodeId: targetNodeId, // Parar no node alvo especificado
            webhookId: 'manual_partial_execution',
            method: 'POST',
            headers: {},
            queryParams: {},
            timestamp: new Date().toISOString(),
            config: {},
          };
        }

        // Executar o flow (usar flow inline ou do banco)
        const flowToExecute = inlineFlow
          ? {
              ...flow,
              id: actualFlowId, // Usar o flowId temporário criado
            }
          : flow;

        await executeFlow(execution.id, flowToExecute, webhookData);

        // Buscar execution atualizada
        const updatedExecution = await prisma.flow_executions.findUnique({
          where: { id: execution.id },
        });

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        // Se ainda não foi finalizada, finalizar agora
        if (updatedExecution?.status === 'running') {
          await prisma.flow_executions.update({
            where: { id: execution.id },
            data: {
              status: 'success',
              endTime,
              duration,
              // ✅ IMPORTANTE: Não sobrescrever nodeExecutions aqui!
              // Eles já foram atualizados pelo executeFlow
            },
          });
        }
      } catch (execError) {
        console.error('❌ Erro na execução do flow:', execError);

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        // Atualizar execução com erro
        try {
          await prisma.flow_executions.update({
            where: { id: execution.id },
            data: {
              status: 'error',
              endTime,
              duration,
              error:
                execError instanceof Error
                  ? execError.message
                  : 'Erro desconhecido',
            },
          });
        } catch (updateError) {
          console.error('❌ Erro ao atualizar execução:', updateError);
        }
      }
    };

    // Executar em background (não bloquear a resposta)
    executeInBackground().catch((error) => {
      console.error('❌ Erro ao executar flow em background:', error);
    });

    // ✅ RETORNAR IMEDIATAMENTE com o executionId E flowId
    return NextResponse.json({
      success: true,
      executionId: execution.id,
      flowId: flowIdForExecution, // ✅ Retornar flowId para o frontend atualizar
      status: 'running', // Status inicial
      isTemporaryFlow,
    });
  } catch (error) {
    console.error('❌ Erro na API de execução parcial:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao processar requisição',
      },
      { status: 500 },
    );
  }
}

/**
 * Encontra o caminho do início até o node alvo usando BFS
 */
function findPathToNode(
  targetNodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): string[] {
  // Criar mapa de conexões
  const graph = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!graph.has(edge.source)) {
      graph.set(edge.source, []);
    }
    graph.get(edge.source)!.push(edge.target);
  });

  // Encontrar nodes iniciais (sem predecessores)
  const hasIncoming = new Set(edges.map((e) => e.target));
  const allNodeIds = nodes.map((n) => n.id);
  const startNodes = allNodeIds.filter((id) => !hasIncoming.has(id));

  if (startNodes.length === 0) {
    console.warn('⚠️ Nenhum node inicial encontrado');
    return [targetNodeId]; // Fallback: executar apenas o node target
  }

  // BFS para encontrar caminho mais curto
  const queue: Array<{ nodeId: string; path: string[] }> = startNodes.map(
    (id) => ({
      nodeId: id,
      path: [id],
    }),
  );
  const visited = new Set<string>(startNodes);

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;

    if (nodeId === targetNodeId) {
      return path;
    }

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({
          nodeId: neighbor,
          path: [...path, neighbor],
        });
      }
    }
  }

  // Se não encontrou caminho, o node pode estar isolado ou após o início
  console.warn(`⚠️ Node ${targetNodeId} não está conectado ao início`);
  return [targetNodeId]; // Executar apenas o node isolado
}
