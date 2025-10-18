import { z } from 'zod';

// Schema sem validações obrigatórias (validação condicional no superRefine)
export const memoryItemSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const memoryConfigSchema = z
  .object({
    action: z.enum(['save', 'fetch', 'delete'], {
      required_error: 'Selecione uma ação',
    }),
    memoryName: z
      .string()
      .min(1, 'Nome da memória é obrigatório')
      .max(255, 'Nome muito longo (máx 255 caracteres)'),
    items: z.array(memoryItemSchema).optional(),
    ttl: z.number().optional(),
    ttlPreset: z.string().optional(),
    customTtl: z.string().optional(),
    defaultValue: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Validar items apenas se a ação for "save"
    if (data.action === 'save') {
      if (!data.items || data.items.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Adicione pelo menos um par chave/valor para salvar',
          path: ['items'],
        });
        return;
      }

      // Validar cada item apenas se a ação for "save"
      data.items.forEach((item, index) => {
        if (!item.key || item.key.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Chave é obrigatória',
            path: ['items', index, 'key'],
          });
        }
        if (item.key && item.key.length > 255) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Chave muito longa (máx 255 caracteres)',
            path: ['items', index, 'key'],
          });
        }
        if (!item.value || item.value.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Valor é obrigatório',
            path: ['items', index, 'value'],
          });
        }
      });
    }
  });

export type MemoryConfigFormData = z.infer<typeof memoryConfigSchema>;
