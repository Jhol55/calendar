/**
 * Avalia uma expressão JavaScript de forma segura (estilo n8n)
 * Suporta encadeamento de métodos como .replace("0", "1").toUpperCase()
 */
function evaluateJavaScriptExpression(baseValue: any, expression: string): any {
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
      let methodMatch: RegExpMatchArray | null = null;

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
          methodMatch = [fullMatch, methodName, argsString] as any;
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
        const args: any[] = [];
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
        if (typeof (targetValue as any)[methodName] === 'function') {
          currentValue = (targetValue as any)[methodName](...args);
        } else if (methodName === 'parseInt') {
          currentValue = parseInt(String(currentValue), args[0] || 10);
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

        currentValue = (currentValue as any)[propertyName];

        // Remover a parte processada da expressão
        trimmedExpr = trimmedExpr.substring(propertyMatch[0].length).trim();
      } else {
        // Não conseguiu fazer match - parar
        break;
      }
    }

    return currentValue;
  } catch (error: any) {
    console.error(
      `❌ Erro ao avaliar expressão JavaScript "${expression}":`,
      error.message,
    );
    return baseValue;
  }
}

/**
 * Parseia argumentos de uma chamada de método de forma segura
 */
function parseMethodArguments(argsString: string): any[] {
  const args: any[] = [];
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
function parseArgumentValue(arg: string): any {
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function replaceVariables(text: string, context: any): any {
  if (!text) return text;

  // Se não for string, retornar como está
  if (typeof text !== 'string') return text;

  console.log('🔹 [VARIABLE-REPLACER] Input:', text.substring(0, 200));

  // Verificar se o texto é APENAS uma variável (sem texto ao redor)
  const isSingleVariable = /^\{\{[^}]+}\}$/.test(text.trim());

  // Encontrar todas as variáveis no formato {{path}} ou {{path.expression()}}
  // IMPORTANTE: Substituir variáveis SEM aspas usando JSON.stringify para manter tipos
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

      let matchPos = -1;
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
          let testValue: any = context;
          const testParts = candidatePath.split('.');
          let pathValid = true;

          for (const part of testParts) {
            if (testValue && typeof testValue === 'object') {
              const numericIndex = parseInt(part, 10);
              if (
                !isNaN(numericIndex) &&
                Array.isArray(testValue) &&
                numericIndex >= 0 &&
                numericIndex < testValue.length
              ) {
                testValue = testValue[numericIndex];
              } else if (part in testValue) {
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

      // Se não encontrou divisão válida, verificar se o path completo é válido
      // Se não for, pode ser que parte dele seja expressão JS
      if (bestSplitPos === -1) {
        // Tentar resolver o path completo
        const testParts = cleanPath.split('.');
        let testValue: any = context;
        let validUntil = -1;

        for (let i = 0; i < testParts.length; i++) {
          const part = testParts[i];
          if (testValue && typeof testValue === 'object') {
            const numericIndex = parseInt(part, 10);
            if (
              !isNaN(numericIndex) &&
              Array.isArray(testValue) &&
              numericIndex >= 0 &&
              numericIndex < testValue.length
            ) {
              testValue = testValue[numericIndex];
              validUntil = i;
            } else if (part in testValue) {
              testValue = testValue[part];
              validUntil = i;
            } else {
              // Não encontrou esta parte - a partir daqui pode ser JS
              if (validUntil >= 0) {
                variablePath = testParts.slice(0, validUntil + 1).join('.');
                jsExpression = '.' + testParts.slice(validUntil + 1).join('.');
              }
              break;
            }
          } else {
            // Valor não é objeto - não pode continuar
            if (validUntil >= 0) {
              variablePath = testParts.slice(0, validUntil + 1).join('.');
              jsExpression = '.' + testParts.slice(validUntil + 1).join('.');
            }
            break;
          }
        }
      }

      // Resolver o path da variável base
      const parts = variablePath.split('.');

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

      // Se há expressão JavaScript, avaliá-la
      if (jsExpression) {
        value = evaluateJavaScriptExpression(value, jsExpression);
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
