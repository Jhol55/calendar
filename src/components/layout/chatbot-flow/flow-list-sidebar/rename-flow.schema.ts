import { z } from 'zod';

export const renameFlowSchema = z.object({
  newName: z
    .string()
    .min(1, 'Nome do fluxo é obrigatório')
    .max(100, 'Nome muito longo'),
});
