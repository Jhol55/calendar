'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { FormSelect } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Typography } from '@/components/ui/typography';
import { EditArrayDialog } from '@/components/layout/database-spreadsheet/edit-array';
import { EditObjectDialog } from '@/components/layout/database-spreadsheet/edit-object';

interface SmartFieldInputProps {
  fieldName: string;
  value: string;
  onChange: (value: string) => void;
  columnType?: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  placeholder?: string;
}

/**
 * Componente que renderiza um input inteligente baseado no tipo da coluna
 */
export function SmartFieldInput({
  fieldName,
  value,
  onChange,
  columnType = 'string',
  placeholder,
}: SmartFieldInputProps) {
  const [showArrayDialog, setShowArrayDialog] = useState(false);
  const [showObjectDialog, setShowObjectDialog] = useState(false);

  // Parse do valor atual para exibição
  const getParsedValue = () => {
    try {
      return JSON.parse(value || '[]');
    } catch {
      return [];
    }
  };

  const getObjectValue = () => {
    try {
      return JSON.parse(value || '{}');
    } catch {
      return {};
    }
  };

  // Renderizar input baseado no tipo
  switch (columnType) {
    case 'array':
      const arrayValue = getParsedValue();
      const arrayDisplay =
        Array.isArray(arrayValue) && arrayValue.length > 0
          ? `[Array com ${arrayValue.length} ${arrayValue.length === 1 ? 'item' : 'itens'}]`
          : '[Array vazio]';

      return (
        <div className="w-full">
          <div className="flex gap-2 items-center">
            <div className="flex-1 whitespace-nowrap px-3 py-2 bg-neutral-100 border border-gray-300 rounded-md text-sm text-gray-700">
              {arrayDisplay}
            </div>
            <Button
              type="button"
              variant="gradient"
              onClick={() => setShowArrayDialog(true)}
              className="px-4 whitespace-nowrap w-fit"
            >
              Editar Array
            </Button>
          </div>

          <EditArrayDialog
            isOpen={showArrayDialog}
            onClose={() => setShowArrayDialog(false)}
            onSave={(newArray) => {
              onChange(JSON.stringify(newArray));
              setShowArrayDialog(false);
            }}
            initialArray={arrayValue}
            columnName={fieldName}
          />
        </div>
      );

    case 'object':
      const objectValue = getObjectValue();
      const objectKeys = Object.keys(objectValue);
      const objectDisplay =
        objectKeys.length > 0
          ? `{Objeto com ${objectKeys.length} ${objectKeys.length === 1 ? 'propriedade' : 'propriedades'}}`
          : '{Objeto vazio}';

      return (
        <div className="w-full">
          <div className="flex gap-2 items-center">
            <div className="flex-1 whitespace-nowrap px-3 py-2 bg-neutral-100 border border-gray-300 rounded-md text-sm text-gray-700">
              {objectDisplay}
            </div>
            <Button
              type="button"
              variant="gradient"
              onClick={() => setShowObjectDialog(true)}
              className="px-4 whitespace-nowrap w-fit"
            >
              Editar Objeto
            </Button>
          </div>

          <EditObjectDialog
            isOpen={showObjectDialog}
            onClose={() => setShowObjectDialog(false)}
            onSave={(newObject) => {
              onChange(JSON.stringify(newObject));
              setShowObjectDialog(false);
            }}
            initialObject={objectValue}
            columnName={fieldName}
          />
        </div>
      );

    case 'boolean':
      return (
        <FormSelect
          fieldName={fieldName}
          placeholder={placeholder || 'Selecione verdadeiro ou falso'}
          onValueChange={onChange}
          options={[
            { value: 'true', label: '✅ Verdadeiro (true)' },
            { value: 'false', label: '❌ Falso (false)' },
          ]}
          className="w-full"
        />
      );

    case 'number':
      return (
        <Input
          type="text"
          fieldName={fieldName}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder || 'Ex: {{input.score}} ou 42 ou {{variavel}}'
          }
        />
      );

    case 'date':
      return (
        <Input
          type="text"
          fieldName={fieldName}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            placeholder || 'Ex: {{input.date}} ou 2024-01-15 ou {{variavel}}'
          }
        />
      );

    case 'string':
    default:
      return (
        <Input
          type="text"
          fieldName={fieldName}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || 'Ex: {{input.name}} ou valor fixo'}
        />
      );
  }
}
