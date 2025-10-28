import { memo, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../../types';
import { Brain, Save, Search, Trash2 } from 'lucide-react';
import { Typography } from '@/components/ui/typography';
import { replaceVariables } from '@/workers/helpers/variable-replacer';

export const MemoryNode = memo(({ data }: NodeProps<NodeData>) => {
  const memoryConfig = data.memoryConfig;
  const action = memoryConfig?.action || 'save';
  const itemCount = memoryConfig?.items?.length || 0;

  // Construir contexto de variáveis para resolução (buscar do sessionStorage)
  const variableContext = (() => {
    const baseContext: Record<string, unknown> = {};

    // Buscar dados de execução do sessionStorage (mesma lógica do flow-editor)
    if (typeof window === 'undefined') return baseContext;

    const selectedExecutionStr = sessionStorage.getItem('selectedExecution');
    if (!selectedExecutionStr) {
      return baseContext;
    }

    try {
      const selectedExecution = JSON.parse(selectedExecutionStr);
      const nodeExecutions = selectedExecution.nodeExecutions;

      if (nodeExecutions) {
        const $nodes: Record<string, { output: unknown }> = {};
        Object.keys(nodeExecutions).forEach((nodeId) => {
          const nodeExec = nodeExecutions[nodeId];
          if (nodeExec?.result) {
            $nodes[nodeId] = {
              output: nodeExec.result,
            };
          } else if (nodeExec?.data) {
            $nodes[nodeId] = {
              output: nodeExec.data,
            };
          }
        });

        const webhookData =
          selectedExecution.data || selectedExecution.triggerData;

        return {
          ...baseContext,
          $nodes,
          $node: {
            input: webhookData,
          },
          ...(webhookData && typeof webhookData === 'object'
            ? webhookData
            : {}),
        };
      }
    } catch (error) {
      console.error('Erro ao buscar execução do sessionStorage:', error);
    }

    return baseContext;
  })();

  // Resolver variáveis dinâmicas no memoryName (seguindo mesma lógica do Input)
  const resolvedMemoryName = useMemo(() => {
    const rawName = memoryConfig?.memoryName || 'memória';

    // Se não contém variáveis, retornar original
    if (!rawName.includes('{{')) {
      return rawName;
    }

    try {
      const resolved = replaceVariables(rawName, variableContext);

      // Verificar se a variável foi resolvida (seguindo lógica do Input)
      const wasResolved =
        resolved !== rawName && !String(resolved).includes('{{');

      if (wasResolved) {
        // Se é objeto, stringificar
        return typeof resolved === 'object'
          ? JSON.stringify(resolved)
          : String(resolved);
      }

      // Se não foi resolvida, retornar original
      return rawName;
    } catch (error) {
      console.error('Erro ao resolver variável no memoryName:', error);
      return rawName;
    }
  }, [memoryConfig?.memoryName, variableContext]);

  const resolvedDefaultValue = useMemo(() => {
    const rawValue = memoryConfig?.defaultValue;
    if (!rawValue) return undefined;

    // Se não contém variáveis, retornar original
    if (!rawValue.includes('{{')) {
      return rawValue;
    }

    try {
      const resolved = replaceVariables(rawValue, variableContext);

      // Verificar se a variável foi resolvida (seguindo lógica do Input)
      const wasResolved =
        resolved !== rawValue && !String(resolved).includes('{{');

      if (wasResolved) {
        // Se é objeto, stringificar
        return typeof resolved === 'object'
          ? JSON.stringify(resolved)
          : String(resolved);
      }

      // Se não foi resolvida, retornar original
      return rawValue;
    } catch (error) {
      console.error('Erro ao resolver variável no defaultValue:', error);
      return rawValue;
    }
  }, [memoryConfig?.defaultValue, variableContext]);

  // Cores e ícones por ação
  const getActionStyle = () => {
    switch (action) {
      case 'save':
        return {
          bgColor: 'bg-fuchsia-500',
          borderColor: 'border-fuchsia-600',
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
      className={`px-4 py-3 shadow-lg rounded-lg border ${style.borderColor} bg-white min-w-[200px] max-w-[300px]`}
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
              className="px-2 py-1 bg-neutral-100 text-fuchsia-600 rounded font-mono text-xs truncate block"
            >
              {resolvedMemoryName}
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

      {resolvedDefaultValue && action === 'fetch' && (
        <Typography
          variant="span"
          className="mt-2 text-xs text-gray-600 truncate block"
        >
          📝 Padrão: {resolvedDefaultValue}
        </Typography>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
});

MemoryNode.displayName = 'MemoryNode';
