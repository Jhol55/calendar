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
import { useInstances } from '@/lib/react-query/hooks/use-user';
import { NodeConfigLayout } from '../node-config-layout';
import { getInstanceWebhook } from '@/actions/uazapi/instance';
import { Copy, CheckCircle } from 'lucide-react';

interface WebhookNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: WebhookConfig;
  onSave: (config: WebhookConfig) => void;
  nodeId?: string;
  flowId?: string;
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// Função para criar slug válido
const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
    .replace(/[\s_-]+/g, '-') // Substitui espaços/underscores por hífen
    .replace(/^-+|-+$/g, ''); // Remove hífens do início/fim
};

// Validação de path do webhook
const validateWebhookPath = (path: string): boolean => {
  // Apenas alfanuméricos, hífens e underscores
  const regex = /^[a-z0-9_-]+$/i;
  return regex.test(path) && path.length >= 3 && path.length <= 50;
};

function WebhookFormFields({
  config,
  webhookId,
  webhookPath,
  setWebhookPath,
  pathError,
  setPathError,
}: {
  config?: WebhookConfig;
  webhookId: string;
  webhookPath: string;
  setWebhookPath: (path: string) => void;
  pathError: string | null;
  setPathError: (error: string | null) => void;
}) {
  const { form, setValue } = useForm();
  const { user } = useUser();
  // Buscar instâncias sob demanda apenas quando este componente for montado
  const { data: instances = [] } = useInstances({
    enabled: true,
  });
  const [selectedMethods, setSelectedMethods] = useState<HttpMethod[]>([
    'POST',
  ]);
  const [copied, setCopied] = useState(false);

  const serviceType = form.serviceType as 'manual' | 'whatsapp' | undefined;
  const authenticationType =
    (form.authenticationType as 'none' | 'basic' | 'bearer') || 'none';

  const copyToClipboard = () => {
    const fullUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/webhooks/${user?.id}/${webhookPath}`
        : `/api/webhooks/${user?.id}/${webhookPath}`;

    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <div className="space-y-3 border-l-4 border-gray-600 pl-4">
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
            <div className="border-l-4 border-gray-600 pl-4">
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

          {/* Webhook URL com Path Editável */}
          <div className="bg-gray-50/40 p-4 rounded-lg border border-gray-200 mt-4">
            <FormControl variant="label">URL do Webhook</FormControl>

            {/* Campo hidden para sincronizar com form */}
            <input type="hidden" name="webhookPath" value={webhookPath} />

            {/* URL Base Fixa + Path Editável + Botão Copiar */}
            <div className="flex items-center gap-2 w-full">
              <div className="flex items-center gap-0 flex-1">
                {/* Base URL (não editável) com userId */}
                <div className="rounded-md rounded-tr-none rounded-br-none border border-gray-300 bg-neutral-100 p-2.5 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#5c5e5d] text-sm">
                  <Typography
                    variant="span"
                    className="text-sm font-mono text-gray-600"
                  >
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/api/webhooks/${user?.id}/`
                      : `/api/webhooks/${user?.id}/`}
                  </Typography>
                </div>

                {/* Path Editável usando componente Input */}
                <div className="flex-1 [&_input]:rounded-l-none [&_input]:border-l-0 [&_input]:font-mono">
                  <Input
                    type="text"
                    fieldName="webhookPathInput"
                    value={webhookPath}
                    onChange={(e) => {
                      const newPath = slugify(e.target.value);
                      setWebhookPath(newPath);

                      if (!validateWebhookPath(newPath)) {
                        setPathError(
                          'Path deve ter 3-50 caracteres (apenas letras, números e hífens)',
                        );
                      } else {
                        setPathError(null);
                      }
                    }}
                    placeholder="meu-webhook-personalizado"
                  />
                </div>
              </div>

              {/* Botão Copiar */}
              <button
                type="button"
                onClick={copyToClipboard}
                className="mx-2 rounded-md hover:bg-neutral-100 transition-colors flex items-center justify-center"
                title="Copiar URL completa"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-600" />
                )}
              </button>
            </div>

            {pathError && (
              <Typography variant="p" className="text-xs text-red-500 mt-2">
                ⚠️ {pathError}
              </Typography>
            )}

            {!pathError && (
              <Typography variant="p" className="text-xs text-gray-600 mt-2">
                ✓ Path válido: <strong>{webhookPath}</strong>
              </Typography>
            )}
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

  // Estado para path editável (apenas Manual)
  const [webhookPath, setWebhookPath] = useState(() => {
    if (config?.webhookId && config.serviceType === 'manual') {
      // Se já tem config manual, usar o webhookId como path
      return config.webhookId;
    }
    // Gerar path aleatório inicial
    return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  });

  const [pathError, setPathError] = useState<string | null>(null);

  // Atualizar webhookId e webhookPath quando config mudar
  useEffect(() => {
    if (config?.webhookId) {
      setWebhookId(config.webhookId);
      if (config.serviceType === 'manual') {
        setWebhookPath(config.webhookId);
      }
    }
  }, [config]);

  const handleSubmit = async (data: FieldValues) => {
    let finalWebhookId: string;

    if (data.serviceType === 'whatsapp' && data.instanceToken) {
      // Para WhatsApp, buscar o webhook real da instância no banco PostgreSQL
      try {
        const result = await getInstanceWebhook(data.instanceToken);

        if (
          result.success &&
          result.data &&
          typeof result.data === 'object' &&
          'webhook' in result.data
        ) {
          // Usar o webhook real da instância
          finalWebhookId = (result.data as { webhook: string }).webhook;
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
      // Para Manual, usar o path customizável (validado)
      if (pathError || !validateWebhookPath(webhookPath)) {
        console.error('Invalid webhook path');
        return; // Não submeter se path inválido
      }

      // IMPORTANTE: garantir que seja apenas o path, sem URL ou userId
      // Se por acaso tiver URL completa, extrair apenas o path final
      let cleanPath = webhookPath;

      // Remover qualquer URL base se existir
      if (cleanPath.includes('/api/webhooks/')) {
        const parts = cleanPath.split('/api/webhooks/');
        if (parts[1]) {
          // Pode ter userId também: userId/path
          const pathParts = parts[1].split('/');
          cleanPath = pathParts[pathParts.length - 1]; // Pegar última parte
        }
      }

      // Remover protocolo e domínio se existir
      if (cleanPath.includes('://')) {
        const urlParts = cleanPath.split('/');
        cleanPath = urlParts[urlParts.length - 1]; // Última parte da URL
      }

      finalWebhookId = cleanPath;
      console.log('✅ Saving webhook with clean path:', finalWebhookId);
    }

    const webhookConfig: WebhookConfig = {
      serviceType: data.serviceType as 'manual' | 'whatsapp',
      instanceToken: data.instanceToken,
      webhookId: finalWebhookId, // Apenas o path limpo
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
        <WebhookFormFields
          config={config}
          webhookId={webhookId}
          webhookPath={webhookPath}
          setWebhookPath={setWebhookPath}
          pathError={pathError}
          setPathError={setPathError}
        />
      </Form>
    </NodeConfigLayout>
  );
}
