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
import { Plus, Trash2, X, Key } from 'lucide-react';
import { z } from 'zod';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { EditObjectDialog } from './edit-object';

const editArraySchema = z.object({
  // Schema vazio pois estamos validando manualmente os itens do array
});

interface EditArrayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (array: unknown[]) => void;
  initialArray: unknown[];
  columnName: string;
  isNested?: boolean;
}

type ItemType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'object'
  | 'array'
  | 'json';

interface ArrayItem {
  id: string;
  type: ItemType;
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

// Componente interno que usa useForm dentro do contexto do Form
function EditArrayForm({
  arrayItems,
  setArrayItems,
  onSave,
  onClose,
  columnName,
  isNested = false,
}: {
  arrayItems: ArrayItem[];
  setArrayItems: React.Dispatch<React.SetStateAction<ArrayItem[]>>;
  onSave: (array: unknown[]) => void;
  onClose: () => void;
  columnName: string;
  isNested?: boolean;
}) {
  const addItem = () => {
    const newItem: ArrayItem = {
      id: `item-${Date.now()}`,
      type: 'string',
      value: '',
    };
    setArrayItems((prev) => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setArrayItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemType = (id: string, type: ItemType) => {
    setArrayItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        // Resetar valores ao mudar de tipo
        const newItem: ArrayItem = { id: item.id, type };

        switch (type) {
          case 'string':
          case 'number':
            newItem.value = '';
            break;
          case 'boolean':
            newItem.booleanValue = true;
            break;
          case 'null':
            // Sem valores adicionais
            break;
          case 'object':
            newItem.objectPairs = [{ key: '', value: '' }];
            break;
          case 'array':
            newItem.arrayValue = '[]';
            break;
          case 'json':
            newItem.jsonValue = '';
            break;
        }

        return newItem;
      }),
    );
  };

  const updateItemValue = (id: string, value: string) => {
    setArrayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value } : item)),
    );
  };

  const updateItemBooleanValue = (id: string, booleanValue: boolean) => {
    setArrayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, booleanValue } : item)),
    );
  };

  const updateItemArrayValue = (id: string, arrayValue: string) => {
    setArrayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, arrayValue } : item)),
    );
  };

  const updateItemJsonValue = (id: string, jsonValue: string) => {
    setArrayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, jsonValue } : item)),
    );
  };

  const updateItemObjectPairs = (
    id: string,
    objectPairs: Array<{ key: string; value: string }>,
  ) => {
    setArrayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, objectPairs } : item)),
    );
  };

  const handleSubmit = async (data: FieldValues) => {
    // Converter items para array final
    const processedArray = arrayItems.map((item) => {
      switch (item.type) {
        case 'string':
          return item.value || '';

        case 'number':
          return item.value ? Number(item.value) : 0;

        case 'boolean':
          return item.booleanValue ?? true;

        case 'null':
          return null;

        case 'object':
          const obj: Record<string, unknown> = {};
          item.objectPairs?.forEach((pair) => {
            if (pair.key.trim()) {
              const key = pair.key.trim();
              const value = pair.value.trim();

              // Tentar converter valor automaticamente
              let processedValue: unknown = value;

              if (!isNaN(Number(value)) && value !== '') {
                processedValue = Number(value);
              } else if (value.toLowerCase() === 'true') {
                processedValue = true;
              } else if (value.toLowerCase() === 'false') {
                processedValue = false;
              } else if (value.toLowerCase() === 'null') {
                processedValue = null;
              } else if (value.startsWith('{') || value.startsWith('[')) {
                try {
                  processedValue = JSON.parse(value);
                } catch {
                  processedValue = value;
                }
              } else if (value === '') {
                processedValue = null;
              }

              obj[key] = processedValue;
            }
          });
          return obj;

        case 'array':
          try {
            return JSON.parse(item.arrayValue || '[]');
          } catch {
            return [];
          }

        case 'json':
          try {
            return JSON.parse(item.jsonValue || 'null');
          } catch {
            // Se falhar o parse, retornar a string original
            return item.jsonValue || null;
          }

        default:
          return null;
      }
    });

    onSave(processedArray);

    // Se não for aninhado, fechar o dialog
    // Se for aninhado, o onSave (handleSaveNestedArray) já gerencia o fechamento
    if (!isNested) {
      onClose();
    }
  };

  return (
    <Form
      className="flex flex-col gap-4 flex-1 overflow-hidden"
      zodSchema={editArraySchema}
      onSubmit={handleSubmit}
    >
      <FormContent
        arrayItems={arrayItems}
        setArrayItems={setArrayItems}
        onClose={onClose}
        columnName={columnName}
      />
    </Form>
  );
}

// Componente para editar objetos aninhados
function ObjectEditor({
  item,
  updateItemObjectPairs,
}: {
  item: ArrayItem;
  updateItemObjectPairs: (
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
    setObjectPairs(item.objectPairs || [{ key: '', value: '' }]);
  }, [item.objectPairs]);

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

    updateItemObjectPairs(item.id, pairs);

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
            Objeto
          </Typography>
        </FormControl>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
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

// Componente para editar arrays aninhados
function ArrayEditor({
  item,
  updateItemArrayValue,
}: {
  item: ArrayItem;
  updateItemArrayValue: (id: string, arrayValue: string) => void;
}) {
  const [showNestedDialog, setShowNestedDialog] = useState(false);
  const [nestedArray, setNestedArray] = useState<unknown[]>([]);
  const isClosingRef = React.useRef(false);

  // Parsear o array atual
  useEffect(() => {
    try {
      const parsed = JSON.parse(item.arrayValue || '[]');
      setNestedArray(Array.isArray(parsed) ? parsed : []);
    } catch {
      setNestedArray([]);
    }
  }, [item.arrayValue]);

  const handleEditArray = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isClosingRef.current = false;
    setShowNestedDialog(true);
  };

  const handleSaveNestedArray = (newArray: unknown[]) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    updateItemArrayValue(item.id, JSON.stringify(newArray));

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

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
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

// Componente que renderiza o conteúdo do formulário
function FormContent({
  arrayItems,
  setArrayItems,
  onClose,
  columnName,
}: {
  arrayItems: ArrayItem[];
  setArrayItems: React.Dispatch<React.SetStateAction<ArrayItem[]>>;
  onClose: () => void;
  columnName: string;
}) {
  const { errors, setValue } = useForm();

  // Inicializar valores do formulário quando os items mudarem
  React.useEffect(() => {
    // Usar setTimeout para garantir que o formulário está pronto
    const timer = setTimeout(() => {
      arrayItems.forEach((item) => {
        setValue(`type_${item.id}`, item.type);

        if (item.type === 'boolean') {
          const boolValue = item.booleanValue ? 'true' : 'false';
          setValue(`booleanValue_${item.id}`, boolValue);
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [arrayItems, setValue]);

  const addItem = () => {
    const newItem: ArrayItem = {
      id: `item-${Date.now()}`,
      type: 'string',
      value: '',
    };
    setArrayItems((prev) => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setArrayItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemType = (id: string, type: ItemType) => {
    setArrayItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        // Resetar valores ao mudar de tipo
        const newItem: ArrayItem = { id: item.id, type };

        switch (type) {
          case 'string':
          case 'number':
            newItem.value = '';
            break;
          case 'boolean':
            newItem.booleanValue = true;
            break;
          case 'null':
            // Sem valores adicionais
            break;
          case 'object':
            newItem.objectPairs = [{ key: '', value: '' }];
            break;
          case 'array':
            newItem.arrayValue = '[]';
            break;
          case 'json':
            newItem.jsonValue = '';
            break;
        }

        return newItem;
      }),
    );
  };

  const updateItemValue = (id: string, value: string) => {
    setArrayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value } : item)),
    );
  };

  const updateItemBooleanValue = (id: string, booleanValue: boolean) => {
    setArrayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, booleanValue } : item)),
    );
  };

  const updateItemArrayValue = (id: string, arrayValue: string) => {
    setArrayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, arrayValue } : item)),
    );
  };

  const updateItemJsonValue = (id: string, jsonValue: string) => {
    setArrayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, jsonValue } : item)),
    );
  };

  const updateItemObjectPairs = (
    id: string,
    objectPairs: Array<{ key: string; value: string }>,
  ) => {
    setArrayItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, objectPairs } : item)),
    );
  };

  const getTypeBadgeColor = (type: ItemType) => {
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

  const getTypeLabel = (type: ItemType) => {
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
          ✏️ Editar Array - {columnName}
        </Typography>
        <Button
          type="button"
          onClick={addItem}
          variant="gradient"
          className="gap-2 w-fit"
        >
          <Plus className="w-4 h-4" />
          Adicionar Valor
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {arrayItems.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            <Typography variant="p">
              Nenhum item no array. Clique em "Adicionar Valor" para começar.
            </Typography>
          </div>
        ) : (
          arrayItems.map((item, index) => (
            <div
              key={item.id}
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
                    className={`text-xs px-2 py-1 rounded ${getTypeBadgeColor(item.type)}`}
                  >
                    {getTypeLabel(item.type)}
                  </Typography>
                </div>

                <Button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 p-2 w-fit"
                  title="Remover item"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {/* Select de Tipo */}
                <div>
                  <FormControl variant="label">
                    <Typography variant="span" className="text-sm font-medium">
                      Tipo do Valor
                    </Typography>
                  </FormControl>
                  <FormSelect
                    fieldName={`type_${item.id}`}
                    onValueChange={(value) =>
                      updateItemType(item.id, value as ItemType)
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
                {item.type === 'json' && (
                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        JSON
                      </Typography>
                    </FormControl>
                    <textarea
                      value={item.jsonValue || ''}
                      onChange={(e) =>
                        updateItemJsonValue(item.id, e.target.value)
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

                {(item.type === 'string' || item.type === 'number') && (
                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Valor
                      </Typography>
                    </FormControl>
                    <Input
                      type={item.type === 'number' ? 'number' : 'text'}
                      fieldName={`value_${item.id}`}
                      value={item.value || ''}
                      onChange={(e) => updateItemValue(item.id, e.target.value)}
                      placeholder={
                        item.type === 'number'
                          ? 'Digite um número'
                          : 'Digite o texto'
                      }
                      className="w-full"
                    />
                  </div>
                )}

                {item.type === 'boolean' && (
                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Valor
                      </Typography>
                    </FormControl>
                    <FormSelect
                      fieldName={`booleanValue_${item.id}`}
                      onValueChange={(value) =>
                        updateItemBooleanValue(item.id, value === 'true')
                      }
                      options={[
                        { value: 'true', label: '✅ True (verdadeiro)' },
                        { value: 'false', label: '❌ False (falso)' },
                      ]}
                      className="w-full"
                    />
                  </div>
                )}

                {item.type === 'null' && (
                  <div className="text-center py-4 text-neutral-500 bg-gray-50 rounded border border-dashed">
                    <Typography variant="span" className="text-sm">
                      Este valor será <strong>null</strong> (vazio)
                    </Typography>
                  </div>
                )}

                {item.type === 'object' && (
                  <ObjectEditor
                    item={item}
                    updateItemObjectPairs={updateItemObjectPairs}
                  />
                )}

                {item.type === 'array' && (
                  <ArrayEditor
                    item={item}
                    updateItemArrayValue={updateItemArrayValue}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <SubmitButton variant="gradient" className="gap-2">
          Salvar
        </SubmitButton>
      </div>
    </div>
  );
}

export function EditArrayDialog({
  isOpen,
  onClose,
  onSave,
  initialArray,
  columnName,
  isNested = false,
}: EditArrayDialogProps) {
  const [arrayItems, setArrayItems] = useState<ArrayItem[]>([]);

  // Inicializar array quando o dialog abrir
  useEffect(() => {
    if (isOpen) {
      const items: ArrayItem[] = initialArray.map((item, index) => {
        if (Array.isArray(item)) {
          return {
            id: `item-${index}`,
            type: 'array',
            arrayValue: JSON.stringify(item),
          };
        } else if (typeof item === 'object' && item !== null) {
          const objectPairs = Object.entries(item).map(([key, value]) => ({
            key,
            value: String(value),
          }));
          return {
            id: `item-${index}`,
            type: 'object',
            objectPairs,
          };
        } else if (typeof item === 'number') {
          return {
            id: `item-${index}`,
            type: 'number',
            value: String(item),
          };
        } else if (typeof item === 'boolean') {
          return {
            id: `item-${index}`,
            type: 'boolean',
            booleanValue: item,
          };
        } else if (item === null) {
          return {
            id: `item-${index}`,
            type: 'null',
          };
        } else {
          return {
            id: `item-${index}`,
            type: 'string',
            value: String(item),
          };
        }
      });
      setArrayItems(items);
    }
  }, [isOpen, initialArray]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      closeOnEscape={!isNested}
      closeOnOverlayClick={!isNested}
      className={isNested ? 'z-[50]' : ''}
      contentClassName="max-w-[50vw] max-h-[100vh] overflow-hidden flex flex-col"
    >
      <EditArrayForm
        arrayItems={arrayItems}
        setArrayItems={setArrayItems}
        onSave={onSave}
        onClose={onClose}
        columnName={columnName}
        isNested={isNested}
      />
    </Dialog>
  );
}
