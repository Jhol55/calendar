// Função para substituir variáveis no texto
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function replaceVariables(text: string, context: any): any {
  if (!text) return text;

  // Se não for string, retornar como está
  if (typeof text !== 'string') return text;

  console.log('🔹 [VARIABLE-REPLACER] Input:', text.substring(0, 200));

  // Tentar parsear como JSON primeiro (para arrays e objetos literais SEM variáveis)
  if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
    // Se NÃO contém variáveis dinâmicas, tentar parsear direto
    if (!/\{\{[^}]+\}\}/.test(text)) {
      try {
        const parsed = JSON.parse(text);
        console.log(
          '🔹 [VARIABLE-REPLACER] Parsed as pure JSON:',
          typeof parsed,
        );
        return parsed;
      } catch {
        // Se falhar, continuar com substituição de variáveis
      }
    }
  }

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

      // SEMPRE usar JSON.stringify para preservar tipos corretamente
      // Isso permite que:
      // - Strings virem "string" (com aspas)
      // - Numbers virem 123 (sem aspas)
      // - Arrays virem [1,2,3] (sem aspas)
      // - Objects virem {"key": "value"} (sem aspas)
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

  // Se a string toda foi uma variável e resultou em JSON, tentar parsear
  if (
    replaced !== text &&
    (replaced.startsWith('[') || replaced.startsWith('{'))
  ) {
    try {
      const parsed = JSON.parse(replaced);
      console.log(
        '🔹 [VARIABLE-REPLACER] Parsed after replace:',
        typeof parsed,
      );
      return parsed;
    } catch (e) {
      console.log('🔹 [VARIABLE-REPLACER] Failed to parse after replace:', e);
      return replaced;
    }
  }

  console.log('🔹 [VARIABLE-REPLACER] Returning as string');
  return replaced;
}
