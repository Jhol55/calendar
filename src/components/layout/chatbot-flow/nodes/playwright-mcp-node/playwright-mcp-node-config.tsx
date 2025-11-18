'use client';

import React, { useEffect, useState } from 'react';
import { Form } from '@/components/ui/form';
import { FormControl } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/components/ui/submit-button';
import { Typography } from '@/components/ui/typography';
import { FormSelect } from '@/components/ui/select';
import { NodeConfigLayout } from '../node-config-layout';
import { playwrightMcpConfigSchema } from './playwright-mcp-node-config.schema';
import type { FieldValues } from 'react-hook-form';
import type {
  WebscraperStep,
  WebscraperStepAction,
} from '@/components/layout/chatbot-flow/types';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useForm } from '@/hooks/use-form';

export interface PlaywrightMcpConfig {
  goal: string;
  startUrl?: string;
  mode?: 'autonomous' | 'guided' | 'hybrid';
  allowedDomains?: string[];
  maxSteps?: number | string;
  timeoutMs?: number | string;
  resultSchema?: string;
  steps?: WebscraperStep[];
}

interface PlaywrightMcpNodeConfigProps {
  isOpen: boolean;
  onClose: () => void;
  config?: PlaywrightMcpConfig;
  onSave: (config: PlaywrightMcpConfig) => void;
  nodeId?: string;
  flowId?: string;
  nodeLabel?: string;
  onNodeLabelChange?: (label: string) => void;
}

interface PlaywrightMcpFormFieldsProps {
  config?: PlaywrightMcpConfig;
  steps: WebscraperStep[];
  setSteps: React.Dispatch<React.SetStateAction<WebscraperStep[]>>;
  expandedSteps: Set<string>;
  setExpandedSteps: React.Dispatch<React.SetStateAction<Set<string>>>;
}

// Helper para calcular o tempo total de wait em todos os steps do node
function calculateTotalWaitTimeInNode(steps: WebscraperStep[]): number {
  return steps.reduce((nodeTotal, step) => {
    const stepTotal = (step.actions || []).reduce((stepTotal, action) => {
      if (action.action === 'wait' && action.text) {
        const seconds = parseFloat(action.text);
        if (!isNaN(seconds) && seconds > 0) {
          return stepTotal + Math.min(seconds, 60); // Limitar cada wait a 60s
        }
      }
      return stepTotal;
    }, 0);
    return nodeTotal + stepTotal;
  }, 0);
}

// Helper para determinar se a ação precisa de campos adicionais
function actionNeedsFields(action: WebscraperStepAction['action']) {
  // Ações que não precisam de nenhum campo
  const noFieldsNeeded = [
    'close_current_tab',
    'go_back',
    'go_forward',
    'switch_to_default_content',
  ];

  return !noFieldsNeeded.includes(action);
}

// Helper para determinar se a ação precisa de "Tipo de seletor"
function actionNeedsSelectorType(action: WebscraperStepAction['action']) {
  // Ações que precisam de seletor (e portanto de "Tipo de seletor")
  const needsSelector = [
    'click',
    'double_click',
    'type',
    'type_and_submit',
    'hover',
    'switch_to_iframe',
    'scroll_to_view',
    'select_option_by_text',
    'select_option_by_value',
  ];

  return needsSelector.includes(action);
}

// Helper para determinar o label e placeholder do campo "Valor" baseado na ação
function getValueFieldConfig(action: WebscraperStepAction['action']) {
  const configMap: Record<string, { label: string; placeholder: string }> = {
    goto_url: { label: 'URL', placeholder: 'https://exemplo.com' },
    click: {
      label: 'Seletor',
      placeholder: 'Ex: #meu-botao ou //button[@id="submit"]',
    },
    double_click: {
      label: 'Seletor',
      placeholder: 'Ex: #meu-botao ou //button[@id="submit"]',
    },
    scroll_to_view: {
      label: 'Seletor',
      placeholder: 'Ex: #meu-elemento ou //div[@class="content"]',
    },
    type: { label: 'Texto', placeholder: 'Ex: email@exemplo.com' },
    type_and_submit: { label: 'Texto', placeholder: 'Ex: termo de busca' },
    scroll_down: { label: 'Pixels', placeholder: 'Ex: 500 ou 1000' },
    scroll_up: { label: 'Pixels', placeholder: 'Ex: 500 ou 1000' },
    wait: { label: 'Segundos', placeholder: 'Ex: 2 ou 1.5 (máx: 60s)' },
    switch_to_iframe: {
      label: 'Seletor do iframe',
      placeholder: 'Ex: iframe#captcha ou //iframe[@name="frame"]',
    },
    switch_to_tab: { label: 'Índice ou Handle', placeholder: 'Ex: 0, 1, 2...' },
    hover: {
      label: 'Seletor',
      placeholder: 'Ex: nav.menu ou //button[@class="menu"]',
    },
    select_option_by_text: {
      label: 'Texto da opção',
      placeholder: 'Ex: Brasil, São Paulo',
    },
    select_option_by_value: { label: 'Valor', placeholder: 'Ex: br, sp' },
  };

  return (
    configMap[action] || {
      label: 'Valor',
      placeholder: 'Digite o valor necessário',
    }
  );
}

function PlaywrightMcpFormFields({
  config,
  steps,
  setSteps,
  expandedSteps,
  setExpandedSteps,
}: PlaywrightMcpFormFieldsProps) {
  const { setValue } = useForm();

  // Inicializar selects com valores da config/steps somente na primeira vez
  useEffect(() => {
    const timer = setTimeout(() => {
      // Modo do node
      setValue('mode', config?.mode || 'autonomous');

      // Etapas
      steps.forEach((step) => {
        setValue(`step_${step.id}_mode`, step.mode || 'guided');
        setValue(`step_${step.id}_url`, step.url || '');
        setValue(`step_${step.id}_description`, step.description || '');
        setValue(`step_${step.id}_prompt`, step.prompt || '');

        (step.actions || []).forEach((action, index) => {
          // Usar actionId se existir, senão usar um ID temporário baseado no índice
          const actionId = action.id || `${step.id}-action-${index}`;

          setValue(
            `step_${step.id}_action_${actionId}_type`,
            action.action || 'click',
            { shouldValidate: false, shouldDirty: false, shouldTouch: false },
          );
          setValue(
            `step_${step.id}_action_${actionId}_selectorType`,
            action.selectorType || 'css',
            { shouldValidate: false, shouldDirty: false, shouldTouch: false },
          );
          setValue(
            `step_${step.id}_action_${actionId}_selector`,
            action.selector || '',
          );
          setValue(
            `step_${step.id}_action_${actionId}_value`,
            action.text || action.selector || '',
          );
        });
      });

      // Forçar atualização dos FormSelects após um pequeno delay
      setTimeout(() => {
        steps.forEach((step) => {
          (step.actions || []).forEach((action, index) => {
            const actionId = action.id || `${step.id}-action-${index}`;
            setValue(
              `step_${step.id}_action_${actionId}_type`,
              action.action || 'click',
              { shouldValidate: false, shouldDirty: false, shouldTouch: false },
            );
            setValue(
              `step_${step.id}_action_${actionId}_selectorType`,
              action.selectorType || 'css',
              { shouldValidate: false, shouldDirty: false, shouldTouch: false },
            );
          });
        });
      }, 100);
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const addStep = () => {
    const newStep: WebscraperStep = {
      id: crypto.randomUUID(),
      mode: 'guided',
      url: '',
      description: '',
      prompt: null,
      actions: [],
    };
    setSteps((prev) => [...prev, newStep]);
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.add(newStep.id);
      return next;
    });
  };

  const removeStep = (stepId: string) => {
    setSteps((prev) =>
      prev.length > 1 ? prev.filter((s) => s.id !== stepId) : prev,
    );
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setSteps((prev) => {
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === prev.length - 1)
      ) {
        return prev;
      }
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const updateStep = (stepId: string, patch: Partial<WebscraperStep>) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
    );
  };

  const addActionToStep = (stepId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId
          ? {
              ...step,
              actions: [
                ...(step.actions || []),
                {
                  id: crypto.randomUUID(),
                  action: 'click',
                  selectorType: 'css',
                  selector: '',
                  text: '',
                } as WebscraperStepAction,
              ],
            }
          : step,
      ),
    );
  };

  const updateActionInStep = (
    stepId: string,
    actionId: string,
    patch: Partial<WebscraperStepAction>,
  ) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        const actions = step.actions ? [...step.actions] : [];
        // Tentar encontrar por ID primeiro
        let actionIndex = actions.findIndex((a) => a.id === actionId);
        // Se não encontrou por ID e o actionId parece ser um ID temporário baseado em índice
        if (actionIndex === -1 && actionId.includes('-action-')) {
          const match = actionId.match(/-action-(\d+)$/);
          if (match) {
            actionIndex = parseInt(match[1], 10);
          }
        }
        if (actionIndex === -1 || actionIndex >= actions.length) return step;

        // Garantir que a ação tenha um ID (gerar se não tiver)
        const finalId = actions[actionIndex].id || crypto.randomUUID();
        actions[actionIndex] = {
          ...actions[actionIndex],
          id: finalId,
          ...patch,
        };
        return { ...step, actions };
      }),
    );
  };

  const removeActionFromStep = (stepId: string, actionId: string) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        const actions = step.actions ? [...step.actions] : [];
        if (actions.length <= 1) {
          return { ...step, actions: [] };
        }
        // Tentar encontrar por ID primeiro
        let actionIndex = actions.findIndex((a) => a.id === actionId);
        // Se não encontrou por ID e o actionId parece ser um ID temporário baseado em índice
        if (actionIndex === -1 && actionId.includes('-action-')) {
          const match = actionId.match(/-action-(\d+)$/);
          if (match) {
            actionIndex = parseInt(match[1], 10);
          }
        }
        if (actionIndex === -1 || actionIndex >= actions.length) return step;
        const filteredActions = actions.filter(
          (_, index) => index !== actionIndex,
        );
        return { ...step, actions: filteredActions };
      }),
    );
  };

  const moveAction = (
    stepId: string,
    actionId: string,
    direction: 'up' | 'down',
  ) => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id !== stepId) return step;
        const actions = step.actions ? [...step.actions] : [];
        // Tentar encontrar por ID primeiro
        let actionIndex = actions.findIndex((a) => a.id === actionId);
        // Se não encontrou por ID e o actionId parece ser um ID temporário baseado em índice
        if (actionIndex === -1 && actionId.includes('-action-')) {
          const match = actionId.match(/-action-(\d+)$/);
          if (match) {
            actionIndex = parseInt(match[1], 10);
          }
        }
        if (actionIndex === -1) return step;
        if (
          (direction === 'up' && actionIndex === 0) ||
          (direction === 'down' && actionIndex === actions.length - 1)
        ) {
          return step;
        }
        const targetIndex =
          direction === 'up' ? actionIndex - 1 : actionIndex + 1;
        [actions[actionIndex], actions[targetIndex]] = [
          actions[targetIndex],
          actions[actionIndex],
        ];
        return { ...step, actions };
      }),
    );
  };

  return (
    <>
      <div className="space-y-2">
        <FormControl variant="label">
          <Typography variant="h3" className="text-sm font-semibold">
            Objetivo geral
          </Typography>
        </FormControl>
        <Typography variant="span" className="text-sm text-neutral-500">
          Descreva o objetivo final que a IA deve alcançar. Isso ajuda a IA a
          entender quando o objetivo foi completado e não sair antes de
          conseguir.
        </Typography>
        <Textarea
          fieldName="goal"
          defaultValue={config?.goal || ''}
          rows={4}
          placeholder="Ex: Fazer login no sistema, buscar informações sobre um produto, extrair dados de uma página, etc."
        />
      </div>

      <div className="space-y-2">
        <FormControl variant="label">
          <Typography variant="h3" className="text-sm font-semibold">
            Domínios permitidos (opcional)
          </Typography>
        </FormControl>
        <Typography variant="span" className="text-sm text-neutral-500">
          Separe múltiplos domínios por vírgula. Ex: `example.com,
          forms.google.com`.
        </Typography>
        <Input
          fieldName="allowedDomains"
          defaultValue={config?.allowedDomains?.join(', ') || ''}
          placeholder="example.com, forms.google.com"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <FormControl variant="label">
            <Typography variant="h3" className="text-sm font-semibold">
              Máx. passos
            </Typography>
          </FormControl>
          <Input
            fieldName="maxSteps"
            type="number"
            defaultValue={config?.maxSteps?.toString() || ''}
            placeholder="ex: 20"
          />
        </div>

        <div className="space-y-2">
          <FormControl variant="label">
            <Typography variant="h3" className="text-sm font-semibold">
              Timeout (ms)
            </Typography>
          </FormControl>
          <Input
            fieldName="timeoutMs"
            type="number"
            defaultValue={config?.timeoutMs?.toString() || ''}
            placeholder="ex: 60000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <FormControl variant="label">
          <Typography variant="h3" className="text-sm font-semibold">
            Esquema de resultado (opcional)
          </Typography>
        </FormControl>
        <Typography variant="span" className="text-sm text-neutral-500">
          Descreva o formato de saída esperado (JSON Schema simples ou um
          exemplo de JSON).
        </Typography>
        <Textarea
          fieldName="resultSchema"
          defaultValue={config?.resultSchema || ''}
          rows={4}
          placeholder='Ex: {"speakerName": "string", "talkTitle": "string"}'
        />
      </div>

      {/* Etapas WebScraper - design semelhante aos casos do SWITCH */}
      <div className="space-y-4 border-t pt-4 mt-2">
        <div className="flex items-center justify-between">
          <Typography variant="h3" className="text-sm font-semibold">
            Etapas WebScraper
          </Typography>
          <Button
            type="button"
            variant="gradient"
            onClick={addStep}
            className="gap-2 w-fit"
          >
            <Plus className="w-4 h-4" />
            Adicionar Etapa
          </Button>
        </div>
        <Typography variant="span" className="text-sm text-neutral-500">
          Cada etapa pode ser <strong>guiada</strong> (com seletores) ou{' '}
          <strong>automática</strong> (IA converte o prompt em ações).
        </Typography>

        <div className="space-y-3">
          {steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.id);
            const isAutomatic = step.mode === 'automatic';

            return (
              <div
                key={step.id}
                className="border border-neutral-200 rounded-lg bg-white"
              >
                {/* Header da etapa */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => toggleStepExpansion(step.id)}
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
                        Etapa {index + 1} ({step.mode || 'guided'})
                      </Typography>
                      {step.description && (
                        <Typography
                          variant="span"
                          className="text-sm text-neutral-500"
                        >
                          {step.description}
                        </Typography>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => moveStep(index, 'up')}
                      disabled={index === 0}
                      className="hover:bg-neutral-200 h-fit w-fit p-1"
                    >
                      <MoveUp className="w-4 h-4 text-neutral-600" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => moveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                      className="hover:bg-neutral-200 h-fit w-fit p-1"
                    >
                      <MoveDown className="w-4 h-4 text-neutral-600" />
                    </Button>
                    {steps.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => removeStep(step.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Conteúdo expandido da etapa */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-neutral-200 pt-4">
                    {/* Modo da etapa */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <FormControl variant="label">
                          <Typography
                            variant="span"
                            className="text-sm font-semibold"
                          >
                            Modo da etapa *
                          </Typography>
                        </FormControl>
                        <FormSelect
                          fieldName={`step_${step.id}_mode`}
                          className="w-full"
                          placeholder="Selecione o modo da etapa"
                          options={[
                            { value: 'guided', label: 'Guiado (seletores)' },
                            {
                              value: 'automatic',
                              label: 'Automático (prompt)',
                            },
                          ]}
                          onValueChange={(value) =>
                            updateStep(step.id, {
                              mode: value as WebscraperStep['mode'],
                            })
                          }
                        />
                      </div>

                      <div>
                        <FormControl variant="label">
                          <Typography
                            variant="span"
                            className="text-sm font-semibold"
                          >
                            URL da etapa (opcional)
                          </Typography>
                        </FormControl>
                        <Input
                          type="text"
                          fieldName={`step_${step.id}_url`}
                          defaultValue={step.url || ''}
                          onChange={(e) =>
                            updateStep(step.id, { url: e.target.value })
                          }
                          placeholder="https://exemplo.com/pagina"
                        />
                      </div>
                    </div>

                    {/* Descrição geral da etapa */}
                    <div>
                      <FormControl variant="label">
                        <Typography
                          variant="span"
                          className="text-sm font-semibold"
                        >
                          Descrição da etapa (opcional)
                        </Typography>
                      </FormControl>
                      <Input
                        type="text"
                        fieldName={`step_${step.id}_description`}
                        defaultValue={step.description || ''}
                        onChange={(e) =>
                          updateStep(step.id, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Ex: Fazer login, buscar notícia, etc."
                      />
                    </div>

                    {/* Prompt para modo automático */}
                    {isAutomatic && (
                      <div>
                        <FormControl variant="label">
                          <Typography
                            variant="span"
                            className="text-sm font-semibold"
                          >
                            Prompt da etapa (modo automático)
                          </Typography>
                        </FormControl>

                        <Textarea
                          fieldName={`step_${step.id}_prompt`}
                          defaultValue={step.prompt || ''}
                          onChange={(e) =>
                            updateStep(step.id, { prompt: e.target.value })
                          }
                          rows={3}
                          placeholder='Ex: "entre no site X e me dê a primeira notícia que você encontrar"'
                        />
                      </div>
                    )}

                    {/* Ações para modo guiado */}
                    {!isAutomatic && (
                      <div className="!mt-10 relative space-y-1">
                        <div className="flex items-center justify-between">
                          <Typography
                            variant="span"
                            className="text-sm font-bold"
                          >
                            Ações (modo guiado)
                          </Typography>
                          <Button
                            type="button"
                            variant="gradient"
                            onClick={() => addActionToStep(step.id)}
                            className="gap-1 text-sm w-fit p-2 absolute -top-6 right-0"
                          >
                            <Plus className="w-3 h-3" />
                            Adicionar ação
                          </Button>
                        </div>

                        {(step.actions || []).length === 0 && (
                          <Typography
                            variant="span"
                            className="text-sm italic text-neutral-500"
                          >
                            Nenhuma ação definida. Adicione ao menos uma ação,
                            por exemplo: goto_url, click, type.
                          </Typography>
                        )}

                        {(step.actions || []).map((action, actionIndex) => {
                          // Usar ID existente ou criar um baseado no stepId e actionIndex para estabilidade
                          const actionId =
                            action.id || `${step.id}-action-${actionIndex}`;

                          return (
                            <div
                              key={actionId}
                              className="p-3 border border-neutral-300 rounded-md bg-neutral-50 space-y-2"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <Typography
                                  variant="span"
                                  className="text-sm font-semibold text-neutral-600"
                                >
                                  Ação {actionIndex + 1}
                                </Typography>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                      moveAction(step.id, actionId, 'up')
                                    }
                                    disabled={actionIndex === 0}
                                    className="hover:bg-neutral-200 h-fit w-fit p-1"
                                  >
                                    <MoveUp className="w-4 h-4 text-neutral-600" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() =>
                                      moveAction(step.id, actionId, 'down')
                                    }
                                    disabled={
                                      actionIndex ===
                                      (step.actions || []).length - 1
                                    }
                                    className="hover:bg-neutral-200 h-fit w-fit p-1"
                                  >
                                    <MoveDown className="w-4 h-4 text-neutral-600" />
                                  </Button>
                                  {(step.actions || []).length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      onClick={() =>
                                        removeActionFromStep(step.id, actionId)
                                      }
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 h-fit w-fit"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {/* Tipo de ação */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <FormControl variant="label">
                                    <Typography
                                      variant="span"
                                      className="text-sm"
                                    >
                                      Tipo de ação *
                                    </Typography>
                                  </FormControl>
                                  <FormSelect
                                    fieldName={`step_${step.id}_action_${actionId}_type`}
                                    className="w-full"
                                    placeholder="Selecione o tipo de ação"
                                    options={[
                                      { value: 'goto_url', label: 'goto_url' },
                                      { value: 'click', label: 'click' },
                                      {
                                        value: 'double_click',
                                        label: 'double_click',
                                      },
                                      { value: 'type', label: 'type' },
                                      {
                                        value: 'type_and_submit',
                                        label: 'type_and_submit',
                                      },
                                      {
                                        value: 'scroll_down',
                                        label: 'scroll_down',
                                      },
                                      {
                                        value: 'scroll_up',
                                        label: 'scroll_up',
                                      },
                                      {
                                        value: 'scroll_to_view',
                                        label: 'scroll_to_view',
                                      },
                                      { value: 'wait', label: 'wait' },
                                      {
                                        value: 'switch_to_iframe',
                                        label: 'switch_to_iframe',
                                      },
                                      {
                                        value: 'switch_to_default_content',
                                        label: 'switch_to_default_content',
                                      },
                                      {
                                        value: 'switch_to_tab',
                                        label: 'switch_to_tab',
                                      },
                                      {
                                        value: 'close_current_tab',
                                        label: 'close_current_tab',
                                      },
                                      { value: 'go_back', label: 'go_back' },
                                      {
                                        value: 'go_forward',
                                        label: 'go_forward',
                                      },
                                      { value: 'hover', label: 'hover' },
                                      {
                                        value: 'select_option_by_text',
                                        label: 'select_option_by_text',
                                      },
                                      {
                                        value: 'select_option_by_value',
                                        label: 'select_option_by_value',
                                      },
                                    ]}
                                    onValueChange={(value) =>
                                      updateActionInStep(step.id, actionId, {
                                        action:
                                          value as WebscraperStepAction['action'],
                                      })
                                    }
                                  />
                                </div>

                                {/* Tipo de seletor - apenas para ações que precisam */}
                                {actionNeedsSelectorType(action.action) && (
                                  <div>
                                    <FormControl variant="label">
                                      <Typography
                                        variant="span"
                                        className="text-sm"
                                      >
                                        Tipo de seletor
                                      </Typography>
                                    </FormControl>
                                    <FormSelect
                                      fieldName={`step_${step.id}_action_${actionId}_selectorType`}
                                      className="w-full"
                                      placeholder="Selecione o tipo de seletor"
                                      options={[
                                        { value: 'css', label: 'css' },
                                        { value: 'xpath', label: 'xpath' },
                                        {
                                          value: 'tag_name',
                                          label: 'tag_name',
                                        },
                                      ]}
                                      onValueChange={(value) =>
                                        updateActionInStep(step.id, actionId, {
                                          selectorType:
                                            value as WebscraperStepAction['selectorType'],
                                        })
                                      }
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Campo do seletor - para ações que precisam de seletor E texto (type, type_and_submit) */}
                              {['type', 'type_and_submit'].includes(
                                action.action,
                              ) && (
                                <div>
                                  <FormControl variant="label">
                                    <Typography
                                      variant="span"
                                      className="text-sm"
                                    >
                                      Seletor *
                                    </Typography>
                                  </FormControl>
                                  <Input
                                    type="text"
                                    fieldName={`step_${step.id}_action_${actionId}_selector`}
                                    defaultValue={action.selector || ''}
                                    onChange={(e) => {
                                      updateActionInStep(step.id, actionId, {
                                        selector: e.target.value,
                                      });
                                    }}
                                    placeholder="Ex: #meu-input ou //input[@name='email']"
                                  />
                                </div>
                              )}

                              {/* Campo único "Valor" - apenas para ações que precisam */}
                              {actionNeedsFields(action.action) &&
                                (() => {
                                  const valueConfig = getValueFieldConfig(
                                    action.action,
                                  );
                                  // Determinar qual campo usar baseado na ação
                                  const needsSelectorOnly = [
                                    'click',
                                    'double_click',
                                    'hover',
                                    'switch_to_iframe',
                                    'scroll_to_view',
                                  ].includes(action.action);
                                  const needsTextOnly = [
                                    'goto_url',
                                    'scroll_down',
                                    'scroll_up',
                                    'wait',
                                    'switch_to_tab',
                                    'select_option_by_text',
                                    'select_option_by_value',
                                  ].includes(action.action);
                                  const needsBoth = [
                                    'type',
                                    'type_and_submit',
                                  ].includes(action.action);

                                  // Valor atual: para ações que precisam de ambos, priorizar text; senão, usar o que existir
                                  const currentValue = needsBoth
                                    ? action.text || ''
                                    : action.text || action.selector || '';

                                  return (
                                    <div>
                                      <FormControl variant="label">
                                        <Typography
                                          variant="span"
                                          className="text-sm"
                                        >
                                          {valueConfig.label} *
                                        </Typography>
                                      </FormControl>
                                      <Input
                                        type={
                                          action.action === 'wait'
                                            ? 'number'
                                            : 'text'
                                        }
                                        fieldName={`step_${step.id}_action_${actionId}_value`}
                                        defaultValue={currentValue}
                                        min={
                                          action.action === 'wait'
                                            ? 0
                                            : undefined
                                        }
                                        max={
                                          action.action === 'wait'
                                            ? 60
                                            : undefined
                                        }
                                        step={
                                          action.action === 'wait'
                                            ? 0.1
                                            : undefined
                                        }
                                        onChange={(e) => {
                                          let value = e.target.value;

                                          // Validação específica para wait: máximo de 60 segundos por ação e 60s total no node
                                          if (action.action === 'wait') {
                                            let numValue = parseFloat(value);
                                            if (isNaN(numValue)) {
                                              numValue = 0;
                                            }

                                            // Limitar a 60 segundos por ação
                                            if (numValue > 60) {
                                              numValue = 60;
                                            }
                                            if (numValue < 0) {
                                              numValue = 0;
                                            }

                                            // Calcular tempo total de wait no node (sem esta ação)
                                            const currentWaitTime =
                                              parseFloat(action.text || '0') ||
                                              0;
                                            const totalWithoutThis =
                                              calculateTotalWaitTimeInNode(
                                                steps,
                                              ) - Math.min(currentWaitTime, 60);

                                            // Limitar para não exceder 60s total no node
                                            const maxAllowed = Math.max(
                                              0,
                                              60 - totalWithoutThis,
                                            );
                                            if (numValue > maxAllowed) {
                                              numValue = maxAllowed;
                                            }

                                            value = numValue.toString();
                                          }

                                          // Para ações que precisam apenas de seletor, salvar em selector
                                          if (needsSelectorOnly) {
                                            updateActionInStep(
                                              step.id,
                                              actionId,
                                              {
                                                selector: value,
                                                text: null,
                                              },
                                            );
                                          }
                                          // Para ações que precisam apenas de texto, salvar em text
                                          else if (needsTextOnly) {
                                            updateActionInStep(
                                              step.id,
                                              actionId,
                                              {
                                                text: value,
                                                selector: null,
                                              },
                                            );
                                          }
                                          // Para type e type_and_submit, salvar em text (o seletor deve ser definido separadamente se necessário)
                                          else if (needsBoth) {
                                            updateActionInStep(
                                              step.id,
                                              actionId,
                                              {
                                                text: value,
                                              },
                                            );
                                          }
                                        }}
                                        placeholder={valueConfig.placeholder}
                                      />
                                      {action.action === 'wait' &&
                                        (() => {
                                          const totalWaitTime =
                                            calculateTotalWaitTimeInNode(steps);
                                          const isExceeding =
                                            totalWaitTime > 60;
                                          return (
                                            <Typography
                                              variant="span"
                                              className={`text-xs mt-1 block ${isExceeding ? 'text-red-600 font-semibold' : 'text-neutral-600'}`}
                                            >
                                              {isExceeding ? (
                                                <>
                                                  ⚠️ Tempo total de wait no
                                                  node:{' '}
                                                  {totalWaitTime.toFixed(1)}s
                                                  (máx: 60s)
                                                </>
                                              ) : (
                                                <>
                                                  Tempo total de wait no node:{' '}
                                                  {totalWaitTime.toFixed(1)}s /
                                                  60s máximo
                                                </>
                                              )}
                                            </Typography>
                                          );
                                        })()}
                                    </div>
                                  );
                                })()}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function PlaywrightMcpNodeConfig({
  isOpen,
  onClose,
  config,
  onSave,
  nodeId,
  flowId,
  nodeLabel,
  onNodeLabelChange,
}: PlaywrightMcpNodeConfigProps) {
  const [steps, setSteps] = useState<WebscraperStep[]>(
    config?.steps && config.steps.length > 0
      ? config.steps
      : [
          {
            id: crypto.randomUUID(),
            mode: 'guided',
            url: config?.startUrl || '',
            description: config?.goal || '',
            prompt: null,
            actions: [],
          },
        ],
  );

  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(
    () => new Set(steps.map((s) => s.id)),
  );

  const handleSubmit = (values: FieldValues) => {
    const allowedDomainsRaw = (values.allowedDomains as string) || '';
    const allowedDomains = allowedDomainsRaw
      ? allowedDomainsRaw
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean)
      : undefined;

    const normalized: PlaywrightMcpConfig = {
      goal: (values.goal as string) || '',
      startUrl: (values.startUrl as string) || undefined,
      mode:
        (values.mode as PlaywrightMcpConfig['mode']) ||
        config?.mode ||
        'autonomous',
      allowedDomains,
      maxSteps:
        typeof values.maxSteps === 'string' && values.maxSteps.trim().length > 0
          ? values.maxSteps
          : undefined,
      timeoutMs:
        typeof values.timeoutMs === 'string' &&
        values.timeoutMs.trim().length > 0
          ? values.timeoutMs
          : undefined,
      resultSchema:
        typeof values.resultSchema === 'string' &&
        values.resultSchema.trim().length > 0
          ? values.resultSchema
          : undefined,
      steps,
    };

    onSave(normalized);
    onClose();
  };

  return (
    <NodeConfigLayout
      isOpen={isOpen}
      onClose={onClose}
      title="Playwright MCP"
      nodeId={nodeId}
      flowId={flowId}
      nodeLabel={nodeLabel}
      onNodeLabelChange={onNodeLabelChange}
    >
      <Form
        className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
        zodSchema={playwrightMcpConfigSchema}
        onSubmit={handleSubmit}
      >
        <PlaywrightMcpFormFields
          config={config}
          steps={steps}
          setSteps={setSteps}
          expandedSteps={expandedSteps}
          setExpandedSteps={setExpandedSteps}
        />

        <div className="pt-4">
          <SubmitButton type="submit" className="w-full">
            Salvar Configuração
          </SubmitButton>
        </div>
      </Form>
    </NodeConfigLayout>
  );
}
