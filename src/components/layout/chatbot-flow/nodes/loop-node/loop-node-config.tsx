'use client';

import React, { useEffect, useState } from 'react';
import { LoopConfig, MemoryItem } from '../../types';
import { Typography } from '@/components/ui/typography';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { loopConfigSchema } from './loop-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { FormSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { NodeConfigLayout } from '../node-config-layout';
import { MemoryConfigSection } from '../memory-config-section';
import { Info } from 'lucide-react';

interface LoopNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: LoopConfig;
  onSave: (config: LoopConfig) => void;
  nodeId?: string;
  flowId?: string;
  nodeLabel?: string;
  onNodeLabelChange?: (label: string) => void;
}

function LoopFormFields({
  config,
  memoryItems,
  setMemoryItems,
}: {
  config?: LoopConfig;
  memoryItems: MemoryItem[];
  setMemoryItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
}) {
  const { form, setValue } = useForm();
  const mode = (form.mode as 'each' | 'batch') || 'each';

  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        setValue('inputData', config.inputData || '');
        setValue('batchSize', config.batchSize?.toString() || '1');
        setValue('mode', config.mode || 'each');
        setValue('accumulateResults', config.accumulateResults || false);
        setValue('outputVariable', config.outputVariable || 'loopItem');
        setValue('maxIterations', config.maxIterations?.toString() || '');
        setValue(
          'pauseBetweenIterations',
          config.pauseBetweenIterations?.toString() || '',
        );

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
  }, [config, setValue, setMemoryItems]);

  return (
    <>
      {/* Banner informativo */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <Typography
              variant="span"
              className="text-sm font-semibold text-blue-900"
            >
              Como funciona o Loop Node?
            </Typography>
            <Typography variant="span" className="text-xs text-blue-800 block">
              O Loop Node divide um array em partes e processa cada uma
              iterativamente. Ele possui <strong>2 saídas</strong>:
            </Typography>
            <ul className="text-xs text-blue-800 space-y-1 ml-4">
              <li>
                <strong>🔄 Loop:</strong> Retorna ao início para processar o
                próximo batch
              </li>
              <li>
                <strong>✅ Done:</strong> Finaliza quando todos os itens foram
                processados
              </li>
            </ul>
            <Typography
              variant="span"
              className="text-xs text-blue-700 block mt-2"
            >
              💡 <strong>Dica:</strong> Conecte a saída "loop" de volta aos
              nodes que devem ser repetidos, e a saída "done" ao próximo passo
              após o loop.
            </Typography>
          </div>
        </div>
      </div>

      {/* Dados de Entrada */}
      <div className="p-1">
        <FormControl variant="label">
          Dados de Entrada *
          <Typography
            variant="span"
            className="text-xs text-neutral-500 font-normal ml-2"
          >
            (Array ou variável)
          </Typography>
        </FormControl>
        <Textarea
          fieldName="inputData"
          placeholder={
            'Exemplo:\n{{$webhook.body.items}}\nou\n["item1", "item2", "item3"]'
          }
          rows={4}
        />
        <Typography variant="span" className="text-xs text-neutral-600 mt-1">
          Use variáveis dinâmicas (ex: {`{{$webhook.body.items}}`}) ou um array
          literal
        </Typography>
      </div>

      {/* Modo de Loop */}
      <div className="p-1">
        <FormControl variant="label">Modo de Processamento *</FormControl>
        <FormSelect
          fieldName="mode"
          placeholder="Selecione o modo"
          options={[
            { value: 'each', label: '🔁 Cada Item (1 por vez)' },
            { value: 'batch', label: '📦 Lotes (N por vez)' },
          ]}
          className="w-full"
        />
        <Typography variant="span" className="text-xs text-neutral-600 mt-1">
          {mode === 'each'
            ? 'Processa um item por vez em cada iteração'
            : 'Processa múltiplos itens por iteração (definido pelo tamanho do lote)'}
        </Typography>
      </div>

      {/* Tamanho do Lote (só aparece se mode for 'batch') */}
      {mode === 'batch' && (
        <div className="p-1">
          <FormControl variant="label">Tamanho do Lote *</FormControl>
          <Input type="number" fieldName="batchSize" placeholder="10" min="1" />
          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Quantos itens processar em cada iteração do loop
          </Typography>
        </div>
      )}

      {/* Variável de Saída */}
      <div className="p-1">
        <FormControl variant="label">
          Nome da Variável de Saída
          <Typography
            variant="span"
            className="text-xs text-neutral-500 font-normal ml-2"
          >
            (opcional)
          </Typography>
        </FormControl>
        <Input type="text" fieldName="outputVariable" placeholder="loopItem" />
        <Typography variant="span" className="text-xs text-neutral-600 mt-1">
          Nome da variável que conterá o item/batch atual (ex:{' '}
          {`{{$loop.loopItem}}`})
        </Typography>
      </div>

      {/* Opções Avançadas */}
      <div className="border-t pt-4 mt-4">
        <Typography variant="h5" className="font-semibold mb-3">
          ⚙️ Opções Avançadas
        </Typography>

        {/* Acumular Resultados */}
        <div className="p-3 bg-neutral-50 rounded-lg mb-3">
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              fieldName="accumulateResults"
              onChange={(e) => setValue('accumulateResults', e.target.checked)}
              className="bg-neutral-200"
            />
            <FormControl
              variant="label"
              className="text-sm font-medium cursor-pointer"
            >
              Acumular resultados de cada iteração
            </FormControl>
          </div>
          <Typography
            variant="span"
            className="text-xs text-neutral-600 mt-2 block ml-6"
          >
            Quando ativo, todos os resultados das iterações serão combinados na
            saída final
          </Typography>
        </div>

        {/* Limite de Iterações */}
        <div className="p-1">
          <FormControl variant="label">
            <Typography variant="span" className="text-sm">
              Limite Máximo de Iterações (opcional)
            </Typography>
          </FormControl>
          <Input
            type="number"
            fieldName="maxIterations"
            placeholder="1000"
            min="1"
          />
          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Proteção contra loops infinitos. Deixe vazio para sem limite.
          </Typography>
        </div>

        {/* Pausa Entre Iterações */}
        <div className="p-1">
          <FormControl variant="label">
            <Typography variant="span" className="text-sm">
              Pausa Entre Iterações (opcional)
            </Typography>
          </FormControl>
          <Input
            type="number"
            fieldName="pauseBetweenIterations"
            placeholder="0"
            min="0"
          />
          <Typography variant="span" className="text-xs text-neutral-600 mt-1">
            Tempo em milissegundos para aguardar entre cada iteração
          </Typography>
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

export function LoopNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
  nodeId,
  flowId,
  nodeLabel,
  onNodeLabelChange,
}: LoopNodeConfigProps) {
  // Estados para configuração de memória
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([
    { key: '', value: '' },
  ]);

  // Carregar configuração de memória quando config mudar
  useEffect(() => {
    if (config?.memoryConfig?.items && config.memoryConfig.items.length > 0) {
      setMemoryItems(config.memoryConfig.items);
    } else {
      setMemoryItems([{ key: '', value: '' }]);
    }
  }, [config]);

  const handleSubmit = async (data: FieldValues) => {
    const loopConfig: LoopConfig = {
      inputData: data.inputData,
      batchSize:
        data.mode === 'batch'
          ? data.batchSize
            ? parseInt(data.batchSize)
            : 1
          : 1,
      mode: data.mode as 'each' | 'batch',
      accumulateResults: data.accumulateResults || false,
      outputVariable: data.outputVariable || 'loopItem',
      maxIterations: data.maxIterations
        ? parseInt(data.maxIterations)
        : undefined,
      pauseBetweenIterations: data.pauseBetweenIterations
        ? parseInt(data.pauseBetweenIterations)
        : undefined,
    };

    // Se configuração de memória estiver preenchida, adicionar ao loopConfig
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

      loopConfig.memoryConfig = {
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

    onSave(loopConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Configurar Loop"
      nodeId={nodeId}
      flowId={flowId}
      nodeLabel={nodeLabel}
      onNodeLabelChange={onNodeLabelChange}
    >
      <Form
        className="flex flex-col gap-4"
        zodSchema={loopConfigSchema}
        onSubmit={handleSubmit}
      >
        <LoopFormFields
          config={config}
          memoryItems={memoryItems}
          setMemoryItems={setMemoryItems}
        />
      </Form>
    </NodeConfigLayout>
  );
}
