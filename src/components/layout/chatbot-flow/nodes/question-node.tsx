import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { HelpCircle } from 'lucide-react';
import { NodeData } from '../../../../features/forms/chatbot-flow/types';

export function QuestionNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-lg min-w-[200px] ${
        selected ? 'border-purple-500' : 'border-gray-300'
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3" />

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold text-sm">Pergunta</h3>
        </div>

        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
          {data.content || 'Digite a pergunta...'}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3" />
    </div>
  );
}
