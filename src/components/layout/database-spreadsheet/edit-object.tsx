'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { FormSelect } from '@/components/ui/select';
import { SubmitButton } from '@/components/ui/submit-button';
import { Plus, Trash2, Key } from 'lucide-react';
import { z } from 'zod';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { EditArrayDialog } from './edit-array';

const editObjectSchema = z.object({
  // Schema vazio pois estamos validando manualmente os pares do objeto
});

interface EditObjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (obj: Record<string, unknown>) => void;
  initialObject: Record<string, unknown>;
  columnName: string;
  isNested?: boolean;
}

type ValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'object'
  | 'array'
  | 'json';

interface ObjectPair {
  id: string;
  key: string;
  type: ValueType;
  // Para string e number
  value?: string;
  // Para boolean
  booleanValue?: boolean;
  // Para object
  objectPairs?: Array<{ key: string; value: string }>;
  // Para array
  arrayValue?: string;
  // Para json
  jsonValue?: string;
}

// Componente para editar arrays aninhados
function ArrayEditor({
  pair,
  updatePairArrayValue,
}: {
  pair: ObjectPair;
  updatePairArrayValue: (id: string, arrayValue: string) => void;
}) {
  const [showNestedDialog, setShowNestedDialog] = useState(false);
  const [nestedArray, setNestedArray] = useState<unknown[]>([]);
  const isClosingRef = React.useRef(false);

  // Parsear o array atual
  useEffect(() => {
    try {
      const parsed = JSON.parse(pair.arrayValue || '[]');
      setNestedArray(Array.isArray(parsed) ? parsed : []);
    } catch {
      setNestedArray([]);
    }
  }, [pair.arrayValue]);

  const handleEditArray = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isClosingRef.current = false;
    setShowNestedDialog(true);
  };

  const handleSaveNestedArray = (newArray: unknown[]) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    updatePairArrayValue(pair.id, JSON.stringify(newArray));

    requestAnimationFrame(() => {
      setShowNestedDialog(false);
      setTimeout(() => {
        document.body.style.overflow = 'hidden';
        isClosingRef.current = false;
      }, 50);
    });
  };

  const handleCloseNestedDialog = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    requestAnimationFrame(() => {
      setShowNestedDialog(false);
      setTimeout(() => {
        document.body.style.overflow = 'hidden';
        isClosingRef.current = false;
      }, 50);
    });
  };

  return (
    <>
      <div className="space-y-3">
        <FormControl variant="label">
          <Typography variant="span" className="text-sm font-medium">
            Array Aninhado
          </Typography>
        </FormControl>

        <div className="p-4 bg-gray-50/40 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <Typography variant="span" className="text-sm text-neutral-600">
              {nestedArray.length === 0
                ? '[Array vazio]'
                : `[Array com ${nestedArray.length} item${nestedArray.length !== 1 ? 's' : ''}]`}
            </Typography>
            <Button
              type="button"
              onClick={handleEditArray}
              variant="gradient"
              className="gap-2 text-sm w-fit"
            >
              Editar Array
            </Button>
          </div>
        </div>
      </div>

      {showNestedDialog && (
        <EditArrayDialog
          isOpen={showNestedDialog}
          onClose={handleCloseNestedDialog}
          onSave={handleSaveNestedArray}
          initialArray={nestedArray}
          columnName={`Array aninhado`}
          isNested={true}
        />
      )}
    </>
  );
}

// Componente para editar objetos aninhados
function NestedObjectEditor({
  pair,
  updatePairObjectPairs,
}: {
  pair: ObjectPair;
  updatePairObjectPairs: (
    id: string,
    objectPairs: Array<{ key: string; value: string }>,
  ) => void;
}) {
  const [showObjectDialog, setShowObjectDialog] = useState(false);
  const [objectPairs, setObjectPairs] = useState<
    Array<{ key: string; value: string }>
  >([]);
  const isClosingRef = React.useRef(false);

  // Sincronizar pares de objeto
  useEffect(() => {
    setObjectPairs(pair.objectPairs || [{ key: '', value: '' }]);
  }, [pair.objectPairs]);

  const handleEditObject = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isClosingRef.current = false;
    setShowObjectDialog(true);
  };

  const handleSaveObject = (newObject: Record<string, unknown>) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    // Converter objeto de volta para pares key/value
    const pairs = Object.entries(newObject).map(([key, value]) => ({
      key,
      value: String(value),
    }));

    updatePairObjectPairs(pair.id, pairs);

    requestAnimationFrame(() => {
      setShowObjectDialog(false);
      setTimeout(() => {
        document.body.style.overflow = 'hidden';
        isClosingRef.current = false;
      }, 50);
    });
  };

  const handleCloseObjectDialog = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    requestAnimationFrame(() => {
      setShowObjectDialog(false);
      setTimeout(() => {
        document.body.style.overflow = 'hidden';
        isClosingRef.current = false;
      }, 50);
    });
  };

  const pairCount = objectPairs.filter((p) => p.key.trim()).length;

  // Converter pares para objeto
  const currentObject: Record<string, unknown> = {};
  objectPairs.forEach((p) => {
    if (p.key.trim()) {
      currentObject[p.key.trim()] = p.value;
    }
  });

  return (
    <>
      <div className="space-y-3">
        <FormControl variant="label">
          <Typography variant="span" className="text-sm font-medium">
            Objeto Aninhado
          </Typography>
        </FormControl>

        <div className="p-4 bg-gray-50/40 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <Typography variant="span" className="text-sm text-neutral-600">
              {pairCount === 0
                ? '[Objeto vazio]'
                : `[Objeto com ${pairCount} propriedade${pairCount !== 1 ? 's' : ''}]`}
            </Typography>
            <Button
              type="button"
              onClick={handleEditObject}
              variant="gradient"
              className="gap-2 text-sm w-fit"
            >
              Editar Objeto
            </Button>
          </div>
        </div>
      </div>

      {showObjectDialog && (
        <EditObjectDialog
          isOpen={showObjectDialog}
          onClose={handleCloseObjectDialog}
          onSave={handleSaveObject}
          initialObject={currentObject}
          columnName={`Objeto aninhado`}
          isNested={true}
        />
      )}
    </>
  );
}

// Componente interno que usa Form
function EditObjectForm({
  objectPairs,
  setObjectPairs,
  onSave,
  onClose,
  columnName,
  isNested = false,
}: {
  objectPairs: ObjectPair[];
  setObjectPairs: React.Dispatch<React.SetStateAction<ObjectPair[]>>;
  onSave: (obj: Record<string, unknown>) => void;
  onClose: () => void;
  columnName: string;
  isNested?: boolean;
}) {
  const addPair = () => {
    const newPair: ObjectPair = {
      id: `pair-${Date.now()}`,
      key: '',
      type: 'string',
      value: '',
    };
    setObjectPairs((prev) => [...prev, newPair]);
  };

  const removePair = (id: string) => {
    setObjectPairs((prev) => prev.filter((pair) => pair.id !== id));
  };

  const updatePairKey = (id: string, key: string) => {
    setObjectPairs((prev) =>
      prev.map((pair) => (pair.id === id ? { ...pair, key } : pair)),
    );
  };

  const updatePairType = (id: string, type: ValueType) => {
    setObjectPairs((prev) =>
      prev.map((pair) => {
        if (pair.id !== id) return pair;

        // Resetar valores ao mudar de tipo
        const newPair: ObjectPair = { id: pair.id, key: pair.key, type };

        switch (type) {
          case 'string':
          case 'number':
            newPair.value = '';
            break;
          case 'boolean':
            newPair.booleanValue = true;
            break;
          case 'null':
            // Sem valores adicionais
            break;
          case 'object':
            newPair.objectPairs = [{ key: '', value: '' }];
            break;
          case 'array':
            newPair.arrayValue = '[]';
            break;
          case 'json':
            newPair.jsonValue = '';
            break;
        }

        return newPair;
      }),
    );
  };

  const updatePairValue = (id: string, value: string) => {
    setObjectPairs((prev) =>
      prev.map((pair) => (pair.id === id ? { ...pair, value } : pair)),
    );
  };

  const updatePairBooleanValue = (id: string, booleanValue: boolean) => {
    setObjectPairs((prev) =>
      prev.map((pair) => (pair.id === id ? { ...pair, booleanValue } : pair)),
    );
  };

  const updatePairArrayValue = (id: string, arrayValue: string) => {
    setObjectPairs((prev) =>
      prev.map((pair) => (pair.id === id ? { ...pair, arrayValue } : pair)),
    );
  };

  const updatePairJsonValue = (id: string, jsonValue: string) => {
    setObjectPairs((prev) =>
      prev.map((pair) => (pair.id === id ? { ...pair, jsonValue } : pair)),
    );
  };

  const updatePairObjectPairs = (
    id: string,
    objectPairs: Array<{ key: string; value: string }>,
  ) => {
    setObjectPairs((prev) =>
      prev.map((pair) => (pair.id === id ? { ...pair, objectPairs } : pair)),
    );
  };

  const handleSubmit = async (data: FieldValues) => {
    const processedObject: Record<string, unknown> = {};

    objectPairs.forEach((pair) => {
      if (pair.key.trim()) {
        const key = pair.key.trim();

        switch (pair.type) {
          case 'string':
            processedObject[key] = pair.value || '';
            break;

          case 'number':
            processedObject[key] = pair.value ? Number(pair.value) : 0;
            break;

          case 'boolean':
            processedObject[key] = pair.booleanValue ?? true;
            break;

          case 'null':
            processedObject[key] = null;
            break;

          case 'object':
            const obj: Record<string, unknown> = {};
            pair.objectPairs?.forEach((objPair) => {
              if (objPair.key.trim()) {
                const objKey = objPair.key.trim();
                const objValue = objPair.value.trim();

                // Tentar converter valor automaticamente
                let processedValue: unknown = objValue;

                if (!isNaN(Number(objValue)) && objValue !== '') {
                  processedValue = Number(objValue);
                } else if (objValue.toLowerCase() === 'true') {
                  processedValue = true;
                } else if (objValue.toLowerCase() === 'false') {
                  processedValue = false;
                } else if (objValue.toLowerCase() === 'null') {
                  processedValue = null;
                } else if (
                  objValue.startsWith('{') ||
                  objValue.startsWith('[')
                ) {
                  try {
                    processedValue = JSON.parse(objValue);
                  } catch {
                    processedValue = objValue;
                  }
                } else if (objValue === '') {
                  processedValue = null;
                }

                obj[objKey] = processedValue;
              }
            });
            processedObject[key] = obj;
            break;

          case 'array':
            try {
              processedObject[key] = JSON.parse(pair.arrayValue || '[]');
            } catch {
              processedObject[key] = [];
            }
            break;

          case 'json':
            try {
              processedObject[key] = JSON.parse(pair.jsonValue || 'null');
            } catch {
              // Se falhar o parse, retornar a string original
              processedObject[key] = pair.jsonValue || null;
            }
            break;

          default:
            processedObject[key] = null;
        }
      }
    });

    onSave(processedObject);

    // Se não for aninhado, fechar o dialog
    // Se for aninhado, o onSave já gerencia o fechamento
    if (!isNested) {
      onClose();
    }
  };

  return (
    <Form
      className="flex flex-col gap-4 flex-1 overflow-hidden"
      zodSchema={editObjectSchema}
      onSubmit={handleSubmit}
    >
      <FormContent
        objectPairs={objectPairs}
        setObjectPairs={setObjectPairs}
        onClose={onClose}
        columnName={columnName}
        addPair={addPair}
        removePair={removePair}
        updatePairKey={updatePairKey}
        updatePairType={updatePairType}
        updatePairValue={updatePairValue}
        updatePairBooleanValue={updatePairBooleanValue}
        updatePairArrayValue={updatePairArrayValue}
        updatePairJsonValue={updatePairJsonValue}
        updatePairObjectPairs={updatePairObjectPairs}
      />
    </Form>
  );
}

// Componente que renderiza o conteúdo do formulário
function FormContent({
  objectPairs,
  setObjectPairs,
  onClose,
  columnName,
  addPair,
  removePair,
  updatePairKey,
  updatePairType,
  updatePairValue,
  updatePairBooleanValue,
  updatePairArrayValue,
  updatePairJsonValue,
  updatePairObjectPairs,
}: {
  objectPairs: ObjectPair[];
  setObjectPairs: React.Dispatch<React.SetStateAction<ObjectPair[]>>;
  onClose: () => void;
  columnName: string;
  addPair: () => void;
  removePair: (id: string) => void;
  updatePairKey: (id: string, key: string) => void;
  updatePairType: (id: string, type: ValueType) => void;
  updatePairValue: (id: string, value: string) => void;
  updatePairBooleanValue: (id: string, booleanValue: boolean) => void;
  updatePairArrayValue: (id: string, arrayValue: string) => void;
  updatePairJsonValue: (id: string, jsonValue: string) => void;
  updatePairObjectPairs: (
    id: string,
    objectPairs: Array<{ key: string; value: string }>,
  ) => void;
}) {
  const { errors, setValue } = useForm();

  // Inicializar valores do formulário quando os pares mudarem
  React.useEffect(() => {
    const timer = setTimeout(() => {
      objectPairs.forEach((pair) => {
        // Definir chave
        setValue(`key_${pair.id}`, pair.key);

        // Definir tipo
        setValue(`type_${pair.id}`, pair.type);

        // Definir valores baseados no tipo
        if (pair.type === 'string' || pair.type === 'number') {
          setValue(`value_${pair.id}`, pair.value || '');
        } else if (pair.type === 'boolean') {
          const boolValue = pair.booleanValue ? 'true' : 'false';
          setValue(`booleanValue_${pair.id}`, boolValue);
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [objectPairs, setValue]);

  const getTypeBadgeColor = (type: ValueType) => {
    switch (type) {
      case 'string':
        return 'bg-blue-100 text-blue-700';
      case 'number':
        return 'bg-green-100 text-green-700';
      case 'boolean':
        return 'bg-yellow-100 text-yellow-700';
      case 'null':
        return 'bg-gray-100 text-gray-700';
      case 'object':
        return 'bg-purple-100 text-purple-700';
      case 'array':
        return 'bg-orange-100 text-orange-700';
      case 'json':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-neutral-100 text-neutral-700';
    }
  };

  const getTypeLabel = (type: ValueType) => {
    switch (type) {
      case 'string':
        return 'String';
      case 'number':
        return 'Number';
      case 'boolean':
        return 'Boolean';
      case 'null':
        return 'Null';
      case 'object':
        return 'Object';
      case 'array':
        return 'Array';
      case 'json':
        return 'JSON';
      default:
        return type;
    }
  };

  return (
    <div
      className="p-6 flex flex-col gap-4 flex-1 overflow-hidden"
      style={{ zoom: 0.9 }}
    >
      <div className="flex items-center justify-between">
        <Typography variant="h2" className="text-neutral-700 whitespace-nowrap">
          📦 Editar Objeto - {columnName}
        </Typography>
        <Button
          type="button"
          onClick={addPair}
          variant="gradient"
          className="gap-2 w-fit"
        >
          <Plus className="w-4 h-4" />
          Adicionar Par
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <FormControl variant="label">Pares Chave/Valor</FormControl>

        <div className="space-y-3 mt-3">
          {objectPairs.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <Typography variant="p">
                Nenhum par chave/valor. Clique em "Adicionar Par" para começar.
              </Typography>
            </div>
          ) : (
            objectPairs.map((pair, index) => (
              <div
                key={pair.id}
                className="p-4 border border-neutral-200 rounded-lg bg-white"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 flex-1">
                    <Typography
                      variant="span"
                      className="text-sm font-medium text-neutral-600 w-8"
                    >
                      {index + 1}.
                    </Typography>
                    <Typography
                      variant="span"
                      className={`text-xs px-2 py-1 rounded ${getTypeBadgeColor(pair.type)}`}
                    >
                      {getTypeLabel(pair.type)}
                    </Typography>
                  </div>

                  <Button
                    type="button"
                    onClick={() => removePair(pair.id)}
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 p-2 w-fit"
                    title="Remover par"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {/* Input de Chave */}
                  <div>
                    <FormControl variant="label">
                      <Typography
                        variant="span"
                        className="text-sm font-medium flex items-center gap-2"
                      >
                        Chave
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName={`key_${pair.id}`}
                      placeholder="Nome da propriedade (ex: nome, idade)"
                      value={pair.key}
                      onChange={(e) => updatePairKey(pair.id, e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* Select de Tipo */}
                  <div>
                    <FormControl variant="label">
                      <Typography
                        variant="span"
                        className="text-sm font-medium"
                      >
                        Tipo do Valor
                      </Typography>
                    </FormControl>
                    <FormSelect
                      fieldName={`type_${pair.id}`}
                      onValueChange={(value) =>
                        updatePairType(pair.id, value as ValueType)
                      }
                      options={[
                        { value: 'string', label: '📝 String (texto)' },
                        { value: 'number', label: '🔢 Number (número)' },
                        { value: 'boolean', label: '✅ Boolean (true/false)' },
                        { value: 'null', label: '🚫 Null (vazio)' },
                        { value: 'object', label: '📦 Object (objeto)' },
                        { value: 'array', label: '📋 Array (lista)' },
                        { value: 'json', label: '🔗 JSON (auto-parse)' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  {/* Inputs baseados no tipo */}
                  {pair.type === 'json' && (
                    <div>
                      <FormControl variant="label">
                        <Typography variant="span" className="text-sm">
                          JSON
                        </Typography>
                      </FormControl>
                      <textarea
                        value={pair.jsonValue || ''}
                        onChange={(e) =>
                          updatePairJsonValue(pair.id, e.target.value)
                        }
                        placeholder='Cole seu JSON aqui (ex: {"nome": "João"} ou [1,2,3])'
                        rows={6}
                        className="w-full rounded-md border border-gray-300 bg-white p-2.5 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#5c5e5d] font-mono text-sm"
                      />
                      <Typography
                        variant="span"
                        className="text-xs text-neutral-500 mt-1"
                      >
                        O JSON será parseado automaticamente. Pode ser objeto,
                        array, string, número, etc.
                      </Typography>
                    </div>
                  )}

                  {(pair.type === 'string' || pair.type === 'number') && (
                    <div>
                      <FormControl variant="label">
                        <Typography variant="span" className="text-sm">
                          Valor
                        </Typography>
                      </FormControl>
                      <Input
                        type={pair.type === 'number' ? 'number' : 'text'}
                        fieldName={`value_${pair.id}`}
                        value={pair.value || ''}
                        onChange={(e) =>
                          updatePairValue(pair.id, e.target.value)
                        }
                        placeholder={
                          pair.type === 'number'
                            ? 'Digite um número'
                            : 'Digite o texto'
                        }
                        className="w-full"
                      />
                    </div>
                  )}

                  {pair.type === 'boolean' && (
                    <div>
                      <FormControl variant="label">
                        <Typography variant="span" className="text-sm">
                          Valor
                        </Typography>
                      </FormControl>
                      <FormSelect
                        fieldName={`booleanValue_${pair.id}`}
                        onValueChange={(value) =>
                          updatePairBooleanValue(pair.id, value === 'true')
                        }
                        options={[
                          { value: 'true', label: '✅ True (verdadeiro)' },
                          { value: 'false', label: '❌ False (falso)' },
                        ]}
                        className="w-full"
                      />
                    </div>
                  )}

                  {pair.type === 'null' && (
                    <div className="text-center py-4 text-neutral-500 bg-gray-50/40 rounded border border-dashed">
                      <Typography variant="span" className="text-sm">
                        Este valor será <strong>null</strong> (vazio)
                      </Typography>
                    </div>
                  )}

                  {pair.type === 'object' && (
                    <NestedObjectEditor
                      pair={pair}
                      updatePairObjectPairs={updatePairObjectPairs}
                    />
                  )}

                  {pair.type === 'array' && (
                    <ArrayEditor
                      pair={pair}
                      updatePairArrayValue={updatePairArrayValue}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <SubmitButton variant="gradient" className="gap-2">
          Salvar
        </SubmitButton>
      </div>
    </div>
  );
}

export function EditObjectDialog({
  isOpen,
  onClose,
  onSave,
  initialObject,
  columnName,
  isNested = false,
}: EditObjectDialogProps) {
  const [objectPairs, setObjectPairs] = useState<ObjectPair[]>([]);

  // Inicializar pares quando o dialog abrir
  useEffect(() => {
    if (isOpen) {
      const pairs: ObjectPair[] = Object.entries(initialObject).map(
        ([key, value], index) => {
          if (Array.isArray(value)) {
            return {
              id: `pair-${index}`,
              key,
              type: 'array',
              arrayValue: JSON.stringify(value),
            };
          } else if (typeof value === 'object' && value !== null) {
            const objectPairs = Object.entries(value).map(([k, v]) => ({
              key: k,
              value: String(v),
            }));
            return {
              id: `pair-${index}`,
              key,
              type: 'object',
              objectPairs,
            };
          } else if (typeof value === 'number') {
            return {
              id: `pair-${index}`,
              key,
              type: 'number',
              value: String(value),
            };
          } else if (typeof value === 'boolean') {
            return {
              id: `pair-${index}`,
              key,
              type: 'boolean',
              booleanValue: value,
            };
          } else if (value === null) {
            return {
              id: `pair-${index}`,
              key,
              type: 'null',
            };
          } else {
            return {
              id: `pair-${index}`,
              key,
              type: 'string',
              value: String(value),
            };
          }
        },
      );

      // Se vazio, começar com um par vazio
      if (pairs.length === 0) {
        pairs.push({ id: 'pair-0', key: '', type: 'string', value: '' });
      }

      setObjectPairs(pairs);
    }
  }, [isOpen, initialObject]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      closeOnEscape={!isNested}
      closeOnOverlayClick={!isNested}
      className={isNested ? 'z-[50]' : ''}
      contentClassName="max-w-[50vw] max-h-[90vh] overflow-hidden flex flex-col"
    >
      <EditObjectForm
        objectPairs={objectPairs}
        setObjectPairs={setObjectPairs}
        onSave={onSave}
        onClose={onClose}
        columnName={columnName}
        isNested={isNested}
      />
    </Dialog>
  );
}
