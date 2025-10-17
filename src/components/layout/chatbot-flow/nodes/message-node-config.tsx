'use client';

import React, { useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { MessageConfig, MessageType } from '../../../layout/chatbot-flow/types';
import { Typography } from '@/components/ui/typography';
import { useUser } from '@/hooks/use-user';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { messageConfigSchema } from './message-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { InstanceProps } from '@/contexts/user/user-context.type';
import { sendMessage } from '@/actions/uazapi/message';
import { FormSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface MessageNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: MessageConfig;
  onSave: (config: MessageConfig) => void;
}

const messageTypes: { value: MessageType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'media', label: 'Mídia' },
  { value: 'contact', label: 'Contato' },
  { value: 'location', label: 'Localização' },
  { value: 'interactive_menu', label: 'Menu Interativo' },
];

function MessageFormFields({
  instances,
  config,
}: {
  instances: InstanceProps[];
  config?: MessageConfig;
}) {
  const { form, setValue } = useForm();
  const messageType = (form.messageType as MessageType) || 'text';

  useEffect(() => {
    if (config) {
      setValue('token', config.token || '');
      setValue('phoneNumber', config.phoneNumber || '');
      setValue('messageType', config.messageType || 'text');
      setValue('text', config.text || '');
      setValue('mediaUrl', config.mediaUrl || '');
      setValue('caption', config.caption || '');
      setValue('contactName', config.contactName || '');
      setValue('contactPhone', config.contactPhone || '');
      setValue('latitude', config.latitude?.toString() || '');
      setValue('longitude', config.longitude?.toString() || '');
    }
  }, [config, setValue]);

  return (
    <>
      {/* Instância */}
      <div className="p-1">
        <FormControl variant="label">Instância</FormControl>
        <FormSelect
          fieldName="token"
          placeholder="Selecione uma instância"
          options={instances.map((instance) => ({
            value: instance.token,
            label: instance.name || instance.profileName || instance.id,
          }))}
          className="w-full"
        />
      </div>

      {/* Número de Celular */}
      <div className="p-1">
        <FormControl variant="label">Número do Celular</FormControl>
        <Input type="tel" fieldName="phoneNumber" placeholder="5511999999999" />
      </div>

      {/* Tipo de Mensagem */}
      <div className="p-1">
        <FormControl variant="label">Tipo de Mensagem</FormControl>
        <FormSelect
          fieldName="messageType"
          placeholder="Selecione o tipo"
          options={messageTypes}
          className="w-full"
        />
      </div>

      {/* Campos específicos por tipo */}
      {messageType === 'text' && (
        <div className="p-1">
          <FormControl variant="label">Mensagem</FormControl>
          <Textarea
            fieldName="text"
            placeholder="Digite a mensagem que será enviada..."
            rows={6}
          />
          <Typography variant="p" className="mt-1 text-xs text-gray-500">
            Você pode usar variáveis como {'{nome}'}, {'{email}'}, etc.
          </Typography>
        </div>
      )}

      {messageType === 'media' && (
        <div className="space-y-3">
          <div className="p-1">
            <FormControl variant="label">URL da Mídia</FormControl>
            <Input
              type="url"
              fieldName="mediaUrl"
              placeholder="https://exemplo.com/imagem.jpg"
            />
          </div>
          <div className="p-1">
            <FormControl variant="label">Legenda (opcional)</FormControl>
            <Textarea
              fieldName="caption"
              placeholder="Legenda da mídia..."
              rows={3}
            />
          </div>
        </div>
      )}

      {messageType === 'contact' && (
        <div className="space-y-3">
          <div>
            <FormControl variant="label">Nome do Contato</FormControl>
            <Input
              type="text"
              fieldName="contactName"
              placeholder="João Silva"
            />
          </div>
          <div>
            <FormControl variant="label">Telefone do Contato</FormControl>
            <Input
              type="tel"
              fieldName="contactPhone"
              placeholder="5511999999999"
            />
          </div>
        </div>
      )}

      {messageType === 'location' && (
        <div className="space-y-3">
          <div>
            <FormControl variant="label">Latitude</FormControl>
            <Input type="text" fieldName="latitude" placeholder="-23.550520" />
          </div>
          <div>
            <FormControl variant="label">Longitude</FormControl>
            <Input type="text" fieldName="longitude" placeholder="-46.633308" />
          </div>
        </div>
      )}

      {messageType === 'interactive_menu' && (
        <div>
          <FormControl variant="label">Menu Interativo</FormControl>
          <Typography variant="p" className="text-gray-500">
            Configuração de menu interativo em desenvolvimento
          </Typography>
        </div>
      )}

      <SubmitButton variant="gradient" className="mt-4">
        Salvar Configuração
      </SubmitButton>
    </>
  );
}

export function MessageNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
}: MessageNodeConfigProps) {
  const { instances } = useUser();

  const handleSubmit = async (data: FieldValues) => {
    const messageConfig: MessageConfig = {
      token: data.token,
      phoneNumber: data.phoneNumber,
      messageType: data.messageType as MessageType,
      text: data.text,
      mediaUrl: data.mediaUrl,
      caption: data.caption,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      latitude: data.latitude ? parseFloat(data.latitude) : undefined,
      longitude: data.longitude ? parseFloat(data.longitude) : undefined,
    };
    onSave(messageConfig);
    onClose();
  };

  const handleSendMessage = async () => {
    const response = await sendMessage({
      token: instances[0].token,
      formData: {
        number: '5519971302477',
        text: 'Olá! Como posso ajudar?',
      },
    });
    console.log(response);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="max-w-lg overflow-hidden"
    >
      <div className="p-6 flex flex-col h-full" style={{ zoom: 0.9 }}>
        <Typography variant="h2" className="mb-6">
          Configurar Mensagem
        </Typography>

        <Form
          className="flex flex-col gap-4 flex-1 overflow-y-auto"
          zodSchema={messageConfigSchema}
          onSubmit={handleSubmit}
        >
          <MessageFormFields instances={instances} config={config} />
        </Form>
      </div>
    </Dialog>
  );
}
