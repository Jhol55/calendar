import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Globe2, Settings } from 'lucide-react';
import { NodeData } from '../../types';
import { Typography } from '@/components/ui/typography';

function PlaywrightMcpNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const config = data.playwrightMcpConfig as
    | {
        goal?: string;
        startUrl?: string;
        mode?: 'autonomous' | 'guided' | 'hybrid';
      }
    | undefined;

  const getModeLabel = () => {
    if (!config?.mode) return 'Autônomo';
    const map: Record<string, string> = {
      autonomous: 'Autônomo',
      guided: 'Guiado',
      hybrid: 'Híbrido',
    };
    return map[config.mode] || 'Autônomo';
  };

  const getPreview = () => {
    if (!config) return 'Duplo clique para configurar...';
    const lines = [];
    if (config.goal) lines.push(config.goal);
    if (config.startUrl) lines.push(`URL inicial: ${config.startUrl}`);
    return lines.join('\n') || 'Duplo clique para configurar...';
  };

  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-lg min-w-[260px] max-w-[320px] ${
        selected ? 'border-emerald-500' : 'border-gray-300'
      }`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-emerald-500" />
            <Typography variant="h3" className="font-semibold text-sm">
              Playwright MCP
            </Typography>
          </div>
          <Settings className="w-4 h-4 text-gray-400" />
        </div>

        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-neutral-100 text-emerald-600 rounded">
            {getModeLabel()}
          </span>
        </div>

        <div className="text-xs text-gray-600 bg-gray-50/40 p-2 rounded line-clamp-3 whitespace-pre-line">
          {getPreview()}
        </div>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const PlaywrightMcpNode = memo(PlaywrightMcpNodeComponent);
