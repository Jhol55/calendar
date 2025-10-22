import { z } from 'zod';

// Schema para cada step do pipeline
export const transformationStepSchema = z.object({
  id: z.string(),
  type: z.enum(['string', 'number', 'date', 'array', 'object', 'validation'], {
    required_error: 'Selecione o tipo de transformação',
  }),
  operation: z.string().min(1, 'Selecione uma operação'),
  input: z.string().min(1, 'Input é obrigatório'),
  params: z.record(z.any()).optional(),
});

// Schema principal
export const transformationConfigSchema = z
  .object({
    steps: z.array(transformationStepSchema),
    outputAs: z.string().optional(),
  })
  .refine(
    (data) => {
      // Deve ter pelo menos 1 step
      return data.steps && data.steps.length > 0;
    },
    {
      message: 'Adicione pelo menos uma transformação',
      path: ['steps'],
    },
  );

export type TransformationConfigFormData = z.infer<
  typeof transformationConfigSchema
>;

// Mapeamento de operações por tipo
export const OPERATIONS_BY_TYPE = {
  string: [
    { value: 'uppercase', label: 'Maiúsculas (UPPERCASE)' },
    { value: 'lowercase', label: 'Minúsculas (lowercase)' },
    { value: 'trim', label: 'Remover espaços (trim)' },
    { value: 'replace', label: 'Substituir texto' },
    { value: 'substring', label: 'Extrair parte (substring)' },
    { value: 'split', label: 'Dividir (split)' },
    { value: 'concat', label: 'Concatenar' },
    { value: 'capitalize', label: 'Primeira letra maiúscula' },
  ],
  number: [
    { value: 'add', label: 'Somar (+)' },
    { value: 'subtract', label: 'Subtrair (-)' },
    { value: 'multiply', label: 'Multiplicar (×)' },
    { value: 'divide', label: 'Dividir (÷)' },
    { value: 'round', label: 'Arredondar' },
    { value: 'formatCurrency', label: 'Formatar moeda (R$)' },
    { value: 'toPercent', label: 'Converter para %' },
  ],
  date: [
    { value: 'format', label: 'Formatar data' },
    { value: 'addDays', label: 'Adicionar dias' },
    { value: 'subtractDays', label: 'Subtrair dias' },
    { value: 'diffDays', label: 'Diferença em dias' },
    { value: 'extractPart', label: 'Extrair parte (dia, mês, ano)' },
    { value: 'now', label: 'Data/hora atual' },
  ],
  array: [
    { value: 'filter', label: 'Filtrar elementos' },
    { value: 'map', label: 'Transformar cada elemento' },
    { value: 'mapObject', label: '🎨 Transformar em Objeto (mapObject)' },
    { value: 'sort', label: 'Ordenar' },
    { value: 'first', label: 'Primeiro elemento' },
    { value: 'last', label: 'Último elemento' },
    { value: 'join', label: 'Juntar em string' },
    { value: 'unique', label: 'Remover duplicados' },
    { value: 'length', label: 'Contar elementos' },
    { value: 'sum', label: 'Somar elementos' },
    { value: 'deleteKeys', label: '🗑️ Deletar chaves de objetos' },
    { value: 'renameKeys', label: '✏️ Renomear chaves de objetos' },
    { value: 'extractField', label: '📤 Extrair campo de objetos' },
    { value: 'flatMap', label: '🔄 Transformar e Achatar (flatMap)' },
  ],
  object: [
    { value: 'extract', label: 'Extrair campo' },
    { value: 'merge', label: 'Mesclar objetos' },
    { value: 'keys', label: 'Obter chaves' },
    { value: 'values', label: 'Obter valores' },
    { value: 'stringify', label: 'Converter para JSON' },
    { value: 'parse', label: 'Parse JSON' },
  ],
  validation: [
    { value: 'validateEmail', label: 'Validar email' },
    { value: 'validatePhone', label: 'Validar telefone' },
    { value: 'formatPhone', label: 'Formatar telefone' },
    { value: 'removeMask', label: 'Remover máscara' },
    { value: 'sanitize', label: 'Sanitizar texto' },
  ],
} as const;

// Parâmetros necessários por operação
export const OPERATION_PARAMS = {
  // String operations
  replace: ['searchValue', 'replaceValue'],
  substring: ['start', 'end'],
  split: ['separator'],
  concat: ['value'],

  // Number operations
  add: ['value'],
  subtract: ['value'],
  multiply: ['value'],
  divide: ['value'],
  round: ['decimals'],

  // Date operations
  format: ['format'],
  addDays: ['days'],
  subtractDays: ['days'],
  diffDays: ['compareDate'],
  extractPart: ['part'],

  // Array operations
  filter: ['condition'],
  map: ['transformation'],
  mapObject: ['objectTemplate'],
  sort: ['order'],
  join: ['separator'],
  deleteKeys: ['keysToDelete'],
  renameKeys: ['keyMappings'],
  extractField: ['fieldName'],
  flatMap: ['template'],

  // Object operations
  extract: ['field'],
  merge: ['mergeWith'],
} as const;
