import { z } from 'zod';

export const codeExecutionConfigSchema = z
  .object({
    // Code settings
    language: z.enum(['javascript', 'python', 'typescript'], {
      errorMap: () => ({ message: 'Selecione uma linguagem' }),
    }),
    code: z.string().min(1, 'Digite o código a ser executado'),

    // Input/Output
    inputVariables: z.string().optional(),
    outputVariable: z.string().optional(),

    // Execution settings
    timeout: z.union([z.string(), z.number()]).optional(),

    // Judge0 settings
    judge0Url: z.string().optional(),

    // Memory config
    memoryAction: z.string().optional(),
    memoryName: z.string().optional(),
    memorySaveMode: z.enum(['overwrite', 'append']).optional(),
    memoryDefaultValue: z.string().optional(),
    memoryItems: z.array(z.any()).optional(),
    memoryTtlPreset: z.string().optional(),
    memoryCustomTtl: z.union([z.string(), z.number()]).optional(),
  })
  .refine(
    (data) => {
      // Validar inputVariables se fornecido (deve ser JSON válido ou conter variáveis dinâmicas)
      if (data.inputVariables && data.inputVariables.trim() !== '') {
        const input = data.inputVariables.trim();

        // Se contém variáveis dinâmicas {{...}}, substituir temporariamente por valores dummy para validar estrutura
        const hasVariables = /\{\{[^}]+\}\}/.test(input);

        if (hasVariables) {
          // Substituir variáveis dinâmicas por valores dummy para validar estrutura JSON
          // Suportar AMBOS os formatos:
          // 1. COM aspas: "{{...}}" → "__DUMMY__"
          // 2. SEM aspas: {{...}} → "__DUMMY__" (para arrays/objetos)
          let dummyJson = input.replace(/"\{\{[^}]+\}\}"/g, '"__DUMMY__"'); // Com aspas
          dummyJson = dummyJson.replace(/\{\{[^}]+\}\}/g, '"__DUMMY__"'); // Sem aspas
          try {
            JSON.parse(dummyJson);
            return true;
          } catch {
            return false;
          }
        } else {
          // Sem variáveis, validar JSON normal
          try {
            JSON.parse(input);
            return true;
          } catch {
            return false;
          }
        }
      }
      return true;
    },
    {
      message: 'Variáveis de entrada devem ser um JSON válido',
      path: ['inputVariables'],
    },
  )
  .refine(
    (data) => {
      // Validar timeout se fornecido
      if (data.timeout) {
        const timeoutNum =
          typeof data.timeout === 'string'
            ? parseInt(data.timeout)
            : data.timeout;
        return timeoutNum && timeoutNum > 0 && timeoutNum <= 30;
      }
      return true;
    },
    {
      message: 'Timeout deve ser entre 1 e 30 segundos',
      path: ['timeout'],
    },
  );

export type CodeExecutionConfigSchema = z.infer<
  typeof codeExecutionConfigSchema
>;
