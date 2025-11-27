import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nodeThemes } from '../node-theme';
import { Typography } from '@/components/ui/typography';
import { NodeInfoLine } from '../base-node';

const AgentNode = ({ data, selected }: NodeProps) => {
  const config = data?.agentConfig;
  const model = config?.model || 'gpt-4';
  const hasTools = config?.enableTools && config?.tools?.length > 0;
  const theme = nodeThemes['purple'];

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
            <Bot className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <Typography
              variant="h3"
              className="font-semibold text-sm text-gray-800"
            >
              AI Agent
            </Typography>
            <Typography variant="span" className="text-xs text-gray-500 block">
              {model}
            </Typography>
          </div>
        </div>

        {/* Info */}
        {config && (
          <div className="space-y-1">
            {config.enableHistory && (
              <NodeInfoLine>
                <span className="w-2 h-2 rounded-full bg-blue-400 mr-1"></span>
                History ({config.historyLength || 10})
              </NodeInfoLine>
            )}
            {hasTools && (
              <NodeInfoLine>
                <span className="w-2 h-2 rounded-full bg-green-400 mr-1"></span>
                Tools ({config.tools?.length || 0})
              </NodeInfoLine>
            )}
            {config.saveResponseTo && (
              <NodeInfoLine className="truncate">
                <span className="w-2 h-2 rounded-full bg-orange-400 mr-1"></span>
                → {config.saveResponseTo}
              </NodeInfoLine>
            )}
          </div>
        )}

        {!config && (
          <Typography
            variant="span"
            className="text-xs text-gray-400 italic block"
          >
            Duplo clique para configurar
          </Typography>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ background: theme.handleColor }}
      />
    </div>
  );
};

export default memo(AgentNode);
