import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Database, Settings } from 'lucide-react';
import { NodeData } from '../../types';
import { Typography } from '@/components/ui/typography';

function DatabaseNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const databaseConfig = data.databaseConfig;

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

  const getPreviewContent = () => {
    if (!databaseConfig) return 'Duplo clique para configurar...';

    const tableName = databaseConfig.tableName || 'tabela';

    switch (databaseConfig.operation) {
      case 'addColumns':
        const colCount = databaseConfig.columns?.length || 0;
        return `${colCount} coluna${colCount !== 1 ? 's' : ''} em "${tableName}"`;

      case 'removeColumns':
        const remCount = databaseConfig.columnsToRemove?.length || 0;
        return `Remover ${remCount} coluna${remCount !== 1 ? 's' : ''} de "${tableName}"`;

      case 'insert':
        const fieldCount = databaseConfig.record
          ? Object.keys(databaseConfig.record).length
          : 0;
        return `Inserir ${fieldCount} campo${fieldCount !== 1 ? 's' : ''} em "${tableName}"`;

      case 'get':
        const filterCount = databaseConfig.filters?.rules?.length || 0;
        if (filterCount > 0) {
          return `Buscar em "${tableName}" (${filterCount} filtro${filterCount !== 1 ? 's' : ''})`;
        }
        return `Buscar todos de "${tableName}"`;

      case 'update':
        const updateCount = databaseConfig.updates
          ? Object.keys(databaseConfig.updates).length
          : 0;
        return `Atualizar ${updateCount} campo${updateCount !== 1 ? 's' : ''} em "${tableName}"`;

      case 'delete':
        const delFilterCount = databaseConfig.filters?.rules?.length || 0;
        return `Deletar de "${tableName}" (${delFilterCount} filtro${delFilterCount !== 1 ? 's' : ''})`;

      default:
        return 'Duplo clique para configurar...';
    }
  };

  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-lg min-w-[250px] max-w-[300px] ${
        selected ? 'border-purple-500' : 'border-gray-300'
      }`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-500" />
            <Typography variant="h3" className="font-semibold text-sm">
              Database
            </Typography>
          </div>
          <Settings className="w-4 h-4 text-gray-400" />
        </div>

        {databaseConfig && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded font-medium">
              {getOperationLabel()}
            </span>
          </div>
        )}

        <div className="text-xs text-gray-600 bg-gray-50/40 p-2 rounded line-clamp-2">
          {getPreviewContent()}
        </div>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const DatabaseNode = memo(DatabaseNodeComponent);
