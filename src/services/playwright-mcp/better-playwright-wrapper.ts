/**
 * Wrapper para carregar better-playwright apenas em runtime
 * Isso evita que o Next.js tente fazer bundle durante análise estática
 *
 * IMPORTANTE: Este arquivo não deve importar playwright diretamente
 */

import type {
  PlaywrightMcpTaskInput,
  PlaywrightMcpTaskResult,
  PlaywrightMcpStep,
} from './better-playwright.service';

// Re-exportar tipos para uso externo
export type {
  PlaywrightMcpStep,
  PlaywrightMcpTaskInput,
  PlaywrightMcpTaskResult,
};

/**
 * Carrega e executa o serviço better-playwright
 *
 * Automaticamente usa Pool + Queue + Timeout para execuções em produção
 * Usa execução direta (sem fila) para debug visual (headless=false)
 */
export async function runBetterPlaywrightMcpTaskWrapper(
  input: PlaywrightMcpTaskInput,
): Promise<PlaywrightMcpTaskResult> {
  // Usar import dinâmico para evitar análise estática do Next.js
  const serviceModule = await import('./index');

  // Se headless=false (debug visual), usar execução direta sem fila
  // Isso permite ver o browser em ação sem esperar na fila
  const isHeadless = input.context?.headless !== false;

  if (!isHeadless) {
    // Debug visual: execução direta
    return serviceModule.runPlaywrightTaskDirect(input);
  }

  // Produção: usar pool + queue + timeout (recomendado)
  return serviceModule.runPlaywrightTask(input);
}
