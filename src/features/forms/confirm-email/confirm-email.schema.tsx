import { z } from 'zod';

export const confirmEmailFormSchema = z.object({
  validationCode: z.string().min(6, 'Código inválido'),
});
