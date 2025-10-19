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
function parseArrayInput(input: any): any[] {
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

export function filterArray(input: any, condition: string): any[] {
  const array = parseArrayInput(input);
  // Nota: condition seria algo como "value > 10" ou "value === 'ativo'"
  // Aqui simplificamos para demonstração
  // Por enquanto retorna o array original
  // TODO: Implementar parser de condição
  return array;
}

export function mapArray(input: any, transformation: string): any[] {
  const array = parseArrayInput(input);
  // Por enquanto retorna o array original
  // TODO: Implementar transformação
  return array;
}

export function sortArray(input: any, order: 'asc' | 'desc' = 'asc'): any[] {
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

export function firstElement(input: any): any {
  const array = parseArrayInput(input);
  return array[0];
}

export function lastElement(input: any): any {
  const array = parseArrayInput(input);
  return array[array.length - 1];
}

export function joinArray(input: any, separator: string = ','): string {
  const array = parseArrayInput(input);
  return array.join(separator);
}

export function uniqueArray(input: any): any[] {
  const array = parseArrayInput(input);
  return [...new Set(array)];
}

export function arrayLength(input: any): number {
  const array = parseArrayInput(input);
  return array.length;
}

export function sumArray(input: any): number {
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
        const objSum = numericValues.reduce(
          (objSum, v) => objSum + Number(v),
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

// ==================== OBJECT OPERATIONS ====================

export function extractField(input: any, field: string): any {
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

export function mergeObjects(input: any, mergeWith: any): any {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Input deve ser um objeto');
  }
  if (typeof mergeWith !== 'object' || mergeWith === null) {
    throw new Error('mergeWith deve ser um objeto');
  }
  return { ...input, ...mergeWith };
}

export function objectKeys(input: any): string[] {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Input deve ser um objeto');
  }
  return Object.keys(input);
}

export function objectValues(input: any): any[] {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Input deve ser um objeto');
  }
  return Object.values(input);
}

export function stringifyObject(input: any): string {
  return JSON.stringify(input);
}

export function parseJSON(input: string): any {
  try {
    return JSON.parse(input);
  } catch (error) {
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
