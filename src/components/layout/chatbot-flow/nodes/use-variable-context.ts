import { useMemo, useSyncExternalStore } from 'react';
import { replaceVariables } from '@/workers/helpers/variable-replacer';

export type VariableContext = Record<string, unknown>;

// Chave para evento de atualização
const EXECUTION_CHANGE_EVENT = 'executionContextChanged';

// Store para sincronizar com sessionStorage
let currentSnapshot = '';

function subscribe(callback: () => void) {
  // Escutar evento customizado
  window.addEventListener(EXECUTION_CHANGE_EVENT, callback);

  // Escutar mudanças no storage (de outras abas)
  window.addEventListener('storage', callback);

  // Polling como fallback para mudanças locais
  const interval = setInterval(() => {
    const newSnapshot = sessionStorage.getItem('selectedExecution') || '';
    if (newSnapshot !== currentSnapshot) {
      currentSnapshot = newSnapshot;
      callback();
    }
  }, 500);

  return () => {
    window.removeEventListener(EXECUTION_CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
    clearInterval(interval);
  };
}

function getSnapshot() {
  if (typeof window === 'undefined') return '';
  const value = sessionStorage.getItem('selectedExecution') || '';
  currentSnapshot = value;
  return value;
}

function getServerSnapshot() {
  return '';
}

/**
 * Hook para obter contexto de variáveis do sessionStorage
 * Atualiza automaticamente quando a execução selecionada muda
 */
export function useVariableContext(): VariableContext {
  // Usar useSyncExternalStore para reagir a mudanças no sessionStorage
  const executionStr = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return useMemo(() => {
    const baseContext: VariableContext = {};

    if (!executionStr) return baseContext;

    try {
      const selectedExecution = JSON.parse(executionStr);
      const nodeExecutions = selectedExecution.nodeExecutions;

      if (nodeExecutions) {
        const $nodes: Record<string, { output: unknown }> = {};
        Object.keys(nodeExecutions).forEach((nodeId) => {
          const nodeExec = nodeExecutions[nodeId];
          if (nodeExec?.result) {
            $nodes[nodeId] = { output: nodeExec.result };
          } else if (nodeExec?.data) {
            $nodes[nodeId] = { output: nodeExec.data };
          }
        });

        const webhookData =
          selectedExecution.data || selectedExecution.triggerData;

        return {
          ...baseContext,
          $nodes,
          $node: { input: webhookData },
          ...(webhookData && typeof webhookData === 'object'
            ? webhookData
            : {}),
        };
      }
    } catch (error) {
      console.error('Erro ao buscar execução do sessionStorage:', error);
    }

    return baseContext;
  }, [executionStr]);
}

/**
 * Resolve variáveis dinâmicas em um texto usando o contexto fornecido
 * Retorna:
 * - O valor resolvido se conseguir resolver
 * - String vazia se o valor resolvido for string vazia
 * - "undefined" se não conseguir resolver a variável
 */
export function resolveVariable(
  text: string | undefined | null,
  context: VariableContext,
): string | undefined {
  // Se não tem texto, retorna undefined
  if (text === null || text === undefined) return undefined;
  if (typeof text !== 'string') return undefined;

  // Se é string vazia, retorna string vazia
  if (text === '') return '';

  // Se não contém variáveis, retorna o texto original
  if (!text.includes('{{')) return text;

  try {
    const resolved = replaceVariables(text, context);

    // Se retornou undefined, a variável não foi resolvida
    if (resolved === undefined) return 'undefined';

    // Converter para string
    const resolvedStr =
      typeof resolved === 'object'
        ? JSON.stringify(resolved)
        : String(resolved);

    // Se ainda contém {{, não foi totalmente resolvida
    if (resolvedStr.includes('{{')) return 'undefined';

    return resolvedStr;
  } catch (error) {
    console.error('Erro ao resolver variável:', error);
    return 'undefined';
  }
}

/**
 * Hook que combina useVariableContext com resolveVariable
 * Retorna uma função para resolver variáveis com o contexto atual
 */
export function useResolveVariable() {
  const context = useVariableContext();

  return useMemo(
    () => (text: string | undefined | null) => resolveVariable(text, context),
    [context],
  );
}

/**
 * Dispara evento para notificar que o contexto de execução mudou
 * Chamar isso quando a execução selecionada mudar
 */
export function notifyExecutionContextChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EXECUTION_CHANGE_EVENT));
  }
}
