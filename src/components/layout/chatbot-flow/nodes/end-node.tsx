import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Square } from 'lucide-react';
import { NodeData } from '../../../../features/forms/chatbot-flow/types';

function EndNodeComponent({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`bg-red-500 rounded-full p-4 shadow-lg ${
        selected ? 'ring-4 ring-red-300' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3" />

      <div className="flex flex-col items-center gap-1 text-white">
        <Square className="w-6 h-6" fill="white" />
        <span className="text-xs font-semibold">Fim</span>
      </div>
    </div>
  );
}

export const EndNode = memo(EndNodeComponent);
