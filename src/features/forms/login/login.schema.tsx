import { z } from 'zod';

export const loginFormSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string(),
  remember: z.boolean().optional(),
});
