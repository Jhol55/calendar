'use client';

import React, { useEffect, useState } from 'react';
import { Typography } from '@/components/ui/typography';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { httpRequestConfigSchema } from './http-request-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { FormSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { NodeConfigLayout } from '../node-config-layout';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MemoryConfigSection } from '../memory-config-section';
import { MemoryItem } from '../../types';

interface HttpRequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  bodyType?: 'json' | 'text' | 'form';
  timeout?: number;
  followRedirects?: boolean;
  validateSSL?: boolean;
  memoryConfig?: {
    action: 'save' | 'fetch' | 'delete';
    memoryName: string;
    items?: MemoryItem[];
    ttl?: number;
    defaultValue?: string;
    saveMode?: 'overwrite' | 'append';
  };
}

interface HttpRequestNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: HttpRequestConfig;
  onSave: (config: HttpRequestConfig) => void;
  nodeId?: string;
  flowId?: string;
  nodeLabel?: string;
  onNodeLabelChange?: (label: string) => void;
}

const httpMethods = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
];

const bodyTypes = [
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Texto' },
  { value: 'form', label: 'Form Data' },
];

function HttpRequestFormFields({
  config,
  headers,
  setHeaders,
  memoryItems,
  setMemoryItems,
}: {
  config?: HttpRequestConfig;
  headers: Array<{ key: string; value: string }>;
  setHeaders: React.Dispatch<
    React.SetStateAction<Array<{ key: string; value: string }>>
  >;
  memoryItems: MemoryItem[];
  setMemoryItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
}) {
  const { form, setValue } = useForm();
  const method = (form.method as string) || 'GET';

  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        setValue('url', config.url || '');
        setValue('method', config.method || 'GET');
        setValue('bodyType', config.bodyType || 'json');
        setValue('body', config.body || '');
        setValue('timeout', config.timeout?.toString() || '');
        setValue('followRedirects', config.followRedirects || false);
        setValue('validateSSL', config.validateSSL !== false); // Padrão: true

        // Carregar headers
        if (config.headers && config.headers.length > 0) {
          setHeaders(config.headers);
          setValue('headers', JSON.stringify(config.headers));
        }

        // Carregar configuração de memória
        if (config.memoryConfig) {
          setValue('memoryAction', config.memoryConfig.action || 'save');
          setValue('memoryName', config.memoryConfig.memoryName || '');
          setValue(
            'memorySaveMode',
            config.memoryConfig.saveMode || 'overwrite',
          );
          setValue(
            'memoryDefaultValue',
            config.memoryConfig.defaultValue || '',
          );

          // Carregar items de memória
          if (
            config.memoryConfig.items &&
            config.memoryConfig.items.length > 0
          ) {
            setMemoryItems(config.memoryConfig.items);
            setValue('memoryItems', config.memoryConfig.items);
          }

          // Carregar TTL
          if (config.memoryConfig.ttl) {
            const ttlString = String(config.memoryConfig.ttl);
            const ttlPresets = ['3600', '86400', '604800', '2592000'];
            if (ttlPresets.includes(ttlString)) {
              setValue('memoryTtlPreset', ttlString);
            } else {
              setValue('memoryTtlPreset', 'custom');
              setValue('memoryCustomTtl', ttlString);
            }
          } else {
            setValue('memoryTtlPreset', 'never');
          }
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [config, setValue, setHeaders, setMemoryItems]);

  // Atualizar headers no formulário quando mudar
  useEffect(() => {
    setValue('headers', JSON.stringify(headers));
  }, [headers, setValue]);

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    if (headers.length > 1) {
      setHeaders(headers.filter((_, i) => i !== index));
    }
  };

  const updateHeader = (
    index: number,
    field: 'key' | 'value',
    value: string,
  ) => {
    const newHeaders = [...headers];
    newHeaders[index] = {
      ...newHeaders[index],
      [field]: value,
    };
    setHeaders(newHeaders);
  };

  return (
    <>
      {/* Método HTTP */}
      <div className="p-1">
        <FormControl variant="label">Método HTTP *</FormControl>
        <FormSelect
          fieldName="method"
          placeholder="Selecione o método"
          options={httpMethods}
          className="w-full"
        />
      </div>

      {/* URL */}
      <div className="p-1">
        <FormControl variant="label">URL *</FormControl>
        <Input
          type="url"
          fieldName="url"
          placeholder="https://api.exemplo.com/endpoint"
        />
        <Typography variant="span" className="text-xs text-neutral-600 mt-1">
          Você pode usar variáveis:{' '}
          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
            {'{{$node.input.campo}}'}
          </code>
        </Typography>
      </div>

      {/* Headers */}
      <div className="p-1 relative mt-6">
        <div className="flex items-center justify-between mb-2">
          <FormControl variant="label">Headers (opcional)</FormControl>
          <Button
            type="button"
            onClick={addHeader}
            variant="gradient"
            className="gap-1 text-sm w-fit absolute right-0 -top-4"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
        </div>

        <div className="space-y-3">
          {headers.map((header, index) => (
            <div
              key={index}
              className="flex gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 items-center"
            >
              <div className="flex-1 space-y-2">
                <Input
                  type="text"
                  fieldName={`header_key_${index}`}
                  placeholder="Chave (ex: Authorization)"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                />
                <Input
                  type="text"
                  fieldName={`header_value_${index}`}
                  placeholder="Valor (ex: Bearer {{$node.input.token}})"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                />
              </div>
              {headers.length > 1 && (
                <Button
                  type="button"
                  onClick={() => removeHeader(index)}
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Typography variant="span" className="text-xs text-neutral-600 mt-2">
          Você pode usar variáveis nos headers:{' '}
          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
            {'{{$node.input.token}}'}
          </code>
        </Typography>
      </div>

      {/* Body (apenas para POST, PUT, PATCH) */}
      {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
        <div className="border-t pt-4 mt-4">
          <Typography variant="h5" className="font-semibold mb-3">
            📦 Corpo da Requisição
          </Typography>

          {/* Tipo do Body */}
          <div className="p-1">
            <FormControl variant="label">Tipo do Corpo</FormControl>
            <FormSelect
              fieldName="bodyType"
              placeholder="Selecione o tipo"
              options={bodyTypes}
              className="w-full"
            />
          </div>

          {/* Body Content */}
          <div className="p-1">
            <FormControl variant="label">Conteúdo</FormControl>
            <Textarea
              fieldName="body"
              placeholder={
                form.bodyType === 'json'
                  ? '{"campo": "valor", "outro": "{{$node.input.variavel}}"}'
                  : form.bodyType === 'form'
                    ? 'campo1=valor1&campo2={{$node.input.valor}}'
                    : 'Texto livre...'
              }
              rows={6}
            />
            <Typography
              variant="span"
              className="text-xs text-neutral-600 mt-1"
            >
              Você pode usar variáveis no corpo:{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                {'{{$node.input.campo}}'}
              </code>
            </Typography>
          </div>
        </div>
      )}

      {/* Opções Avançadas */}
      <div className="border-t pt-4 mt-4">
        <Typography variant="h5" className="font-semibold mb-3">
          ⚙️ Opções Avançadas
        </Typography>

        {/* Timeout */}
        <div className="p-1">
          <FormControl variant="label">
            <Typography variant="span" className="text-sm">
              Timeout (opcional)
            </Typography>
          </FormControl>
          <Input type="number" fieldName="timeout" placeholder="30000" />
          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Tempo máximo em milissegundos (padrão: 30000)
          </Typography>
        </div>

        {/* Checkboxes */}
        <div className="space-y-2 p-3 bg-neutral-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              fieldName="followRedirects"
              onChange={(e) => setValue('followRedirects', e.target.checked)}
              className="bg-neutral-200"
            />
            <FormControl variant="label" className="text-sm cursor-pointer">
              Seguir redirecionamentos (301, 302)
            </FormControl>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              fieldName="validateSSL"
              onChange={(e) => setValue('validateSSL', e.target.checked)}
              className="bg-neutral-200"
            />
            <FormControl variant="label" className="text-sm cursor-pointer">
              Validar certificado SSL
            </FormControl>
          </div>
        </div>
      </div>

      {/* Seção de Configuração de Memória */}
      <MemoryConfigSection
        memoryItems={memoryItems}
        setMemoryItems={setMemoryItems}
        form={form}
        setValue={setValue}
      />

      <SubmitButton
        variant="gradient"
        className="absolute top-2 right-12 w-fit mt-4"
      >
        Salvar Configuração
      </SubmitButton>
    </>
  );
}

export function HttpRequestNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
  nodeId,
  flowId,
  nodeLabel,
  onNodeLabelChange,
}: HttpRequestNodeConfigProps) {
  const [headers, setHeaders] = useState<Array<{ key: string; value: string }>>(
    [{ key: '', value: '' }],
  );

  // Estados para configuração de memória
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([
    { key: '', value: '' },
  ]);

  // Carregar headers quando config mudar
  useEffect(() => {
    if (config?.headers && config.headers.length > 0) {
      setHeaders(config.headers);
    } else {
      setHeaders([{ key: '', value: '' }]);
    }
  }, [config]);

  // Carregar configuração de memória quando config mudar
  useEffect(() => {
    if (config?.memoryConfig?.items && config.memoryConfig.items.length > 0) {
      setMemoryItems(config.memoryConfig.items);
    } else {
      setMemoryItems([{ key: '', value: '' }]);
    }
  }, [config]);

  const handleSubmit = async (data: FieldValues) => {
    // Filtrar headers vazios
    const filteredHeaders = headers.filter(
      (h) => h.key.trim() !== '' || h.value.trim() !== '',
    );

    const httpRequestConfig: HttpRequestConfig = {
      url: data.url,
      method: data.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
      headers: filteredHeaders.length > 0 ? filteredHeaders : undefined,
      body: data.body || undefined,
      bodyType: data.bodyType || undefined,
      timeout: data.timeout ? parseInt(data.timeout) : undefined,
      followRedirects: data.followRedirects || undefined,
      validateSSL: data.validateSSL !== false, // Padrão: true
    };

    // Se configuração de memória estiver preenchida, adicionar ao httpRequestConfig
    if (data.memoryName && data.memoryAction && data.memoryAction !== '') {
      // Processar TTL baseado no preset selecionado
      let ttl: number | undefined = undefined;
      if (data.memoryTtlPreset && data.memoryTtlPreset !== 'never') {
        if (data.memoryTtlPreset === 'custom') {
          ttl = data.memoryCustomTtl ? Number(data.memoryCustomTtl) : undefined;
        } else {
          ttl = Number(data.memoryTtlPreset);
        }
      }

      httpRequestConfig.memoryConfig = {
        action: data.memoryAction as 'save' | 'fetch' | 'delete',
        memoryName: data.memoryName,
        items:
          data.memoryAction === 'save'
            ? (data.memoryItems as MemoryItem[])
            : undefined,
        ttl: ttl,
        defaultValue: data.memoryDefaultValue,
        saveMode:
          data.memoryAction === 'save'
            ? (data.memorySaveMode as 'overwrite' | 'append')
            : undefined,
      };
    }

    onSave(httpRequestConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="🌐 Configurar HTTP Request"
      nodeId={nodeId}
      flowId={flowId}
      nodeLabel={nodeLabel}
      onNodeLabelChange={onNodeLabelChange}
    >
      <Form
        className="flex flex-col gap-4"
        zodSchema={httpRequestConfigSchema}
        onSubmit={handleSubmit}
      >
        <HttpRequestFormFields
          config={config}
          headers={headers}
          setHeaders={setHeaders}
          memoryItems={memoryItems}
          setMemoryItems={setMemoryItems}
        />
      </Form>
    </NodeConfigLayout>
  );
}
