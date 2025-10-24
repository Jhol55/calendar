/**
 * Webhook Worker - Handler Principal
 *
 * Responsável por processar jobs de webhook da fila
 * A lógica de execução do fluxo foi movida para flow-executor.ts
 * Os processadores de nós estão organizados em helpers/
 */
import { webhookQueue, WebhookJobData } from '../services/queue';
import { prisma } from '../services/prisma';
import { executeFlow } from './flow-executor';

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

    // Executar o fluxo completo
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

console.log('🚀 Webhook worker started');
console.log('📂 Flow execution logic: src/workers/flow-executor.ts');
console.log('🔧 Node processors: src/workers/helpers/');
