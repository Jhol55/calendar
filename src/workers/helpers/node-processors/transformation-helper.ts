/**
 * Helper functions para transformações de dados
 * Funções puras sem side effects
 */

// ==================== STRING OPERATIONS ====================

export function uppercase(input: string): string {
  return String(input).toUpperCase();
}

export function lowercase(input: string): string {
  return String(input).toLowerCase();
}

export function trim(input: string): string {
  return String(input).trim();
}

export function replace(
  input: string,
  searchValue: string,
  replaceValue: string,
): string {
  return String(input).replace(new RegExp(searchValue, 'g'), replaceValue);
}

export function substring(input: string, start: number, end?: number): string {
  return String(input).substring(start, end);
}

export function split(input: string, separator: string): string[] {
  return String(input).split(separator);
}

export function concat(input: string, value: string): string {
  return String(input) + String(value);
}

export function capitalize(input: string): string {
  const str = String(input);
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ==================== NUMBER OPERATIONS ====================

export function add(input: number, value: number): number {
  return Number(input) + Number(value);
}

export function subtract(input: number, value: number): number {
  return Number(input) - Number(value);
}

export function multiply(input: number, value: number): number {
  return Number(input) * Number(value);
}

export function divide(input: number, value: number): number {
  if (Number(value) === 0) {
    throw new Error('Divisão por zero não é permitida');
  }
  return Number(input) / Number(value);
}

export function round(input: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(Number(input) * factor) / factor;
}

export function formatCurrency(input: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(input));
}

export function toPercent(input: number): string {
  return `${(Number(input) * 100).toFixed(2)}%`;
}

// ==================== DATE OPERATIONS ====================

export function formatDate(input: string | Date, format: string): string {
  const date = new Date(input);

  if (isNaN(date.getTime())) {
    throw new Error('Data inválida');
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('DD', day)
    .replace('MM', month)
    .replace('YYYY', String(year))
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

export function addDays(input: string | Date, days: number): string {
  const date = new Date(input);
  date.setDate(date.getDate() + Number(days));
  return date.toISOString();
}

export function subtractDays(input: string | Date, days: number): string {
  const date = new Date(input);
  date.setDate(date.getDate() - Number(days));
  return date.toISOString();
}

export function diffDays(
  input: string | Date,
  compareDate: string | Date,
): number {
  const date1 = new Date(input);
  const date2 = new Date(compareDate);
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function extractPart(
  input: string | Date,
  part: 'day' | 'month' | 'year' | 'hour' | 'minute' | 'second',
): number {
  const date = new Date(input);

  switch (part) {
    case 'day':
      return date.getDate();
    case 'month':
      return date.getMonth() + 1; // JavaScript months are 0-indexed
    case 'year':
      return date.getFullYear();
    case 'hour':
      return date.getHours();
    case 'minute':
      return date.getMinutes();
    case 'second':
      return date.getSeconds();
    default:
      throw new Error(`Parte inválida: ${part}`);
  }
}

export function now(): string {
  return new Date().toISOString();
}

// ==================== ARRAY OPERATIONS ====================

// Função auxiliar para parsear input que pode ser string JSON ou array
function parseArrayInput(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Se não conseguir fazer parse, continuar com erro
    }
  }

  // Se for um objeto, tentar extrair valores ou chaves
  if (typeof input === 'object' && input !== null) {
    // Se tem propriedade 'value' que é array
    if (input.value && Array.isArray(input.value)) {
      return input.value;
    }
    // Se tem propriedade 'output' que é array
    if (input.output && Array.isArray(input.output)) {
      return input.output;
    }
    // Se tem propriedade 'data' que é array
    if (input.data && Array.isArray(input.data)) {
      return input.data;
    }
    // Se tem propriedade 'items' que é array
    if (input.items && Array.isArray(input.items)) {
      return input.items;
    }
    // Se tem propriedade 'results' que é array
    if (input.results && Array.isArray(input.results)) {
      return input.results;
    }
    // Se for um objeto com valores numéricos, converter para array
    const values = Object.values(input);
    if (
      values.length > 0 &&
      values.every((v) => typeof v === 'number' || typeof v === 'string')
    ) {
      return values;
    }
  }

  throw new Error(
    `Input deve ser um array ou string JSON válida. Recebido: ${typeof input} - ${JSON.stringify(input)}`,
  );
}

export function filterArray(input: unknown): unknown[] {
  const array = parseArrayInput(input);
  // Nota: condition seria algo como "value > 10" ou "value === 'ativo'"
  // Aqui simplificamos para demonstração
  // Por enquanto retorna o array original
  // TODO: Implementar parser de condição
  return array;
}

export function mapArray(input: unknown): unknown[] {
  const array = parseArrayInput(input);
  // Por enquanto retorna o array original
  // TODO: Implementar transformação
  return array;
}

export function sortArray(
  input: unknown,
  order: 'asc' | 'desc' = 'asc',
): unknown[] {
  const array = parseArrayInput(input);

  const sorted = [...array].sort((a, b) => {
    if (typeof a === 'string' && typeof b === 'string') {
      return order === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    }
    if (typeof a === 'number' && typeof b === 'number') {
      return order === 'asc' ? a - b : b - a;
    }
    return 0;
  });

  return sorted;
}

export function firstElement(input: unknown): unknown {
  const array = parseArrayInput(input);
  return array[0];
}

export function lastElement(input: unknown): unknown {
  const array = parseArrayInput(input);
  return array[array.length - 1];
}

export function joinArray(input: unknown, separator: string = ','): string {
  const array = parseArrayInput(input);
  return array.join(separator);
}

export function uniqueArray(input: unknown): unknown[] {
  const array = parseArrayInput(input);
  return [...new Set(array)];
}

export function arrayLength(input: unknown): number {
  const array = parseArrayInput(input);
  return array.length;
}

export function sumArray(input: unknown): number {
  const array = parseArrayInput(input);
  console.log(`🔢 sumArray input:`, array);

  const result = array.reduce((sum, val, index) => {
    console.log(`  🔢 Processing item ${index}:`, val, `(type: ${typeof val})`);

    // Se for objeto, tentar extrair valor numérico
    if (typeof val === 'object' && val !== null) {
      // Tentar propriedades comuns que podem conter números
      const numericValue =
        val.value ||
        val.amount ||
        val.price ||
        val.quantity ||
        val.count ||
        val.number;
      console.log(`    🔢 Found numeric value: ${numericValue}`);
      if (numericValue !== undefined) {
        const numVal = Number(numericValue);
        console.log(`    🔢 Adding ${numVal} to sum (was ${sum})`);
        return sum + numVal;
      }
      // Se não encontrar propriedade numérica, tentar somar todos os valores numéricos do objeto
      const objectValues = Object.values(val);
      const numericValues = objectValues.filter(
        (v) =>
          typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))),
      );
      console.log(
        `    🔢 Object values:`,
        objectValues,
        `numeric:`,
        numericValues,
      );
      if (numericValues.length > 0) {
        const objSum = numericValues.reduce<number>(
          (acc, v) => acc + Number(v),
          0,
        );
        console.log(
          `    🔢 Object sum: ${objSum}, adding to total (was ${sum})`,
        );
        return sum + objSum;
      }
      // Se não conseguir extrair número do objeto, retornar 0
      console.log(`    🔢 No numeric value found in object, skipping`);
      return sum;
    }
    // Se for valor simples, converter para número
    const numVal = Number(val);
    console.log(
      `    🔢 Simple value: ${val} -> ${numVal}, adding to sum (was ${sum})`,
    );
    return sum + numVal;
  }, 0);

  console.log(`🔢 sumArray result: ${result}`);
  return result;
}

/**
 * Deleta chaves específicas de cada objeto em um array
 * @param input Array de objetos ou string JSON
 * @param keysToDelete String com chaves separadas por vírgula (ex: "campo1, campo2, campo3")
 * @returns Array de objetos sem as chaves especificadas
 *
 * @example
 * deleteKeys([{nome: "João", idade: 30, cpf: "123"}], "cpf")
 * // Retorna: [{nome: "João", idade: 30}]
 */
export function deleteKeys(input: unknown, keysToDelete: string): unknown[] {
  const array = parseArrayInput(input);

  // Parsear chaves a deletar (remover espaços em branco)
  const keys = keysToDelete
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  if (keys.length === 0) {
    throw new Error('Nenhuma chave para deletar foi especificada');
  }

  // Processar cada objeto do array
  return array.map((item) => {
    // Se não for objeto, retornar o item original
    if (typeof item !== 'object' || item === null) {
      return item;
    }

    // Criar cópia do objeto
    const newItem = { ...item };

    // Deletar as chaves especificadas
    keys.forEach((key) => {
      delete newItem[key];
    });

    return newItem;
  });
}

/**
 * Renomeia chaves de cada objeto em um array
 * @param input Array de objetos ou string JSON
 * @param keyMappings String com mapeamentos no formato "chave_antiga:chave_nova" separados por vírgula
 * @returns Array de objetos com chaves renomeadas
 *
 * @example
 * renameKeys([{nome: "João", valor: 100}], "valor:preco, nome:cliente")
 * // Retorna: [{cliente: "João", preco: 100}]
 */
export function renameKeys(input: unknown, keyMappings: string): unknown[] {
  const array = parseArrayInput(input);

  // Parsear mapeamentos
  const mappings: Record<string, string> = {};
  const mappingPairs = keyMappings
    .split(',')
    .map((pair) => pair.trim())
    .filter((pair) => pair.length > 0);

  if (mappingPairs.length === 0) {
    throw new Error('Nenhum mapeamento de chaves foi especificado');
  }

  // Processar cada par "chave_antiga:chave_nova"
  mappingPairs.forEach((pair) => {
    const [oldKey, newKey] = pair.split(':').map((k) => k.trim());
    if (!oldKey || !newKey) {
      throw new Error(
        `Mapeamento inválido: "${pair}". Use o formato "chave_antiga:chave_nova"`,
      );
    }
    mappings[oldKey] = newKey;
  });

  // Processar cada objeto do array
  return array.map((item) => {
    // Se não for objeto, retornar o item original
    if (typeof item !== 'object' || item === null) {
      return item;
    }

    // Criar novo objeto com chaves renomeadas
    const newItem: Record<string, unknown> = {};

    Object.keys(item).forEach((key) => {
      // Se a chave tem um mapeamento, usar o novo nome
      const newKey = mappings[key] || key;
      newItem[newKey] = item[key];
    });

    return newItem;
  });
}

/**
 * Extrai um campo específico de cada elemento do array
 * @param input Array de objetos/arrays ou string JSON
 * @param fieldName Nome do campo (para objetos) ou índice (para arrays). Suporta dot notation
 * @returns Array com os valores extraídos
 *
 * @example
 * // Extrair campo de objetos
 * extractArrayField([{nome: "João", idade: 30}, {nome: "Maria", idade: 25}], "nome")
 * // Retorna: ["João", "Maria"]
 *
 * @example
 * // Extrair com dot notation
 * extractArrayField([{user: {name: "João"}}, {user: {name: "Maria"}}], "user.name")
 * // Retorna: ["João", "Maria"]
 *
 * @example
 * // Extrair índice de arrays
 * extractArrayField([["a", "b", "c"], ["d", "e", "f"]], "0")
 * // Retorna: ["a", "d"]
 */
export function extractArrayField(
  input: unknown,
  fieldName: string,
): unknown[] {
  const array = parseArrayInput(input);

  if (!fieldName || fieldName.trim() === '') {
    throw new Error('Nome do campo ou índice não especificado');
  }

  const trimmedField = fieldName.trim();

  // Verificar se é um índice numérico
  const isNumericIndex = /^\d+$/.test(trimmedField);

  return array.map((item) => {
    // Se for índice numérico e o item for array
    if (isNumericIndex && Array.isArray(item)) {
      const index = parseInt(trimmedField, 10);
      return item[index];
    }

    // Se for objeto, extrair o campo (suporta dot notation)
    if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
      // Suportar dot notation (ex: "user.name")
      const fields = trimmedField.split('.');
      let result = item;

      for (const field of fields) {
        result = result?.[field];
        if (result === undefined) {
          return null;
        }
      }

      return result;
    }

    // Se não for objeto nem array, retornar o próprio valor se for o campo solicitado
    // ou null se não puder extrair
    return null;
  });
}

/**
 * Transforma cada elemento do array em um objeto usando um template JSON
 * @param input Array de objetos ou string JSON
 * @param objectTemplate Template de objeto JSON como string
 * @returns Array de objetos transformados
 *
 * @example
 * // Transformar produtos em formato de carousel
 * mapObjectArray([{nome: "Produto", valor: "100"}], '{"id": "{{_id}}", "title": "{{nome}}", "description": "R$ {{valor}}"}')
 * // Retorna: [{id: "...", title: "Produto", description: "R$ 100"}]
 *
 * @example
 * // Template com arrays e objetos aninhados
 * mapObjectArray([{nome: "Item"}], '{"title": "{{nome}}", "buttons": [{"text": "Comprar", "id": "{{nome}}"}]}')
 * // Retorna: [{title: "Item", buttons: [{text: "Comprar", id: "Item"}]}]
 */
export function mapObjectArray(
  input: unknown,
  objectTemplate: string,
): unknown[] {
  const array = parseArrayInput(input);

  if (!objectTemplate || objectTemplate.trim() === '') {
    throw new Error('Template de objeto não especificado');
  }

  const trimmedTemplate = objectTemplate.trim();

  // Função recursiva para processar o template
  const processTemplate = (
    template: unknown,
    sourceObj: Record<string, unknown>,
  ): unknown => {
    // Se for string, substituir variáveis
    if (typeof template === 'string') {
      return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
        const trimmedKey = key.trim();

        // Suportar dot notation
        const fields = trimmedKey.split('.');
        let result = sourceObj;

        for (const field of fields) {
          result = result?.[field];
          if (result === undefined || result === null) {
            return '';
          }
        }

        // Se for objeto ou array, converter para JSON
        if (typeof result === 'object') {
          return JSON.stringify(result);
        }

        return String(result);
      });
    }

    // Se for array, processar cada elemento
    if (Array.isArray(template)) {
      return template.map((item) => processTemplate(item, sourceObj));
    }

    // Se for objeto, processar cada propriedade
    if (typeof template === 'object' && template !== null) {
      const processed: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        processed[key] = processTemplate(value, sourceObj);
      }
      return processed;
    }

    // Outros tipos (number, boolean, null)
    return template;
  };

  // Parsear o template
  let templateObj: unknown;
  try {
    templateObj = JSON.parse(trimmedTemplate);
  } catch {
    throw new Error(
      'Template inválido. Use um objeto JSON válido: {"field": "{{value}}"}',
    );
  }

  // Aplicar template a cada item do array
  return array.map((item) => {
    // Se não for objeto, retornar vazio
    if (typeof item !== 'object' || item === null) {
      return {};
    }

    return processTemplate(templateObj, item);
  });
}

/**
 * Transforma cada elemento do array usando um template e achata o resultado
 * @param input Array de objetos ou string JSON
 * @param template Template JSON como string que será aplicado a cada objeto
 * @returns Array achatado com os resultados da transformação
 *
 * @example
 * // Transformar objetos em múltiplos elementos
 * flatMapArray([{title: "A", desc: "B"}], '["[{{title}}]", "{{desc}}"]')
 * // Retorna: ["[A]", "B"]
 *
 * @example
 * // Criar estrutura de carousel
 * flatMapArray([{title: "Produto", imageUrl: "http://..."}], '["[{{title}}]", "{{{imageUrl}}}"]')
 * // Retorna: ["[Produto]", "{http://...}"]
 */
export function flatMapArray(input: unknown, template: string): unknown[] {
  const array = parseArrayInput(input);

  if (!template || template.trim() === '') {
    throw new Error('Template não especificado');
  }

  const trimmedTemplate = template.trim();

  // Tentar parsear o template como JSON array
  let templateArray: string[];
  try {
    const parsed = JSON.parse(trimmedTemplate);
    if (!Array.isArray(parsed)) {
      throw new Error('Template deve ser um array JSON');
    }
    templateArray = parsed;
  } catch {
    throw new Error(
      'Template inválido. Use formato JSON array: ["item1", "item2"]',
    );
  }

  // Função para substituir variáveis no template
  const replaceVars = (
    templateStr: string,
    obj: Record<string, unknown>,
  ): string => {
    return templateStr.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const trimmedKey = key.trim();

      // Suportar dot notation
      const fields = trimmedKey.split('.');
      let result = obj;

      for (const field of fields) {
        result = result?.[field];
        if (result === undefined || result === null) {
          return '';
        }
      }

      // Se for objeto ou array, converter para JSON
      if (typeof result === 'object') {
        return JSON.stringify(result);
      }

      return String(result);
    });
  };

  // Processar cada objeto e achatar os resultados
  const result: unknown[] = [];

  array.forEach((item) => {
    // Se não for objeto, pular
    if (typeof item !== 'object' || item === null) {
      return;
    }

    // Aplicar template a cada item
    templateArray.forEach((templateItem) => {
      const processed = replaceVars(templateItem, item);
      result.push(processed);
    });
  });

  return result;
}

// ==================== OBJECT OPERATIONS ====================

export function extractField(input: unknown, field: string): unknown {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Input deve ser um objeto');
  }

  // Suporta nested fields com dot notation (ex: "user.name")
  const fields = field.split('.');
  let result = input;

  for (const f of fields) {
    result = result?.[f];
    if (result === undefined) {
      return null;
    }
  }

  return result;
}

export function mergeObjects(
  input: Record<string, unknown>,
  mergeWith: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Input deve ser um objeto');
  }
  if (typeof mergeWith !== 'object' || mergeWith === null) {
    throw new Error('mergeWith deve ser um objeto');
  }
  return { ...input, ...mergeWith };
}

export function objectKeys(input: unknown): string[] {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Input deve ser um objeto');
  }
  return Object.keys(input);
}

export function objectValues(input: unknown): unknown[] {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Input deve ser um objeto');
  }
  return Object.values(input);
}

export function stringifyObject(input: unknown): string {
  return JSON.stringify(input);
}

export function parseJSON(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error('JSON inválido');
  }
}

// ==================== VALIDATION OPERATIONS ====================

export function validateEmail(input: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(input));
}

export function validatePhone(input: string): boolean {
  // Remove tudo que não é número
  const numbers = String(input).replace(/\D/g, '');
  // Valida formato brasileiro (10 ou 11 dígitos)
  return numbers.length >= 10 && numbers.length <= 11;
}

export function formatPhone(input: string): string {
  // Remove tudo que não é número
  const numbers = String(input).replace(/\D/g, '');

  if (numbers.length === 11) {
    // Celular: (11) 98765-4321
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  } else if (numbers.length === 10) {
    // Fixo: (11) 3456-7890
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }

  return input; // Retorna original se não bater formato
}

export function removeMask(input: string): string {
  return String(input).replace(/\D/g, '');
}

export function sanitize(input: string): string {
  return String(input)
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/javascript:/gi, '') // Remove javascript:
    .trim();
}
