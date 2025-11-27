import { memo, useMemo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../../types';
import { Repeat, ArrowRightCircle, CheckCircle2 } from 'lucide-react';
import { Typography } from '@/components/ui/typography';
import { cn } from '@/lib/utils';
import { nodeThemes } from '../node-theme';
import { NodeInfoLine } from '../base-node';
import { useVariableContext, resolveVariable } from '../use-variable-context';

export const LoopNode = memo(({ data, selected }: NodeProps<NodeData>) => {
  const loopConfig = data.loopConfig;
  const mode = loopConfig?.mode || 'each';
  const batchSize = loopConfig?.batchSize || 1;
  const theme = nodeThemes['rose'];
  const context = useVariableContext();

  const resolvedOutputVariable = useMemo(
    () => resolveVariable(loopConfig?.outputVariable, context),
    [loopConfig?.outputVariable, context],
  );

  return (
    <div
      className={cn(
        'bg-white rounded-lg border-2 shadow-lg transition-all duration-200 min-w-[220px] max-w-[300px]',
        selected ? theme.borderSelected : theme.border,
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ background: theme.handleColor }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className={cn('p-2 rounded-lg', theme.iconBg, theme.iconText)}>
            <Repeat className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <Typography
              variant="h3"
              className="font-semibold text-sm text-gray-800"
            >
              Loop
            </Typography>
            <Typography variant="span" className="text-xs text-gray-500 block">
              {mode === 'each'
                ? 'Processar 1 por vez'
                : `Lotes de ${batchSize}`}
            </Typography>
          </div>
        </div>

        {/* Informações do loop */}
        {loopConfig && (
          <div className="space-y-1 mb-3">
            {resolvedOutputVariable && (
              <NodeInfoLine className="truncate">
                📦 Variável: {resolvedOutputVariable}
              </NodeInfoLine>
            )}
            {loopConfig.maxIterations && (
              <NodeInfoLine>
                🔢 Máx: {loopConfig.maxIterations} iterações
              </NodeInfoLine>
            )}
            {loopConfig.accumulateResults && (
              <span
                className={cn(
                  'inline-block px-2 py-0.5 rounded text-xs font-medium',
                  theme.badgeBg,
                  theme.badgeText,
                )}
              >
                ✅ Acumulando resultados
              </span>
            )}
          </div>
        )}

        {/* Handles de saída com labels */}
        <div className="space-y-2">
          {/* Handle LOOP */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
              <ArrowRightCircle className="w-3 h-3" />
              <span>Loop</span>
            </div>
          </div>

          {/* Handle DONE */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
              <CheckCircle2 className="w-3 h-3" />
              <span>Done</span>
            </div>
          </div>
        </div>
      </div>

      {/* Handles posicionados */}
      <Handle
        type="source"
        position={Position.Right}
        id="loop"
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ top: '60%', background: '#3b82f6' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="done"
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ top: '80%', background: '#22c55e' }}
      />
    </div>
  );
});

LoopNode.displayName = 'LoopNode';
