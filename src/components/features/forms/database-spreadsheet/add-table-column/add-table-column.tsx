'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { FormSelect } from '@/components/ui/select';
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useForm } from '@/hooks/use-form';
import { addColumnSchema } from './add-table-column.schema';
import { AddColumnDialogProps, Column } from './add-table-column.type';

// Componente interno que usa useForm dentro do contexto do Form
function AddColumnForm({
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
  onSubmit: (columns: Column[]) => Promise<void>;
  onClose: () => void;
}) {
  // Estado para controlar quais colunas estão expandidas
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
      { name: '', type: 'string', required: false, default: '', unique: false },
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

  const handleSubmit = async () => {
    // Validação manual das colunas
    const validColumns = columns.filter((col) => col.name.trim() !== '');

    if (validColumns.length === 0) {
      alert('Pelo menos uma coluna com nome é obrigatória');
      return;
    }

    // Verificar se todas as colunas válidas têm nome e tipo
    for (const col of validColumns) {
      if (!col.name.trim()) {
        alert('Nome da coluna é obrigatório');
        return;
      }
      if (!col.type) {
        alert('Tipo da coluna é obrigatório');
        return;
      }
    }

    try {
      await onSubmit(validColumns);
      // Reset form
      setColumns([
        {
          name: '',
          type: 'string',
          required: false,
          default: '',
          unique: false,
        },
      ]);
      setExpandedColumns(new Set([0]));
      onClose();
    } catch (error) {
      console.error('Error adding columns:', error);
    }
  };

  return (
    <Form
      className="flex flex-col gap-4"
      zodSchema={addColumnSchema}
      onSubmit={handleSubmit}
    >
      <FormContent
        columns={columns}
        setColumns={setColumns}
        expandedColumns={expandedColumns}
        setExpandedColumns={setExpandedColumns}
        addColumn={addColumn}
        removeColumn={removeColumn}
        updateColumn={updateColumn}
        toggleColumnExpansion={toggleColumnExpansion}
      />
    </Form>
  );
}

// Componente que usa useForm dentro do Form
function FormContent({
  columns,
  expandedColumns,
  addColumn,
  removeColumn,
  updateColumn,
  toggleColumnExpansion,
}: {
  columns: Column[];
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
  expandedColumns: Set<number>;
  setExpandedColumns: React.Dispatch<React.SetStateAction<Set<number>>>;
  addColumn: () => void;
  removeColumn: (index: number) => void;
  updateColumn: (
    index: number,
    field: keyof Column,
    value: string | boolean,
  ) => void;
  toggleColumnExpansion: (index: number) => void;
}) {
  const { errors } = useForm();

  return (
    <>
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
              <div key={index} className="border border-gray-200 rounded-lg">
                {/* Header da Coluna - Sempre visível */}
                <div className="p-3 flex items-center justify-between bg-neutral-50">
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

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="checkbox"
                          fieldName={`column_unique_${index}`}
                          checked={column.unique || false}
                          onChange={(e) =>
                            updateColumn(index, 'unique', e.target.checked)
                          }
                        />
                        <FormControl variant="label">
                          <Typography variant="span" className="text-sm">
                            Valor único (UNIQUE)
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
        <SubmitButton
          variant="gradient"
          className="gap-2"
          onClick={() => console.log(errors)}
        >
          Adicionar Colunas
        </SubmitButton>
      </div>
    </>
  );
}

export function AddColumnDialog({
  isOpen,
  onClose,
  onSubmit,
  tableName,
}: AddColumnDialogProps) {
  const [columns, setColumns] = useState<Column[]>([
    { name: '', type: 'string', required: false, default: '', unique: false },
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
          ➕ Adicionar Colunas à Tabela &quot;{tableName}&quot;
        </Typography>

        <AddColumnForm
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
