import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap } from 'lucide-react';
import { NodeData } from '../../../../features/forms/chatbot-flow/types';

export function ActionNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-lg min-w-[200px] ${
        selected ? 'border-orange-500' : 'border-gray-300'
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3" />

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-sm">Ação</h3>
        </div>

        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
          {data.actions?.length
            ? `${data.actions.length} ação(ões)`
            : 'Configurar ações...'}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3" />
    </div>
  );
}
