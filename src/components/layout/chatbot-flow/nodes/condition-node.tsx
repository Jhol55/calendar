import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { NodeData } from '../../../../features/forms/chatbot-flow/types';

export function ConditionNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-lg min-w-[200px] ${
        selected ? 'border-yellow-500' : 'border-gray-300'
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3" />

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <GitBranch className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-sm">Condição</h3>
        </div>

        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mb-2">
          {data.conditions?.length
            ? `${data.conditions.length} condição(ões)`
            : 'Configurar condições...'}
        </div>

        <div className="flex flex-col gap-1 text-xs">
          <div className="text-green-600">→ Sim</div>
          <div className="text-red-600">→ Não</div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className="w-3 h-3 -translate-y-4"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className="w-3 h-3 translate-y-4"
      />
    </div>
  );
}
