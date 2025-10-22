import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Bot } from 'lucide-react';

const AgentNode = ({ data, selected }: NodeProps) => {
  const config = data?.agentConfig;
  const model = config?.model || 'gpt-4';
  const hasTools = config?.enableTools && config?.tools?.length > 0;

  return (
    <div
      className={`px-4 py-3 shadow-lg rounded-lg border-2 bg-white min-w-[180px] transition-all ${
        selected
          ? 'border-purple-500 shadow-purple-200'
          : 'border-purple-300 hover:border-purple-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-purple-500"
      />

      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-gray-800">AI Agent</div>
          <div className="text-xs text-gray-500">{model}</div>
        </div>
      </div>

      {config && (
        <div className="space-y-1 text-xs text-gray-600">
          {config.enableHistory && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>History ({config.historyLength || 10})</span>
            </div>
          )}
          {hasTools && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              <span>Tools ({config.tools?.length || 0})</span>
            </div>
          )}
          {config.saveResponseTo && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-400"></span>
              <span className="truncate">→ {config.saveResponseTo}</span>
            </div>
          )}
        </div>
      )}

      {!config && (
        <div className="text-xs text-gray-400 italic">
          Clique duas vezes para configurar
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-purple-500"
      />
    </div>
  );
};

export default memo(AgentNode);
