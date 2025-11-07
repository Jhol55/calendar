/**
 * Hooks para Database Operations
 *
 * Gerenciamento de operações de banco de dados com React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { databaseKeys, TableFilters } from '../query-keys';
import { CACHE_TIMES } from '../config';
import { rollbackOptimisticUpdate } from '../utils';
import { CustomQueryOptions, CustomMutationOptions, ApiError } from '../types';
import {
  getAvailableTables,
  getTableData as getTableDataAction,
  addRow,
  updateCell,
  deleteRow,
  createTable,
  addColumnsToTable,
  renameColumn,
  deleteColumn,
} from '@/actions/database/operations';

/**
 * Tipos para Database
 */
export interface Table {
  name: string;
  recordCount?: number;
}

export interface TableRow {
  id?: string;
  [key: string]: unknown;
}

export interface TableSchema {
  columns: Array<{
    name: string;
    type: string;
    nullable?: boolean;
    default?: unknown;
  }>;
}

/**
 * Hook para listar tabelas disponíveis
 */
export function useTables(options?: CustomQueryOptions<string[]>) {
  return useQuery({
    queryKey: databaseKeys.tables(),
    queryFn: async () => {
      const response = await getAvailableTables();
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch tables');
      }
      return response.data as string[];
    },
    ...CACHE_TIMES.STATIC,
    ...options,
  });
}

/**
 * Hook para buscar dados de uma tabela
 */
export function useTableData(
  tableName: string | null,
  filters?: TableFilters,
  options?: CustomQueryOptions<{
    data: TableRow[];
    schema: TableSchema | null;
  }>,
) {
  return useQuery({
    queryKey: databaseKeys.tableData(tableName || '', filters),
    queryFn: async () => {
      if (!tableName) throw new Error('Table name is required');

      const response = await getTableDataAction(tableName);
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch table data');
      }
      return response.data as { data: TableRow[]; schema: TableSchema | null };
    },
    enabled: !!tableName,
    ...CACHE_TIMES.DYNAMIC,
    ...options,
  });
}

/**
 * Hook para buscar schema de uma tabela
 */
export function useTableSchema(
  tableName: string | null,
  options?: CustomQueryOptions<TableSchema>,
) {
  return useQuery({
    queryKey: databaseKeys.tableSchema(tableName || ''),
    queryFn: async () => {
      if (!tableName) throw new Error('Table name is required');

      const response = await getTableDataAction(tableName);
      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch table schema');
      }
      const tableData = response.data as {
        data: TableRow[];
        schema: TableSchema;
      };
      return tableData.schema;
    },
    enabled: !!tableName,
    ...CACHE_TIMES.STATIC,
    ...options,
  });
}

/**
 * Hook para inserir dados em uma tabela
 */
export function useInsertTableRow(
  tableName: string,
  options?: CustomMutationOptions<
    TableRow,
    ApiError,
    TableRow,
    { previousData: TableRow[] | undefined; tempRow: TableRow }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TableRow) => {
      const response = await addRow(tableName, data);
      if (!response.success) {
        throw new Error(response.message || 'Failed to insert row');
      }
      return response.data as TableRow;
    },

    onMutate: async (
      newRow,
    ): Promise<{ previousData: TableRow[] | undefined; tempRow: TableRow }> => {
      // Cancelar queries da tabela
      await queryClient.cancelQueries({
        queryKey: databaseKeys.table(tableName),
      });

      // Snapshot
      const previousData = queryClient.getQueryData<TableRow[]>(
        databaseKeys.tableData(tableName),
      );

      // Atualização otimista
      const tempRow: TableRow = {
        id: `temp-${Date.now()}`,
        ...newRow,
      };

      queryClient.setQueryData<TableRow[]>(
        databaseKeys.tableData(tableName),
        (old) => (old ? [...old, tempRow] : [tempRow]),
      );

      return { previousData, tempRow };
    },

    onError: (error, variables, context) => {
      // Rollback
      if (context?.previousData) {
        rollbackOptimisticUpdate(
          queryClient,
          databaseKeys.tableData(tableName),
          context.previousData,
        );
      }
    },

    onSuccess: (newRow) => {
      // Adicionar ao cache
      queryClient.setQueryData<{
        data: TableRow[];
        schema: TableSchema | null;
      }>(databaseKeys.tableData(tableName), (old) => {
        if (!old) return { data: [newRow], schema: null };
        return {
          ...old,
          data: [...old.data, newRow],
        };
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: databaseKeys.table(tableName),
      });
    },

    ...options,
  });
}

/**
 * Hook para atualizar célula de uma tabela
 */
export function useUpdateTableCell(
  tableName: string,
  options?: CustomMutationOptions<
    void,
    ApiError,
    { rowId: string; column: string; value: unknown },
    {
      previousData:
        | { data: TableRow[]; schema: TableSchema | null }
        | undefined;
      rowId: string;
    }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rowId, column, value }) => {
      // Converter valor para string (a função updateCell espera string)
      const stringValue =
        value === null || value === undefined
          ? ''
          : typeof value === 'string'
            ? value
            : String(value);
      const response = await updateCell(tableName, rowId, column, stringValue);
      if (!response.success) {
        throw new Error(response.message || 'Failed to update cell');
      }
      return undefined;
    },

    onMutate: async ({
      rowId,
      column,
      value,
    }): Promise<{
      previousData:
        | { data: TableRow[]; schema: TableSchema | null }
        | undefined;
      rowId: string;
    }> => {
      await queryClient.cancelQueries({
        queryKey: databaseKeys.table(tableName),
      });

      const previousData = queryClient.getQueryData<{
        data: TableRow[];
        schema: TableSchema | null;
      }>(databaseKeys.tableData(tableName));

      // Atualização otimista
      queryClient.setQueryData<{
        data: TableRow[];
        schema: TableSchema | null;
      }>(databaseKeys.tableData(tableName), (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((row) =>
            row.id === rowId ? { ...row, [column]: value } : row,
          ),
        };
      });

      return { previousData, rowId };
    },

    onError: (error, variables, context) => {
      if (context?.previousData) {
        rollbackOptimisticUpdate(
          queryClient,
          databaseKeys.tableData(tableName),
          context.previousData,
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: databaseKeys.table(tableName),
      });
    },

    ...options,
  });
}

/**
 * Hook para deletar linha de uma tabela
 */
export function useDeleteTableRow(
  tableName: string,
  options?: CustomMutationOptions<
    void,
    ApiError,
    string,
    {
      previousData:
        | { data: TableRow[]; schema: TableSchema | null }
        | undefined;
      rowId: string;
    }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rowId: string) => {
      const response = await deleteRow(tableName, rowId);
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete row');
      }
      return undefined;
    },

    onMutate: async (
      rowId,
    ): Promise<{
      previousData:
        | { data: TableRow[]; schema: TableSchema | null }
        | undefined;
      rowId: string;
    }> => {
      await queryClient.cancelQueries({
        queryKey: databaseKeys.table(tableName),
      });

      const previousData = queryClient.getQueryData<{
        data: TableRow[];
        schema: TableSchema | null;
      }>(databaseKeys.tableData(tableName));

      // Remover otimisticamente
      queryClient.setQueryData<{
        data: TableRow[];
        schema: TableSchema | null;
      }>(databaseKeys.tableData(tableName), (old) =>
        old
          ? {
              ...old,
              data: old.data.filter((row) => row.id !== rowId),
            }
          : old,
      );

      return { previousData, rowId };
    },

    onError: (error, rowId, context) => {
      if (context?.previousData) {
        rollbackOptimisticUpdate(
          queryClient,
          databaseKeys.tableData(tableName),
          context.previousData,
        );
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: databaseKeys.table(tableName),
      });
    },

    ...options,
  });
}

/**
 * Hook para criar uma nova tabela
 */
export function useCreateTable(
  options?: CustomMutationOptions<
    { tableName: string; schema: TableSchema },
    ApiError,
    {
      tableName: string;
      columns: Array<{
        name: string;
        type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
        default: unknown;
        required: boolean;
      }>;
    }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tableName, columns }) => {
      const response = await createTable(tableName, columns);
      if (!response.success) {
        throw new Error(response.message || 'Failed to create table');
      }
      return response.data as { tableName: string; schema: TableSchema };
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: databaseKeys.tables() });
    },

    ...options,
  });
}

/**
 * Hook para adicionar colunas a uma tabela
 */
export function useAddColumns(
  tableName: string,
  options?: CustomMutationOptions<
    void,
    ApiError,
    Array<{
      name: string;
      type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
      required: boolean;
      default: string;
    }>
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (columns) => {
      const response = await addColumnsToTable(tableName, columns);
      if (!response.success) {
        throw new Error(response.message || 'Failed to add columns');
      }
      return undefined;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: databaseKeys.table(tableName),
      });
    },

    ...options,
  });
}

/**
 * Hook para renomear uma coluna
 */
export function useRenameColumn(
  tableName: string,
  options?: CustomMutationOptions<
    void,
    ApiError,
    { oldColumnName: string; newColumnName: string }
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ oldColumnName, newColumnName }) => {
      const response = await renameColumn(
        tableName,
        oldColumnName,
        newColumnName,
      );
      if (!response.success) {
        throw new Error(response.message || 'Failed to rename column');
      }
      return undefined;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: databaseKeys.table(tableName),
      });
    },

    ...options,
  });
}

/**
 * Hook para deletar uma coluna
 */
export function useDeleteColumn(
  tableName: string,
  options?: CustomMutationOptions<void, ApiError, string>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (columnName: string) => {
      const response = await deleteColumn(tableName, columnName);
      if (!response.success) {
        throw new Error(response.message || 'Failed to delete column');
      }
      return undefined;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: databaseKeys.table(tableName),
      });
    },

    ...options,
  });
}

/**
 * Hook para invalidar cache de database
 */
export function useInvalidateDatabase() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      return queryClient.invalidateQueries({ queryKey: databaseKeys.all });
    },
    invalidateTables: () => {
      return queryClient.invalidateQueries({ queryKey: databaseKeys.tables() });
    },
    invalidateTable: (tableName: string) => {
      return queryClient.invalidateQueries({
        queryKey: databaseKeys.table(tableName),
      });
    },
  };
}
