import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../../types';
import { Repeat, ArrowRightCircle, CheckCircle2 } from 'lucide-react';
import { Typography } from '@/components/ui/typography';

export const LoopNode = memo(({ data }: NodeProps<NodeData>) => {
  const loopConfig = data.loopConfig;
  const mode = loopConfig?.mode || 'each';
  const batchSize = loopConfig?.batchSize || 1;

  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-rose-500 bg-white min-w-[200px] max-w-[300px]">
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center gap-2 mb-2">
        <div className="bg-rose-500 p-2 rounded-lg text-white">
          <Repeat className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <Typography
            variant="h3"
            className="font-semibold text-sm text-gray-800"
          >
            🔁 Loop
          </Typography>
          <Typography variant="span" className="text-xs text-gray-500 block">
            {mode === 'each' ? 'Processar 1 por vez' : `Lotes de ${batchSize}`}
          </Typography>
        </div>
      </div>

      {/* Informações do loop */}
      {loopConfig && (
        <div className="mt-2 space-y-1">
          {loopConfig.outputVariable && (
            <Typography
              variant="span"
              className="text-xs text-gray-600 truncate block"
            >
              📦 Variável: {loopConfig.outputVariable}
            </Typography>
          )}
          {loopConfig.maxIterations && (
            <Typography
              variant="span"
              className="text-xs text-gray-600 truncate block"
            >
              🔢 Máx: {loopConfig.maxIterations} iterações
            </Typography>
          )}
          {loopConfig.accumulateResults && (
            <Typography
              variant="span"
              className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded text-xs font-medium inline-block"
            >
              ✅ Acumulando resultados
            </Typography>
          )}
        </div>
      )}

      {/* Handles de saída com labels */}
      <div className="mt-3 space-y-1.5">
        {/* Handle LOOP - retorna para processar mais */}
        <div className="relative">
          <div className="flex items-center gap-2 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
            <ArrowRightCircle className="w-3 h-3" />
            <span>Loop</span>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id="loop"
            style={{ top: '75%', background: '#2563eb' }}
          />
        </div>

        {/* Handle DONE - finaliza o loop */}
        <div className="relative">
          <div className="flex items-center gap-2 text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
            <CheckCircle2 className="w-3 h-3" />
            <span>Done</span>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id="done"
            style={{ top: '95%', background: '#16a34a' }}
          />
        </div>
      </div>
    </div>
  );
});

LoopNode.displayName = 'LoopNode';
