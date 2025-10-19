import { z } from 'zod';

export const conditionRuleSchema = z.object({
  id: z.string().min(1, 'ID da regra é obrigatório'),
  variable: z.string().min(1, 'Variável é obrigatória'),
  operator: z.enum(
    [
      'equals',
      'not_equals',
      'contains',
      'not_contains',
      'starts_with',
      'ends_with',
      'greater_than',
      'less_than',
      'greater_or_equal',
      'less_or_equal',
      'is_empty',
      'is_not_empty',
      'regex_match',
    ],
    { required_error: 'Operador é obrigatório' },
  ),
  value: z.string().optional(),
  logicOperator: z.enum(['AND', 'OR']).optional(),
});

export const switchCaseSchema = z.object({
  id: z.string().min(1, 'ID do caso é obrigatório'),
  variable: z.string().min(1, 'Variável é obrigatória'),
  operator: z.enum(
    [
      'equals',
      'not_equals',
      'contains',
      'not_contains',
      'starts_with',
      'ends_with',
      'greater_than',
      'less_than',
      'greater_or_equal',
      'less_or_equal',
      'is_empty',
      'is_not_empty',
      'regex_match',
    ],
    { required_error: 'Operador é obrigatório' },
  ),
  value: z.string().optional(),
  label: z.string().min(1, 'Label do caso é obrigatório'),
});

export const conditionConfigSchema = z
  .object({
    conditionType: z.enum(['if', 'switch'], {
      required_error: 'Tipo de condição é obrigatório',
    }),
    // Para IF
    rules: z.array(conditionRuleSchema).optional(),
    // Para SWITCH
    variable: z.string().optional(),
    cases: z.array(switchCaseSchema).optional(),
    useDefaultCase: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.conditionType === 'if') {
      // Validar regras para IF
      if (!data.rules || data.rules.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Adicione pelo menos uma regra de condição',
          path: ['rules'],
        });
      }

      // Validar que regras que precisam de valor têm valor
      data.rules?.forEach((rule, index) => {
        if (
          !['is_empty', 'is_not_empty'].includes(rule.operator) &&
          (!rule.value || rule.value.trim() === '')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Valor é obrigatório para este operador',
            path: ['rules', index, 'value'],
          });
        }
      });
    }

    if (data.conditionType === 'switch') {
      // Validar casos para SWITCH
      if (!data.cases || data.cases.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Adicione pelo menos um caso',
          path: ['cases'],
        });
      }

      // Validar que casos que precisam de valor têm valor
      data.cases?.forEach((caseItem, index) => {
        if (
          !['is_empty', 'is_not_empty'].includes(caseItem.operator) &&
          (!caseItem.value || caseItem.value.trim() === '')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Valor é obrigatório para este operador',
            path: ['cases', index, 'value'],
          });
        }
      });
    }
  });

export type ConditionConfigSchema = z.infer<typeof conditionConfigSchema>;
