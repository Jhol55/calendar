import React, { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { MessageSquare } from 'lucide-react';
import { NodeData } from '../../types';
import { BaseNode, NodePreview } from '../base-node';
import { useVariableContext, resolveVariable } from '../use-variable-context';

function MessageNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const messageConfig = data.messageConfig;
  const context = useVariableContext();

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

  // Resolver variáveis no preview
  const resolvedPreview = useMemo(() => {
    if (!messageConfig) return 'Duplo clique para configurar...';

    switch (messageConfig.messageType) {
      case 'text':
        const resolvedText = resolveVariable(messageConfig.text, context);
        return resolvedText || 'Digite a mensagem...';

      case 'media':
        const mediaLabel = getMediaTypeLabel(messageConfig.mediaType);
        const resolvedDocName = resolveVariable(messageConfig.docName, context);
        const resolvedMediaUrl = resolveVariable(
          messageConfig.mediaUrl,
          context,
        );
        const fileName = resolvedDocName || 'arquivo';
        return resolvedMediaUrl
          ? `${mediaLabel}: ${fileName}`
          : 'Configure a mídia...';

      case 'contact':
        const resolvedContactName = resolveVariable(
          messageConfig.contactName,
          context,
        );
        if (!resolvedContactName) return 'Configure o contato...';

        const contactInfo = [];
        contactInfo.push(`👤 ${resolvedContactName}`);

        const resolvedPhone = resolveVariable(
          messageConfig.contactPhone,
          context,
        );
        if (resolvedPhone) {
          contactInfo.push(`📱 ${resolvedPhone}`);
        }

        const resolvedOrg = resolveVariable(
          messageConfig.contactOrganization,
          context,
        );
        if (resolvedOrg) {
          contactInfo.push(`🏢 ${resolvedOrg}`);
        }
        return contactInfo.join('\n');

      case 'location':
        const resolvedLat = resolveVariable(messageConfig.latitude, context);
        const resolvedLng = resolveVariable(messageConfig.longitude, context);
        return resolvedLat && resolvedLng
          ? `📍 ${resolvedLat}, ${resolvedLng}`
          : 'Configure a localização...';

      case 'interactive_menu':
        return 'Menu interativo';

      default:
        return 'Duplo clique para configurar...';
    }
  }, [messageConfig, context]);

  return (
    <BaseNode
      icon={<MessageSquare className="w-4 h-4" />}
      title="Enviar Mensagem"
      badge={messageConfig ? getMessageTypeLabel() : undefined}
      selected={selected}
      themeColor="blue"
      preview={<NodePreview>{resolvedPreview}</NodePreview>}
    />
  );
}

export const MessageNode = memo(MessageNodeComponent);
