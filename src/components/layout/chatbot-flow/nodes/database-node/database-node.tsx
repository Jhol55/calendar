import React, { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { Database } from 'lucide-react';
import { NodeData } from '../../types';
import { BaseNode, NodePreview } from '../base-node';
import { useVariableContext, resolveVariable } from '../use-variable-context';

function DatabaseNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const databaseConfig = data.databaseConfig;
  const context = useVariableContext();

  const getOperationLabel = () => {
    const operations: Record<string, string> = {
      addColumns: '➕ Adicionar Colunas',
      removeColumns: '➖ Remover Colunas',
      insert: '📝 Inserir',
      get: '🔍 Buscar',
      update: '✏️ Atualizar',
      delete: '🗑️ Deletar',
    };
    return databaseConfig?.operation
      ? operations[databaseConfig.operation]
      : 'Não configurado';
  };

  const resolvedPreview = useMemo(() => {
    if (!databaseConfig) return 'Duplo clique para configurar...';

    const resolvedTableName =
      resolveVariable(databaseConfig.tableName, context) || 'tabela';

    switch (databaseConfig.operation) {
      case 'addColumns':
        const colCount = databaseConfig.columns?.length || 0;
        return `${colCount} coluna${colCount !== 1 ? 's' : ''} em "${resolvedTableName}"`;

      case 'removeColumns':
        const remCount = databaseConfig.columnsToRemove?.length || 0;
        return `Remover ${remCount} coluna${remCount !== 1 ? 's' : ''} de "${resolvedTableName}"`;

      case 'insert':
        const fieldCount = databaseConfig.record
          ? Object.keys(databaseConfig.record).length
          : 0;
        return `Inserir ${fieldCount} campo${fieldCount !== 1 ? 's' : ''} em "${resolvedTableName}"`;

      case 'get':
        const filterCount = databaseConfig.filters?.rules?.length || 0;
        if (filterCount > 0) {
          return `Buscar em "${resolvedTableName}" (${filterCount} filtro${filterCount !== 1 ? 's' : ''})`;
        }
        return `Buscar todos de "${resolvedTableName}"`;

      case 'update':
        const updateCount = databaseConfig.updates
          ? Object.keys(databaseConfig.updates).length
          : 0;
        return `Atualizar ${updateCount} campo${updateCount !== 1 ? 's' : ''} em "${resolvedTableName}"`;

      case 'delete':
        const delFilterCount = databaseConfig.filters?.rules?.length || 0;
        return `Deletar de "${resolvedTableName}" (${delFilterCount} filtro${delFilterCount !== 1 ? 's' : ''})`;

      default:
        return 'Duplo clique para configurar...';
    }
  }, [databaseConfig, context]);

  return (
    <BaseNode
      icon={<Database className="w-4 h-4" />}
      title="Database"
      badge={databaseConfig ? getOperationLabel() : undefined}
      selected={selected}
      themeColor="cyan"
      preview={<NodePreview>{resolvedPreview}</NodePreview>}
    />
  );
}

export const DatabaseNode = memo(DatabaseNodeComponent);
