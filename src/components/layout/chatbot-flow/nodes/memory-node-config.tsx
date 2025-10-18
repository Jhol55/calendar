'use client';

import React, { useEffect, useState } from 'react';
import { Typography } from '@/components/ui/typography';
import { MemoryConfig } from '../types';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { memoryConfigSchema } from './memory-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { FormSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { NodeConfigLayout } from './node-config-layout';

interface MemoryNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: MemoryConfig;
  onSave: (config: MemoryConfig) => void;
  nodeId?: string;
  flowId?: string;
}

const acaoOptions = [
  { value: 'salvar', label: 'Salvar' },
  { value: 'buscar', label: 'Buscar' },
  { value: 'deletar', label: 'Deletar' },
];

const ttlPresets = [
  { value: 'never', label: 'Nunca expira' },
  { value: '3600', label: '1 hora' },
  { value: '86400', label: '1 dia' },
  { value: '604800', label: '7 dias' },
  { value: '2592000', label: '30 dias' },
  { value: 'custom', label: 'Personalizado' },
];

function MemoryFormFields({ config }: { config?: MemoryConfig }) {
  const { form, setValue, errors } = useForm();
  const acao = (form.acao as 'salvar' | 'buscar' | 'deletar') || 'salvar';
  const [ttlPreset, setTtlPreset] = useState<string>('never');
  const [customTtl, setCustomTtl] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        setValue('acao', config.acao || 'salvar');
        setValue('chave', config.chave || '');
        setValue('valor', config.valor || '');
        setValue('ttl', config.ttl || undefined);
        setValue('valorPadrao', config.valorPadrao || '');

        // Definir preset de TTL
        if (config.ttl) {
          const ttlString = String(config.ttl);
          const preset = ttlPresets.find((p) => p.value === ttlString);
          if (preset) {
            setTtlPreset(preset.value);
          } else {
            setTtlPreset('custom');
            setCustomTtl(ttlString);
          }
        } else {
          setTtlPreset('never');
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [config, setValue]);

  const handleTtlPresetChange = (value: string) => {
    setTtlPreset(value);

    if (value === 'custom') {
      setValue('ttl', customTtl ? Number(customTtl) : undefined);
    } else if (value === 'never') {
      setValue('ttl', undefined);
    } else {
      setValue('ttl', Number(value));
    }
  };

  const handleCustomTtlChange = (value: string) => {
    setCustomTtl(value);
    if (ttlPreset === 'custom') {
      setValue('ttl', value ? Number(value) : undefined);
    }
  };

  return (
    <>
      {/* Ação */}
      <div className="p-1">
        <FormControl variant="label">Ação *</FormControl>
        <FormSelect
          fieldName="acao"
          placeholder="Selecione a ação"
          options={acaoOptions}
          className="w-full"
        />
        <Typography variant="span" className="text-xs text-neutral-600 mt-1">
          {acao === 'salvar' && 'Salvar ou atualizar uma memória'}
          {acao === 'buscar' && 'Recuperar valor de uma memória salva'}
          {acao === 'deletar' && 'Apagar uma memória'}
        </Typography>
      </div>

      {/* Chave */}
      <div className="p-1">
        <FormControl variant="label">Chave (Nome da Memória) *</FormControl>
        <Input
          type="text"
          fieldName="chave"
          placeholder="Ex: nomeCliente, emailCliente, preferencia"
        />
        <Typography variant="span" className="text-xs text-neutral-600 mt-1">
          Identificador único da memória (apenas letras, números, _ e -)
        </Typography>
      </div>

      {/* Valor - Apenas para SALVAR */}
      {acao === 'salvar' && (
        <div className="p-1">
          <FormControl variant="label">Valor *</FormControl>
          <Textarea
            fieldName="valor"
            placeholder="Digite o valor ou use variáveis: {{$node.input.message.text}}"
            rows={4}
          />
          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Você pode usar variáveis dinâmicas:{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              {'{{$node.input.campo}}'}
            </code>
            ,{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              {'{{$nodes.nodeId.output.campo}}'}
            </code>
          </Typography>
        </div>
      )}

      {/* TTL - Apenas para SALVAR */}
      {acao === 'salvar' && (
        <div className="p-1">
          <FormControl variant="label">Tempo de Expiração (TTL)</FormControl>
          <FormSelect
            fieldName="ttlPreset"
            placeholder="Selecione o tempo"
            options={ttlPresets}
            className="w-full mb-2"
            onChange={(e) => handleTtlPresetChange(e.target.value)}
            value={ttlPreset}
          />

          {ttlPreset === 'custom' && (
            <Input
              type="number"
              fieldName="customTtl"
              placeholder="Tempo em segundos"
              value={customTtl}
              onChange={(e) => handleCustomTtlChange(e.target.value)}
            />
          )}

          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Tempo até a memória expirar (deixe em branco para nunca expirar)
          </Typography>
        </div>
      )}

      {/* Valor Padrão - Apenas para BUSCAR */}
      {acao === 'buscar' && (
        <div className="p-1">
          <FormControl variant="label">Valor Padrão (Opcional)</FormControl>
          <Input
            type="text"
            fieldName="valorPadrao"
            placeholder="Valor retornado se memória não existir"
          />
          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Retornado quando a memória não é encontrada ou está expirada
          </Typography>
        </div>
      )}

      {/* Info sobre acesso às memórias */}
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mt-4">
        <Typography
          variant="span"
          className="block mb-2 text-sm font-semibold text-blue-900"
        >
          💡 Como usar memórias
        </Typography>
        <Typography variant="span" className="text-xs text-blue-800">
          {acao === 'salvar' &&
            'Após salvar, a memória estará disponível em nodes seguintes via {{$memory.chave}}'}
          {acao === 'buscar' &&
            'O valor encontrado será retornado e pode ser usado em nodes seguintes'}
          {acao === 'deletar' &&
            'A memória será removida permanentemente do banco de dados'}
        </Typography>
      </div>

      <SubmitButton
        variant="gradient"
        className="mt-4"
        onClick={() => console.log(errors)}
      >
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
}: MemoryNodeConfigProps) {
  const handleSubmit = async (data: FieldValues) => {
    const memoryConfig: MemoryConfig = {
      acao: data.acao as 'salvar' | 'buscar' | 'deletar',
      chave: data.chave,
      valor: data.valor,
      ttl: data.ttl,
      valorPadrao: data.valorPadrao,
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
    >
      <Form
        key={`${isOpen}-${config?.chave || 'new'}`}
        className="flex flex-col gap-4"
        zodSchema={memoryConfigSchema}
        onSubmit={handleSubmit}
      >
        <MemoryFormFields config={config} />
      </Form>
    </NodeConfigLayout>
  );
}
