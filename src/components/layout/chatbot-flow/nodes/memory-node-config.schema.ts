import { z } from 'zod';

export const memoryConfigSchema = z
  .object({
    acao: z.enum(['salvar', 'buscar', 'deletar'], {
      required_error: 'Selecione uma ação',
    }),
    chave: z
      .string()
      .min(1, 'Chave é obrigatória')
      .max(255, 'Chave muito longa (máx 255 caracteres)'),
    valor: z.string().optional(),
    ttl: z.number().optional(),
    valorPadrao: z.string().optional(),
  })
  .refine(
    (data) => {
      // Se ação é "salvar", valor é obrigatório
      if (data.acao === 'salvar' && !data.valor) {
        return false;
      }
      return true;
    },
    {
      message: 'Valor é obrigatório para ação "salvar"',
      path: ['valor'],
    },
  );

export type MemoryConfigFormData = z.infer<typeof memoryConfigSchema>;
