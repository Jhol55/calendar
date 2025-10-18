'use client';

import React, { useEffect, useState } from 'react';
import {
  MessageConfig,
  MessageType,
  InteractiveMenuType,
} from '../../../layout/chatbot-flow/types';
import { Typography } from '@/components/ui/typography';
import { useUser } from '@/hooks/use-user';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { messageConfigSchema } from './message-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { InstanceProps } from '@/contexts/user/user-context.type';
// import { sendMessage } from '@/actions/uazapi/message';
import { FormSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { NodeConfigLayout } from './node-config-layout';
import { Plus, Trash2 } from 'lucide-react';

interface MessageNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: MessageConfig;
  onSave: (config: MessageConfig) => void;
  nodeId?: string;
  flowId?: string;
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
  const interactiveMenuType =
    (form.interactiveMenuType as InteractiveMenuType) || 'button';

  // Gerenciar choices do menu interativo como objetos estruturados
  interface Choice {
    id: string;
    text: string;
    description: string;
  }
  const [choices, setChoices] = useState<Choice[]>([
    { id: '', text: '', description: '' },
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
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

        // Carregar configuração de menu interativo
        if (config.interactiveMenu) {
          setValue('interactiveMenuType', config.interactiveMenu.type);
          setValue('interactiveMenuText', config.interactiveMenu.text);
          setValue(
            'interactiveMenuFooter',
            config.interactiveMenu.footerText || '',
          );
          setValue(
            'interactiveMenuListButton',
            config.interactiveMenu.listButton || '',
          );
          setValue(
            'interactiveMenuImageButton',
            config.interactiveMenu.imageButton || '',
          );
          setValue(
            'interactiveMenuSelectableCount',
            config.interactiveMenu.selectableCount?.toString() || '1',
          );

          // Converter strings com pipe de volta para objetos
          const parsedChoices = (config.interactiveMenu.choices || []).map(
            (choice) => {
              if (!choice || typeof choice !== 'string') {
                return { id: '', text: '', description: '' };
              }
              const parts = choice.split('|');
              return {
                text: parts[0] || '',
                id: parts[1] || '',
                description: parts[2] || '',
              };
            },
          );
          setChoices(
            parsedChoices.length > 0
              ? parsedChoices
              : [{ id: '', text: '', description: '' }],
          );

          setValue(
            'interactiveMenuChoices',
            JSON.stringify(config.interactiveMenu.choices || ['']),
          );
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [config, setValue]);

  // Atualizar choices no formulário quando mudar (converter para strings com pipe)
  useEffect(() => {
    // Converter objetos para strings no formato "texto|id|descrição"
    const choicesStrings = choices
      .map((choice) => {
        // Se não tiver texto, não incluir essa opção
        if (!choice.text || choice.text.trim() === '') return '';

        // Montar string: texto|id|descrição
        // Sempre incluir os pipes, mesmo se id ou descrição estiverem vazios
        return `${choice.text}|${choice.id || ''}|${choice.description || ''}`;
      })
      .filter((str) => str !== ''); // Remover strings vazias

    setValue('interactiveMenuChoices', JSON.stringify(choicesStrings));
  }, [choices, setValue]);

  const addChoice = () => {
    setChoices([...choices, { id: '', text: '', description: '' }]);
  };

  const removeChoice = (index: number) => {
    if (choices.length > 1) {
      setChoices(choices.filter((_, i) => i !== index));
    }
  };

  const updateChoice = (
    index: number,
    field: 'id' | 'text' | 'description',
    value: string,
  ) => {
    const newChoices = [...choices];
    newChoices[index] = {
      ...newChoices[index],
      [field]: value,
    };
    setChoices(newChoices);
  };

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
        <div className="space-y-4 border-t pt-4">
          <Typography variant="h5" className="font-semibold">
            Configuração de Menu Interativo
          </Typography>

          {/* Tipo de Menu */}
          <div className="p-1">
            <FormControl variant="label">Tipo de Menu *</FormControl>
            <FormSelect
              fieldName="interactiveMenuType"
              placeholder="Selecione o tipo"
              options={[
                { value: 'button', label: 'Botões' },
                { value: 'list', label: 'Lista' },
                { value: 'poll', label: 'Enquete' },
                { value: 'carousel', label: 'Carrossel' },
              ]}
              className="w-full"
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              {interactiveMenuType === 'button' &&
                'Cria botões de resposta, URL, chamada ou cópia'}
              {interactiveMenuType === 'list' &&
                'Cria um menu organizado em seções'}
              {interactiveMenuType === 'poll' &&
                'Cria uma enquete para votação'}
              {interactiveMenuType === 'carousel' &&
                'Cria um carrossel de cartões com imagens'}
            </Typography>
          </div>

          {/* Texto Principal */}
          <div className="p-1">
            <FormControl variant="label">Texto Principal *</FormControl>
            <Textarea
              fieldName="interactiveMenuText"
              placeholder="Digite o texto da mensagem..."
              rows={3}
            />
          </div>

          {/* Choices */}
          <div className="p-1">
            <FormControl variant="label">
              Opções *{' '}
              <Typography
                variant="span"
                className="text-xs text-gray-500 font-normal"
              >
                {interactiveMenuType === 'button' &&
                  '- Configure botões com ações'}
                {interactiveMenuType === 'list' &&
                  '- Use [Seção] no texto para criar seções'}
                {interactiveMenuType === 'poll' &&
                  '- Configure as opções de votação'}
                {interactiveMenuType === 'carousel' &&
                  '- Use [Título] no texto, {URL} no ID para imagens'}
              </Typography>
            </FormControl>
            <div className="space-y-3 mt-2">
              {choices.map((choice, index) => (
                <div
                  key={index}
                  className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Typography
                      variant="span"
                      className="text-sm font-medium text-gray-700"
                    >
                      Opção {index + 1}
                    </Typography>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeChoice(index)}
                      disabled={choices.length === 1}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Texto *
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName={`choice_text_${index}`}
                      value={choice.text}
                      onChange={(e) =>
                        updateChoice(index, 'text', e.target.value)
                      }
                      placeholder={
                        interactiveMenuType === 'button'
                          ? 'Ex: Suporte Técnico'
                          : interactiveMenuType === 'list'
                            ? 'Ex: Smartphones ou [Eletrônicos]'
                            : interactiveMenuType === 'carousel'
                              ? 'Ex: [Produto XYZ]'
                              : 'Ex: Manhã (8h-12h)'
                      }
                    />
                  </div>

                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Identificador
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName={`choice_id_${index}`}
                      value={choice.id}
                      onChange={(e) =>
                        updateChoice(index, 'id', e.target.value)
                      }
                      placeholder={
                        interactiveMenuType === 'button'
                          ? 'Ex: suporte ou https://... ou call:+5511...'
                          : interactiveMenuType === 'list'
                            ? 'Ex: phones'
                            : interactiveMenuType === 'carousel'
                              ? 'Ex: {https://img.jpg} ou copy:PROMO'
                              : 'Deixe vazio para enquetes'
                      }
                    />
                  </div>

                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Descrição{' '}
                        <Typography
                          variant="span"
                          className="text-xs text-gray-500 font-normal"
                        >
                          (opcional)
                        </Typography>
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName={`choice_description_${index}`}
                      value={choice.description}
                      onChange={(e) =>
                        updateChoice(index, 'description', e.target.value)
                      }
                      placeholder={
                        interactiveMenuType === 'list'
                          ? 'Ex: Últimos lançamentos'
                          : 'Descrição adicional (opcional)'
                      }
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="gradient"
                onClick={addChoice}
                className="w-full gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Opção
              </Button>
            </div>
          </div>

          {/* Campos Opcionais baseados no tipo */}
          {(interactiveMenuType === 'button' ||
            interactiveMenuType === 'list') && (
            <div className="p-1">
              <FormControl variant="label">
                Texto do Rodapé (opcional)
              </FormControl>
              <Input
                type="text"
                fieldName="interactiveMenuFooter"
                placeholder="Texto exibido no rodapé..."
              />
            </div>
          )}

          {interactiveMenuType === 'list' && (
            <div className="p-1">
              <FormControl variant="label">
                Texto do Botão da Lista *
              </FormControl>
              <Input
                type="text"
                fieldName="interactiveMenuListButton"
                placeholder="Ex: Ver opções"
              />
            </div>
          )}

          {interactiveMenuType === 'button' && (
            <div className="p-1">
              <FormControl variant="label">
                URL da Imagem (opcional)
              </FormControl>
              <Input
                type="url"
                fieldName="interactiveMenuImageButton"
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </div>
          )}

          {interactiveMenuType === 'poll' && (
            <div className="p-1">
              <FormControl variant="label">Opções Selecionáveis</FormControl>
              <Input
                type="number"
                fieldName="interactiveMenuSelectableCount"
                placeholder="1"
                min="1"
              />
              <Typography variant="span" className="text-xs text-gray-500 mt-1">
                Quantas opções o usuário pode selecionar
              </Typography>
            </div>
          )}
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
  nodeId,
  flowId,
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

    // Se for menu interativo, adicionar configuração
    if (data.messageType === 'interactive_menu') {
      const choices = data.interactiveMenuChoices
        ? JSON.parse(data.interactiveMenuChoices)
        : [];

      messageConfig.interactiveMenu = {
        type: data.interactiveMenuType as InteractiveMenuType,
        text: data.interactiveMenuText,
        choices: choices.filter((c: string) => c.trim() !== ''),
        footerText: data.interactiveMenuFooter || undefined,
        listButton: data.interactiveMenuListButton || undefined,
        imageButton: data.interactiveMenuImageButton || undefined,
        selectableCount: data.interactiveMenuSelectableCount
          ? parseInt(data.interactiveMenuSelectableCount)
          : undefined,
      };
    }

    onSave(messageConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Configurar Mensagem"
      nodeId={nodeId}
      flowId={flowId}
    >
      <Form
        className="flex flex-col gap-4"
        zodSchema={messageConfigSchema}
        onSubmit={handleSubmit}
      >
        <MessageFormFields instances={instances} config={config} />
      </Form>
    </NodeConfigLayout>
  );
}
