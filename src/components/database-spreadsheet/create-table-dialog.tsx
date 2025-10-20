'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { FormSelect } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { FieldValues } from 'react-hook-form';

interface CreateTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tableName: string, columns: Column[]) => Promise<void>;
}

interface Column {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  default: string;
}

const createTableSchema = z.object({
  tableName: z.string().min(1, 'Nome da tabela é obrigatório'),
});

export function CreateTableDialog({
  isOpen,
  onClose,
  onSubmit,
}: CreateTableDialogProps) {
  const [columns, setColumns] = useState<Column[]>([
    { name: '', type: 'string', required: false, default: '' },
  ]);
  const [loading, setLoading] = useState(false);

  const addColumn = () => {
    setColumns([
      ...columns,
      { name: '', type: 'string', required: false, default: '' },
    ]);
  };

  const removeColumn = (index: number) => {
    if (columns.length > 1) {
      setColumns(columns.filter((_, i) => i !== index));
    }
  };

  const updateColumn = (
    index: number,
    field: keyof Column,
    value: string | boolean,
  ) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setColumns(newColumns);
  };

  const handleSubmit = async (data: FieldValues) => {
    setLoading(true);
    try {
      await onSubmit(data.tableName, columns);
      // Reset form
      setColumns([{ name: '', type: 'string', required: false, default: '' }]);
      onClose();
    } catch (error) {
      console.error('Error creating table:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      contentClassName="max-w-3xl max-h-[90vh] overflow-auto"
    >
      <div className="p-6">
        <Typography variant="h2" className="text-neutral-600 mb-6">
          🗄️ Criar Nova Tabela
        </Typography>

        <Form
          className="flex flex-col gap-4"
          zodSchema={createTableSchema}
          onSubmit={handleSubmit}
        >
          {/* Nome da Tabela */}
          <div>
            <FormControl variant="label">Nome da Tabela *</FormControl>
            <Input
              type="text"
              fieldName="tableName"
              placeholder="Ex: leads, customers, orders"
            />
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              Use letras, números, _ e -
            </Typography>
          </div>

          {/* Colunas */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <FormControl variant="label">Colunas *</FormControl>
              <Button
                type="button"
                variant="gradient"
                onClick={addColumn}
                className="w-fit gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Coluna
              </Button>
            </div>

            <div className="space-y-3">
              {columns.map((column, index) => (
                <div
                  key={index}
                  className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Typography variant="span" className="text-sm font-medium">
                      Coluna {index + 1}
                    </Typography>
                    {columns.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeColumn(index)}
                        className="text-red-500 hover:text-red-700 p-1 h-fit w-fit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Nome *
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName={`column_name_${index}`}
                      value={column.name}
                      onChange={(e) =>
                        updateColumn(index, 'name', e.target.value)
                      }
                      placeholder="Ex: nome, email, score"
                    />
                  </div>

                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Tipo *
                      </Typography>
                    </FormControl>
                    <FormSelect
                      fieldName={`column_type_${index}`}
                      placeholder="Selecione o tipo"
                      value={column.type}
                      onValueChange={(value) =>
                        updateColumn(index, 'type', value)
                      }
                      options={[
                        { value: 'string', label: '📝 Texto (string)' },
                        { value: 'number', label: '🔢 Número (number)' },
                        {
                          value: 'boolean',
                          label: '✅ Verdadeiro/Falso (boolean)',
                        },
                        { value: 'date', label: '📅 Data (date)' },
                        { value: 'array', label: '📋 Lista (array)' },
                        { value: 'object', label: '📦 Objeto (object)' },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`column_required_${index}`}
                      checked={column.required}
                      onChange={(e) =>
                        updateColumn(index, 'required', e.target.checked)
                      }
                      className="w-4 h-4"
                    />
                    <label
                      htmlFor={`column_required_${index}`}
                      className="text-sm"
                    >
                      Campo obrigatório
                    </label>
                  </div>

                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Valor padrão (opcional)
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName={`column_default_${index}`}
                      value={column.default}
                      onChange={(e) =>
                        updateColumn(index, 'default', e.target.value)
                      }
                      placeholder="Ex: 0, true, []"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              onClick={onClose}
              variant="gradient"
              bgHexColor="#6b7280"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={loading}
              className="gap-2"
            >
              {loading ? 'Criando...' : 'Criar Tabela'}
            </Button>
          </div>
        </Form>
      </div>
    </Dialog>
  );
}
