'use client';

import { useForm } from '@/hooks/use-form';
import { TextareaProps } from './textarea.type';
import { forwardRef, useMemo, useState, useRef, useEffect } from 'react';
import { mergeRefs } from '@/utils/mergeRefs';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { replaceVariables } from '@/workers/helpers/variable-replacer';
import { useFlowExecutionOptional } from '@/contexts/flow-execution/flow-execution-context';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ fieldName, className, onChange, value: externalValue, ...props }, ref) => {
    const { register, setValue, form } = useForm();
    const flowExecution = useFlowExecutionOptional();
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const {
      ref: registerRef,
      onChange: registerOnChange,
      ...registerProps
    } = register(fieldName);

    const handleOnChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setValue(fieldName, value);
      registerOnChange?.(e);
      onChange?.(e);
    };

    // Detectar clique fora do textarea para voltar ao modo de visualização
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          textareaRef.current &&
          !textareaRef.current.contains(event.target as Node)
        ) {
          setIsEditing(false);
        }
      };

      if (isEditing) {
        document.addEventListener('mousedown', handleClickOutside);
        return () =>
          document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isEditing]);

    // Focar no textarea quando entrar no modo de edição
    useEffect(() => {
      if (isEditing && textareaRef.current) {
        textareaRef.current.focus();
      }
    }, [isEditing]);

    const defaultStyle =
      'w-full rounded-md border border-gray-300 bg-neutral-100 p-2.5 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#5c5e5d] text-sm resize-none';

    // Detectar variáveis dinâmicas no valor do textarea
    const currentValue = (externalValue ?? form[fieldName] ?? '') as string;
    const hasVariables =
      typeof currentValue === 'string' && /\{\{[^}]+\}\}/g.test(currentValue);

    // Construir contexto de variáveis para resolução
    const variableContext = useMemo(() => {
      const baseContext = { ...form };

      if (flowExecution?.selectedExecution?.nodeExecutions) {
        const nodeExecutions = flowExecution.selectedExecution.nodeExecutions;

        const $nodes: Record<string, { output: unknown }> = {};
        Object.keys(nodeExecutions).forEach((nodeId) => {
          const nodeExec = nodeExecutions[nodeId];
          // Webhook nodes têm "data" ao invés de "result"
          if (nodeExec?.result) {
            $nodes[nodeId] = {
              output: nodeExec.result,
            };
          } else if (nodeExec?.data) {
            // Para webhook nodes, usar "data" como output
            $nodes[nodeId] = {
              output: nodeExec.data,
            };
          }
        });

        // Dados do webhook/trigger (entrada do flow)
        const execution = flowExecution.selectedExecution as unknown as {
          data?: unknown;
          triggerData?: unknown;
        };
        const webhookData = execution.data || execution.triggerData;

        return {
          ...baseContext,
          $nodes,
          $node: {
            input: webhookData,
          },
          // Adicionar dados do webhook diretamente no contexto raiz também
          ...(webhookData && typeof webhookData === 'object'
            ? webhookData
            : {}),
        };
      }

      return baseContext;
    }, [form, flowExecution]);

    // Parse do valor para destacar variáveis
    const renderValueWithVariables = useMemo(() => {
      if (!hasVariables || !currentValue || typeof currentValue !== 'string') {
        return null;
      }

      const parts: Array<{ text: string; isVariable: boolean; path?: string }> =
        [];
      let lastIndex = 0;
      const regex = /\{\{([^}]+)\}\}/g;
      let match;

      while ((match = regex.exec(currentValue)) !== null) {
        if (match.index > lastIndex) {
          parts.push({
            text: currentValue.slice(lastIndex, match.index),
            isVariable: false,
          });
        }

        parts.push({
          text: match[0],
          isVariable: true,
          path: match[1].trim(),
        });

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < currentValue.length) {
        parts.push({
          text: currentValue.slice(lastIndex),
          isVariable: false,
        });
      }

      return parts;
    }, [currentValue, hasVariables]);

    // Se não houver variáveis, renderizar normalmente
    if (!hasVariables) {
      return (
        <textarea
          ref={mergeRefs(ref, registerRef)}
          onChange={handleOnChange}
          className={cn(defaultStyle, className)}
          {...props}
          {...registerProps}
        />
      );
    }

    // Se estiver no modo de edição, renderizar textarea normal
    if (isEditing) {
      return (
        <textarea
          ref={mergeRefs(ref, registerRef, textareaRef)}
          onChange={handleOnChange}
          className={cn(defaultStyle, className)}
          {...props}
          {...registerProps}
        />
      );
    }

    // Renderizar com overlay para variáveis
    return (
      <div className="relative w-full">
        <textarea
          ref={mergeRefs(ref, registerRef, textareaRef)}
          onChange={handleOnChange}
          className={cn(
            defaultStyle,
            'text-transparent caret-black',
            className,
          )}
          {...props}
          {...registerProps}
        />
        {/* Overlay para mostrar variáveis estilizadas */}
        <div
          className="absolute inset-0 pointer-events-none p-2.5 text-sm overflow-hidden"
          style={{ backgroundColor: 'transparent' }}
        >
          <div className="flex flex-wrap items-start gap-0.5 whitespace-pre-wrap">
            {renderValueWithVariables?.map((part, index) => {
              if (!part.isVariable) {
                return (
                  <span
                    key={index}
                    className="text-black/80"
                    style={{ fontFamily: 'inherit' }}
                  >
                    {part.text}
                  </span>
                );
              }

              // Resolver o valor da variável (com JavaScript aplicado se houver)
              const resolvedValue = part.path
                ? (() => {
                    try {
                      return replaceVariables(part.text, variableContext);
                    } catch {
                      return 'Error resolving variable';
                    }
                  })()
                : part.text;

              // Verificar se a variável foi resolvida ou não
              const wasResolved =
                resolvedValue !== part.text &&
                !String(resolvedValue).includes('{{');

              const displayValue = wasResolved
                ? typeof resolvedValue === 'object'
                  ? JSON.stringify(resolvedValue, null, 2)
                  : String(resolvedValue)
                : 'Nenhum valor disponível';

              return (
                <Tooltip
                  key={index}
                  content={
                    <div className="max-w-md w-fit">
                      <div
                        className={cn(
                          'break-words whitespace-pre-wrap font-mono text-xs leading-relaxed',
                          wasResolved ? 'text-white' : 'text-yellow-200 italic',
                        )}
                      >
                        {displayValue}
                      </div>
                      {!wasResolved && (
                        <div className="mt-2 pt-2 border-t border-neutral-500/50 text-xs text-neutral-300">
                          💡 Dica: Execute o fluxo para visualizar os valores
                          reais
                        </div>
                      )}
                    </div>
                  }
                  delay={200}
                >
                  <span
                    className="pointer-events-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-300 cursor-pointer hover:bg-zinc-200 transition-colors"
                    style={{
                      fontFamily: 'inherit',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    }}
                    onClick={() => setIsEditing(true)}
                  >
                    {part.text}
                  </span>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
