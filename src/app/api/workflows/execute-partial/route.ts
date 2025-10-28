/**
 * API Route para execução parcial de workflows
 * Executa o workflow do início até um node específico
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/services/prisma';
import { executeFlow } from '@/workers/helpers/flow-executor';
import { getSession } from '@/utils/security/session';

interface PartialExecutionRequest {
  flowId: string;
  targetNodeId: string;
  triggerData?: any;
  flow?: {
    id: string;
    name: string;
    nodes: any[];
    edges: any[];
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
    const session = (await getSession()) as any;
    let currentUserId: number | null = null;

    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      if (user) {
        currentUserId = user.id;
      }
    }

    // Usar flow inline (sem salvar) ou buscar do banco
    let flow: any;
    let nodes: any[];
    let edges: any[];

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

      flow = dbFlow;
      nodes = dbFlow.nodes as any[];
      edges = dbFlow.edges as any[];
    }

    // Identificar o caminho do início até o targetNode

    const pathToTarget = findPathToNode(targetNodeId, nodes, edges);

    if (pathToTarget.length === 0) {
      return NextResponse.json(
        { error: 'Não foi possível encontrar caminho até o node especificado' },
        { status: 400 },
      );
    }

    console.log(`📍 Caminho identificado: ${pathToTarget.join(' → ')}`);

    // Se for flow inline, criar ou atualizar flow temporário no banco
    let actualFlowId = flowId;
    let isTemporaryFlow = false;

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
            nodes: inlineFlow.nodes,
            edges: inlineFlow.edges,
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
            nodes: inlineFlow.nodes,
            edges: inlineFlow.edges,
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
    let mergedNodeExecutions: any = {};
    for (let i = recentExecutions.length - 1; i >= 0; i--) {
      const exec = recentExecutions[i];
      const nodeExecs = exec.nodeExecutions as any;
      if (nodeExecs && typeof nodeExecs === 'object') {
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

    // Criar execution record (herdando nodeExecutions mesclados)
    const startTime = new Date();
    const execution = await prisma.flow_executions.create({
      data: {
        flowId: actualFlowId,
        status: 'running',
        triggerType: inlineFlow ? 'manual_partial_preview' : 'manual_partial',
        triggerData,
        startTime,
        data: triggerData,
        nodeExecutions: mergedNodeExecutions, // ✅ Herdar dados de nodes anteriores
      },
    });

    console.log(
      `✅ Execution criada: ${execution.id} (${Object.keys(mergedNodeExecutions).length} nodes herdados)`,
    );

    // Executar o flow parcialmente
    try {
      // Encontrar o primeiro node (webhook ou outro tipo)
      const startNode = nodes.find((node: any) => {
        const hasIncoming = edges.some((edge: any) => edge.target === node.id);
        return !hasIncoming;
      });

      if (!startNode) {
        throw new Error(
          'Não foi possível encontrar o node inicial. Verifique se o fluxo tem um node inicial sem conexões de entrada.',
        );
      }

      console.log(
        `🚀 Executando flow a partir de: ${startNode.id} (tipo: ${startNode.type})`,
      );

      // Criar WebhookJobData simulado para execução
      const webhookData = {
        jobId: execution.id,
        nodeId: startNode.id,
        flowId: actualFlowId,
        body: triggerData,
        stopAtNodeId: targetNodeId, // Adicionar flag para parar no node especificado
        webhookId: 'manual_partial_execution',
        method: 'POST',
        headers: {},
        queryParams: {},
        timestamp: new Date().toISOString(),
        config: {},
      };

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
          },
        });
      }

      console.log(
        `✅ Execução parcial concluída em ${duration}ms ${isTemporaryFlow ? '(flow temporário)' : ''}`,
      );

      return NextResponse.json({
        success: true,
        executionId: execution.id,
        status: 'success',
        duration,
        path: pathToTarget,
        isTemporaryFlow, // Indicar se o flow é temporário
      });
    } catch (execError) {
      console.error('❌ Erro na execução do flow:', execError);

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

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

      return NextResponse.json(
        {
          success: false,
          error:
            execError instanceof Error ? execError.message : 'Erro na execução',
        },
        { status: 500 },
      );
    }
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
  nodes: any[],
  edges: any[],
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
