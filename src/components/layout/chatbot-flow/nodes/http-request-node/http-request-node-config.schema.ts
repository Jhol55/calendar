import { z } from 'zod';

export const httpRequestConfigSchema = z.object({
  url: z.string().min(1, 'URL é obrigatória'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], {
    required_error: 'Método HTTP é obrigatório',
  }),
  headers: z.string().optional(),
  body: z.string().optional(),
  bodyType: z.enum(['json', 'text', 'form']).optional(),
  timeout: z.string().optional(),
  followRedirects: z.boolean().optional(),
  validateSSL: z.boolean().optional(),
  saveResponse: z.boolean().optional(),
  responseVariable: z.string().optional(),
});
