'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { FormSelect } from '@/components/ui/select';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { FieldValues } from 'react-hook-form';
import { SubmitButton } from '@/components/ui/submit-button';
import { createTableSchema } from './create-database-table.schema';
import { CreateTableDialogProps, Column } from './create-database-table.type';

// Componente interno do formulário
function CreateTableForm({
  columns,
  setColumns,
  expandedColumns,
  setExpandedColumns,
  onSubmit,
  onClose,
}: {
  columns: Column[];
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
  expandedColumns: Set<number>;
  setExpandedColumns: React.Dispatch<React.SetStateAction<Set<number>>>;
  onSubmit: (tableName: string, columns: Column[]) => Promise<void>;
  onClose: () => void;
}) {
  // Função para alternar expansão de uma coluna
  const toggleColumnExpansion = (index: number) => {
    setExpandedColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const addColumn = () => {
    const newIndex = columns.length;
    setColumns([
      ...columns,
      { name: '', type: 'string', required: false, default: '' },
    ]);
    // Expandir a nova coluna automaticamente
    setExpandedColumns((prev) => new Set([...Array.from(prev), newIndex]));
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
    try {
      await onSubmit(data.tableName, columns);
      // Reset form
      setColumns([{ name: '', type: 'string', required: false, default: '' }]);
      setExpandedColumns(new Set([0]));
      onClose();
    } catch (error) {
      console.error('Error creating table:', error);
    }
  };

  return (
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
        <div className="flex items-center justify-between relative mt-4">
          <FormControl variant="label">Colunas *</FormControl>
          <Button
            type="button"
            variant="gradient"
            onClick={addColumn}
            className="w-fit gap-2 absolute -top-4 right-0"
          >
            <Plus className="w-4 h-4" />
            Adicionar Coluna
          </Button>
        </div>

        <div className="space-y-3">
          {columns.map((column, index) => {
            const isExpanded = expandedColumns.has(index);

            return (
              <div
                key={index}
                className="border border-gray-200 rounded-lg bg-white"
              >
                {/* Header da Coluna - Sempre visível */}
                <div className="p-3 flex items-center justify-between bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => toggleColumnExpansion(index)}
                      className="h-fit w-fit p-1 hover:bg-gray-200"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </Button>
                    <div className="flex flex-col flex-1">
                      <Typography
                        variant="span"
                        className="text-sm font-medium"
                      >
                        Coluna {index + 1}
                      </Typography>
                      {column.name && (
                        <Typography
                          variant="span"
                          className="text-xs text-gray-500"
                        >
                          {column.name}
                        </Typography>
                      )}
                    </div>
                  </div>
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

                {/* Conteúdo da Coluna - Colapsável */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-gray-200 pt-3">
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
                      <div className="flex items-center gap-2">
                        <Input
                          type="checkbox"
                          fieldName={`column_required_${index}`}
                          checked={column.required}
                          onChange={(e) =>
                            updateColumn(index, 'required', e.target.checked)
                          }
                        />
                        <FormControl variant="label">
                          <Typography variant="span" className="text-sm">
                            Campo obrigatório
                          </Typography>
                        </FormControl>
                      </div>
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
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <SubmitButton variant="gradient" className="gap-2">
          Criar Tabela
        </SubmitButton>
      </div>
    </Form>
  );
}

export function CreateTableDialog({
  isOpen,
  onClose,
  onSubmit,
}: CreateTableDialogProps) {
  const [columns, setColumns] = useState<Column[]>([
    { name: '', type: 'string', required: false, default: '' },
  ]);

  // Estado para controlar quais colunas estão expandidas
  const [expandedColumns, setExpandedColumns] = useState<Set<number>>(
    new Set([0]),
  ); // Primeira coluna expandida por padrão

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      contentClassName="max-w-3xl max-h-[90vh] overflow-auto"
    >
      <div className="p-6" style={{ zoom: 0.9 }}>
        <Typography variant="h2" className="whitespace-nowrap truncate mb-6">
          🗄️ Criar Nova Tabela
        </Typography>

        <CreateTableForm
          columns={columns}
          setColumns={setColumns}
          expandedColumns={expandedColumns}
          setExpandedColumns={setExpandedColumns}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      </div>
    </Dialog>
  );
}
