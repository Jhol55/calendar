import { z } from 'zod';

export const playwrightMcpConfigSchema = z.object({
  goal: z.string().optional().or(z.literal('')),
  startUrl: z.string().url('URL inicial inválida').optional().or(z.literal('')),
  mode: z
    .enum(['autonomous', 'guided', 'hybrid'])
    .default('autonomous')
    .optional(),
  // Usamos um único input de string no formulário e fazemos o split manual no submit
  // portanto aqui validamos como string opcional (pode ser vazia)
  allowedDomains: z.string().optional().or(z.literal('')),
  maxSteps: z.union([z.number(), z.string()]).optional(),
  timeoutMs: z.union([z.number(), z.string()]).optional(),
  resultSchema: z.string().optional(), // JSON ou descrição textual da saída esperada
  // JSON opcional com lista de etapas WebScraper
  stepsJson: z.string().optional().or(z.literal('')),
});

export type PlaywrightMcpConfigSchema = z.infer<
  typeof playwrightMcpConfigSchema
>;
