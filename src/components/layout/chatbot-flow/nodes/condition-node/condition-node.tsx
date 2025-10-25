'use client';

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Typography } from '@/components/ui/typography';
import type { NodeData } from '../../types';
import { GitBranch, Settings, Split } from 'lucide-react';

interface ConditionNodeProps {
  data: NodeData;
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

function ConditionNodeComponent({ data }: ConditionNodeProps) {
  const config = data.conditionConfig;
  const isIfType = config?.conditionType === 'if';
  const isSwitchType = config?.conditionType === 'switch';

  // Para IF: 1 entrada, 2 saídas (true/false)
  // Para SWITCH: 1 entrada, N saídas (casos + default)
  const switchCases = config?.cases || [];
  const hasDefaultCase = config?.useDefaultCase ?? true;

  return (
    <div className="relative">
      {/* Handle de Entrada (esquerda) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-purple-400 border-2 border-white"
      />

      {/* Card do Node */}
      <div className="min-w-[240px] max-w-[280px] bg-gradient-to-br from-purple-50 to-white border-2 border-purple-400 rounded-xl shadow-lg overflow-hidden">
        {/* Header Compacto */}
        <div className="bg-neutral-50 px-3 py-2">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex gap-2 items-center">
              {isIfType && <GitBranch className="w-4 h-4 text-purple-600" />}
              {isSwitchType && <Split className="w-4 h-4 text-purple-600" />}
              {!config && <GitBranch className="w-4 h-4 text-purple-600" />}
              <Typography
                variant="span"
                className="text-neutral-600 font-semibold text-sm"
              >
                {isIfType && 'If (Condicional)'}
                {isSwitchType && 'Switch (Múltiplas condições)'}
                {!config && 'Condição'}
              </Typography>
            </div>
            <Settings className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Body Minimalista */}
        <div className="px-3 py-2 w-full">
          {/* IF Config Display - Melhorado */}
          {isIfType && config?.rules && (
            <div className="space-y-1">
              {config.rules.slice(0, 2).map((rule, index) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-1 text-xs bg-neutral-50 rounded px-2 py-1"
                >
                  {index > 0 && rule.logicOperator && (
                    <span className="font-bold text-purple-600 text-[10px] bg-purple-200 px-1 rounded">
                      {rule.logicOperator}
                    </span>
                  )}
                  <span className="font-mono text-gray-700 truncate max-w-[70px]">
                    {rule.variable.length > 10
                      ? `${rule.variable.substring(0, 10)}...`
                      : rule.variable}
                  </span>
                  <span className="text-purple-600 font-bold">
                    {getOperatorSymbol(rule.operator)}
                  </span>
                  {rule.value && (
                    <span className="font-mono text-gray-700 truncate max-w-[50px]">
                      {rule.value.length > 8
                        ? `"${rule.value.substring(0, 8)}..."`
                        : `"${rule.value}"`}
                    </span>
                  )}
                </div>
              ))}
              {config.rules.length > 2 && (
                <div className="text-center">
                  <Typography
                    variant="span"
                    className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full"
                  >
                    +{config.rules.length - 2} regras
                  </Typography>
                </div>
              )}
            </div>
          )}

          {/* SWITCH Config Display - Melhorado */}
          {isSwitchType && config?.variable && (
            <div className="space-y-1 pr-4">
              <div className="bg-purple-50 rounded px-2 py-1">
                <Typography
                  variant="span"
                  className="text-[10px] text-gray-500 uppercase"
                >
                  Variável
                </Typography>
                <div className="font-mono text-xs text-gray-800 font-semibold truncate">
                  {config.variable.length > 22
                    ? `${config.variable.substring(0, 22)}...`
                    : config.variable}
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
                Clique 2x para configurar
              </Typography>
            </div>
          )}
        </div>

        {/* Handles de Saída - Design melhorado */}

        {/* IF Type - Handles mais destacados */}
        {/* Sempre renderizar handles true/false quando NÃO for switch */}
        {!isSwitchType && (
          <>
            {/* Handle True */}
            <div className="absolute right-[-4px] top-[15%] flex items-center gap-1">
              {isIfType && (
                <div className="text-white px-2 py-0.5 rounded-l-md mr-1">
                  <Typography
                    variant="span"
                    className="absolute -right-5 -top-5 text-[10px] font-semibold text-neutral-600"
                  >
                    true
                  </Typography>
                </div>
              )}
              <Handle
                type="source"
                position={Position.Right}
                id="true"
                className="w-3 h-3 !bg-green-500 border-2 border-white shadow-lg hover:scale-125 transition-transform"
              />
            </div>

            {/* Handle False */}
            <div className="absolute right-[-4px] bottom-[15%] flex items-center gap-1">
              {isIfType && (
                <div className="text-white px-2 py-0.5 rounded-l-md mr-1">
                  <Typography
                    variant="span"
                    className="absolute -right-6 -top-5 text-[10px] font-semibold text-neutral-600"
                  >
                    false
                  </Typography>
                </div>
              )}
              <Handle
                type="source"
                position={Position.Right}
                id="false"
                className="w-3 h-3 !bg-red-500 border-2 border-white shadow-lg hover:scale-125 transition-transform"
              />
            </div>
          </>
        )}

        {/* SWITCH Type - Lista na lateral direita */}
        {isSwitchType && (
          <div className="absolute right-[-4px] top-[50%] -translate-y-1/2 flex flex-col gap-2">
            {/* Handles para cada caso - TODOS os casos */}
            {switchCases.length > 0 ? (
              switchCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className="flex items-center gap-1 relative"
                >
                  <Typography
                    variant="span"
                    className="absolute left-[calc(100%-7px)] ml-2 -top-1 -translate-y-1/2 text-[10px] font-semibold text-neutral-600 whitespace-nowrap"
                  >
                    {caseItem.label.length > 12
                      ? `${caseItem.label.substring(0, 12)}...`
                      : caseItem.label}
                  </Typography>
                  <div className=" text-white px-2 py-0.5 rounded-l-md max-w-[100px] truncate">
                    <div className="my-5"></div>
                  </div>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`case_${caseItem.id}`}
                    className="w-3 h-3 border-2 border-white shadow-lg hover:scale-125 transition-transform"
                  />
                </div>
              ))
            ) : (
              // Handle padrão se não houver casos ainda
              <Handle
                type="source"
                position={Position.Right}
                id="default"
                className="w-3 h-3 !bg-gray-500 border-2 border-white shadow-lg hover:scale-125 transition-transform"
              />
            )}

            {/* Handle Default - sempre renderizar se configurado */}
            {hasDefaultCase && switchCases.length > 0 && (
              <div className="flex items-center gap-1 mt-1 relative">
                <div className=" text-white px-2 py-0.5 rounded-l-md">
                  <Typography
                    variant="span"
                    className="absolute left-[calc(100%-7px)] ml-2 -top-2 -translate-y-1/2 text-[10px] font-semibold text-neutral-600 whitespace-nowrap"
                  >
                    Default
                  </Typography>
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id="default"
                  className="w-3 h-3 !bg-gray-500 border-2 border-white shadow-lg hover:scale-125 transition-transform"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
