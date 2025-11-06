'use client';

import React from 'react';
import { Typography } from '@/components/ui/typography';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormSelect } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { MemoryItem } from '../types';
import type { FormContextProps } from '@/contexts/form/form-context.type';

interface MemoryConfigSectionProps {
  memoryItems: MemoryItem[];
  setMemoryItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
  form: FormContextProps['form'];
  setValue: FormContextProps['setValue'];
  showMemoryConfig?: boolean; // Controla se a seção deve ser exibida (false por padrão)
}

export function MemoryConfigSection({
  memoryItems,
  setMemoryItems,
  form,
  setValue,
  showMemoryConfig = false,
}: MemoryConfigSectionProps) {
  // Funções para manipular memory items
  const addMemoryItem = () => {
    const newItems = [...memoryItems, { key: '', value: '' }];
    setMemoryItems(newItems);
    setValue('memoryItems', newItems);
  };

  const removeMemoryItem = (index: number) => {
    if (memoryItems.length > 1) {
      const newItems = memoryItems.filter((_, i) => i !== index);
      setMemoryItems(newItems);
      setValue('memoryItems', newItems);
    }
  };

  const updateMemoryItem = (
    index: number,
    field: 'key' | 'value',
    val: string,
  ) => {
    const newItems = [...memoryItems];
    newItems[index][field] = val;
    setMemoryItems(newItems);
    setValue('memoryItems', newItems);
  };

  // Não renderizar nada se showMemoryConfig for false
  if (!showMemoryConfig) {
    return null;
  }

  return (
    <div className="border-t pt-4 mt-4">
      <div className="space-y-4 p-4 rounded-lg bg-gray-50/40">
        <Typography variant="h5" className="font-semibold mb-3">
          🧠 Configurações de Memória (Opcional)
        </Typography>
        <div className="flex flex-col gap-2 mb-3">
          <Typography variant="span" className="text-xs text-neutral-600">
            Configure a memória para salvar, buscar ou deletar dados após a
            execução deste node.
          </Typography>
          <Typography
            variant="span"
            className="text-xs text-neutral-600 bg-gray-100 p-2 rounded"
          >
            💡 Você pode usar variáveis dinâmicas da saída deste node:{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              {'{{$node.output.apiResponse.messageId}}'}
            </code>
            ,{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              {'{{$node.output.phoneNumber}}'}
            </code>
            , etc.
          </Typography>
        </div>

        {/* Ação de Memória */}
        <div className="p-1">
          <FormControl variant="label">Ação</FormControl>
          <FormSelect
            fieldName="memoryAction"
            placeholder="Nenhuma (desabilitar memória)"
            options={[
              { value: 'nothing', label: 'Nenhuma' },
              { value: 'save', label: 'Salvar' },
              { value: 'fetch', label: 'Buscar' },
              { value: 'delete', label: 'Deletar' },
            ]}
            className="w-full"
          />
        </div>

        {/* Mostrar campos apenas se uma ação foi selecionada */}
        {form.memoryAction && form.memoryAction !== '' && (
          <>
            {/* Nome da Memória */}
            <div className="p-1">
              <FormControl variant="label">Identificador Único</FormControl>
              <Input
                type="text"
                fieldName="memoryName"
                placeholder="Ex: dadosCliente, informacoesPedido"
              />
              <Typography
                variant="span"
                className="text-xs text-neutral-600 mt-1"
              >
                Nome único para identificar esta memória
              </Typography>
            </div>

            {/* Modo de Salvamento - Apenas para SALVAR */}
            {form.memoryAction === 'save' && (
              <>
                <div className="p-1">
                  <FormControl variant="label">Modo de Salvamento</FormControl>
                  <FormSelect
                    fieldName="memorySaveMode"
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
                </div>

                {/* Items (Chave/Valor) */}
                <div className="p-1 relative !mt-8">
                  <div className="flex items-center justify-between mb-2">
                    <FormControl variant="label">Pares Chave/Valor</FormControl>
                    <Button
                      type="button"
                      onClick={addMemoryItem}
                      variant="gradient"
                      className="gap-1 text-sm w-fit absolute right-0 -top-4"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {memoryItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex gap-2 p-3 bg-gray-50/40 rounded-lg border border-gray-200 items-center"
                      >
                        <div className="flex-1 space-y-2">
                          <Input
                            type="text"
                            fieldName={`memory_item_key_${index}`}
                            placeholder="Chave (ex: etapa, nome)"
                            value={item.key}
                            onChange={(e) =>
                              updateMemoryItem(index, 'key', e.target.value)
                            }
                          />
                          <Input
                            type="text"
                            fieldName={`memory_item_value_${index}`}
                            placeholder="Valor ou variável: {{$node.input.campo}}"
                            value={item.value}
                            onChange={(e) =>
                              updateMemoryItem(index, 'value', e.target.value)
                            }
                          />
                        </div>
                        {memoryItems.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => removeMemoryItem(index)}
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <Typography
                    variant="span"
                    className="text-xs text-neutral-600 mt-2"
                  >
                    Você pode usar variáveis dinâmicas no valor:{' '}
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                      {'{{$node.input.campo}}'}
                    </code>
                  </Typography>
                </div>

                {/* TTL */}
                <div className="p-1">
                  <FormControl variant="label">
                    Tempo de Expiração (TTL)
                  </FormControl>
                  <FormSelect
                    fieldName="memoryTtlPreset"
                    placeholder="Selecione o tempo"
                    options={[
                      { value: 'never', label: 'Nunca expira' },
                      { value: '3600', label: '1 hora' },
                      { value: '86400', label: '1 dia' },
                      { value: '604800', label: '7 dias' },
                      { value: '2592000', label: '30 dias' },
                      { value: 'custom', label: 'Personalizado' },
                    ]}
                    className="w-full"
                  />

                  {form.memoryTtlPreset === 'custom' && (
                    <div className="mt-2">
                      <Input
                        type="number"
                        fieldName="memoryCustomTtl"
                        placeholder="Tempo em segundos"
                      />
                    </div>
                  )}

                  <Typography
                    variant="span"
                    className="text-xs text-neutral-600 mt-1"
                  >
                    Tempo até a memória expirar
                  </Typography>
                </div>
              </>
            )}

            {/* Valor Padrão - Apenas para BUSCAR */}
            {form.memoryAction === 'fetch' && (
              <div className="p-1">
                <FormControl variant="label">
                  Valor Padrão (Opcional)
                </FormControl>
                <Input
                  type="text"
                  fieldName="memoryDefaultValue"
                  placeholder="Valor retornado se memória não existir"
                />
                <Typography
                  variant="span"
                  className="text-xs text-neutral-600 mt-1"
                >
                  Retornado quando a memória não é encontrada ou está expirada
                </Typography>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
