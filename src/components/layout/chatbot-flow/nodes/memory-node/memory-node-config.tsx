'use client';

import React, { useEffect, useState } from 'react';
import { Typography } from '@/components/ui/typography';
import { MemoryConfig, MemoryItem } from '../../types';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { memoryConfigSchema } from './memory-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { FormSelect } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { NodeConfigLayout } from '../node-config-layout';
import { Plus, Trash2 } from 'lucide-react';

interface MemoryNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: MemoryConfig;
  onSave: (config: MemoryConfig) => void;
  nodeId?: string;
  flowId?: string;
  nodeLabel?: string;
  onNodeLabelChange?: (label: string) => void;
}

const actionOptions = [
  { value: 'save', label: 'Salvar' },
  { value: 'fetch', label: 'Buscar' },
  { value: 'delete', label: 'Deletar' },
];

const ttlPresets = [
  { value: 'never', label: 'Nunca expira' },
  { value: '3600', label: '1 hora' },
  { value: '86400', label: '1 dia' },
  { value: '604800', label: '7 dias' },
  { value: '2592000', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

function MemoryFormFields({
  config,
  items,
  setItems,
}: {
  config?: MemoryConfig;
  items: MemoryItem[];
  setItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
}) {
  const { form, setValue, errors } = useForm();
  const action = (form.action as 'save' | 'fetch' | 'delete') || 'save';
  const ttlPreset = (form.ttlPreset as string) || 'never';
  const saveMode = (form.saveMode as 'overwrite' | 'append') || 'overwrite';

  // Sincronizar items com o formulário
  useEffect(() => {
    items.forEach((item, index) => {
      setValue(`item_key_${index}`, item.key);
      setValue(`item_value_${index}`, item.value);
    });
  }, [items, setValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        setValue('action', config.action || 'save');
        setValue('memoryName', config.memoryName || '');
        setValue('defaultValue', config.defaultValue || '');
        setValue('saveMode', config.saveMode || 'overwrite');

        // Sincronizar items com o formulário APENAS quando config mudar
        if (config.items && config.items.length > 0) {
          setValue('items', config.items);
        }

        // Definir preset de TTL
        if (config.ttl) {
          const ttlString = String(config.ttl);
          const preset = ttlPresets.find((p) => p.value === ttlString);
          if (preset) {
            setValue('ttlPreset', preset.value);
          } else {
            setValue('ttlPreset', 'custom');
            setValue('customTtl', ttlString);
          }
        } else {
          setValue('ttlPreset', 'never');
        }
      } else {
        // Se não tem config, setar items inicial
        setValue('items', items);
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, setValue]);

  const addItem = () => {
    const newItems = [...items, { key: '', value: '' }];
    setItems(newItems);
    setValue('items', newItems);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    setValue('items', newItems);
  };

  const updateItem = (index: number, field: 'key' | 'value', val: string) => {
    const newItems = [...items];
    newItems[index][field] = val;
    setItems(newItems);
    setValue('items', newItems);
  };

  return (
    <>
      {/* Ação */}
      <div className="p-1">
        <FormControl variant="label">Ação *</FormControl>
        <FormSelect
          fieldName="action"
          placeholder="Selecione a ação"
          options={actionOptions}
          className="w-full"
        />
      </div>

      {/* Nome da Memória */}
      <div className="p-1">
        <FormControl variant="label">Identificador Único *</FormControl>
        <Input
          type="text"
          fieldName="memoryName"
          placeholder="Ex: dadosCliente, informacoesPedido"
        />
      </div>

      {/* Modo de Salvamento - Apenas para SALVAR */}
      {action === 'save' && (
        <div className="p-1">
          <FormControl variant="label">Modo de Salvamento *</FormControl>
          <FormSelect
            fieldName="saveMode"
            placeholder="Selecione o modo"
            options={[
              {
                value: 'overwrite',
                label: 'Sobrescrever - Substitui o valor existente',
              },
              {
                value: 'append',
                label: 'Adicionar à Lista - Adiciona à lista existente',
              },
            ]}
            className="w-full"
          />
          <Typography variant="span" className="text-xs text-gray-500 mt-1">
            {saveMode === 'overwrite'
              ? 'O valor será substituído completamente'
              : 'O valor será adicionado como um novo item na lista'}
          </Typography>
        </div>
      )}

      {/* Items (Chave/Valor) - Apenas para SALVAR */}
      {action === 'save' && (
        <div className="p-1 relative mt-6">
          <div className="flex items-center justify-between mb-2">
            <FormControl variant="label">Pares Chave/Valor *</FormControl>
            <Button
              type="button"
              onClick={addItem}
              variant="gradient"
              className="gap-1 text-sm w-fit absolute right-0 -top-4"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="flex gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 items-center"
              >
                <div className="flex-1 space-y-2">
                  <Input
                    type="text"
                    fieldName={`item_key_${index}`}
                    placeholder="Chave (ex: etapa, nome)"
                    onChange={(e) => updateItem(index, 'key', e.target.value)}
                  />
                  <Input
                    type="text"
                    fieldName={`item_value_${index}`}
                    placeholder="Valor ou variável: {{$node.input.campo}}"
                    onChange={(e) => updateItem(index, 'value', e.target.value)}
                  />
                </div>
                {items.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeItem(index)}
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
            Você pode usar variáveis dinâmicas no valor:{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              {'{{$node.input.campo}}'}
            </code>
            ,{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              {'{{$nodes.nodeId.output.campo}}'}
            </code>
          </Typography>

          {errors?.items && (
            <Typography variant="span" className="text-xs text-red-500 mt-1">
              {String(errors.items)}
            </Typography>
          )}
        </div>
      )}

      {/* TTL - Apenas para SALVAR */}
      {action === 'save' && (
        <div className="p-1">
          <FormControl variant="label">Tempo de Expiração (TTL)</FormControl>
          <FormSelect
            fieldName="ttlPreset"
            placeholder="Selecione o tempo"
            options={ttlPresets}
            className="w-full"
          />

          {ttlPreset === 'custom' && (
            <div className="mt-2">
              <Input
                type="number"
                fieldName="customTtl"
                placeholder="Tempo em segundos"
              />
            </div>
          )}

          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Tempo até a memória expirar (deixe em branco para nunca expirar)
          </Typography>
        </div>
      )}

      {/* Valor Padrão - Apenas para BUSCAR */}
      {action === 'fetch' && (
        <div className="p-1">
          <FormControl variant="label">Valor Padrão (Opcional)</FormControl>
          <Input
            type="text"
            fieldName="defaultValue"
            placeholder="Valor retornado se memória não existir"
          />
          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Retornado quando a memória não é encontrada ou está expirada
          </Typography>
        </div>
      )}

      <SubmitButton variant="gradient" className="mt-4">
        Salvar Configuração
      </SubmitButton>
    </>
  );
}

export function MemoryNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
  nodeId,
  flowId,
  nodeLabel,
  onNodeLabelChange,
}: MemoryNodeConfigProps) {
  const [items, setItems] = useState<MemoryItem[]>([{ key: '', value: '' }]);

  // Carregar items quando config mudar
  useEffect(() => {
    if (config?.items && config.items.length > 0) {
      setItems(config.items);
    } else {
      setItems([{ key: '', value: '' }]);
    }
  }, [config]);

  // Sincronizar items com o formulário - será feito dentro do MemoryFormFields

  const handleSubmit = async (data: FieldValues) => {
    // Processar TTL baseado no preset selecionado
    let ttl: number | undefined = undefined;
    if (data.ttlPreset && data.ttlPreset !== 'never') {
      if (data.ttlPreset === 'custom') {
        ttl = data.customTtl ? Number(data.customTtl) : undefined;
      } else {
        ttl = Number(data.ttlPreset);
      }
    }

    const memoryConfig: MemoryConfig = {
      action: data.action as 'save' | 'fetch' | 'delete',
      memoryName: data.memoryName,
      // Items apenas para action "save"
      items: data.action === 'save' ? (data.items as MemoryItem[]) : undefined,
      ttl: ttl,
      defaultValue: data.defaultValue,
      saveMode:
        data.action === 'save'
          ? (data.saveMode as 'overwrite' | 'append')
          : undefined,
    };

    onSave(memoryConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="🧠 Configurar Memória"
      nodeId={nodeId}
      flowId={flowId}
      nodeLabel={nodeLabel}
      onNodeLabelChange={onNodeLabelChange}
    >
      <Form
        key={`${isOpen}-${config?.memoryName || 'novo'}`}
        className="flex flex-col gap-4"
        zodSchema={memoryConfigSchema}
        onSubmit={handleSubmit}
      >
        <MemoryFormFields config={config} items={items} setItems={setItems} />
      </Form>
    </NodeConfigLayout>
  );
}
