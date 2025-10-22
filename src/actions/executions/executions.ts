'use server';

import { prisma } from '@/services/prisma';

export interface Execution {
  id: string;
  status: 'running' | 'success' | 'error' | 'stopped';
  triggerType: 'webhook' | 'manual' | 'schedule';
  startTime: string;
  endTime?: string;
  duration?: number;
  error?: string;
  data?: any;
  result?: any;
  nodeExecutions?: any;
}

export interface ListExecutionsParams {
  flowId: string;
  limit?: number;
  offset?: number;
}

export interface ListExecutionsResponse {
  success: boolean;
  executions?: Execution[];
  total?: number;
  error?: string;
}

/**
 * Listar execuções de um fluxo
 * Acesso direto ao Prisma (sem HTTP overhead)
 */
export async function listExecutions(
  params: ListExecutionsParams,
): Promise<ListExecutionsResponse> {
  try {
    const { flowId, limit = 20, offset = 0 } = params;

    if (!flowId) {
      return {
        success: false,
        error: 'flowId é obrigatório',
      };
    }

    // Buscar execuções do fluxo
    const executions = await prisma.flow_executions.findMany({
      where: {
        flowId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Contar total de execuções
    const total = await prisma.flow_executions.count({
      where: {
        flowId,
      },
    });

    // Mapear para o tipo Execution
    const mappedExecutions = executions.map((exec) => ({
      id: exec.id,
      status: exec.status as 'running' | 'success' | 'error' | 'stopped',
      triggerType: exec.triggerType as 'webhook' | 'manual' | 'schedule',
      startTime: exec.createdAt.toISOString(),
      endTime: exec.updatedAt?.toISOString(),
      duration: exec.duration || undefined,
      error: exec.error || undefined,
      data: exec.data as any,
      result: exec.result as any,
      nodeExecutions: exec.nodeExecutions as any,
    }));

    return {
      success: true,
      executions: mappedExecutions,
      total,
    };
  } catch (error) {
    console.error('Error listing executions:', error);
    return {
      success: false,
      error: 'Erro ao listar execuções',
    };
  }
}

/**
 * Buscar execução específica por ID
 * Acesso direto ao Prisma (sem HTTP overhead)
 */
export async function getExecution(id: string) {
  try {
    if (!id) {
      return { success: false, error: 'ID da execução é obrigatório' };
    }

    const execution = await prisma.flow_executions.findUnique({
      where: { id },
    });

    if (!execution) {
      return { success: false, error: 'Execução não encontrada' };
    }

    // Mapear para o tipo Execution
    const mappedExecution: Execution = {
      id: execution.id,
      status: execution.status as 'running' | 'success' | 'error' | 'stopped',
      triggerType: execution.triggerType as 'webhook' | 'manual' | 'schedule',
      startTime: execution.createdAt.toISOString(),
      endTime: execution.updatedAt?.toISOString(),
      duration: execution.duration || undefined,
      error: execution.error || undefined,
      data: execution.data as any,
      result: execution.result as any,
      nodeExecutions: execution.nodeExecutions as any,
    };

    return { success: true, execution: mappedExecution };
  } catch (error) {
    console.error('Error getting execution:', error);
    return { success: false, error: 'Erro ao buscar execução' };
  }
}

/**
 * Parar execução em andamento
 * Acesso direto ao Prisma e fila (sem HTTP overhead)
 */
export async function stopExecution(id: string) {
  try {
    if (!id) {
      return { success: false, error: 'ID da execução é obrigatório' };
    }

    // Verificar se a execução existe
    const execution = await prisma.flow_executions.findUnique({
      where: { id },
    });

    if (!execution) {
      return { success: false, error: 'Execução não encontrada' };
    }

    if (execution.status !== 'running') {
      return {
        success: false,
        error: 'Apenas execuções em andamento podem ser paradas',
      };
    }

    // Atualizar status da execução
    // Nota: O worker deve verificar o status antes de continuar processando
    const updatedExecution = await prisma.flow_executions.update({
      where: { id },
      data: {
        status: 'stopped',
        error: 'Execução parada manualmente',
        updatedAt: new Date(),
      },
    });

    // Mapear para o tipo Execution
    const mappedExecution: Execution = {
      id: updatedExecution.id,
      status: updatedExecution.status as
        | 'running'
        | 'success'
        | 'error'
        | 'stopped',
      triggerType: updatedExecution.triggerType as
        | 'webhook'
        | 'manual'
        | 'schedule',
      startTime: updatedExecution.createdAt.toISOString(),
      endTime: updatedExecution.updatedAt?.toISOString(),
      duration: updatedExecution.duration || undefined,
      error: updatedExecution.error || undefined,
      data: updatedExecution.data as any,
      result: updatedExecution.result as any,
      nodeExecutions: updatedExecution.nodeExecutions as any,
    };

    return { success: true, execution: mappedExecution };
  } catch (error) {
    console.error('Error stopping execution:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao parar execução',
    };
  }
}
