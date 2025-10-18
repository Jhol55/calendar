'use server';

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

// Listar execuções de um fluxo
export async function listExecutions(
  params: ListExecutionsParams,
): Promise<ListExecutionsResponse> {
  try {
    const { flowId, limit = 20, offset = 0 } = params;

    const queryParams = new URLSearchParams();
    queryParams.append('flowId', flowId);
    queryParams.append('limit', limit.toString());
    queryParams.append('offset', offset.toString());

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/executions?${queryParams}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      executions: data.executions || [],
      total: data.total,
    };
  } catch (error) {
    console.error('Error listing executions:', error);
    return {
      success: false,
      error: 'Erro ao listar execuções',
    };
  }
}

// Buscar execução específica
export async function getExecution(id: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/executions/${id}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, execution: data };
  } catch (error) {
    console.error('Error getting execution:', error);
    return { success: false, error: 'Erro ao buscar execução' };
  }
}
