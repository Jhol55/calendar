import React, { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { Globe } from 'lucide-react';
import { NodeData } from '../../types';
import { BaseNode, NodePreview } from '../base-node';
import { cn } from '@/lib/utils';
import { useVariableContext, resolveVariable } from '../use-variable-context';

function HttpRequestNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const httpConfig = data.httpRequestConfig;
  const context = useVariableContext();

  const getMethodBadge = (method?: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-green-100 text-green-700',
      POST: 'bg-blue-100 text-blue-700',
      PUT: 'bg-yellow-100 text-yellow-700',
      DELETE: 'bg-red-100 text-red-700',
      PATCH: 'bg-purple-100 text-purple-700',
    };
    return (
      <span
        className={cn(
          'px-2 py-0.5 rounded text-xs font-semibold',
          colors[method || ''] || 'bg-neutral-100 text-neutral-700',
        )}
      >
        {method || 'GET'}
      </span>
    );
  };

  const resolvedPreview = useMemo(() => {
    if (!httpConfig) return 'Duplo clique para configurar...';

    const resolvedUrl = resolveVariable(httpConfig.url, context);

    if (resolvedUrl) {
      try {
        const url = new URL(resolvedUrl);
        return url.hostname || resolvedUrl;
      } catch {
        return resolvedUrl;
      }
    }

    return 'Configure a URL da requisição...';
  }, [httpConfig, context]);

  return (
    <BaseNode
      icon={<Globe className="w-4 h-4" />}
      title="HTTP Request"
      selected={selected}
      themeColor="orange"
    >
      {/* Method Badge */}
      {httpConfig && (
        <div className="mb-2">{getMethodBadge(httpConfig.method)}</div>
      )}

      {/* Preview */}
      <NodePreview>{resolvedPreview}</NodePreview>
    </BaseNode>
  );
}

export const HttpRequestNode = memo(HttpRequestNodeComponent);
