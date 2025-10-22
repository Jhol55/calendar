/**
 * React Query Hooks
 *
 * Exportações centralizadas de todos os hooks
 */

// Workflows
export {
  useWorkflows,
  useWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  usePrefetchWorkflow,
  useInvalidateWorkflows,
} from './use-workflows';

// User
export {
  useUser,
  useInstances,
  useInstance,
  useUpdateUser,
  useLogout,
  useInvalidateUser,
  usePrefetchUser,
} from './use-user';
export type { User, Instance } from './use-user';

// Database
export {
  useTables,
  useTableData,
  useTableSchema,
  useInsertTableRow,
  useUpdateTableCell,
  useDeleteTableRow,
  useCreateTable,
  useAddColumns,
  useRenameColumn,
  useDeleteColumn,
  useInvalidateDatabase,
} from './use-database';
export type { Table, TableRow, TableSchema } from './use-database';

// Executions
export {
  useExecutions,
  useFlowExecutions,
  useExecution,
  useStopExecution,
  useCancelExecution, // Alias para useStopExecution
  useInvalidateExecutions,
  usePrefetchExecutions,
} from './use-executions';
export type { Execution } from './use-executions';
