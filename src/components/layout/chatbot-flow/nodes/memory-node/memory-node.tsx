import { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { NodeData } from '../../types';
import { Brain, Save, Search, Trash2 } from 'lucide-react';
import { BaseNode, NodeInfoLine } from '../base-node';
import { useVariableContext, resolveVariable } from '../use-variable-context';

export const MemoryNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  const memoryConfig = data.memoryConfig;
  const action = memoryConfig?.action || 'save';
  const itemCount = memoryConfig?.items?.length || 0;
  const context = useVariableContext();

  // Resolver variáveis dinâmicas
  const resolvedMemoryName = useMemo(
    () => resolveVariable(memoryConfig?.memoryName, context) || 'memória',
    [memoryConfig?.memoryName, context],
  );

  const resolvedDefaultValue = useMemo(
    () => resolveVariable(memoryConfig?.defaultValue, context),
    [memoryConfig?.defaultValue, context],
  );

  // Ícone e label por ação
  const getActionInfo = () => {
    switch (action) {
      case 'save':
        return { icon: <Save className="w-4 h-4" />, label: 'Salvar' };
      case 'fetch':
        return { icon: <Search className="w-4 h-4" />, label: 'Buscar' };
      case 'delete':
        return { icon: <Trash2 className="w-4 h-4" />, label: 'Deletar' };
      default:
        return { icon: <Brain className="w-4 h-4" />, label: 'Memória' };
    }
  };

  const actionInfo = getActionInfo();

  return (
    <BaseNode
      icon={actionInfo.icon}
      title={`${actionInfo.label} Memória`}
      subtitle={resolvedMemoryName}
      selected={selected}
      themeColor="fuchsia"
      footer={
        <div className="space-y-1">
          {action === 'save' && itemCount > 0 && (
            <NodeInfoLine>
              📦 {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </NodeInfoLine>
          )}
          {memoryConfig?.ttl && action === 'save' && (
            <NodeInfoLine>⏰ TTL: {memoryConfig.ttl}s</NodeInfoLine>
          )}
          {resolvedDefaultValue && action === 'fetch' && (
            <NodeInfoLine className="truncate">
              📝 Padrão: {resolvedDefaultValue}
            </NodeInfoLine>
          )}
        </div>
      }
    />
  );
});

MemoryNode.displayName = 'MemoryNode';
