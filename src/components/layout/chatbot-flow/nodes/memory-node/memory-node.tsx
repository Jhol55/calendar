import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../../types';
import { Brain, Save, Search, Trash2 } from 'lucide-react';
import { Typography } from '@/components/ui/typography';

export const MemoryNode = memo(({ data }: NodeProps<NodeData>) => {
  const memoryConfig = data.memoryConfig;
  const action = memoryConfig?.action || 'save';
  const memoryName = memoryConfig?.memoryName || 'memória';
  const itemCount = memoryConfig?.items?.length || 0;

  // Cores e ícones por ação
  const getActionStyle = () => {
    switch (action) {
      case 'save':
        return {
          bgColor: 'bg-purple-500',
          borderColor: 'border-purple-600',
          icon: <Save className="w-4 h-4" />,
          label: 'Salvar',
        };
      case 'fetch':
        return {
          bgColor: 'bg-blue-500',
          borderColor: 'border-blue-600',
          icon: <Search className="w-4 h-4" />,
          label: 'Buscar',
        };
      case 'delete':
        return {
          bgColor: 'bg-red-500',
          borderColor: 'border-red-600',
          icon: <Trash2 className="w-4 h-4" />,
          label: 'Deletar',
        };
      default:
        return {
          bgColor: 'bg-gray-500',
          borderColor: 'border-gray-600',
          icon: <Brain className="w-4 h-4" />,
          label: 'Memória',
        };
    }
  };

  const style = getActionStyle();

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg border-2 ${style.borderColor} bg-white min-w-[200px] max-w-[300px]`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center gap-2 mb-2">
        <div className={`${style.bgColor} p-2 rounded-lg text-white`}>
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <Typography
            variant="h3"
            className="font-semibold text-sm text-gray-800"
          >
            {style.label} Memória
          </Typography>
          <div className="text-xs text-gray-500 w-full overflow-hidden">
            <Typography
              variant="span"
              className="px-2 py-1 bg-neutral-100 text-purple-600 rounded font-mono text-xs truncate block"
            >
              {memoryName}
            </Typography>
            {action === 'save' && itemCount > 0 && (
              <Typography
                variant="span"
                className="text-xs text-gray-500 mt-1 block"
              >
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </Typography>
            )}
          </div>
        </div>
      </div>

      {/* Informações adicionais */}
      {memoryConfig?.ttl && action === 'save' && (
        <Typography variant="span" className="mt-2 text-xs text-gray-600 block">
          ⏰ TTL: {memoryConfig.ttl}s
        </Typography>
      )}

      {memoryConfig?.defaultValue && action === 'fetch' && (
        <Typography
          variant="span"
          className="mt-2 text-xs text-gray-600 truncate block"
        >
          📝 Padrão: {memoryConfig.defaultValue}
        </Typography>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
});

MemoryNode.displayName = 'MemoryNode';
