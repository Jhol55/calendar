import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Webhook, Settings, Copy, CheckCircle } from 'lucide-react';
import { NodeData } from '../types';
import { useState } from 'react';
import { Typography } from '@/components/ui/typography/typography';
import { cn } from '@/lib/utils';

export function WebhookNode({ data, selected }: NodeProps<NodeData>) {
  const [copied, setCopied] = useState(false);
  const webhookConfig = data.webhookConfig;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getWebhookUrl = () => {
    // Se for WhatsApp, buscar webhook da instância (será implementado)
    if (
      webhookConfig?.serviceType === 'whatsapp' &&
      webhookConfig?.instanceToken
    ) {
      return `Webhook da instância ${webhookConfig.instanceToken.substring(0, 8)}...`;
    }

    // Se for Manual, usar webhookId
    if (webhookConfig?.webhookUrl) {
      return webhookConfig.webhookUrl;
    }
    if (webhookConfig?.webhookId) {
      const baseUrl =
        typeof window !== 'undefined' ? window.location.origin : '';
      return `${baseUrl}/api/webhooks/${webhookConfig.webhookId}`;
    }
    return 'Configure o webhook...';
  };

  return (
    <div
      className={cn(
        'bg-white rounded-lg border-2 shadow-lg min-w-[280px] max-w-[320px]',
        selected ? 'border-green-500' : 'border-gray-300',
      )}
    >
      {/* Webhook não tem entrada - apenas recebe requisições HTTP e dispara o fluxo */}

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-green-500" />
            <Typography variant="h5" className="text-sm">
              Webhook
            </Typography>
          </div>
          <Settings className="w-4 h-4 text-gray-400" />
        </div>

        {webhookConfig && (
          <>
            {webhookConfig.serviceType && (
              <div className="mb-2">
                <Typography
                  variant="span"
                  className="px-2 py-0.5 bg-neutral-50 text-green-400 rounded text-xs"
                >
                  {webhookConfig.serviceType === 'manual'
                    ? 'Manual'
                    : 'WhatsApp'}
                </Typography>
              </div>
            )}

            {webhookConfig.methods && webhookConfig.methods.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1">
                {webhookConfig.methods.map((method) => (
                  <Typography
                    key={method}
                    variant="span"
                    className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs"
                  >
                    {method}
                  </Typography>
                ))}
              </div>
            )}
          </>
        )}

        {/* Só mostrar URL se for Manual ou não tiver serviceType definido */}
        {(!webhookConfig?.serviceType ||
          webhookConfig.serviceType === 'manual') && (
          <div className="mt-3 bg-gray-50 p-2 rounded border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <Typography variant="span" className="text-xs text-gray-700">
                URL:
              </Typography>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(getWebhookUrl());
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

        {!webhookConfig && (
          <Typography
            variant="p"
            className="text-xs text-gray-500 text-center mt-2 italic"
          >
            Duplo clique para configurar
          </Typography>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3" />
    </div>
  );
}
