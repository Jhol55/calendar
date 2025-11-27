'use client';

import { useForm } from '@/hooks/use-form';
import { InputProps } from './input.type';
import { forwardRef, useMemo, useState, useRef, useEffect } from 'react';
import { mergeRefs } from '@/utils/mergeRefs';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { replaceVariables } from '@/workers/helpers/variable-replacer';
import { useFlowExecutionOptional } from '@/contexts/flow-execution/flow-execution-context';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      fieldName,
      type = 'text',
      autoComplete = 'on',
      className,
      onChange,
      value: externalValue,
      ...props
    },
    ref,
  ) => {
    const { register, setValue, maskSchema, form } = useForm();
    const flowExecution = useFlowExecutionOptional();
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const {
      ref: registerRef,
      onChange: registerOnChange,
      ...registerProps
    } = register(fieldName);

    // Sincronizar externalValue com o formulário quando mudar
    useEffect(() => {
      if (externalValue !== undefined) {
        const formValue = form[fieldName];
        const externalValueStr = String(externalValue);
        if (formValue !== externalValueStr) {
          setValue(fieldName, externalValueStr, { shouldValidate: false });
        }
      }
    }, [externalValue, fieldName, setValue, form]);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!['checkbox', 'radio'].includes(type)) {
        setValue(fieldName, maskSchema?.[fieldName]?.(e) ?? e.target.value);
      }
      registerOnChange?.(e);
      onChange?.(e);
    };

    // Detectar clique fora do input para voltar ao modo de visualização
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          inputRef.current &&
          !inputRef.current.contains(event.target as Node)
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

    // Focar no input quando entrar no modo de edição
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isEditing]);

    const styles: Record<string, string> = {
      default:
        'w-full rounded-md border border-gray-300 bg-neutral-100 p-2.5 text-black/80 outline-none placeholder:text-black/40 focus:ring-2 focus:ring-[#5c5e5d] text-sm',
      checkbox:
        "border-1 relative box-border block min-h-4 min-w-4 max-w-4 cursor-pointer appearance-none border-neutral-300 bg-neutral-300 transition-all duration-300 before:absolute before:left-2/4 before:top-[42%] before:h-[10px] before:w-[6px] before:-translate-x-2/4 before:-translate-y-2/4 before:rotate-45 before:scale-0 before:border-b-2 before:border-r-2 before:border-solid before:border-b-white before:border-r-white before:opacity-0 before:transition-all before:delay-100 before:duration-100 before:ease-in before:content-[''] after:absolute after:inset-0 after:rounded-[7px] after:opacity-0 after:shadow-[0_0_0_calc(30px_/_2.5)_#34d399] after:transition-all after:duration-500 after:ease-in after:content-[''] checked:border-transparent checked:bg-[#34d399] checked:before:-translate-x-2/4 checked:before:-translate-y-2/4 checked:before:rotate-45 checked:before:scale-x-[1] checked:before:scale-y-[1] checked:before:opacity-100 checked:before:transition-all checked:before:delay-100 checked:before:duration-200 checked:before:ease-in hover:border-[#34d399] focus:outline-[#34d399] [&:active:not(:checked)]:after:opacity-100 [&:active:not(:checked)]:after:shadow-none [&:active:not(:checked)]:after:transition-none",
    };

    // Detectar variáveis dinâmicas no valor do input
    const currentValue = (externalValue ?? form[fieldName] ?? '') as string;
    const hasVariables =
      typeof currentValue === 'string' && /\{\{[^}]+\}\}/g.test(currentValue);

    // Tipos de input que suportam variáveis dinâmicas
    const supportedTypes = ['text', 'tel', 'email', 'url', 'search', 'number'];
    const supportsVariables = supportedTypes.includes(type);

    // Construir contexto de variáveis para resolução
    const variableContext = useMemo(() => {
      // Contexto base com dados do formulário
      const baseContext = { ...form };

      // Se tiver execução de flow disponível, adicionar $nodes
      if (flowExecution?.selectedExecution?.nodeExecutions) {
        const nodeExecutions = flowExecution.selectedExecution.nodeExecutions;

        // Criar objeto $nodes com saídas de todos os nodes
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
        // Texto antes da variável
        if (match.index > lastIndex) {
          parts.push({
            text: currentValue.slice(lastIndex, match.index),
            isVariable: false,
          });
        }

        // A variável
        parts.push({
          text: match[0],
          isVariable: true,
          path: match[1].trim(),
        });

        lastIndex = match.index + match[0].length;
      }

      // Texto após a última variável
      if (lastIndex < currentValue.length) {
        parts.push({
          text: currentValue.slice(lastIndex),
          isVariable: false,
        });
      }

      return parts;
    }, [currentValue, hasVariables]);

    // Para inputs que não suportam variáveis ou não têm variáveis, renderizar normalmente
    if (!supportsVariables || !hasVariables) {
      return (
        <input
          ref={mergeRefs(ref, registerRef)}
          type={type}
          autoComplete={autoComplete}
          onChange={handleOnChange}
          className={cn(styles[type] ?? styles.default, className)}
          {...props}
          {...registerProps}
        />
      );
    }

    // Se estiver no modo de edição, renderizar input normal
    if (isEditing) {
      return (
        <input
          ref={mergeRefs(ref, registerRef, inputRef)}
          type={type}
          autoComplete={autoComplete}
          onChange={handleOnChange}
          className={cn(styles.default, className)}
          {...props}
          {...registerProps}
        />
      );
    }

    // Para inputs text com variáveis, renderizar com overlay
    const handleEnterEditMode = () => {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    };

    return (
      <div className="relative w-full">
        {/* Container clicável que parece um input */}
        <div
          className={cn(
            styles.default,
            'flex items-center overflow-hidden whitespace-nowrap cursor-text min-h-[42px]',
            className,
          )}
          onClick={handleEnterEditMode}
        >
          <div className="flex flex-wrap items-center gap-0.5">
            {renderValueWithVariables?.map((part, index) => {
              if (!part.isVariable) {
                return (
                  <span
                    key={index}
                    className="text-black/80 select-none"
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
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-300 cursor-pointer hover:bg-zinc-200 transition-colors"
                    style={{
                      fontFamily: 'inherit',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEnterEditMode();
                    }}
                  >
                    {part.text}
                  </span>
                </Tooltip>
              );
            })}
          </div>
        </div>
        {/* Input escondido para manter o valor do formulário */}
        <input
          ref={mergeRefs(ref, registerRef, inputRef)}
          type="hidden"
          onChange={handleOnChange}
          {...props}
          {...registerProps}
        />
      </div>
    );
  },
);

Input.displayName = 'Input';
