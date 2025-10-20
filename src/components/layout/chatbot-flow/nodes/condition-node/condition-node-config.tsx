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
import {
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type {
  ConditionConfig,
  ConditionRule,
  SwitchCase,
  ConditionType,
  MemoryItem,
  ComparisonOperator,
} from '../../types';
import { MemoryConfigSection } from '../memory-config-section';

interface ConditionNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: ConditionConfig;
  onSave: (config: ConditionConfig) => void;
  nodeId?: string;
  flowId?: string;
}

// Componente interno para os campos do formulário
function ConditionFormFields({
  config,
  memoryItems,
  setMemoryItems,
}: {
  config?: ConditionConfig;
  memoryItems: MemoryItem[];
  setMemoryItems: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
}) {
  const { form, setValue, errors } = useForm();
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
      label: '',
      rules: [
        {
          id: crypto.randomUUID(),
          variable: '',
          operator: 'equals',
          value: '',
        },
      ],
    },
  ]);

  const [useDefaultCase, setUseDefaultCase] = useState(true);

  // Estado para controlar quais casos estão expandidos
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

  // Função para alternar expansão de um caso
  const toggleCaseExpansion = (caseId: string) => {
    setExpandedCases((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

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

          // Migrar formato antigo para novo (se necessário)
          const loadedCases =
            config.cases && config.cases.length > 0
              ? config.cases.map((caseItem) => {
                  // Se já tem rules, usar o novo formato
                  if (caseItem.rules && caseItem.rules.length > 0) {
                    return caseItem;
                  }
                  // Migrar formato antigo (variable, operator, value) para novo (rules)
                  return {
                    id: caseItem.id,
                    label: caseItem.label || '',
                    rules: [
                      {
                        id: crypto.randomUUID(),
                        variable: caseItem.variable || '',
                        operator:
                          (caseItem.operator as ComparisonOperator) || 'equals',
                        value: caseItem.value || '',
                        logicOperator: undefined,
                      },
                    ],
                  };
                })
              : [
                  {
                    id: crypto.randomUUID(),
                    label: '',
                    rules: [
                      {
                        id: crypto.randomUUID(),
                        variable: '',
                        operator: 'equals' as const,
                        value: '',
                        logicOperator: undefined,
                      },
                    ],
                  },
                ];

          setCases(loadedCases);
          setUseDefaultCase(config.useDefaultCase ?? true);

          // Popula os campos do formulário para cada caso
          loadedCases.forEach((caseItem) => {
            setValue(`case_label_${caseItem.id}`, caseItem.label);

            // Popula as regras de cada caso
            caseItem.rules.forEach((rule) => {
              setValue(
                `case_${caseItem.id}_rule_variable_${rule.id}`,
                rule.variable,
              );
              setValue(
                `case_${caseItem.id}_rule_operator_${rule.id}`,
                rule.operator,
              );
              setValue(
                `case_${caseItem.id}_rule_value_${rule.id}`,
                rule.value || '',
              );
              if (rule.logicOperator) {
                setValue(
                  `case_${caseItem.id}_rule_logic_${rule.id}`,
                  rule.logicOperator,
                );
              }
            });
          });
        }
      }

      // Carregar configuração de memória
      if (config?.memoryConfig) {
        setValue('memoryAction', config.memoryConfig.action);
        setValue('memoryName', config.memoryConfig.memoryName);
        setValue('memorySaveMode', config.memoryConfig.saveMode || 'overwrite');
        setValue('memoryDefaultValue', config.memoryConfig.defaultValue || '');

        if (config.memoryConfig.items && config.memoryConfig.items.length > 0) {
          setMemoryItems(config.memoryConfig.items);
        }

        // TTL
        if (config.memoryConfig.ttl) {
          const ttlValue = config.memoryConfig.ttl;
          const presetMatch = [
            { value: '3600', label: '1 hora' },
            { value: '86400', label: '1 dia' },
            { value: '604800', label: '7 dias' },
            { value: '2592000', label: '30 dias' },
          ].find((p) => p.value === String(ttlValue));

          if (presetMatch) {
            setValue('memoryTtlPreset', presetMatch.value);
          } else {
            setValue('memoryTtlPreset', 'custom');
            setValue('memoryCustomTtl', String(ttlValue));
          }
        } else {
          setValue('memoryTtlPreset', 'never');
        }
      }
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        label: '',
        rules: [
          {
            id: crypto.randomUUID(),
            variable: '',
            operator: 'equals',
            value: '',
          },
        ],
      },
    ]);
  };

  const removeCase = (caseId: string) => {
    if (cases.length > 1) {
      setCases(cases.filter((c) => c.id !== caseId));
    }
  };

  const updateCase = (caseId: string, field: 'label', value: string) => {
    setCases(
      cases.map((c) => (c.id === caseId ? { ...c, [field]: value } : c)),
    );
  };

  // Funções para manipular regras dentro de um caso
  const addRuleToCase = (caseId: string) => {
    setCases(
      cases.map((c) =>
        c.id === caseId
          ? {
              ...c,
              rules: [
                ...c.rules,
                {
                  id: crypto.randomUUID(),
                  variable: '',
                  operator: 'equals',
                  value: '',
                },
              ],
            }
          : c,
      ),
    );
  };

  const removeRuleFromCase = (caseId: string, ruleId: string) => {
    setCases(
      cases.map((c) =>
        c.id === caseId && c.rules.length > 1
          ? { ...c, rules: c.rules.filter((r) => r.id !== ruleId) }
          : c,
      ),
    );
  };

  const updateCaseRule = (
    caseId: string,
    ruleId: string,
    field: keyof ConditionRule,
    value: string,
  ) => {
    setCases(
      cases.map((c) =>
        c.id === caseId
          ? {
              ...c,
              rules: c.rules.map((r) =>
                r.id === ruleId ? { ...r, [field]: value } : r,
              ),
            }
          : c,
      ),
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
            Cada caso pode ter múltiplas condições (regras) com operadores
            lógicos AND/OR
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
              {cases.map((caseItem, index) => {
                const isExpanded = expandedCases.has(caseItem.id);

                return (
                  <div
                    key={caseItem.id}
                    className="border border-neutral-200 rounded-lg bg-white"
                  >
                    {/* Header do Caso - Sempre visível */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => toggleCaseExpansion(caseItem.id)}
                          className="h-fit w-fit p-1 hover:bg-neutral-100"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-neutral-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-neutral-400" />
                          )}
                        </Button>
                        <div className="flex flex-col flex-1">
                          <Typography
                            variant="span"
                            className="text-sm text-neutral-700"
                          >
                            Caso {index + 1}
                          </Typography>
                          {caseItem.label && (
                            <Typography
                              variant="span"
                              className="text-xs text-neutral-500"
                            >
                              {caseItem.label}
                            </Typography>
                          )}
                        </div>
                      </div>
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

                    {/* Conteúdo do Caso - Colapsável */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-neutral-200 pt-4">
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

                        {/* Regras do Caso */}
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <Typography
                              variant="span"
                              className="text-sm font-medium"
                            >
                              Condições (Regras)
                            </Typography>
                            <Button
                              type="button"
                              variant="gradient"
                              onClick={() => addRuleToCase(caseItem.id)}
                              className="gap-1 text-sm w-fit p-2"
                            >
                              <Plus className="w-3 h-3" />
                              Adicionar Regra
                            </Button>
                          </div>

                          {caseItem.rules.map((rule, ruleIndex) => (
                            <div
                              key={rule.id}
                              className="p-3 border border-neutral-300 rounded-md bg-neutral-50 space-y-2"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <Typography
                                  variant="span"
                                  className="text-xs font-medium text-neutral-600"
                                >
                                  Regra {ruleIndex + 1}
                                </Typography>
                                {caseItem.rules.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                      removeRuleFromCase(caseItem.id, rule.id)
                                    }
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>

                              {/* Variável */}
                              <div>
                                <FormControl variant="label">
                                  <Typography
                                    variant="span"
                                    className="text-xs"
                                  >
                                    Variável *
                                  </Typography>
                                </FormControl>
                                <Input
                                  type="text"
                                  fieldName={`case_${caseItem.id}_rule_variable_${rule.id}`}
                                  value={rule.variable}
                                  onChange={(e) =>
                                    updateCaseRule(
                                      caseItem.id,
                                      rule.id,
                                      'variable',
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Ex: {{$nodes.node_xxx.output.status}}"
                                />
                              </div>

                              {/* Operador */}
                              <div>
                                <FormControl variant="label">
                                  <Typography
                                    variant="span"
                                    className="text-xs"
                                  >
                                    Operador *
                                  </Typography>
                                </FormControl>
                                <FormSelect
                                  fieldName={`case_${caseItem.id}_rule_operator_${rule.id}`}
                                  placeholder="Selecione o operador"
                                  options={operators}
                                  onValueChange={(value) =>
                                    updateCaseRule(
                                      caseItem.id,
                                      rule.id,
                                      'operator',
                                      value,
                                    )
                                  }
                                  className="w-full"
                                />
                              </div>

                              {/* Valor (se necessário) */}
                              {needsValue(rule.operator) && (
                                <div>
                                  <FormControl variant="label">
                                    <Typography
                                      variant="span"
                                      className="text-xs"
                                    >
                                      Valor *
                                    </Typography>
                                  </FormControl>
                                  <Input
                                    type="text"
                                    fieldName={`case_${caseItem.id}_rule_value_${rule.id}`}
                                    value={rule.value}
                                    onChange={(e) =>
                                      updateCaseRule(
                                        caseItem.id,
                                        rule.id,
                                        'value',
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Ex: aprovado"
                                  />
                                </div>
                              )}

                              {/* Operador Lógico (se não for a última regra) */}
                              {ruleIndex < caseItem.rules.length - 1 && (
                                <div>
                                  <FormControl variant="label">
                                    <Typography
                                      variant="span"
                                      className="text-xs"
                                    >
                                      Operador Lógico *
                                    </Typography>
                                  </FormControl>
                                  <FormSelect
                                    fieldName={`case_${caseItem.id}_rule_logic_${rule.id}`}
                                    placeholder="Selecione"
                                    options={[
                                      { value: 'AND', label: 'E (AND)' },
                                      { value: 'OR', label: 'OU (OR)' },
                                    ]}
                                    onValueChange={(value) =>
                                      updateCaseRule(
                                        caseItem.id,
                                        rule.id,
                                        'logicOperator',
                                        value,
                                      )
                                    }
                                    className="w-full"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* Configuração de Memória */}
      <MemoryConfigSection
        memoryItems={memoryItems}
        setMemoryItems={setMemoryItems}
        form={form}
        setValue={setValue}
      />

      <SubmitButton
        variant="gradient"
        className="mt-4"
        onClick={() => console.log(errors)}
      >
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
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([
    { key: '', value: '' },
  ]);

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

    // Adicionar configuração de memória se preenchida
    if (data.memoryName && data.memoryAction && data.memoryAction !== '') {
      let ttl: number | undefined;
      if (data.memoryTtlPreset && data.memoryTtlPreset !== 'never') {
        if (data.memoryTtlPreset === 'custom') {
          ttl = data.memoryCustomTtl ? Number(data.memoryCustomTtl) : undefined;
        } else {
          ttl = Number(data.memoryTtlPreset);
        }
      }

      conditionConfig.memoryConfig = {
        action: data.memoryAction || 'save',
        memoryName: data.memoryName,
        items: data.memoryAction === 'save' ? memoryItems : undefined,
        ttl,
        defaultValue: data.memoryDefaultValue,
        saveMode: data.memorySaveMode || 'overwrite',
      };
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
        <ConditionFormFields
          config={config}
          memoryItems={memoryItems}
          setMemoryItems={setMemoryItems}
        />
      </Form>
    </NodeConfigLayout>
  );
}
