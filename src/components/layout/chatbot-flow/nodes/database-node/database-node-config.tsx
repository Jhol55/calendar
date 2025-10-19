'use client';

import React, { useEffect, useState } from 'react';
import { DatabaseConfig } from '../../types';
import { Typography } from '@/components/ui/typography';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { databaseConfigSchema } from './database-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { FormSelect } from '@/components/ui/select';
import { NodeConfigLayout } from '../node-config-layout';
import { Plus, Trash2 } from 'lucide-react';

interface DatabaseNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: DatabaseConfig;
  onSave: (config: DatabaseConfig) => void;
  nodeId?: string;
  flowId?: string;
}

interface Column {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  default: string;
}

interface RecordField {
  key: string;
  value: string;
}

interface FilterRule {
  field: string;
  operator: string;
  value: string;
}

function DatabaseFormFields({ config }: { config?: DatabaseConfig }) {
  const { form, setValue } = useForm();
  const operation = form.operation || 'insert';

  // Estados para gerenciar listas dinâmicas
  const [columns, setColumns] = useState<Column[]>([
    { name: '', type: 'string', required: false, default: '' },
  ]);

  const [columnsToRemove, setColumnsToRemove] = useState<string[]>(['']);

  const [recordFields, setRecordFields] = useState<RecordField[]>([
    { key: '', value: '' },
  ]);

  const [updateFields, setUpdateFields] = useState<RecordField[]>([
    { key: '', value: '' },
  ]);

  const [filterRules, setFilterRules] = useState<FilterRule[]>([
    { field: '', operator: 'equals', value: '' },
  ]);

  const [filterCondition, setFilterCondition] = useState<'AND' | 'OR'>('AND');

  // Carregar config existente
  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        setValue('operation', config.operation || 'insert');
        setValue('tableName', config.tableName || '');

        if (config.columns) {
          setColumns(config.columns);
          setValue('columns', JSON.stringify(config.columns));
        }

        if (config.columnsToRemove) {
          setColumnsToRemove(config.columnsToRemove);
          setValue('columnsToRemove', JSON.stringify(config.columnsToRemove));
        }

        if (config.record) {
          const fields = Object.entries(config.record).map(([key, value]) => ({
            key,
            value: String(value),
          }));
          setRecordFields(fields);
          setValue('record', JSON.stringify(config.record));
        }

        if (config.updates) {
          const fields = Object.entries(config.updates).map(([key, value]) => ({
            key,
            value: String(value),
          }));
          setUpdateFields(fields);
          setValue('updates', JSON.stringify(config.updates));
        }

        if (config.filters) {
          setFilterCondition(config.filters.condition);
          setFilterRules(config.filters.rules);
          setValue('filters', JSON.stringify(config.filters));
        }

        if (config.sort) {
          setValue('sortField', config.sort.field);
          setValue('sortOrder', config.sort.order);
        }

        if (config.pagination) {
          setValue('limit', config.pagination.limit?.toString() || '');
          setValue('offset', config.pagination.offset?.toString() || '');
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [config, setValue]);

  // Sincronizar columns com formulário
  useEffect(() => {
    setValue('columns', JSON.stringify(columns));
  }, [columns, setValue]);

  // Sincronizar columnsToRemove com formulário
  useEffect(() => {
    setValue(
      'columnsToRemove',
      JSON.stringify(columnsToRemove.filter((c) => c.trim() !== '')),
    );
  }, [columnsToRemove, setValue]);

  // Sincronizar record com formulário
  useEffect(() => {
    const record: Record<string, string> = {};
    recordFields.forEach((field) => {
      if (field.key.trim() !== '') {
        record[field.key] = field.value;
      }
    });
    setValue('record', JSON.stringify(record));
  }, [recordFields, setValue]);

  // Sincronizar updates com formulário
  useEffect(() => {
    const updates: Record<string, string> = {};
    updateFields.forEach((field) => {
      if (field.key.trim() !== '') {
        updates[field.key] = field.value;
      }
    });
    setValue('updates', JSON.stringify(updates));
  }, [updateFields, setValue]);

  // Sincronizar filters com formulário
  useEffect(() => {
    const filters = {
      condition: filterCondition,
      rules: filterRules.filter((r) => r.field.trim() !== ''),
    };
    setValue('filters', JSON.stringify(filters));
  }, [filterRules, filterCondition, setValue]);

  // Funções para gerenciar columns
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

  // Funções para gerenciar columnsToRemove
  const addColumnToRemove = () => {
    setColumnsToRemove([...columnsToRemove, '']);
  };

  const removeColumnToRemove = (index: number) => {
    if (columnsToRemove.length > 1) {
      setColumnsToRemove(columnsToRemove.filter((_, i) => i !== index));
    }
  };

  const updateColumnToRemove = (index: number, value: string) => {
    const newColumns = [...columnsToRemove];
    newColumns[index] = value;
    setColumnsToRemove(newColumns);
  };

  // Funções para gerenciar recordFields
  const addRecordField = () => {
    setRecordFields([...recordFields, { key: '', value: '' }]);
  };

  const removeRecordField = (index: number) => {
    if (recordFields.length > 1) {
      setRecordFields(recordFields.filter((_, i) => i !== index));
    }
  };

  const updateRecordField = (
    index: number,
    field: 'key' | 'value',
    value: string,
  ) => {
    const newFields = [...recordFields];
    newFields[index] = { ...newFields[index], [field]: value };
    setRecordFields(newFields);
  };

  // Funções para gerenciar updateFields
  const addUpdateField = () => {
    setUpdateFields([...updateFields, { key: '', value: '' }]);
  };

  const removeUpdateField = (index: number) => {
    if (updateFields.length > 1) {
      setUpdateFields(updateFields.filter((_, i) => i !== index));
    }
  };

  const updateUpdateField = (
    index: number,
    field: 'key' | 'value',
    value: string,
  ) => {
    const newFields = [...updateFields];
    newFields[index] = { ...newFields[index], [field]: value };
    setUpdateFields(newFields);
  };

  // Funções para gerenciar filterRules
  const addFilterRule = () => {
    setFilterRules([
      ...filterRules,
      { field: '', operator: 'equals', value: '' },
    ]);
  };

  const removeFilterRule = (index: number) => {
    if (filterRules.length > 1) {
      setFilterRules(filterRules.filter((_, i) => i !== index));
    }
  };

  const updateFilterRule = (
    index: number,
    field: keyof FilterRule,
    value: string,
  ) => {
    const newRules = [...filterRules];
    newRules[index] = { ...newRules[index], [field]: value };
    setFilterRules(newRules);
  };

  const operatorOptions = [
    { value: 'equals', label: 'Igual (=)' },
    { value: 'notEquals', label: 'Diferente (≠)' },
    { value: 'greaterThan', label: 'Maior que (>)' },
    { value: 'greaterThanOrEqual', label: 'Maior ou igual (≥)' },
    { value: 'lessThan', label: 'Menor que (<)' },
    { value: 'lessThanOrEqual', label: 'Menor ou igual (≤)' },
    { value: 'contains', label: 'Contém' },
    { value: 'notContains', label: 'Não contém' },
    { value: 'startsWith', label: 'Começa com' },
    { value: 'endsWith', label: 'Termina com' },
    { value: 'in', label: 'Está em (lista)' },
    { value: 'notIn', label: 'Não está em (lista)' },
    { value: 'isEmpty', label: 'Está vazio' },
    { value: 'isNotEmpty', label: 'Não está vazio' },
    { value: 'isTrue', label: 'É verdadeiro' },
    { value: 'isFalse', label: 'É falso' },
  ];

  return (
    <>
      {/* Nome da Tabela */}
      <div className="p-1">
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

      {/* Operação */}
      <div className="p-1">
        <FormControl variant="label">Operação *</FormControl>
        <FormSelect
          fieldName="operation"
          placeholder="Selecione a operação"
          options={[
            { value: 'addColumns', label: '➕ Adicionar Colunas' },
            { value: 'removeColumns', label: '➖ Remover Colunas' },
            { value: 'insert', label: '📝 Inserir Registro' },
            { value: 'get', label: '🔍 Buscar Registros' },
            { value: 'update', label: '✏️ Atualizar Registros' },
            { value: 'delete', label: '🗑️ Deletar Registros' },
          ]}
          className="w-full"
        />
      </div>

      {/* Campos específicos por operação */}
      {operation === 'addColumns' && (
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
      )}

      {operation === 'removeColumns' && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <FormControl variant="label">Colunas para Remover *</FormControl>
            <Button
              type="button"
              variant="gradient"
              onClick={addColumnToRemove}
              className="w-fit gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          </div>

          <div className="space-y-2">
            {columnsToRemove.map((column, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="text"
                  fieldName={`remove_column_${index}`}
                  value={column}
                  onChange={(e) => updateColumnToRemove(index, e.target.value)}
                  placeholder="Nome da coluna"
                  className="flex-1"
                />
                {columnsToRemove.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeColumnToRemove(index)}
                    className="text-red-500 hover:text-red-700 p-2 h-fit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {operation === 'insert' && (
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center justify-between">
            <FormControl variant="label">Campos do Registro *</FormControl>
            <Button
              type="button"
              variant="gradient"
              onClick={addRecordField}
              className="w-fit gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Campo
            </Button>
          </div>

          <div className="space-y-2">
            {recordFields.map((field, index) => (
              <div
                key={index}
                className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2"
              >
                <div className="flex items-center justify-between mb-2">
                  <Typography variant="span" className="text-sm font-medium">
                    Campo {index + 1}
                  </Typography>
                  {recordFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeRecordField(index)}
                      className="text-red-500 hover:text-red-700 p-1 h-fit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div>
                  <FormControl variant="label">
                    <Typography variant="span" className="text-sm">
                      Nome do Campo *
                    </Typography>
                  </FormControl>
                  <Input
                    type="text"
                    fieldName={`record_key_${index}`}
                    value={field.key}
                    onChange={(e) =>
                      updateRecordField(index, 'key', e.target.value)
                    }
                    placeholder="Ex: name, email, score"
                  />
                </div>

                <div>
                  <FormControl variant="label">
                    <Typography variant="span" className="text-sm">
                      Valor *
                    </Typography>
                  </FormControl>
                  <Input
                    type="text"
                    fieldName={`record_value_${index}`}
                    value={field.value}
                    onChange={(e) =>
                      updateRecordField(index, 'value', e.target.value)
                    }
                    placeholder="Ex: {{input.name}} ou valor fixo"
                  />
                  <Typography
                    variant="span"
                    className="text-xs text-gray-500 mt-1"
                  >
                    Use {'{{variavel}}'} para valores dinâmicos
                  </Typography>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(operation === 'get' ||
        operation === 'update' ||
        operation === 'delete') && (
        <div className="space-y-3 border-t pt-4">
          <Typography variant="h5" className="font-semibold">
            Filtros
          </Typography>

          <div className="p-1">
            <FormControl variant="label">Condição</FormControl>
            <FormSelect
              fieldName="filterCondition"
              placeholder="Selecione"
              value={filterCondition}
              onValueChange={(value) =>
                setFilterCondition(value as 'AND' | 'OR')
              }
              options={[
                {
                  value: 'AND',
                  label: 'E (AND) - Todas as regras devem ser verdadeiras',
                },
                {
                  value: 'OR',
                  label: 'OU (OR) - Pelo menos uma regra deve ser verdadeira',
                },
              ]}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <FormControl variant="label">Regras de Filtro</FormControl>
            <Button
              type="button"
              variant="gradient"
              onClick={addFilterRule}
              className="w-fit gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Regra
            </Button>
          </div>

          <div className="space-y-2">
            {filterRules.map((rule, index) => (
              <div
                key={index}
                className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2"
              >
                <div className="flex items-center justify-between mb-2">
                  <Typography variant="span" className="text-sm font-medium">
                    Regra {index + 1}
                  </Typography>
                  {filterRules.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeFilterRule(index)}
                      className="text-red-500 hover:text-red-700 p-1 h-fit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div>
                  <FormControl variant="label">
                    <Typography variant="span" className="text-sm">
                      Campo *
                    </Typography>
                  </FormControl>
                  <Input
                    type="text"
                    fieldName={`filter_field_${index}`}
                    value={rule.field}
                    onChange={(e) =>
                      updateFilterRule(index, 'field', e.target.value)
                    }
                    placeholder="Ex: score, active, _createdAt"
                  />
                </div>

                <div>
                  <FormControl variant="label">
                    <Typography variant="span" className="text-sm">
                      Operador *
                    </Typography>
                  </FormControl>
                  <FormSelect
                    fieldName={`filter_operator_${index}`}
                    placeholder="Selecione"
                    value={rule.operator}
                    onValueChange={(value) =>
                      updateFilterRule(index, 'operator', value)
                    }
                    options={operatorOptions}
                    className="w-full"
                  />
                </div>

                <div>
                  <FormControl variant="label">
                    <Typography variant="span" className="text-sm">
                      Valor
                    </Typography>
                  </FormControl>
                  <Input
                    type="text"
                    fieldName={`filter_value_${index}`}
                    value={rule.value}
                    onChange={(e) =>
                      updateFilterRule(index, 'value', e.target.value)
                    }
                    placeholder="Ex: {{input.minScore}} ou 70"
                  />
                  <Typography
                    variant="span"
                    className="text-xs text-gray-500 mt-1"
                  >
                    Use {'{{variavel}}'} para valores dinâmicos
                  </Typography>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {operation === 'update' && (
        <div className="space-y-3 border-t pt-4 mt-4">
          <div className="flex items-center justify-between">
            <FormControl variant="label">Campos para Atualizar *</FormControl>
            <Button
              type="button"
              variant="gradient"
              onClick={addUpdateField}
              className="w-fit gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Campo
            </Button>
          </div>

          <div className="space-y-2">
            {updateFields.map((field, index) => (
              <div
                key={index}
                className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2"
              >
                <div className="flex items-center justify-between mb-2">
                  <Typography variant="span" className="text-sm font-medium">
                    Campo {index + 1}
                  </Typography>
                  {updateFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeUpdateField(index)}
                      className="text-red-500 hover:text-red-700 p-1 h-fit"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div>
                  <FormControl variant="label">
                    <Typography variant="span" className="text-sm">
                      Nome do Campo *
                    </Typography>
                  </FormControl>
                  <Input
                    type="text"
                    fieldName={`update_key_${index}`}
                    value={field.key}
                    onChange={(e) =>
                      updateUpdateField(index, 'key', e.target.value)
                    }
                    placeholder="Ex: status, score, tags"
                  />
                </div>

                <div>
                  <FormControl variant="label">
                    <Typography variant="span" className="text-sm">
                      Novo Valor *
                    </Typography>
                  </FormControl>
                  <Input
                    type="text"
                    fieldName={`update_value_${index}`}
                    value={field.value}
                    onChange={(e) =>
                      updateUpdateField(index, 'value', e.target.value)
                    }
                    placeholder="Ex: {{input.newStatus}} ou 'qualified'"
                  />
                  <Typography
                    variant="span"
                    className="text-xs text-gray-500 mt-1"
                  >
                    Use {'{{variavel}}'} para valores dinâmicos
                  </Typography>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {operation === 'get' && (
        <div className="space-y-3 border-t pt-4 mt-4">
          <Typography variant="h5" className="font-semibold">
            Ordenação e Paginação
          </Typography>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormControl variant="label">Campo para Ordenar</FormControl>
              <Input
                type="text"
                fieldName="sortField"
                placeholder="Ex: score, _createdAt"
              />
            </div>

            <div>
              <FormControl variant="label">Ordem</FormControl>
              <FormSelect
                fieldName="sortOrder"
                placeholder="Selecione"
                options={[
                  { value: 'asc', label: 'Crescente (A-Z, 0-9)' },
                  { value: 'desc', label: 'Decrescente (Z-A, 9-0)' },
                ]}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormControl variant="label">Limite</FormControl>
              <Input
                type="number"
                fieldName="limit"
                placeholder="Ex: 100"
                min="1"
              />
            </div>

            <div>
              <FormControl variant="label">Offset</FormControl>
              <Input
                type="number"
                fieldName="offset"
                placeholder="Ex: 0"
                min="0"
              />
            </div>
          </div>
        </div>
      )}

      <SubmitButton variant="gradient" className="mt-4">
        Salvar Configuração
      </SubmitButton>
    </>
  );
}

export function DatabaseNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
  nodeId,
  flowId,
}: DatabaseNodeConfigProps) {
  const handleSubmit = async (data: FieldValues) => {
    const databaseConfig: DatabaseConfig = {
      operation: data.operation,
      tableName: data.tableName,
    };

    // Adicionar campos específicos por operação
    if (data.operation === 'addColumns') {
      databaseConfig.columns = JSON.parse(data.columns || '[]');
    }

    if (data.operation === 'removeColumns') {
      databaseConfig.columnsToRemove = JSON.parse(data.columnsToRemove || '[]');
    }

    if (data.operation === 'insert') {
      databaseConfig.record = JSON.parse(data.record || '{}');
    }

    if (data.operation === 'update') {
      databaseConfig.updates = JSON.parse(data.updates || '{}');
      databaseConfig.filters = JSON.parse(
        data.filters || '{"condition":"AND","rules":[]}',
      );
    }

    if (data.operation === 'delete') {
      databaseConfig.filters = JSON.parse(
        data.filters || '{"condition":"AND","rules":[]}',
      );
    }

    if (data.operation === 'get') {
      if (data.filters) {
        databaseConfig.filters = JSON.parse(data.filters);
      }
      if (data.sortField) {
        databaseConfig.sort = {
          field: data.sortField,
          order: data.sortOrder || 'asc',
        };
      }
      if (data.limit || data.offset) {
        databaseConfig.pagination = {
          limit: data.limit ? parseInt(data.limit) : undefined,
          offset: data.offset ? parseInt(data.offset) : undefined,
        };
      }
    }

    onSave(databaseConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Configurar Database"
      nodeId={nodeId}
      flowId={flowId}
    >
      <Form
        className="flex flex-col gap-4"
        zodSchema={databaseConfigSchema}
        onSubmit={handleSubmit}
      >
        <DatabaseFormFields config={config} />
      </Form>
    </NodeConfigLayout>
  );
}
