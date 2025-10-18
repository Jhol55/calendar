'use client';

import React, { useEffect, useState } from 'react';
import { Typography } from '@/components/ui/typography';
import { WebhookConfig, HttpMethod } from '../../types';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { webhookConfigSchema } from './webhook-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { FormSelect } from '@/components/ui/select';
import { useUser } from '@/hooks/use-user';
import { NodeConfigLayout } from '../node-config-layout';
import { getInstanceWebhook } from '@/actions/uazapi/instance';

interface WebhookNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: WebhookConfig;
  onSave: (config: WebhookConfig) => void;
  nodeId?: string;
  flowId?: string;
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function WebhookFormFields({
  config,
  webhookId,
}: {
  config?: WebhookConfig;
  webhookId: string;
}) {
  const { form, setValue } = useForm();
  const { instances } = useUser();
  const [selectedMethods, setSelectedMethods] = useState<HttpMethod[]>([
    'POST',
  ]);

  const serviceType = form.serviceType as 'manual' | 'whatsapp' | undefined;
  const authenticationType =
    (form.authenticationType as 'none' | 'basic' | 'bearer') || 'none';

  useEffect(() => {
    // Usar setTimeout para garantir que o formulário esteja pronto
    const timer = setTimeout(() => {
      if (config) {
        if (config.serviceType) {
          setValue('serviceType', config.serviceType);
        }

        if (config.instanceToken) {
          setValue('instanceToken', config.instanceToken);
        }

        setValue('webhookId', config.webhookId || webhookId);
        setValue('authenticationType', config.authentication?.type || 'none');
        setValue('authUsername', config.authentication?.username || '');
        setValue('authPassword', config.authentication?.password || '');
        setValue('authToken', config.authentication?.token || '');

        if (config.methods && config.methods.length > 0) {
          setSelectedMethods(config.methods);
          setValue('methods', config.methods);
        }
      } else {
        // Nova configuração - não definir serviceType inicialmente
        setValue('webhookId', webhookId);
        setValue('methods', ['POST']);
        setValue('authenticationType', 'none');
        setSelectedMethods(['POST']);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [config, webhookId, setValue]);

  const toggleMethod = (method: HttpMethod) => {
    const newMethods = selectedMethods.includes(method)
      ? selectedMethods.filter((m) => m !== method)
      : [...selectedMethods, method];

    setSelectedMethods(newMethods);
    setValue('methods', newMethods);
  };

  return (
    <>
      {/* Service Type */}
      <div className="p-1">
        <FormControl variant="label">Tipo de Serviço</FormControl>
        <FormSelect
          fieldName="serviceType"
          placeholder="Selecione o tipo de serviço"
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'whatsapp', label: 'WhatsApp' },
          ]}
          className="w-full"
        />
        {serviceType && (
          <Typography variant="p" className="text-xs text-gray-500 mt-1">
            {serviceType === 'manual'
              ? 'Webhook personalizado com URL própria'
              : 'Usar webhook da instância WhatsApp'}
          </Typography>
        )}
      </div>

      {/* WhatsApp Instance Selection */}
      {serviceType === 'whatsapp' && (
        <div className="p-1">
          <FormControl variant="label">Instância WhatsApp</FormControl>
          <FormSelect
            fieldName="instanceToken"
            placeholder="Selecione uma instância"
            options={instances.map((instance) => ({
              value: instance.token,
              label: instance.name || instance.profileName || instance.token,
            }))}
            className="w-full"
          />
          <Typography variant="p" className="text-xs text-gray-500 mt-1">
            O webhook da instância será usado automaticamente
          </Typography>
        </div>
      )}

      {/* Manual Webhook Config */}
      {serviceType === 'manual' && (
        <>
          {/* HTTP Methods */}
          <div className="p-1">
            <FormControl variant="label">Métodos HTTP Permitidos</FormControl>
            <div className="flex flex-wrap gap-2 mt-2">
              {HTTP_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => toggleMethod(method)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors ${
                    selectedMethods.includes(method)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
            {selectedMethods.length === 0 && (
              <Typography variant="p" className="text-xs text-red-500 mt-1">
                Selecione pelo menos um método HTTP
              </Typography>
            )}
          </div>

          {/* Authentication Type */}
          <div className="p-1">
            <FormControl variant="label">Autenticação</FormControl>
            <FormSelect
              fieldName="authenticationType"
              placeholder="Selecione o tipo de autenticação"
              options={[
                { value: 'none', label: 'Sem autenticação' },
                { value: 'basic', label: 'Basic Auth' },
                { value: 'bearer', label: 'Bearer Token' },
              ]}
              className="w-full"
            />
          </div>

          {/* Basic Auth */}
          {authenticationType === 'basic' && (
            <div className="space-y-3 border-l-4 border-blue-500 pl-4">
              <div className="p-1">
                <FormControl variant="label">Username</FormControl>
                <Input
                  type="text"
                  fieldName="authUsername"
                  placeholder="username"
                />
              </div>
              <div className="p-1">
                <FormControl variant="label">Password</FormControl>
                <Input
                  type="password"
                  fieldName="authPassword"
                  placeholder="password"
                />
              </div>
            </div>
          )}

          {/* Bearer Token */}
          {authenticationType === 'bearer' && (
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="p-1">
                <FormControl variant="label">Bearer Token</FormControl>
                <Input
                  type="text"
                  fieldName="authToken"
                  placeholder="seu-token-aqui"
                />
              </div>
            </div>
          )}

          {/* Webhook URL Preview */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
            <Typography
              variant="p"
              className="block mb-2 text-sm font-semibold text-blue-900"
            >
              URL do Webhook
            </Typography>
            <div className="bg-white p-3 rounded border border-blue-200 break-all font-mono text-sm text-blue-900">
              {typeof window !== 'undefined' &&
                `${window.location.origin}/api/webhooks/${webhookId}`}
            </div>
          </div>
        </>
      )}

      <SubmitButton variant="gradient" className="mt-4">
        Salvar Configuração
      </SubmitButton>
    </>
  );
}

export function WebhookNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
  nodeId,
  flowId,
}: WebhookNodeConfigProps) {
  const [webhookId, setWebhookId] = useState(() => {
    // Se já tem config, usar o webhookId existente
    if (config?.webhookId) {
      return config.webhookId;
    }
    // Se não tem config, gerar um novo (apenas para manual)
    return `wh_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  });

  // Atualizar webhookId quando config mudar
  useEffect(() => {
    if (config?.webhookId) {
      setWebhookId(config.webhookId);
    }
  }, [config]);

  const handleSubmit = async (data: FieldValues) => {
    let finalWebhookId: string;

    if (data.serviceType === 'whatsapp' && data.instanceToken) {
      // Para WhatsApp, buscar o webhook real da instância no banco PostgreSQL
      try {
        const result = await getInstanceWebhook(data.instanceToken);

        if (result.success && result.data && (result.data as any).webhook) {
          // Usar o webhook real da instância
          finalWebhookId = (result.data as any).webhook;
          console.log('✅ Using instance webhook:', finalWebhookId);
        } else {
          // Fallback: usar o token da instância
          finalWebhookId = data.instanceToken;
          console.log('⚠️ Using token as fallback:', finalWebhookId);
        }
      } catch (error) {
        console.error('Error fetching instance webhook:', error);
        finalWebhookId = data.instanceToken;
      }
    } else {
      // Para Manual, usar o webhookId gerado
      finalWebhookId = data.webhookId || webhookId;
    }

    const webhookConfig: WebhookConfig = {
      serviceType: data.serviceType as 'manual' | 'whatsapp',
      instanceToken: data.instanceToken,
      webhookId: finalWebhookId,
      methods:
        data.serviceType === 'manual'
          ? (data.methods as HttpMethod[])
          : undefined,
      authentication:
        data.serviceType === 'manual'
          ? {
              type: data.authenticationType as 'none' | 'basic' | 'bearer',
              username: data.authUsername,
              password: data.authPassword,
              token: data.authToken,
            }
          : undefined,
    };
    onSave(webhookConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Configurar Webhook"
      nodeId={nodeId}
      flowId={flowId}
    >
      <Form
        key={`${isOpen}-${config?.webhookId || 'new'}-${webhookId}`}
        className="flex flex-col gap-4"
        zodSchema={webhookConfigSchema}
        onSubmit={handleSubmit}
      >
        <WebhookFormFields config={config} webhookId={webhookId} />
      </Form>
    </NodeConfigLayout>
  );
}
