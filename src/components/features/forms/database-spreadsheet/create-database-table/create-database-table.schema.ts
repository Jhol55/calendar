import { z } from 'zod';

export const createTableSchema = z.object({
  tableName: z.string().min(1, 'Nome da tabela é obrigatório'),
});
