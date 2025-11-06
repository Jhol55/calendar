'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Typography } from '@/components/ui/typography';
import { SubmitButton } from '@/components/ui/submit-button';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { FormSelect } from '@/components/ui/select';
import { useForm } from '@/hooks/use-form';
import { editColumnSchema } from './edit-table-column.schema';
import { EditColumnDialogProps, ColumnData } from './edit-table-column.type';

// Componente interno que usa useForm dentro do contexto do Form
function EditColumnForm({
  columnData,
  setColumnData,
  onSubmit,
  onClose,
}: {
  columnData: ColumnData;
  setColumnData: React.Dispatch<React.SetStateAction<ColumnData>>;
  onSubmit: (updatedColumn: ColumnData) => Promise<void>;
  onClose: () => void;
}) {
  const updateColumn = (field: keyof ColumnData, value: string | boolean) => {
    setColumnData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validação manual
    if (!columnData.name.trim()) {
      alert('Nome da coluna é obrigatório');
      return;
    }

    if (!columnData.type) {
      alert('Tipo da coluna é obrigatório');
      return;
    }

    try {
      await onSubmit(columnData);
      onClose();
    } catch (error) {
      console.error('Error editing column:', error);
    }
  };

  return (
    <Form
      className="flex flex-col gap-4"
      zodSchema={editColumnSchema}
      onSubmit={handleSubmit}
    >
      <FormContent columnData={columnData} updateColumn={updateColumn} />
    </Form>
  );
}

// Componente que usa useForm dentro do Form
function FormContent({
  columnData,
  updateColumn,
}: {
  columnData: ColumnData;
  updateColumn: (field: keyof ColumnData, value: string | boolean) => void;
}) {
  const { errors, setValue } = useForm();

  // Inicializar todos os valores do formulário quando o dialog abrir
  useEffect(() => {
    setTimeout(() => {
      setValue('column_name', columnData.name);
      setValue('column_type', columnData.type);
      setValue('column_required', columnData.required);
      setValue('column_unique', columnData.unique || false);
      setValue('column_default', columnData.default);
    }, 100);
  }, [columnData, setValue]);

  return (
    <>
      {/* Campos do formulário */}
      <div className="space-y-4 border-t pt-4">
        {/* Nome da coluna */}
        <div>
          <FormControl variant="label">
            <Typography variant="span" className="text-sm">
              Nome da Coluna *
            </Typography>
          </FormControl>
          <Input
            type="text"
            fieldName="column_name"
            value={columnData.name}
            onChange={(e) => updateColumn('name', e.target.value)}
            placeholder="Digite o nome da coluna"
            autoFocus
          />
          <Typography variant="span" className="text-xs text-neutral-500 mt-1">
            Use apenas letras, números, _ e -
          </Typography>
        </div>

        {/* Tipo da coluna */}
        <div>
          <FormControl variant="label">
            <Typography variant="span" className="text-sm">
              Tipo *
            </Typography>
          </FormControl>
          <FormSelect
            fieldName="column_type"
            placeholder="Selecione o tipo"
            onValueChange={(value) => updateColumn('type', value)}
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

        {/* Campo obrigatório */}
        <div className="flex items-center gap-2">
          <Input
            type="checkbox"
            fieldName="column_required"
            checked={columnData.required}
            onChange={(e) => updateColumn('required', e.target.checked)}
            className="bg-neutral-200"
          />
          <FormControl variant="label">
            <Typography variant="span" className="text-sm cursor-pointer">
              Campo obrigatório
            </Typography>
          </FormControl>
        </div>
        <Typography variant="span" className="text-xs text-neutral-500 -mt-2">
          Se marcado, este campo não pode ficar vazio
        </Typography>

        {/* Valor único (UNIQUE) */}
        <div className="flex items-center gap-2">
          <Input
            type="checkbox"
            fieldName="column_unique"
            checked={columnData.unique || false}
            onChange={(e) => updateColumn('unique', e.target.checked)}
            className="bg-neutral-200"
          />
          <FormControl variant="label">
            <Typography variant="span" className="text-sm cursor-pointer">
              Valor único (UNIQUE)
            </Typography>
          </FormControl>
        </div>
        <Typography variant="span" className="text-xs text-neutral-500 -mt-2">
          Garante que não haja valores duplicados nesta coluna
        </Typography>

        {/* Valor padrão */}
        <div>
          <FormControl variant="label">
            <Typography variant="span" className="text-sm">
              Valor Padrão (opcional)
            </Typography>
          </FormControl>
          <Input
            type="text"
            fieldName="column_default"
            value={columnData.default}
            onChange={(e) => updateColumn('default', e.target.value)}
            placeholder="Ex: 0, true, []"
          />
          <Typography variant="span" className="text-xs text-neutral-500 mt-1">
            Valor usado ao criar novas linhas
          </Typography>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t">
        <SubmitButton
          variant="gradient"
          className="gap-2 w-full"
          onClick={() => console.log(errors)}
        >
          Salvar Alterações
        </SubmitButton>
      </div>
    </>
  );
}

export function EditColumnDialog({
  isOpen,
  onClose,
  onSubmit,
  columnData: initialColumnData,
}: EditColumnDialogProps) {
  const [columnData, setColumnData] = useState<ColumnData>(initialColumnData);

  // Atualizar estado quando columnData mudar
  useEffect(() => {
    setColumnData(initialColumnData);
  }, [initialColumnData]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeButton={true}
      contentClassName="max-w-[50vw] max-h-[90vh] overflow-auto"
    >
      <div className="p-6" style={{ zoom: 0.9 }}>
        <div className="flex flex-col gap-2 mb-6">
          <Typography
            variant="h3"
            className="text-xl font-bold text-neutral-800"
          >
            ✏️ Editar Coluna
          </Typography>
          <Typography variant="p" className="text-neutral-600">
            Edite as propriedades da coluna{' '}
            <strong>{initialColumnData.name}</strong>
          </Typography>
        </div>

        <EditColumnForm
          columnData={columnData}
          setColumnData={setColumnData}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      </div>
    </Dialog>
  );
}
