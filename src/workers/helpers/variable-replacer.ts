// Função para substituir variáveis no texto
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function replaceVariables(text: string, context: any): any {
  if (!text) return text;

  // Se não for string, retornar como está
  if (typeof text !== 'string') return text;

  console.log('🔹 [VARIABLE-REPLACER] Input:', text.substring(0, 200));

  // Verificar se o texto é APENAS uma variável (sem texto ao redor)
  const isSingleVariable = /^\{\{[^}]+\}\}$/.test(text.trim());

  // Encontrar todas as variáveis no formato {{path}}
  // IMPORTANTE: Substituir variáveis SEM aspas usando JSON.stringify para manter tipos
  const replaced = text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    try {
      // Remover espaços e dividir o path
      const cleanPath = path.trim();
      const parts = cleanPath.split('.');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = context;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          // Tentar acessar como índice numérico primeiro (para arrays)
          const numericIndex = parseInt(part, 10);
          if (
            !isNaN(numericIndex) &&
            Array.isArray(value) &&
            numericIndex >= 0 &&
            numericIndex < value.length
          ) {
            value = value[numericIndex];
          } else if (part in value) {
            value = value[part];
          } else {
            // Path não existe - marcar como não resolvido
            return '__UNRESOLVED__' + match;
          }
        } else {
          // Path não existe - marcar como não resolvido
          return '__UNRESOLVED__' + match;
        }
      }

      // Tratar null e undefined
      if (value === null) {
        return 'NULL'; // NULL SQL
      }
      if (value === undefined) {
        return '__UNRESOLVED__' + match;
      }

      // Converter para string preservando tipos
      // - Strings: retornar direto (SEM aspas extras) - cada contexto adiciona aspas se necessário
      // - Numbers/Booleans: converter para string
      // - Arrays/Objects: usar JSON.stringify
      if (typeof value === 'string') {
        return value; // Não adicionar aspas extras!
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }

      // Para arrays e objects, usar JSON.stringify
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    } catch {
      return '__UNRESOLVED__' + match;
    }
  });

  // Se era uma variável única e não foi resolvida, retornar undefined
  if (isSingleVariable && replaced.includes('__UNRESOLVED__')) {
    console.log(
      '🔹 [VARIABLE-REPLACER] Variable not resolved, returning undefined',
    );
    return undefined;
  }

  // Remover marcadores __UNRESOLVED__ e manter a variável original
  const finalResult = replaced.replace(/__UNRESOLVED__/g, '');

  console.log(
    '🔹 [VARIABLE-REPLACER] After replace:',
    typeof finalResult === 'string'
      ? finalResult.substring(0, 200)
      : finalResult,
  );

  return finalResult;
}
