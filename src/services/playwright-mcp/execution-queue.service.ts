/**
 * Execution Queue Manager
 * Gerencia fila de execuções com limite de concorrência
 *
 * Previne sobrecarga do servidor limitando execuções simultâneas
 * e enfileirando requisições excedentes
 */

import type {
  PlaywrightMcpTaskInput,
  PlaywrightMcpTaskResult,
} from '@/types/playwright-mcp.types';

interface QueuedExecution {
  id: string;
  input: PlaywrightMcpTaskInput;
  resolve: (result: PlaywrightMcpTaskResult) => void;
  reject: (error: Error) => void;
  enqueuedAt: Date;
  timeoutId?: NodeJS.Timeout;
}

export class ExecutionQueueManager {
  private queue: QueuedExecution[] = [];
  private running: Map<string, QueuedExecution> = new Map();
  private maxConcurrent: number;
  private queueMaxSize: number;
  private executionTimeoutMs: number;

  // Callback para executar a tarefa (será definido externamente)
  private executeTask: (
    input: PlaywrightMcpTaskInput,
  ) => Promise<PlaywrightMcpTaskResult>;

  constructor(
    executeTask: (
      input: PlaywrightMcpTaskInput,
    ) => Promise<PlaywrightMcpTaskResult>,
    maxConcurrent = 10,
    queueMaxSize = 50,
    executionTimeoutMs = 5 * 60 * 1000,
  ) {
    this.executeTask = executeTask;
    this.maxConcurrent = maxConcurrent;
    this.queueMaxSize = queueMaxSize;
    this.executionTimeoutMs = executionTimeoutMs;
  }

  /**
   * Enfileira uma execução
   */
  async enqueue(
    input: PlaywrightMcpTaskInput,
  ): Promise<PlaywrightMcpTaskResult> {
    // Verificar se a fila está cheia
    if (this.queue.length >= this.queueMaxSize) {
      throw new Error(
        `Fila de execuções cheia (${this.queueMaxSize}). Tente novamente mais tarde.`,
      );
    }

    return new Promise<PlaywrightMcpTaskResult>((resolve, reject) => {
      const executionId = this.generateExecutionId();

      const queuedExecution: QueuedExecution = {
        id: executionId,
        input,
        resolve,
        reject,
        enqueuedAt: new Date(),
      };

      this.queue.push(queuedExecution);

      // Tentar processar imediatamente se houver capacidade
      this.processNext();
    });
  }

  /**
   * Processa próxima execução da fila
   */
  private async processNext(): Promise<void> {
    // Verificar se há capacidade para executar
    if (this.running.size >= this.maxConcurrent) {
      return; // Aguardar liberação
    }

    // Pegar próxima execução da fila
    const execution = this.queue.shift();
    if (!execution) {
      return; // Fila vazia
    }

    // Mover para execuções em andamento
    this.running.set(execution.id, execution);

    // Configurar timeout
    const timeoutId = setTimeout(() => {
      this.handleTimeout(execution.id);
    }, this.executionTimeoutMs);

    execution.timeoutId = timeoutId;

    try {
      // Executar tarefa
      const result = await this.executeTask(execution.input);

      // Limpar timeout
      clearTimeout(timeoutId);

      // Resolver promise
      execution.resolve(result);
    } catch (error) {
      // Limpar timeout
      clearTimeout(timeoutId);

      // Rejeitar promise
      execution.reject(
        error instanceof Error ? error : new Error('Erro desconhecido'),
      );
    } finally {
      // Remover de execuções em andamento
      this.running.delete(execution.id);

      // Processar próxima da fila
      this.processNext();
    }
  }

  /**
   * Trata timeout de execução
   */
  private handleTimeout(executionId: string): void {
    const execution = this.running.get(executionId);
    if (!execution) return;

    // Remover de execuções em andamento
    this.running.delete(executionId);

    // Rejeitar com erro de timeout
    execution.reject(
      new Error(
        `Execução excedeu o tempo limite de ${this.executionTimeoutMs / 1000}s`,
      ),
    );

    // Processar próxima da fila
    this.processNext();
  }

  /**
   * Cancela uma execução (se ainda na fila)
   */
  cancel(executionId: string): boolean {
    const index = this.queue.findIndex((e) => e.id === executionId);

    if (index === -1) {
      return false; // Não está na fila (já executando ou concluída)
    }

    const execution = this.queue[index];
    this.queue.splice(index, 1);

    execution.reject(new Error('Execução cancelada'));
    return true;
  }

  /**
   * Gera ID único para execução
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Retorna estatísticas da fila
   */
  getStats(): {
    queueSize: number;
    running: number;
    maxConcurrent: number;
    queueMaxSize: number;
  } {
    return {
      queueSize: this.queue.length,
      running: this.running.size,
      maxConcurrent: this.maxConcurrent,
      queueMaxSize: this.queueMaxSize,
    };
  }

  /**
   * Limpa fila (cancela todas as execuções pendentes)
   */
  clearQueue(): void {
    while (this.queue.length > 0) {
      const execution = this.queue.shift();
      if (execution) {
        execution.reject(new Error('Fila limpa'));
      }
    }
  }

  /**
   * Aguarda todas as execuções em andamento finalizarem
   */
  async waitForCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.running.size === 0 && this.queue.length === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }
}

// Singleton instance
let queueInstance: ExecutionQueueManager | null = null;

/**
 * Retorna instância singleton da fila
 * Nota: executeTask precisa ser definido na primeira chamada
 */
export function getExecutionQueue(
  executeTask?: (
    input: PlaywrightMcpTaskInput,
  ) => Promise<PlaywrightMcpTaskResult>,
): ExecutionQueueManager {
  if (!queueInstance && executeTask) {
    const maxConcurrent = parseInt(
      process.env.MAX_CONCURRENT_EXECUTIONS || '10',
      10,
    );
    const queueMaxSize = parseInt(process.env.QUEUE_MAX_SIZE || '50', 10);
    const executionTimeoutMs = parseInt(
      process.env.EXECUTION_TIMEOUT_MS || String(5 * 60 * 1000),
      10,
    );

    queueInstance = new ExecutionQueueManager(
      executeTask,
      maxConcurrent,
      queueMaxSize,
      executionTimeoutMs,
    );
  }

  if (!queueInstance) {
    throw new Error('ExecutionQueue não inicializado. Forneça executeTask.');
  }

  return queueInstance;
}
