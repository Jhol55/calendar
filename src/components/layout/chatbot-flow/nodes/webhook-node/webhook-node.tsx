import React, { memo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { Webhook, Copy, CheckCircle } from 'lucide-react';
import { NodeData } from '../../types';
import { Typography } from '@/components/ui/typography';
import { useUser } from '@/hooks/use-user';
import { BaseNode, NodeBadgeList } from '../base-node';

function WebhookNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const [copied, setCopied] = useState(false);
  const webhookConfig = data.webhookConfig;
  const { user } = useUser();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getWebhookUrl = () => {
    if (
      webhookConfig?.serviceType === 'whatsapp' &&
      webhookConfig?.instanceToken
    ) {
      return null;
    }

    if (webhookConfig?.webhookId && user?.id) {
      const baseUrl =
        typeof window !== 'undefined' ? window.location.origin : '';
      return `${baseUrl}/api/webhooks/${user.id}/${webhookConfig.webhookId}`;
    }

    return 'Configure o webhook...';
  };

  const getServiceBadge = () => {
    if (!webhookConfig?.serviceType) return undefined;
    return webhookConfig.serviceType === 'manual' ? 'Manual' : 'WhatsApp';
  };

  return (
    <BaseNode
      icon={<Webhook className="w-4 h-4" />}
      title="Webhook"
      badge={getServiceBadge()}
      selected={selected}
      themeColor="green"
      handles={{ input: false, outputs: [{}] }}
      minWidth={280}
      maxWidth={320}
    >
      {/* Methods badges */}
      {webhookConfig?.methods && webhookConfig.methods.length > 0 && (
        <div className="mb-3">
          <NodeBadgeList items={webhookConfig.methods} themeColor="green" />
        </div>
      )}

      {/* URL para Manual */}
      {webhookConfig?.serviceType === 'manual' && (
        <div className="bg-gray-50 p-2 rounded border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <Typography variant="span" className="text-xs text-gray-700">
              URL:
            </Typography>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const url = getWebhookUrl();
                if (url) copyToClipboard(url);
              }}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Copiar URL"
            >
              {copied ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <Typography
            variant="span"
            className="text-xs text-gray-600 break-all font-mono bg-white p-1.5 rounded block"
          >
            {getWebhookUrl()}
          </Typography>
        </div>
      )}

      {/* Para WhatsApp */}
      {webhookConfig?.serviceType === 'whatsapp' && (
        <Typography
          variant="p"
          className="text-xs text-gray-500 italic text-center"
        >
          Webhook da instância será usado automaticamente
        </Typography>
      )}

      {/* Não configurado */}
      {!webhookConfig && (
        <Typography
          variant="p"
          className="text-xs text-gray-500 text-center italic"
        >
          Duplo clique para configurar
        </Typography>
      )}
    </BaseNode>
  );
}

export const WebhookNode = memo(WebhookNodeComponent);
WebhookNode.displayName = 'WebhookNode';
