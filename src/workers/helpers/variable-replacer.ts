/**
 * Tipo para methodMatch: [fullMatch, methodName, argsString]
 */
type MethodMatch = [string, string, string];

/**
 * Type guard para verificar se um valor tem uma propriedade específica
 */
function hasProperty(
  value: unknown,
  prop: string,
): value is Record<string, unknown> {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    prop in value
  );
}

/**
 * Type guard para verificar se um valor tem um método específico
 */
function hasMethod(
  value: unknown,
  method: string,
): value is Record<string, (...args: unknown[]) => unknown> {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    method in value &&
    typeof (value as Record<string, unknown>)[method] === 'function'
  );
}

/**
 * Avalia uma expressão JavaScript de forma segura (estilo n8n)
 * Suporta encadeamento de métodos como .replace("0", "1").toUpperCase()
 */
function evaluateJavaScriptExpression(
  baseValue: unknown,
  expression: string,
): unknown {
  try {
    // Remover espaços extras
    let trimmedExpr = expression.trim();

    // Se não começa com ponto, não é uma expressão válida
    if (!trimmedExpr.startsWith('.')) {
      return baseValue;
    }

    let currentValue = baseValue;

    // Processar encadeamento de métodos/propriedades
    // Exemplo: .replace("0", "1").toUpperCase().length
    while (trimmedExpr.startsWith('.')) {
      // Remover o ponto inicial
      trimmedExpr = trimmedExpr.substring(1).trim();

      // Detectar se é uma chamada de método (ex: replace("0", "1")) ou propriedade (ex: length)
      // Precisa capturar parênteses balanceados para argumentos complexos
      const methodNameMatch = trimmedExpr.match(/^(\w+)\s*\(/);
      let methodMatch: MethodMatch | null = null;

      if (methodNameMatch) {
        const methodName = methodNameMatch[1];
        const matchStart = methodNameMatch.index || 0;
        const matchLength = methodNameMatch[0].length;
        const startPos = matchStart + matchLength - 1; // Índice do '(' no trimmedExpr

        // Encontrar o parêntese de fechamento balanceado
        let depth = 0;
        let endPos = trimmedExpr.length;

        for (let i = startPos; i < trimmedExpr.length; i++) {
          if (trimmedExpr[i] === '(') depth++;
          if (trimmedExpr[i] === ')') {
            depth--;
            if (depth === 0) {
              endPos = i + 1;
              break;
            }
          }
        }

        if (depth === 0 && endPos <= trimmedExpr.length) {
          const fullMatch = trimmedExpr.substring(0, endPos);
          const argsString = trimmedExpr.substring(startPos + 1, endPos - 1);
          methodMatch = [fullMatch, methodName, argsString];
        }
      }

      const propertyMatch = trimmedExpr.match(/^(\w+)(\.|$)/);

      if (methodMatch) {
        // Chamada de método
        const methodName = methodMatch[1];
        const argsString = methodMatch[2];

        // Verificar se o método existe e é seguro
        const safeMethods = new Set([
          'replace',
          'toUpperCase',
          'toLowerCase',
          'trim',
          'substring',
          'substr',
          'slice',
          'split',
          'join',
          'concat',
          'indexOf',
          'lastIndexOf',
          'includes',
          'startsWith',
          'endsWith',
          'repeat',
          'padStart',
          'padEnd',
          'toFixed',
          'toString',
          'parseInt',
          'parseFloat',
          'map',
          'filter',
          'find',
          'some',
          'every',
          'reduce',
        ]);

        if (!safeMethods.has(methodName)) {
          throw new Error(
            `Método "${methodName}" não é permitido por segurança`,
          );
        }

        // Parsear argumentos de forma segura
        const args: unknown[] = [];
        if (argsString.trim()) {
          const parsedArgs = parseMethodArguments(argsString);
          args.push(...parsedArgs);
        }

        // Verificar se o método existe no valor atual
        if (currentValue === null || currentValue === undefined) {
          return currentValue;
        }

        // Converter para o tipo apropriado se necessário
        let targetValue = currentValue;
        if (methodName === 'parseInt' || methodName === 'parseFloat') {
          targetValue = String(currentValue);
        }

        // Chamar o método
        if (hasMethod(targetValue, methodName)) {
          const method = targetValue[methodName];
          currentValue = method(...args);
        } else if (methodName === 'parseInt') {
          const radix = typeof args[0] === 'number' ? args[0] : 10;
          currentValue = parseInt(String(currentValue), radix);
        } else if (methodName === 'parseFloat') {
          currentValue = parseFloat(String(currentValue));
        } else {
          throw new Error(`Método "${methodName}" não está disponível`);
        }

        // Remover a parte processada da expressão
        trimmedExpr = trimmedExpr.substring(methodMatch[0].length).trim();
      } else if (propertyMatch) {
        // Propriedade (ex: .length)
        const propertyName = propertyMatch[1];

        if (currentValue === null || currentValue === undefined) {
          return currentValue;
        }

        if (hasProperty(currentValue, propertyName)) {
          currentValue = currentValue[propertyName];
        } else {
          throw new Error(`Propriedade "${propertyName}" não está disponível`);
        }

        // Remover a parte processada da expressão
        trimmedExpr = trimmedExpr.substring(propertyMatch[0].length).trim();
      } else {
        // Não conseguiu fazer match - parar
        break;
      }
    }

    return currentValue;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `❌ Erro ao avaliar expressão JavaScript "${expression}":`,
      errorMessage,
    );
    return baseValue;
  }
}

/**
 * Parseia argumentos de uma chamada de método de forma segura
 */
function parseMethodArguments(argsString: string): unknown[] {
  const args: unknown[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (inString && char === stringChar && argsString[i - 1] !== '\\') {
      inString = false;
      stringChar = '';
      current += char;
      continue;
    }

    if (!inString) {
      if (char === '(' || char === '[' || char === '{') {
        depth++;
        current += char;
        continue;
      }

      if (char === ')' || char === ']' || char === '}') {
        depth--;
        current += char;
        continue;
      }

      if (char === ',' && depth === 0) {
        // Novo argumento
        const trimmed = current.trim();
        if (trimmed) {
          args.push(parseArgumentValue(trimmed));
        }
        current = '';
        continue;
      }
    }

    current += char;
  }

  // Último argumento
  const trimmed = current.trim();
  if (trimmed) {
    args.push(parseArgumentValue(trimmed));
  }

  return args;
}

/**
 * Converte uma string de argumento em valor JavaScript
 */
function parseArgumentValue(arg: string): unknown {
  const trimmed = arg.trim();

  // String (com ou sem aspas)
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\(.)/g, '$1');
  }

  // Número
  if (/^-?\d+\.?\d*$/.test(trimmed)) {
    return trimmed.includes('.') ? parseFloat(trimmed) : parseInt(trimmed, 10);
  }

  // Boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;

  // Array ou objeto JSON
  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  // Variável do contexto (ex: $nodes.x)
  // Por enquanto, retornar como string - será resolvido depois se necessário
  return trimmed;
}

// Função para substituir variáveis no texto
export function replaceVariables(
  text: string,
  context: Record<string, unknown>,
): unknown {
  if (!text) return text;

  // Se não for string, retornar como está
  if (typeof text !== 'string') return text;

  // Encontrar todas as variáveis no formato {{path}} ou {{path.expression()}}
  // IMPORTANTE: Substituir variáveis SEM aspas usando JSON.stringify para manter tipos
  let hasUnresolved = false;

  const replaced = text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    try {
      // Remover espaços
      const cleanPath = path.trim();

      // Detectar se há uma expressão JavaScript após o path da variável
      // Exemplo: $nodes.x.output.loopItem.replace("0", "1")
      // No n8n, qualquer coisa após o path da variável é tratado como JS
      // Dividir entre o path da variável e a expressão JS
      let variablePath = cleanPath;
      let jsExpression = '';

      // No n8n, a lógica é simples: se encontrar um ponto seguido de uma palavra
      // que não faz parte do caminho da variável conhecido, é expressão JS
      // Vamos tentar resolver o path completo primeiro, e se falhar,
      // tentamos dividir no último ponto antes de um método JS conhecido

      // Padrão para detectar início de expressão JS: .method( ou .property
      // Procurar por padrões que indicam expressões JS (métodos ou propriedades)
      const jsPattern =
        /\.(replace|toUpperCase|toLowerCase|trim|substring|substr|slice|split|join|concat|indexOf|lastIndexOf|includes|startsWith|endsWith|repeat|padStart|padEnd|toFixed|toString|parseInt|parseFloat|map|filter|find|some|every|reduce|length)\s*\(?/i;

      let bestSplitPos = -1;

      // Tentar encontrar onde começa a expressão JS procurando métodos/propriedades conhecidos
      for (let i = 0; i < cleanPath.length; i++) {
        const remaining = cleanPath.substring(i);
        const match = remaining.match(jsPattern);

        if (match && match.index === 0) {
          // Encontrou um método JS neste ponto
          // Verificar se o que vem antes é um path válido tentando resolvê-lo
          const candidatePath = cleanPath.substring(0, i);
          const candidateExpr = cleanPath.substring(i);

          // Tentar resolver o path candidato
          let testValue: unknown = context;
          const testParts = candidatePath.split('.');
          let pathValid = true;

          for (const part of testParts) {
            const isObjectOrArray =
              testValue !== null &&
              testValue !== undefined &&
              (typeof testValue === 'object' || Array.isArray(testValue));

            if (isObjectOrArray) {
              const numericIndex = parseInt(part, 10);
              if (!isNaN(numericIndex) && Array.isArray(testValue)) {
                // Para arrays, índices negativos ou fora dos limites são inválidos
                if (numericIndex >= 0 && numericIndex < testValue.length) {
                  testValue = testValue[numericIndex];
                } else {
                  pathValid = false;
                  break;
                }
              } else if (
                !Array.isArray(testValue) &&
                hasProperty(testValue, part)
              ) {
                testValue = testValue[part];
              } else {
                pathValid = false;
                break;
              }
            } else {
              pathValid = false;
              break;
            }
          }

          if (pathValid && testValue !== undefined && testValue !== null) {
            bestSplitPos = i;
            variablePath = candidatePath;
            jsExpression = candidateExpr;
            break; // Usar a primeira ocorrência válida
          }
        }
      }

      // Se não encontrou divisão válida, tentar resolver o path completo
      // Se alguma parte do path não existir, retornar undefined
      if (bestSplitPos === -1) {
        // Tentar resolver o path completo diretamente
        // Se não conseguir, retornar undefined
        variablePath = cleanPath;
        jsExpression = '';
      }

      // Resolver o path da variável base
      const parts = variablePath.split('.');

      let value: unknown = context;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // Verificar se value é um objeto válido (não null, não string, não number, etc)
        // null é typeof 'object' mas não é um objeto válido para acessar propriedades
        const isObjectOrArray =
          value !== null &&
          value !== undefined &&
          (typeof value === 'object' || Array.isArray(value));

        if (!isObjectOrArray) {
          // Path não existe (value é null, undefined, string, number, etc e não pode ter propriedades)
          hasUnresolved = true;
          return '__UNRESOLVED__';
        }

        // Tentar acessar como índice numérico primeiro (para arrays)
        const numericIndex = parseInt(part, 10);
        if (!isNaN(numericIndex) && Array.isArray(value)) {
          // Para arrays, índices negativos ou fora dos limites retornam undefined
          if (numericIndex >= 0 && numericIndex < value.length) {
            value = value[numericIndex];
            // Verificar se o valor obtido é undefined
            if (value === undefined) {
              hasUnresolved = true;
              return '__UNRESOLVED__';
            }
          } else {
            // Índice fora dos limites ou negativo - não resolvido
            hasUnresolved = true;
            return '__UNRESOLVED__';
          }
        } else if (Array.isArray(value)) {
          // Array mas não é índice numérico válido
          hasUnresolved = true;
          return '__UNRESOLVED__';
        } else {
          // É um objeto - verificar se a propriedade existe
          const valueObj = value as Record<string, unknown>;

          // Usar 'in' operator para verificar se a propriedade existe
          // Isso funciona mesmo se o valor da propriedade for undefined
          if (!(part in valueObj)) {
            // Propriedade não existe no objeto
            hasUnresolved = true;
            return '__UNRESOLVED__';
          }

          // Propriedade existe - acessar o valor
          value = valueObj[part];

          // Se o valor é undefined, ainda consideramos não resolvido
          if (value === undefined) {
            hasUnresolved = true;
            return '__UNRESOLVED__';
          }
        }
      }

      // Tratar null após resolver o path completo
      // Se chegamos aqui, o path foi completamente resolvido
      if (value === null) {
        // null é tratado como não resolvido (retornar undefined)
        hasUnresolved = true;
        return '__UNRESOLVED__';
      }
      // Se value é undefined, já foi tratado no loop acima
      // Se chegamos aqui, value tem um valor válido

      // Se há expressão JavaScript, avaliá-la
      if (jsExpression) {
        value = evaluateJavaScriptExpression(value, jsExpression);
        // Se a expressão JS retornou undefined, tratar como não resolvido
        if (value === undefined) {
          hasUnresolved = true;
          return '__UNRESOLVED__';
        }
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
      // Qualquer erro significa que a variável não foi resolvida
      hasUnresolved = true;
      return '__UNRESOLVED__';
    }
  });

  // Se QUALQUER variável não foi resolvida, retornar undefined
  if (
    hasUnresolved ||
    (typeof replaced === 'string' && replaced.includes('__UNRESOLVED__'))
  ) {
    return undefined;
  }

  return replaced;
}
