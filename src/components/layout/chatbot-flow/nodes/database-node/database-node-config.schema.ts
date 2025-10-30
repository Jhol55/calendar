import { z } from 'zod';

const baseSchema = z.object({
  operation: z.enum([
    'addColumns',
    'removeColumns',
    'insert',
    'update',
    'delete',
    'get',
    'sql_query',
  ]),
  tableName: z.string().optional(), // Opcional para sql_query

  // Para addColumns
  columns: z.string().optional(), // JSON stringified array

  // Para removeColumns
  columnsToRemove: z.string().optional(), // JSON stringified array

  // Para insert
  record: z.string().optional(), // JSON stringified object

  // Para update
  updates: z.string().optional(), // JSON stringified object

  // Para update, delete, get
  filters: z.string().optional(), // JSON stringified FilterConfig

  // Para get
  sortField: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.union([z.string(), z.number()]).optional(),
  offset: z.union([z.string(), z.number()]).optional(),

  // Para sql_query
  sqlQuery: z.string().optional(), // Raw SQL query
  enableComplexQueries: z.boolean().optional().default(true),
  maxRecordsPerTable: z.number().optional().default(10000),
});

export const databaseConfigSchema = baseSchema.refine(
  (data) => {
    // tableName é obrigatório exceto para sql_query
    if (
      data.operation !== 'sql_query' &&
      (!data.tableName || data.tableName.trim().length === 0)
    ) {
      return false;
    }

    // Validar campos específicos baseado na operação
    if (data.operation === 'addColumns') {
      if (!data.columns) return false;
      try {
        const cols = JSON.parse(data.columns);
        return Array.isArray(cols) && cols.length > 0;
      } catch {
        return false;
      }
    }

    if (data.operation === 'removeColumns') {
      if (!data.columnsToRemove) return false;
      try {
        const cols = JSON.parse(data.columnsToRemove);
        return Array.isArray(cols) && cols.length > 0;
      } catch {
        return false;
      }
    }

    if (data.operation === 'insert') {
      if (!data.record) return false;
      try {
        const rec = JSON.parse(data.record);
        return typeof rec === 'object' && rec !== null;
      } catch {
        return false;
      }
    }

    if (data.operation === 'update') {
      if (!data.updates || !data.filters) return false;
      try {
        const upd = JSON.parse(data.updates);
        const flt = JSON.parse(data.filters);
        return typeof upd === 'object' && typeof flt === 'object';
      } catch {
        return false;
      }
    }

    if (data.operation === 'delete') {
      if (!data.filters) return false;
      try {
        const flt = JSON.parse(data.filters);
        return typeof flt === 'object';
      } catch {
        return false;
      }
    }

    if (data.operation === 'sql_query') {
      if (!data.sqlQuery || data.sqlQuery.trim().length === 0) return false;
      // Validação básica: deve conter alguma palavra-chave SQL
      const sqlKeywords = [
        'SELECT',
        'INSERT',
        'UPDATE',
        'DELETE',
        'FROM',
        'WHERE',
      ];
      const upperQuery = data.sqlQuery.toUpperCase();
      return sqlKeywords.some((keyword) => upperQuery.includes(keyword));
    }

    return true;
  },
  (data) => {
    // Retornar mensagem de erro apropriada

    // Validar tableName primeiro (exceto para sql_query)
    if (
      data.operation !== 'sql_query' &&
      (!data.tableName || data.tableName.trim().length === 0)
    ) {
      return { message: 'Digite o nome da tabela', path: ['tableName'] };
    }

    if (data.operation === 'addColumns') {
      return { message: 'Adicione pelo menos uma coluna', path: ['columns'] };
    }
    if (data.operation === 'removeColumns') {
      return {
        message: 'Selecione pelo menos uma coluna para remover',
        path: ['columnsToRemove'],
      };
    }
    if (data.operation === 'insert') {
      return { message: 'Defina os campos do registro', path: ['record'] };
    }
    if (data.operation === 'update') {
      if (!data.updates) {
        return { message: 'Defina os campos a atualizar', path: ['updates'] };
      }
      return { message: 'Defina os filtros', path: ['filters'] };
    }
    if (data.operation === 'delete') {
      return { message: 'Defina os filtros', path: ['filters'] };
    }
    if (data.operation === 'sql_query') {
      return { message: 'Escreva uma query SQL válida', path: ['sqlQuery'] };
    }
    return { message: 'Erro de validação', path: [] };
  },
);

export type DatabaseConfigSchema = z.infer<typeof baseSchema>;
