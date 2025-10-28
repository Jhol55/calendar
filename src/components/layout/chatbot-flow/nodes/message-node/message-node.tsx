import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { MessageSquare, Settings } from 'lucide-react';
import { NodeData } from '../../types';
import { Typography } from '@/components/ui/typography';

function MessageNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const messageConfig = data.messageConfig;

  const getMessageTypeLabel = () => {
    const types: Record<string, string> = {
      text: 'Texto',
      media: 'Mídia',
      contact: 'Contato',
      location: 'Localização',
      interactive_menu: 'Menu',
    };
    return messageConfig?.messageType
      ? types[messageConfig.messageType]
      : 'Texto';
  };

  const getMediaTypeLabel = (mediaType?: string) => {
    const types: Record<string, string> = {
      image: '🖼️ Imagem',
      video: '🎥 Vídeo',
      document: '📄 Documento',
      audio: '🎵 Áudio',
      myaudio: '🎤 Mensagem de Voz',
      ptt: '🎙️ PTT',
      sticker: '😄 Sticker',
    };
    return mediaType ? types[mediaType] || 'Mídia' : 'Mídia';
  };

  const getPreviewContent = () => {
    if (!messageConfig) return 'Duplo clique para configurar...';

    switch (messageConfig.messageType) {
      case 'text':
        return messageConfig.text || 'Digite a mensagem...';
      case 'media':
        const mediaLabel = getMediaTypeLabel(messageConfig.mediaType);
        const fileName = messageConfig.docName || 'arquivo';
        return messageConfig.mediaUrl
          ? `${mediaLabel}: ${fileName}`
          : 'Configure a mídia...';
      case 'contact':
        return messageConfig.contactName || 'Configure o contato...';
      case 'location':
        return messageConfig.latitude && messageConfig.longitude
          ? `${messageConfig.latitude}, ${messageConfig.longitude}`
          : 'Configure a localização...';
      case 'interactive_menu':
        return 'Menu interativo';
      default:
        return 'Duplo clique para configurar...';
    }
  };

  return (
    <div
      className={`bg-white rounded-lg border-2 shadow-lg min-w-[250px] max-w-[300px] ${
        selected ? 'border-blue-500' : 'border-gray-300'
      }`}
    >
      <Handle type="target" position={Position.Left} className="w-3 h-3" />

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            <Typography variant="h3" className="font-semibold text-sm">
              Enviar Mensagem
            </Typography>
          </div>
          <Settings className="w-4 h-4 text-gray-400" />
        </div>

        {messageConfig && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-neutral-100 text-blue-600 rounded">
              {getMessageTypeLabel()}
            </span>
          </div>
        )}

        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded line-clamp-3">
          {getPreviewContent()}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="w-3 h-3" />
    </div>
  );
}

export const MessageNode = memo(MessageNodeComponent);
