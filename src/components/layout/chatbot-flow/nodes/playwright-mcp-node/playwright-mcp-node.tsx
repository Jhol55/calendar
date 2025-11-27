import React, { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { Globe2 } from 'lucide-react';
import { NodeData } from '../../types';
import { BaseNode, NodePreview } from '../base-node';
import { useVariableContext, resolveVariable } from '../use-variable-context';

function PlaywrightMcpNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const config = data.playwrightMcpConfig as
    | {
        goal?: string;
        startUrl?: string;
        mode?: 'autonomous' | 'guided' | 'hybrid';
      }
    | undefined;

  const context = useVariableContext();

  const getModeLabel = () => {
    if (!config?.mode) return 'Autônomo';
    const map: Record<string, string> = {
      autonomous: 'Autônomo',
      guided: 'Guiado',
      hybrid: 'Híbrido',
    };
    return map[config.mode] || 'Autônomo';
  };

  const resolvedPreview = useMemo(() => {
    if (!config) return 'Duplo clique para configurar...';

    const lines = [];
    const resolvedGoal = resolveVariable(config.goal, context);
    const resolvedUrl = resolveVariable(config.startUrl, context);

    if (resolvedGoal) lines.push(resolvedGoal);
    if (resolvedUrl) lines.push(`🌐 ${resolvedUrl}`);

    return lines.join('\n') || 'Duplo clique para configurar...';
  }, [config, context]);

  return (
    <BaseNode
      icon={<Globe2 className="w-4 h-4" />}
      title="Playwright MCP"
      badge={getModeLabel()}
      selected={selected}
      themeColor="green"
      minWidth={260}
      maxWidth={320}
      preview={
        <NodePreview className="whitespace-pre-line">
          {resolvedPreview}
        </NodePreview>
      }
    />
  );
}

export const PlaywrightMcpNode = memo(PlaywrightMcpNodeComponent);
