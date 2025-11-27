'use client';

import React, { memo, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { Typography } from '@/components/ui/typography';
import type { NodeData } from '../../types';
import { GitBranch, Split } from 'lucide-react';
import { cn } from '@/lib/utils';
import { nodeThemes } from '../node-theme';
import { useVariableContext, resolveVariable } from '../use-variable-context';

interface ConditionNodeProps {
  data: NodeData;
  selected?: boolean;
}

// Função helper para traduzir operadores
const getOperatorSymbol = (operator: string): string => {
  const operators: Record<string, string> = {
    equals: '=',
    not_equals: '≠',
    contains: '⊃',
    not_contains: '⊅',
    starts_with: '⊲',
    ends_with: '⊳',
    greater_than: '>',
    less_than: '<',
    greater_or_equal: '≥',
    less_or_equal: '≤',
    is_empty: '∅',
    is_not_empty: '∄',
    regex_match: '~',
  };
  return operators[operator] || operator;
};

function ConditionNodeComponent({ data, selected }: ConditionNodeProps) {
  const config = data.conditionConfig;
  const isIfType = config?.conditionType === 'if';
  const isSwitchType = config?.conditionType === 'switch';
  const theme = nodeThemes['violet'];
  const context = useVariableContext();

  const switchCases = config?.cases || [];
  const hasDefaultCase = config?.useDefaultCase ?? true;

  // Resolver variáveis nas regras do IF
  const resolvedRules = useMemo(() => {
    if (!config?.rules) return [];
    return config.rules.map((rule) => {
      // Resolver cada campo separadamente
      const varResolved = rule.variable
        ? resolveVariable(rule.variable, context)
        : undefined;
      const valResolved = rule.value
        ? resolveVariable(rule.value, context)
        : undefined;

      return {
        ...rule,
        resolvedVariable: varResolved ?? rule.variable ?? '',
        resolvedValue: valResolved ?? rule.value ?? '',
      };
    });
  }, [config?.rules, context]);

  // Resolver variável do Switch
  const resolvedSwitchVariable = useMemo(() => {
    if (!config?.variable) return '';
    return resolveVariable(config.variable, context) ?? config.variable;
  }, [config?.variable, context]);

  // Calcular altura dinâmica para Switch
  const totalOutputs = isSwitchType
    ? switchCases.length + (hasDefaultCase ? 1 : 0)
    : 0;

  let minHeight: number | undefined;
  if (isSwitchType && totalOutputs > 0) {
    minHeight = Math.max(160, 100 + totalOutputs * 40);
  } else if (isIfType) {
    minHeight = 140;
  }

  return (
    <div className="relative">
      {/* Handle de Entrada */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white"
        style={{ background: theme.handleColor }}
      />

      {/* Card do Node */}
      <div
        className={cn(
          'bg-white rounded-lg border-2 shadow-lg transition-all duration-200 min-w-[240px] max-w-[280px]',
          selected ? theme.borderSelected : theme.border,
          isSwitchType && totalOutputs > 3 ? 'flex flex-col' : '',
        )}
        style={minHeight ? { minHeight: `${minHeight}px` } : undefined}
      >
        {/* Header */}
        <div className="p-4 pb-2">
          <div className="flex items-center gap-3 mb-3">
            <div className={cn('p-2 rounded-lg', theme.iconBg, theme.iconText)}>
              {isIfType && <GitBranch className="w-4 h-4" />}
              {isSwitchType && <Split className="w-4 h-4" />}
              {!config && <GitBranch className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <Typography
                variant="h3"
                className="font-semibold text-sm text-gray-800"
              >
                {isIfType && 'If (Condicional)'}
                {isSwitchType && 'Switch'}
                {!config && 'Condição'}
              </Typography>
              {isSwitchType && (
                <Typography
                  variant="span"
                  className="text-xs text-gray-500 block"
                >
                  Múltiplas condições
                </Typography>
              )}
            </div>
          </div>

          {/* IF Config Display */}
          {isIfType && resolvedRules.length > 0 && (
            <div className="space-y-2 pr-16">
              {resolvedRules.slice(0, 2).map((rule, index) => {
                // Mostrar 'undefined' apenas se for realmente undefined, não para string vazia
                const displayVar =
                  rule.resolvedVariable === undefined
                    ? 'undefined'
                    : rule.resolvedVariable;
                const displayVal =
                  rule.resolvedValue === undefined
                    ? 'undefined'
                    : rule.resolvedValue;

                return (
                  <div key={rule.id}>
                    {index > 0 && rule.logicOperator && (
                      <div className="flex justify-center mb-1">
                        <span
                          className={cn(
                            'font-bold text-[10px] px-2 py-0.5 rounded',
                            theme.badgeBg,
                            theme.badgeText,
                          )}
                        >
                          {rule.logicOperator}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col gap-0.5 text-xs bg-gray-50 rounded px-2 py-1.5">
                      {/* Valor 1 - Variável */}
                      <span className="font-mono text-gray-700 truncate">
                        {displayVar.length > 25
                          ? `${displayVar.substring(0, 25)}...`
                          : displayVar}
                      </span>
                      {/* Operador */}
                      <span
                        className={cn('font-bold text-center', theme.badgeText)}
                      >
                        {getOperatorSymbol(rule.operator)}
                      </span>
                      {/* Valor 2 */}
                      <span className="font-mono text-gray-700 truncate">
                        {displayVal.length > 25
                          ? `${displayVal.substring(0, 25)}...`
                          : displayVal}
                      </span>
                    </div>
                  </div>
                );
              })}
              {resolvedRules.length > 2 && (
                <div className="text-center">
                  <Typography
                    variant="span"
                    className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                  >
                    +{resolvedRules.length - 2} regras
                  </Typography>
                </div>
              )}
            </div>
          )}

          {/* SWITCH Config Display */}
          {isSwitchType && config?.variable && (
            <div className="space-y-1 pr-4">
              <div className={cn('rounded px-2 py-1', theme.badgeBg)}>
                <Typography
                  variant="span"
                  className="text-[10px] text-gray-500 uppercase"
                >
                  Variável
                </Typography>
                <div className="font-mono text-xs text-gray-800 font-semibold truncate">
                  {resolvedSwitchVariable && resolvedSwitchVariable.length > 22
                    ? `${resolvedSwitchVariable.substring(0, 22)}...`
                    : resolvedSwitchVariable}
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Typography
                  variant="span"
                  className="text-[10px] text-gray-500 bg-blue-100 px-2 py-0.5 rounded-full"
                >
                  {switchCases.length} casos
                </Typography>
                {hasDefaultCase && (
                  <Typography
                    variant="span"
                    className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                  >
                    + default
                  </Typography>
                )}
              </div>
            </div>
          )}

          {/* Estado não configurado */}
          {!config && (
            <div className="text-center py-2">
              <Typography
                variant="span"
                className="text-xs text-gray-400 italic"
              >
                Duplo clique para configurar
              </Typography>
            </div>
          )}
        </div>

        {/* Handles IF Type */}
        {!isSwitchType && (
          <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-end h-5">
                <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded leading-none">
                  true
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="true"
                  className="!w-3 !h-3 !border-2 !border-white !static !transform-none !ml-1"
                  style={{ background: '#22c55e' }}
                />
              </div>
              <div className="flex items-center justify-end h-5">
                <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded leading-none">
                  false
                </span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="false"
                  className="!w-3 !h-3 !border-2 !border-white !static !transform-none !ml-1"
                  style={{ background: '#ef4444' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Handles SWITCH Type */}
        {isSwitchType && (
          <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-center">
            <div className="flex flex-col gap-4">
              {switchCases.length > 0 ? (
                switchCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="flex items-center justify-end h-5"
                  >
                    <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded whitespace-nowrap leading-none">
                      {caseItem.label.length > 40
                        ? `${caseItem.label.substring(0, 40)}...`
                        : caseItem.label}
                    </span>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`case_${caseItem.id}`}
                      className="!w-3 !h-3 !border-2 !border-white !static !transform-none !ml-1"
                      style={{ background: theme.handleColor }}
                    />
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-end h-5">
                  <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded leading-none">
                    Default
                  </span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id="default"
                    className="!w-3 !h-3 !border-2 !border-white !static !transform-none !ml-1"
                    style={{ background: '#6b7280' }}
                  />
                </div>
              )}

              {hasDefaultCase && switchCases.length > 0 && (
                <div className="flex items-center justify-end h-5">
                  <span className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded leading-none">
                    Default
                  </span>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id="default"
                    className="!w-3 !h-3 !border-2 !border-white !static !transform-none !ml-1"
                    style={{ background: '#6b7280' }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
