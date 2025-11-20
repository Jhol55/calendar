/**
 * Playwright MCP Service - Exportações principais
 *
 * Fornece diferentes formas de executar tarefas Playwright:
 * 1. Direto: sem pool, sem fila, sem timeout automático
 * 2. Com Pool: reutiliza browsers do pool
 * 3. Com Queue: limita concorrência e enfileira requisições
 * 4. Com Timeout: adiciona timeout automático
 */

// Exportar tipos
export type {
  PlaywrightMcpStepAction,
  PlaywrightMcpStep,
  PlaywrightMcpTaskInput,
  PlaywrightMcpTaskResult,
} from '@/types/playwright-mcp.types';

// Exportar função básica (sem pool, sem queue)
export {
  runBetterPlaywrightMcpTask,
  runWithTimeout,
  runWithBrowserPool,
} from './better-playwright.service';

// Exportar classes de gerenciamento
export { BrowserPoolManager, getBrowserPool } from './browser-pool.service';
export {
  ExecutionQueueManager,
  getExecutionQueue,
} from './execution-queue.service';

// Re-exportar para compatibilidade com wrapper antigo
import {
  runBetterPlaywrightMcpTask,
  runWithBrowserPool,
} from './better-playwright.service';
import { getExecutionQueue } from './execution-queue.service';
import type {
  PlaywrightMcpTaskInput,
  PlaywrightMcpTaskResult,
} from '@/types/playwright-mcp.types';

/**
 * Executa tarefa com fila + pool + timeout (RECOMENDADO para produção)
 *
 * Benefícios:
 * - Limite de concorrência (evita sobrecarga)
 * - Reuso de browsers (menor latência)
 * - Timeout automático (previne travamentos)
 * - Fila automática quando limite atingido
 *
 * @param input - Configuração da tarefa
 * @returns Resultado da execução
 */
export async function runPlaywrightTask(
  input: PlaywrightMcpTaskInput,
): Promise<PlaywrightMcpTaskResult> {
  try {
    // Obter fila (inicializa se necessário)
    const queue = getExecutionQueue(runWithBrowserPool);

    // Enfileirar execução (processa imediatamente se houver capacidade)
    return await queue.enqueue(input);
  } catch (error) {
    // Se houver erro na fila, executar diretamente como fallback
    console.error(
      '[PlaywrightMCP] Erro na fila, executando diretamente:',
      error,
    );
    return await runBetterPlaywrightMcpTask(input);
  }
}

/**
 * Executa tarefa diretamente SEM fila (para casos especiais)
 *
 * Use quando:
 * - Modo headless=false (debug visual)
 * - Testes/desenvolvimento
 * - Casos que não podem esperar na fila
 *
 * @param input - Configuração da tarefa
 * @returns Resultado da execução
 */
export async function runPlaywrightTaskDirect(
  input: PlaywrightMcpTaskInput,
): Promise<PlaywrightMcpTaskResult> {
  return await runBetterPlaywrightMcpTask(input);
}

/**
 * Retorna estatísticas do sistema (pool + fila)
 */
export function getPlaywrightStats(): {
  pool?: {
    total: number;
    inUse: number;
    available: number;
    maxSize: number;
  };
  queue?: {
    queueSize: number;
    running: number;
    maxConcurrent: number;
    queueMaxSize: number;
  };
} {
  try {
    const { getBrowserPool } = require('./browser-pool.service');
    const { getExecutionQueue } = require('./execution-queue.service');

    const pool = getBrowserPool();
    const queue = getExecutionQueue();

    return {
      pool: pool.getStats(),
      queue: queue.getStats(),
    };
  } catch {
    // Pool/Queue não inicializados ainda
    return {};
  }
}

// Exportação padrão: função recomendada para produção
export default runPlaywrightTask;
