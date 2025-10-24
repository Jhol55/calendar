/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/services/prisma';
import type { WebhookJobData } from '@/services/queue';
import { listarMemorias } from './memory-helper';

interface NodeExecutionsRecord {
  [nodeId: string]: {
    status: string;
    result?: any;
    startTime?: string;
    endTime?: string;
  };
}

/**
 * Constrói o contexto de variáveis disponíveis para substituição
 *
 * Contexto inclui:
 * - $node: Dados do webhook trigger (body, headers, queryParams)
 * - $nodes: Outputs de todos os nós executados anteriormente
 * - $memory: Todas as memórias salvas do usuário
 * - $loop: Variável atual do loop (se dentro de um loop)
 *
 * Este contexto é usado para substituir variáveis no formato {{path}}
 * em todos os nós do fluxo
 */
export async function buildVariableContext(
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
  let $loop: any = null;
  Object.keys(nodeExecutions).forEach((nodeId) => {
    const nodeExec = nodeExecutions[nodeId];
    // Usar "result" se existir, senão usar "data" (para webhook node)
    const output = nodeExec?.result || (nodeExec as any)?.data;

    console.log(`🔍 [BUILD-CONTEXT] Processing node ${nodeId}:`, {
      hasResult: !!nodeExec?.result,
      hasData: !!(nodeExec as any)?.data,
      outputExists: !!output,
      outputType: output ? typeof output : 'undefined',
    });

    if (output) {
      $nodes[nodeId] = {
        output: output,
      };

      // Se for um loop node, adicionar ao $loop
      if ((output as any)?.loopVariable) {
        $loop = (output as any).loopVariable;
      }
    } else {
      console.warn(
        `⚠️ [BUILD-CONTEXT] Node ${nodeId} has no output (result or data)`,
      );
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
