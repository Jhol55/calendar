import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Globe, Settings } from 'lucide-react';
import { NodeData } from '../../types';
import { Typography } from '@/components/ui/typography';

function HttpRequestNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const httpConfig = data.httpRequestConfig;

  const getMethodColor = (method?: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-100 text-green-700';
      case 'POST':
        return 'bg-blue-100 text-blue-700';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-700';
      case 'DELETE':
        return 'bg-red-100 text-red-700';
      case 'PATCH':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-neutral-100 text-neutral-700';
    }
  };

  const getPreviewContent = () => {
    if (!httpConfig) return 'Duplo clique para configurar...';

    if (httpConfig.url) {
      // Tentar extrair o domínio da URL
      try {
        const url = new URL(httpConfig.url);
        return url.hostname || httpConfig.url;
      } catch {
        return httpConfig.url;
      }
    }

    return 'Configure a URL da requisição...';
  };

  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-lg min-w-[250px] max-w-[300px] ${
        selected ? 'border-blue-500' : 'border-gray-300'
      }`}
    >
      <Handle type="target" position={Position.Left} />

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-teal-500" />
            <Typography variant="h3" className="font-semibold text-sm">
              HTTP Request
            </Typography>
          </div>
          <Settings className="w-4 h-4 text-gray-400" />
        </div>

        {httpConfig && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span
              className={`px-2 py-1 rounded font-semibold ${getMethodColor(httpConfig.method)}`}
            >
              {httpConfig.method || 'GET'}
            </span>
          </div>
        )}

        <div className="text-xs text-gray-600 bg-gray-50/40 p-2 rounded line-clamp-3">
          {getPreviewContent()}
        </div>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const HttpRequestNode = memo(HttpRequestNodeComponent);
