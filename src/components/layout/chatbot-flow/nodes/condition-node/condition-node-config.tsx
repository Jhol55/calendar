'use client';

import React, { useEffect, useState } from 'react';
import { Typography } from '@/components/ui/typography';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { conditionConfigSchema } from './condition-node-config.schema';
import { FieldValues } from 'react-hook-form';
import { useForm } from '@/hooks/use-form';
import { FormSelect } from '@/components/ui/select';
import { NodeConfigLayout } from '../node-config-layout';
import { Plus, Trash2, MoveUp, MoveDown } from 'lucide-react';
import type {
  ConditionConfig,
  ConditionRule,
  SwitchCase,
  ConditionType,
} from '../../types';

interface ConditionNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: ConditionConfig;
  onSave: (config: ConditionConfig) => void;
  nodeId?: string;
  flowId?: string;
}

// Componente interno para os campos do formulário
function ConditionFormFields({ config }: { config?: ConditionConfig }) {
  const { form, setValue } = useForm();
  const conditionType = (form.conditionType as ConditionType) || 'if';

  // Estado para IF rules
  const [rules, setRules] = useState<ConditionRule[]>([
    {
      id: crypto.randomUUID(),
      variable: '',
      operator: 'equals',
      value: '',
    },
  ]);

  // Estado para SWITCH cases
  const [cases, setCases] = useState<SwitchCase[]>([
    {
      id: crypto.randomUUID(),
      variable: '',
      operator: 'equals',
      value: '',
      label: '',
    },
  ]);

  const [useDefaultCase, setUseDefaultCase] = useState(true);

  // Carregar configuração existente
  useEffect(() => {
    const timer = setTimeout(() => {
      if (config) {
        setValue('conditionType', config.conditionType);

        if (config.conditionType === 'if' && config.rules) {
          const loadedRules: ConditionRule[] =
            config.rules.length > 0
              ? config.rules
              : [
                  {
                    id: crypto.randomUUID(),
                    variable: '',
                    operator: 'equals' as const,
                    value: '',
                  },
                ];
          setRules(loadedRules);

          // Popula os campos do formulário para cada regra
          loadedRules.forEach((rule) => {
            setValue(`rule_variable_${rule.id}`, rule.variable);
            setValue(`rule_operator_${rule.id}`, rule.operator);
            setValue(`rule_value_${rule.id}`, rule.value || '');
            if (rule.logicOperator) {
              setValue(`rule_logic_${rule.id}`, rule.logicOperator);
            }
          });
        }

        if (config.conditionType === 'switch') {
          setValue('variable', config.variable || '');
          const loadedCases =
            config.cases && config.cases.length > 0
              ? config.cases
              : [
                  {
                    id: crypto.randomUUID(),
                    variable: '',
                    operator: 'equals' as const,
                    value: '',
                    label: '',
                  },
                ];
          setCases(loadedCases);
          setUseDefaultCase(config.useDefaultCase ?? true);

          // Popula os campos do formulário para cada caso
          loadedCases.forEach((caseItem) => {
            setValue(`case_variable_${caseItem.id}`, caseItem.variable);
            setValue(`case_operator_${caseItem.id}`, caseItem.operator);
            setValue(`case_value_${caseItem.id}`, caseItem.value);
            setValue(`case_label_${caseItem.id}`, caseItem.label);
          });
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [config, setValue]);

  // Sincronizar rules com formulário
  useEffect(() => {
    if (conditionType === 'if') {
      setValue('rules', rules);
      // Limpar campos do SWITCH
      setValue('variable', undefined);
      setValue('cases', undefined);
      setValue('useDefaultCase', undefined);
    }
  }, [rules, conditionType, setValue]);

  // Sincronizar cases com formulário
  useEffect(() => {
    if (conditionType === 'switch') {
      setValue('cases', cases);
      setValue('useDefaultCase', useDefaultCase);
      // Limpar campos do IF
      setValue('rules', undefined);
    }
  }, [cases, useDefaultCase, conditionType, setValue]);

  // Funções para gerenciar rules (IF)
  const addRule = () => {
    setRules([
      ...rules,
      {
        id: crypto.randomUUID(),
        variable: '',
        operator: 'equals',
        value: '',
      },
    ]);
  };

  const removeRule = (ruleId: string) => {
    if (rules.length > 1) {
      setRules(rules.filter((rule) => rule.id !== ruleId));
    }
  };

  const updateRule = (
    ruleId: string,
    field: keyof ConditionRule,
    value: string,
  ) => {
    setRules(
      rules.map((rule) =>
        rule.id === ruleId ? { ...rule, [field]: value } : rule,
      ),
    );
  };

  const moveRule = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === rules.length - 1)
    ) {
      return;
    }

    const newRules = [...rules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newRules[index], newRules[targetIndex]] = [
      newRules[targetIndex],
      newRules[index],
    ];

    setRules(newRules);
  };

  // Funções para gerenciar cases (SWITCH)
  const addCase = () => {
    setCases([
      ...cases,
      {
        id: crypto.randomUUID(),
        variable: '',
        operator: 'equals',
        value: '',
        label: '',
      },
    ]);
  };

  const removeCase = (caseId: string) => {
    if (cases.length > 1) {
      setCases(cases.filter((c) => c.id !== caseId));
    }
  };

  const updateCase = (
    caseId: string,
    field: keyof SwitchCase,
    value: string,
  ) => {
    setCases(
      cases.map((c) => (c.id === caseId ? { ...c, [field]: value } : c)),
    );
  };

  const moveCase = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === cases.length - 1)
    ) {
      return;
    }

    const newCases = [...cases];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newCases[index], newCases[targetIndex]] = [
      newCases[targetIndex],
      newCases[index],
    ];

    setCases(newCases);
  };

  // Operadores disponíveis
  const operators = [
    { value: 'equals', label: 'Igual a (=)' },
    { value: 'not_equals', label: 'Diferente de (≠)' },
    { value: 'contains', label: 'Contém' },
    { value: 'not_contains', label: 'Não contém' },
    { value: 'starts_with', label: 'Começa com' },
    { value: 'ends_with', label: 'Termina com' },
    { value: 'greater_than', label: 'Maior que (>)' },
    { value: 'less_than', label: 'Menor que (<)' },
    { value: 'greater_or_equal', label: 'Maior ou igual (≥)' },
    { value: 'less_or_equal', label: 'Menor ou igual (≤)' },
    { value: 'is_empty', label: 'Está vazio' },
    { value: 'is_not_empty', label: 'Não está vazio' },
    { value: 'regex_match', label: 'Match Regex' },
  ];

  const needsValue = (operator: string) => {
    return !['is_empty', 'is_not_empty'].includes(operator);
  };

  return (
    <>
      {/* Tipo de Condição */}
      <div className="p-1">
        <FormControl variant="label">Tipo de Condição *</FormControl>
        <FormSelect
          fieldName="conditionType"
          placeholder="Selecione o tipo"
          options={[
            { value: 'if', label: '🔀 IF (Condicional)' },
            { value: 'switch', label: '📋 SWITCH (Múltiplos Casos)' },
          ]}
          className="w-full"
        />
        <Typography variant="span" className="text-sm text-gray-500 mt-1">
          {conditionType === 'if' &&
            'Avalia condições e direciona para TRUE ou FALSE'}
          {conditionType === 'switch' &&
            'Avalia uma variável e direciona para casos específicos'}
        </Typography>
      </div>

      {/* Configuração para IF */}
      {conditionType === 'if' && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex items-center justify-between relative mt-4">
            <Typography variant="h5" className="font-semibold">
              Regras de Condição
            </Typography>
            <Button
              type="button"
              variant="gradient"
              onClick={addRule}
              className="gap-2 w-fit absolute right-0 -top-4"
            >
              <Plus className="w-4 h-4" />
              Adicionar Regra
            </Button>
          </div>

          <div className="space-y-4">
            {rules.map((rule, index) => (
              <div
                key={rule.id}
                className="p-4 border-2 border-neutral-200 rounded-lg bg-white space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Typography
                    variant="span"
                    className="text-sm font-semibold text-neutral-600"
                  >
                    Regra {index + 1}
                  </Typography>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => moveRule(index, 'up')}
                      disabled={index === 0}
                      className="hover:bg-neutral-200 h-fit w-fit p-1"
                    >
                      <MoveUp className="w-4 h-4 text-neutral-600" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => moveRule(index, 'down')}
                      disabled={index === rules.length - 1}
                      className="hover:bg-neutral-200 h-fit w-fit p-1"
                    >
                      <MoveDown className="w-4 h-4 text-neutral-600" />
                    </Button>
                    {rules.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeRule(rule.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Lógica (AND/OR) - Apenas para regras após a primeira */}
                {index > 0 && (
                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Operador Lógico *
                      </Typography>
                    </FormControl>
                    <FormSelect
                      fieldName={`rule_logic_${rule.id}`}
                      placeholder="Selecione"
                      options={[
                        {
                          value: 'AND',
                          label: 'E (AND) - Ambas devem ser verdadeiras',
                        },
                        {
                          value: 'OR',
                          label: 'OU (OR) - Uma delas deve ser verdadeira',
                        },
                      ]}
                      onValueChange={(value) =>
                        updateRule(rule.id, 'logicOperator', value)
                      }
                      className="w-full"
                    />
                  </div>
                )}

                {/* Variável */}
                <div>
                  <FormControl variant="label">
                    <Typography variant="span" className="text-sm">
                      Variável *
                    </Typography>
                  </FormControl>
                  <Input
                    type="text"
                    fieldName={`rule_variable_${rule.id}`}
                    value={rule.variable}
                    onChange={(e) =>
                      updateRule(rule.id, 'variable', e.target.value)
                    }
                    placeholder="Ex: {{$nodes.node_xxx.output.status}}"
                  />
                </div>

                {/* Operador */}
                <div>
                  <FormControl variant="label">
                    <Typography variant="span" className="text-sm">
                      Operador *
                    </Typography>
                  </FormControl>
                  <FormSelect
                    fieldName={`rule_operator_${rule.id}`}
                    placeholder="Selecione o operador"
                    options={operators}
                    onValueChange={(value) =>
                      updateRule(rule.id, 'operator', value)
                    }
                    className="w-full"
                  />
                </div>

                {/* Valor (se necessário) */}
                {needsValue(rule.operator) && (
                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Valor *
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName={`rule_value_${rule.id}`}
                      value={rule.value}
                      onChange={(e) =>
                        updateRule(rule.id, 'value', e.target.value)
                      }
                      placeholder="Ex: aprovado"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuração para SWITCH */}
      {conditionType === 'switch' && (
        <div className="space-y-4 border-t pt-4 mt-4">
          <Typography variant="h5" className="font-semibold">
            Configuração do SWITCH
          </Typography>
          <Typography variant="p" className="text-sm text-gray-600">
            Cada caso pode avaliar uma variável diferente com seu próprio
            operador
          </Typography>

          {/* Casos */}
          <div>
            <div className="relative flex items-center justify-between mb-3 mt-4">
              <FormControl variant="label">Casos *</FormControl>
              <Button
                type="button"
                variant="gradient"
                onClick={addCase}
                className="gap-2 w-fit absolute right-0 -top-4"
              >
                <Plus className="w-4 h-4" />
                Adicionar Caso
              </Button>
            </div>

            <div className="space-y-3">
              {cases.map((caseItem, index) => (
                <div
                  key={caseItem.id}
                  className="p-4 border-2 border-neutral-200 rounded-lg bg-white space-y-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Typography
                      variant="span"
                      className="text-sm font-semibold text-neutral-800"
                    >
                      Caso {index + 1}
                    </Typography>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => moveCase(index, 'up')}
                        disabled={index === 0}
                        className="hover:bg-neutral-200 h-fit w-fit p-1"
                      >
                        <MoveUp className="w-4 h-4 text-neutral-600" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => moveCase(index, 'down')}
                        disabled={index === cases.length - 1}
                        className="hover:bg-neutral-200 h-fit w-fit p-1"
                      >
                        <MoveDown className="w-4 h-4 text-neutral-600" />
                      </Button>
                      {cases.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeCase(caseItem.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Variável */}
                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Variável *
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName={`case_variable_${caseItem.id}`}
                      value={caseItem.variable}
                      onChange={(e) =>
                        updateCase(caseItem.id, 'variable', e.target.value)
                      }
                      placeholder="Ex: {{$nodes.node_xxx.output.status}}"
                    />
                  </div>

                  {/* Operador */}
                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Operador *
                      </Typography>
                    </FormControl>
                    <FormSelect
                      fieldName={`case_operator_${caseItem.id}`}
                      placeholder="Selecione o operador"
                      options={operators}
                      onValueChange={(value) =>
                        updateCase(caseItem.id, 'operator', value)
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Valor (se necessário) */}
                  {needsValue(caseItem.operator) && (
                    <div>
                      <FormControl variant="label">
                        <Typography variant="span" className="text-sm">
                          Valor *
                        </Typography>
                      </FormControl>
                      <Input
                        type="text"
                        fieldName={`case_value_${caseItem.id}`}
                        value={caseItem.value}
                        onChange={(e) =>
                          updateCase(caseItem.id, 'value', e.target.value)
                        }
                        placeholder="Ex: aprovado"
                      />
                    </div>
                  )}

                  {/* Label */}
                  <div>
                    <FormControl variant="label">
                      <Typography variant="span" className="text-sm">
                        Label (Exibição) *
                      </Typography>
                    </FormControl>
                    <Input
                      type="text"
                      fieldName={`case_label_${caseItem.id}`}
                      value={caseItem.label}
                      onChange={(e) =>
                        updateCase(caseItem.id, 'label', e.target.value)
                      }
                      placeholder="Ex: Cliente Aprovado"
                    />
                    <Typography
                      variant="span"
                      className="text-xs text-gray-500 mt-1"
                    >
                      Este texto aparecerá ao lado do handle no nó
                    </Typography>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Caso Default */}
          <div className="p-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useDefaultCase}
                onChange={(e) => setUseDefaultCase(e.target.checked)}
                className="w-4 h-4"
              />
              <Typography variant="span" className="text-sm">
                Usar caso padrão (DEFAULT)
              </Typography>
            </label>
            <Typography variant="span" className="text-xs text-gray-500 mt-1">
              Quando nenhum caso corresponder, seguir pelo handle DEFAULT
            </Typography>
          </div>
        </div>
      )}

      <SubmitButton variant="gradient" className="mt-4">
        Salvar Configuração
      </SubmitButton>
    </>
  );
}

export function ConditionNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
  nodeId,
  flowId,
}: ConditionNodeConfigProps) {
  const handleSubmit = async (data: FieldValues) => {
    console.log('📊 Dados recebidos no handleSubmit:', data);

    const conditionConfig: ConditionConfig = {
      conditionType: data.conditionType as ConditionType,
    };

    if (data.conditionType === 'if') {
      // Rules já vem como array
      conditionConfig.rules = data.rules || [];
    }

    if (data.conditionType === 'switch') {
      conditionConfig.variable = data.variable;
      // Cases já vem como array
      conditionConfig.cases = data.cases || [];
      conditionConfig.useDefaultCase = data.useDefaultCase ?? true;
      console.log('📦 Casos sendo salvos:', conditionConfig.cases);
    }

    console.log('💾 Configuração final:', conditionConfig);
    onSave(conditionConfig);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Configurar Condição"
      nodeId={nodeId}
      flowId={flowId}
    >
      <Form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit}
        zodSchema={conditionConfigSchema}
      >
        <ConditionFormFields config={config} />
      </Form>
    </NodeConfigLayout>
  );
}
