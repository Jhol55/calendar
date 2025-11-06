import { z } from 'zod';

export const createInstanceFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Nome é obrigatório')
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(25, 'Nome deve ter no máximo 25 caracteres')
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/,
      'Nome deve conter apenas letras, números, espaços, hífens e underscores',
    ),
  provider: z.enum(['default', 'cloud'], {
    required_error: 'Selecione um provedor',
  }),
});
