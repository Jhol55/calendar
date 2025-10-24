// Função para substituir variáveis no texto
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function replaceVariables(text: string, context: any): any {
  if (!text) return text;

  // Se não for string, retornar como está
  if (typeof text !== 'string') return text;

  console.log('🔹 [VARIABLE-REPLACER] Input:', text.substring(0, 200));

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
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          // Se o path não existir, retornar o match original
          return match;
        }
      }

      // Converter para string se necessário
      if (value === null || value === undefined) {
        return match;
      }

      // Converter para string preservando tipos
      // - Strings: retornar direto (SEM aspas extras)
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
      return match;
    }
  });

  console.log(
    '🔹 [VARIABLE-REPLACER] After replace:',
    replaced.substring(0, 200),
  );
  console.log('🔹 [VARIABLE-REPLACER] Returning as string');
  return replaced;
}
