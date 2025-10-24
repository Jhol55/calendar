/**
 * Utilitário para parsing recursivo de strings JSON
 *
 * Converte automaticamente strings que parecem JSON em objetos/arrays reais
 * Útil para processar dados vindos do banco de dados ou APIs externas
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Parseia recursivamente strings JSON em um objeto ou array
 * Converte strings que parecem JSON em objetos/arrays reais
 *
 * @param obj - Objeto, array ou valor a ser processado
 * @param depth - Profundidade atual (proteção contra recursão infinita)
 * @returns O mesmo objeto com strings JSON parseadas recursivamente
 *
 * @example
 * const input = {
 *   nome: "João",
 *   dados: '{"idade": 30, "cidade": "SP"}',
 *   lista: '["item1", "item2"]'
 * };
 *
 * const output = parseJSONRecursively(input);
 * // {
 * //   nome: "João",
 * //   dados: {idade: 30, cidade: "SP"},
 * //   lista: ["item1", "item2"]
 * // }
 */
export function parseJSONRecursively(obj: any, depth: number = 0): any {
  // Proteção contra recursão infinita
  const MAX_DEPTH = 10;
  if (depth > MAX_DEPTH) {
    return obj;
  }

  // Se for null ou undefined, retornar como está
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Se for array, processar cada elemento
  if (Array.isArray(obj)) {
    return obj.map((item) => parseJSONRecursively(item, depth + 1));
  }

  // Se for objeto, processar cada propriedade
  if (typeof obj === 'object') {
    const parsed: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        parsed[key] = parseJSONRecursively(obj[key], depth + 1);
      }
    }
    return parsed;
  }

  // Se for string, tentar parsear como JSON
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    // Verificar se parece JSON (começa com [ ou {)
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        const parsed = JSON.parse(obj);
        // Recursivamente parsear o resultado
        return parseJSONRecursively(parsed, depth + 1);
      } catch {
        // Se falhar o parse, retornar a string original
        return obj;
      }
    }
  }

  // Para outros tipos (number, boolean, etc), retornar como está
  return obj;
}
