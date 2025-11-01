'use client';

import React, { useEffect, useState } from 'react';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormSelect } from '@/components/ui/select';
import { Typography } from '@/components/ui/typography';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { NodeConfigLayout } from '../node-config-layout';
import {
  transformationConfigSchema,
  OPERATIONS_BY_TYPE,
  OPERATION_PARAMS,
} from './transformation-node-config.schema';
import {
  TransformationConfig,
  TransformationStep,
  MemoryItem,
} from '../../types';
import { Plus, Trash2, MoveUp, MoveDown } from 'lucide-react';
import { MemoryConfigSection } from '../memory-config-section';

interface TransformationNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: TransformationConfig) => void;
  config?: TransformationConfig;
  nodeId?: string;
  flowId?: string;
}

// Mapeamento de parâmetros para português
const PARAM_LABELS: Record<string, string> = {
  searchValue: 'Buscar',
  replaceValue: 'Substituir por',
  start: 'Início',
  end: 'Fim',
  separator: 'Separador',
  value: 'Valor',
  decimals: 'Casas decimais',
  format: 'Formato',
  days: 'Dias',
  compareDate: 'Data de comparação',
  part: 'Parte',
  condition: 'Condição',
  transformation: 'Transformação',
  order: 'Ordem',
  field: 'Campo',
  mergeWith: 'Mesclar com',
  keysToDelete: 'Chaves para deletar',
  keyMappings: 'Mapeamento de chaves',
  fieldName: 'Nome do campo ou índice',
  template: 'Template de transformação',
  objectTemplate: 'Template de objeto JSON',
};

function TransformationFormFields({
  config,
  steps,
  setSteps,
  memoryItems,
  setMemoryItems,
}: {
  config?: TransformationConfig;
  steps: TransformationStep[];
  setSteps: React.Dispatch<React.SetStateAction<TransformationStep[]>>;
  memoryItems: MemoryItem[];
  setMemoryItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
}) {
  const { form, setValue } = useForm();
  const [selectedTypes, setSelectedTypes] = useState<Record<string, string>>(
    {},
  );

  // Carregar configuração existente
  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        setValue('outputAs', config.outputAs || '');

        // Sincronizar steps com o formulário APENAS quando config mudar
        if (config.steps && config.steps.length > 0) {
          setValue('steps', config.steps);

          // Inicializar valores dos selects para cada step
          config.steps.forEach((step, index) => {
            setValue(`step_type_${index}`, step.type);
            setValue(`step_operation_${index}`, step.operation);
            setValue(`step_input_${index}`, step.input);
          });
        }

        // Pré-preencher tipos selecionados
        const types: Record<string, string> = {};
        config.steps?.forEach((step) => {
          types[step.id] = step.type;
        });
        setSelectedTypes(types);

        // Carregar configuração de memória
        if (config.memoryConfig) {
          setValue('memoryAction', config.memoryConfig.action);
          setValue('memoryName', config.memoryConfig.memoryName);
          setValue(
            'memorySaveMode',
            config.memoryConfig.saveMode || 'overwrite',
          );
          setValue(
            'memoryDefaultValue',
            config.memoryConfig.defaultValue || '',
          );

          if (
            config.memoryConfig.items &&
            config.memoryConfig.items.length > 0
          ) {
            setMemoryItems(config.memoryConfig.items);
          }

          // TTL
          if (config.memoryConfig.ttl) {
            const ttlValue = config.memoryConfig.ttl;
            const presetMatch = [
              { value: '3600', label: '1 hora' },
              { value: '86400', label: '1 dia' },
              { value: '604800', label: '7 dias' },
              { value: '2592000', label: '30 dias' },
            ].find((p) => p.value === String(ttlValue));

            if (presetMatch) {
              setValue('memoryTtlPreset', presetMatch.value);
            } else {
              setValue('memoryTtlPreset', 'custom');
              setValue('memoryCustomTtl', String(ttlValue));
            }
          } else {
            setValue('memoryTtlPreset', 'never');
          }
        }
      } else {
        // Se não tem config, setar steps inicial
        setValue('steps', steps);

        // Inicializar valores dos selects para o step inicial
        if (steps.length > 0) {
          steps.forEach((step, index) => {
            setValue(`step_type_${index}`, step.type);
            setValue(`step_operation_${index}`, step.operation);
            setValue(`step_input_${index}`, step.input);
          });
        }
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, setValue]);

  const addStep = () => {
    const newStep: TransformationStep = {
      id: crypto.randomUUID(),
      type: 'string',
      operation: 'uppercase',
      input: '',
      params: {},
    };
    const newSteps = [...steps, newStep];
    const newIndex = newSteps.length - 1;

    setSteps(newSteps);
    setSelectedTypes({ ...selectedTypes, [newStep.id]: 'string' });
    setValue('steps', newSteps);

    // Inicializar valores dos selects para o novo step
    setTimeout(() => {
      setValue(`step_type_${newIndex}`, newStep.type);
      setValue(`step_operation_${newIndex}`, newStep.operation);
      setValue(`step_input_${newIndex}`, newStep.input);
    }, 0);
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
    setValue('steps', newSteps);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === steps.length - 1)
    ) {
      return;
    }

    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [
      newSteps[targetIndex],
      newSteps[index],
    ];

    setSteps(newSteps);
    setValue('steps', newSteps);
  };

  const updateStep = (
    index: number,
    field: keyof TransformationStep,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
  ) => {
    const newSteps = [...steps];

    if (field === 'type') {
      // Quando mudar o tipo, resetar a operação para a primeira do novo tipo
      const operations =
        OPERATIONS_BY_TYPE[value as keyof typeof OPERATIONS_BY_TYPE];
      const newOperation = operations[0]?.value || '';

      newSteps[index] = {
        ...newSteps[index],
        type: value,
        operation: newOperation,
        params: {},
      };
      setSelectedTypes({ ...selectedTypes, [newSteps[index].id]: value });

      // Atualizar valores dos selects
      setValue(`step_type_${index}`, value);
      setValue(`step_operation_${index}`, newOperation);
    } else if (field === 'operation') {
      newSteps[index] = {
        ...newSteps[index],
        operation: value,
        params: {},
      };

      // Atualizar valor do select
      setValue(`step_operation_${index}`, value);
    } else if (field === 'params') {
      newSteps[index] = {
        ...newSteps[index],
        params: { ...newSteps[index].params, ...value },
      };
    } else {
      newSteps[index] = {
        ...newSteps[index],
        [field]: value,
      };

      // Atualizar valor se for input
      if (field === 'input') {
        setValue(`step_input_${index}`, value);
      }
    }

    setSteps(newSteps);
    setValue('steps', newSteps);
  };

  return (
    <>
      {/* Lista de Steps */}
      <div className="space-y-4 p-1 relative mt-6">
        <div className="flex items-center justify-between mb-2">
          <FormControl variant="label">
            Pipeline de Transformações *
          </FormControl>
          <Button
            type="button"
            variant="gradient"
            onClick={addStep}
            className="gap-1 text-sm w-fit absolute right-0 -top-4"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="p-3 bg-gray-50/40 rounded-lg border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <Typography variant="span" className="font-medium text-sm">
                  Transformação {index + 1}
                </Typography>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => moveStep(index, 'up')}
                    disabled={index === 0}
                    className="hover:bg-neutral-200 h-fit w-fit p-1"
                  >
                    <MoveUp className="w-4 h-4 text-neutral-600" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => moveStep(index, 'down')}
                    disabled={index === steps.length - 1}
                    className="hover:bg-neutral-200 h-fit w-fit p-1"
                  >
                    <MoveDown className="w-4 h-4 text-neutral-600" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeStep(index)}
                    disabled={steps.length === 1}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-fit w-fit p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Tipo de Transformação */}
              <div className="p-1">
                <FormControl variant="label">Tipo</FormControl>
                <FormSelect
                  fieldName={`step_type_${index}`}
                  onValueChange={(value) => updateStep(index, 'type', value)}
                  options={[
                    { value: 'string', label: 'Texto' },
                    { value: 'number', label: 'Número' },
                    { value: 'date', label: 'Data' },
                    { value: 'array', label: 'Array' },
                    { value: 'object', label: 'Objeto' },
                    { value: 'validation', label: 'Validação' },
                  ]}
                  placeholder="Selecione o tipo"
                  className="w-full"
                />
              </div>

              {/* Operação */}
              <div className="p-1">
                <FormControl variant="label">Operação</FormControl>
                <FormSelect
                  fieldName={`step_operation_${index}`}
                  onValueChange={(value) =>
                    updateStep(index, 'operation', value)
                  }
                  options={(
                    OPERATIONS_BY_TYPE[
                      step.type as keyof typeof OPERATIONS_BY_TYPE
                    ] || []
                  ).map((op) => ({ value: op.value, label: op.label }))}
                  placeholder="Selecione a operação"
                  className="w-full"
                />
              </div>

              {/* Input */}
              <div className="p-1">
                <FormControl variant="label">Entrada</FormControl>
                <Input
                  type="text"
                  fieldName={`step_input_${index}`}
                  value={step.input}
                  onChange={(e) => updateStep(index, 'input', e.target.value)}
                  placeholder="{{$nodes.node_xxx.output.field}}"
                />
                <Typography
                  variant="span"
                  className="text-xs text-neutral-600 mt-1"
                >
                  Use variáveis dinâmicas ou texto fixo
                </Typography>
              </div>

              {/* Parâmetros dinâmicos baseados na operação */}
              {OPERATION_PARAMS[
                step.operation as keyof typeof OPERATION_PARAMS
              ]?.map((param) => {
                // Placeholders e ajuda contextuais
                let placeholder = `Digite ${PARAM_LABELS[param]?.toLowerCase() || param}`;
                let helpText = '';

                if (param === 'keysToDelete') {
                  placeholder = 'Ex: campo1, campo2, campo3';
                  helpText =
                    'Lista de chaves separadas por vírgula que serão removidas de cada objeto';
                } else if (param === 'keyMappings') {
                  placeholder = 'Ex: nome_antigo:nome_novo, preco:valor';
                  helpText =
                    'Mapeamento de chaves no formato "chave_antiga:chave_nova", separadas por vírgula';
                } else if (param === 'fieldName') {
                  placeholder = 'Ex: nome (para objetos) ou 0 (para índice)';
                  helpText =
                    'Nome do campo para extrair de cada objeto, ou índice numérico para arrays. Suporta dot notation (ex: user.name)';
                } else if (param === 'template') {
                  placeholder =
                    'Ex: ["[{{title}}\\n{{description}}]", "{{{imageUrl}}}"]';
                  helpText =
                    'Template JSON com {{variáveis}} do objeto. Use \\n para quebra de linha. Retorna array achatado.';
                } else if (param === 'objectTemplate') {
                  placeholder =
                    'Ex: {"id": "{{_id}}", "title": "{{nome}}", "buttons": [...]}';
                  helpText =
                    'Template de objeto JSON com {{variáveis}}. Suporta objetos aninhados e arrays. Transforma cada item do array.';
                }

                // Usar Textarea para templates JSON
                const isJsonTemplate =
                  param === 'objectTemplate' || param === 'template';

                return (
                  <div key={param} className="p-1">
                    <FormControl variant="label">
                      {PARAM_LABELS[param] || param}
                    </FormControl>
                    {isJsonTemplate ? (
                      <Textarea
                        fieldName={`step_param_${index}_${param}`}
                        value={step.params?.[param] || ''}
                        onChange={(e) =>
                          updateStep(index, 'params', {
                            [param]: e.target.value,
                          })
                        }
                        placeholder={placeholder}
                        rows={8}
                        className="font-mono text-sm"
                      />
                    ) : (
                      <Input
                        type="text"
                        fieldName={`step_param_${index}_${param}`}
                        value={step.params?.[param] || ''}
                        onChange={(e) =>
                          updateStep(index, 'params', {
                            [param]: e.target.value,
                          })
                        }
                        placeholder={placeholder}
                      />
                    )}
                    {helpText && (
                      <Typography
                        variant="span"
                        className="text-xs text-neutral-600 mt-1"
                      >
                        {helpText}
                      </Typography>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <Typography
          variant="span"
          className="text-xs text-neutral-600 mt-2 block"
        >
          Você pode usar variáveis dinâmicas na entrada:{' '}
          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
            {'{{$node.input.campo}}'}
          </code>
          ,{' '}
          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
            {'{{$nodes.nodeId.output.campo}}'}
          </code>
        </Typography>
      </div>

      {/* Nome da variável de saída (opcional) */}
      <div className="p-1">
        <FormControl variant="label">
          Nome da variável de saída (opcional)
        </FormControl>
        <Input
          type="text"
          fieldName="outputAs"
          placeholder="Ex: dados_transformados"
        />
        <Typography variant="span" className="text-xs text-neutral-600 mt-1">
          Deixe vazio para usar o nome padrão
        </Typography>
      </div>

      {/* Configuração de Memória */}
      <MemoryConfigSection
        memoryItems={memoryItems}
        setMemoryItems={setMemoryItems}
        form={form}
        setValue={setValue}
      />

      <SubmitButton variant="gradient" className="mt-4">
        Salvar Configuração
      </SubmitButton>
    </>
  );
}

export function TransformationNodeConfig({
  isOpen,
  onClose,
  onSave,
  config,
  nodeId,
  flowId,
}: TransformationNodeConfigProps) {
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([
    { key: '', value: '' },
  ]);

  const [steps, setSteps] = useState<TransformationStep[]>([
    {
      id: crypto.randomUUID(),
      type: 'string',
      operation: 'uppercase',
      input: '',
      params: {},
    },
  ]);

  // Carregar steps quando config mudar
  useEffect(() => {
    if (config?.steps && config.steps.length > 0) {
      setSteps(config.steps);
    } else {
      setSteps([
        {
          id: crypto.randomUUID(),
          type: 'string',
          operation: 'uppercase',
          input: '',
          params: {},
        },
      ]);
    }
  }, [config]);

  const handleSubmit = async (data: FieldValues) => {
    const transformationConfig: TransformationConfig = {
      steps: steps,
      outputAs: data.outputAs || undefined,
    };

    // Adicionar configuração de memória se preenchida
    if (data.memoryName && data.memoryAction && data.memoryAction !== '') {
      let ttl: number | undefined;
      if (data.memoryTtlPreset && data.memoryTtlPreset !== 'never') {
        if (data.memoryTtlPreset === 'custom') {
          ttl = data.memoryCustomTtl ? Number(data.memoryCustomTtl) : undefined;
        } else {
          ttl = Number(data.memoryTtlPreset);
        }
      }

      transformationConfig.memoryConfig = {
        action: data.memoryAction || 'save',
        memoryName: data.memoryName,
        items: data.memoryAction === 'save' ? memoryItems : undefined,
        ttl,
        defaultValue: data.memoryDefaultValue,
        saveMode: data.memorySaveMode || 'overwrite',
      };
    }

    onSave(transformationConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="🔧 Configurar Transformação"
      nodeId={nodeId}
      flowId={flowId}
    >
      <Form
        key={`${isOpen}-${config?.outputAs || 'novo'}`}
        className="flex flex-col gap-4"
        zodSchema={transformationConfigSchema}
        onSubmit={handleSubmit}
      >
        <TransformationFormFields
          config={config}
          steps={steps}
          setSteps={setSteps}
          memoryItems={memoryItems}
          setMemoryItems={setMemoryItems}
        />
      </Form>
    </NodeConfigLayout>
  );
}
