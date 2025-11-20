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
 * Usa import dinâmico com caminho absoluto para evitar análise estática
 */
export async function runBetterPlaywrightMcpTaskWrapper(
  input: PlaywrightMcpTaskInput,
): Promise<PlaywrightMcpTaskResult> {
  // Usar import dinâmico com caminho relativo
  // O webpackIgnore deve evitar que o webpack tente fazer bundle
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const serviceModule = await import('./better-playwright.service');
  return serviceModule.runBetterPlaywrightMcpTask(input);
}
