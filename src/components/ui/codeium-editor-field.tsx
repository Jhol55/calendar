'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { CodeiumEditor } from '@codeium/react-code-editor';
import { useForm } from '@/hooks/use-form';
import { useFlowExecutionOptional } from '@/contexts/flow-execution/flow-execution-context';
import { replaceVariables } from '@/workers/helpers/variable-replacer';

interface CodeiumEditorFieldProps {
  fieldName: string;
  language?: 'javascript' | 'python' | 'typescript' | 'json';
  placeholder?: string;
  height?: string;
  theme?: 'vs-dark' | 'light';
  className?: string;
  backgroundColor?: string;
  lineNumberColor?: string;
  selectionBackground?: string;
}

export function CodeiumEditorField({
  fieldName,
  language = 'javascript',
  placeholder = '',
  height = '300px',
  theme = 'light',
  className = '',
  backgroundColor,
  lineNumberColor,
  selectionBackground,
}: CodeiumEditorFieldProps) {
  const { form, setValue } = useForm();
  const flowExecution = useFlowExecutionOptional();

  // 🔄 Ref para manter o contexto sempre atualizado
  const variableContextRef = useRef<Record<string, unknown>>({});

  // Pegar o valor atual do campo
  const value = (form[fieldName] as string) || '';

  // Handler para mudanças no editor
  const handleChange = (newValue: string | undefined) => {
    setValue(fieldName, newValue || '');
  };

  // Construir contexto de variáveis para resolução (igual ao Input)
  const variableContext = useMemo(() => {
    const baseContext = { ...form };

    if (flowExecution?.selectedExecution?.nodeExecutions) {
      const nodeExecutions = flowExecution.selectedExecution.nodeExecutions;

      const $nodes: Record<string, { output: unknown }> = {};
      Object.keys(nodeExecutions).forEach((nodeId) => {
        const nodeExec = nodeExecutions[nodeId];
        if (nodeExec?.result) {
          $nodes[nodeId] = {
            output: nodeExec.result,
          };
        } else if (nodeExec?.data) {
          $nodes[nodeId] = {
            output: nodeExec.data,
          };
        }
      });

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
        ...(webhookData && typeof webhookData === 'object' ? webhookData : {}),
      };
    }

    return baseContext;
  }, [form, flowExecution]);

  // 🔄 Atualizar ref sempre que o contexto mudar
  useEffect(() => {
    variableContextRef.current = variableContext;
  }, [variableContext]);

  // Handler para customizar cores e adicionar features quando o editor for montado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorDidMount = (editor: any, monaco: any) => {
    // 🧹 Armazenar disposables para limpar ao desmontar
    const disposables: { dispose: () => void }[] = [];

    // 🚫 Desabilitar validação de sintaxe para todos os tipos de linguagem
    if (language === 'json') {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: false,
        schemas: [],
      });
    }

    if (language === 'javascript' || language === 'typescript') {
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
    }

    // Aplicar tema customizado
    if (backgroundColor || lineNumberColor || selectionBackground) {
      monaco.editor.defineTheme('customTheme', {
        base: theme === 'vs-dark' ? 'vs-dark' : 'vs',
        inherit: true,
        rules: [],
        colors: {
          ...(backgroundColor && { 'editor.background': backgroundColor }),
          ...(lineNumberColor && {
            'editorLineNumber.foreground': lineNumberColor,
          }),
          ...(selectionBackground && {
            'editor.selectionBackground': selectionBackground,
          }),
        },
      });
      monaco.editor.setTheme('customTheme');
    }

    // 🎨 Adicionar decorações para variáveis dinâmicas
    const updateDecorations = () => {
      const model = editor.getModel();
      if (!model) return;

      const text = model.getValue();
      const regex = /\{\{([^}]+)\}\}/g;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decorations: any[] = [];
      let match;

      while ((match = regex.exec(text)) !== null) {
        const startPos = model.getPositionAt(match.index);
        const endPos = model.getPositionAt(match.index + match[0].length);

        decorations.push({
          range: new monaco.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column,
          ),
          options: {
            inlineClassName: 'variable-decoration',
            stickiness:
              monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        });
      }

      editor.deltaDecorations([], decorations);
    };

    // Atualizar decorações quando o conteúdo mudar
    const changeDisposable = editor.onDidChangeModelContent(() => {
      updateDecorations();
    });
    disposables.push(changeDisposable);

    // Aplicar decorações iniciais
    updateDecorations();

    // 💡 Adicionar hover provider para mostrar valores das variáveis
    const hoverDisposable = monaco.languages.registerHoverProvider(language, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        // Pegar a linha inteira para detectar variáveis
        const lineContent = model.getLineContent(position.lineNumber);
        const regex = /\{\{([^}]+)\}\}/g;
        let match;

        while ((match = regex.exec(lineContent)) !== null) {
          const startCol = match.index + 1;
          const endCol = match.index + match[0].length + 1;

          // Verificar se o cursor está dentro dessa variável
          if (position.column >= startCol && position.column <= endCol) {
            const variableText = match[0];

            // Tentar resolver a variável usando o ref (sempre atualizado)
            try {
              const resolvedValue = replaceVariables(
                variableText,
                variableContextRef.current,
              );

              const wasResolved =
                resolvedValue !== variableText &&
                !String(resolvedValue).includes('{{');

              const displayValue = wasResolved
                ? typeof resolvedValue === 'object'
                  ? JSON.stringify(resolvedValue, null, 2)
                  : String(resolvedValue)
                : 'Nenhum valor disponível';

              return {
                range: new monaco.Range(
                  position.lineNumber,
                  startCol,
                  position.lineNumber,
                  endCol,
                ),
                contents: [
                  {
                    value: wasResolved
                      ? `${displayValue}`
                      : `_Nenhum valor disponível_\n\n💡 Dica: Execute o fluxo para visualizar os valores reais`,
                  },
                ],
              };
            } catch {
              return {
                range: new monaco.Range(
                  position.lineNumber,
                  startCol,
                  position.lineNumber,
                  endCol,
                ),
                contents: [
                  {
                    value: `**${variableText}**\n\n_Erro ao resolver variável_`,
                  },
                ],
              };
            }
          }
        }

        return null;
      },
    });
    disposables.push(hoverDisposable);

    // 🧹 Cleanup quando o editor for desmontado
    editor.onDidDispose(() => {
      disposables.forEach((d) => d.dispose());
    });

    // 📌 Adicionar estilo CSS para as decorações de variáveis e hover widget
    if (typeof document !== 'undefined') {
      const styleId = 'variable-decoration-style';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          .variable-decoration {
            background-color: rgba(147, 197, 253, 0.2);
            border-bottom: 2px solid rgba(59, 130, 246, 0.5);
            border-radius: 2px;
          }
          
          /* Estilo básico do hover */
          .monaco-editor .monaco-hover {
            z-index: 999999 !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
        `;
        document.head.appendChild(style);
      }
    }

    // 🎯 Remover SOMENTE a tag <a> do botão Codeium (não o container pai)
    const removeCodeiumButton = () => {
      const codeiumLinks = document.querySelectorAll(
        'a[href="https://codeium.com?referrer=codeium-editor"]',
      );
      codeiumLinks.forEach((link) => {
        // Remover APENAS o link <a>, não o pai
        link.remove();
      });
    };

    // ⚡ Executar várias vezes imediatamente para garantir remoção rápida
    removeCodeiumButton();
    setTimeout(removeCodeiumButton, 0);
    setTimeout(removeCodeiumButton, 10);
    setTimeout(removeCodeiumButton, 50);
    setTimeout(removeCodeiumButton, 100);

    // ⚡ Intervalo para verificação contínua (mais agressivo)
    const interval = setInterval(removeCodeiumButton, 100);

    // Observar mudanças no DOM para remover instantaneamente
    const observer = new MutationObserver(() => {
      removeCodeiumButton();
    });

    if (typeof document !== 'undefined') {
      const editorElement = editor.getDomNode();
      if (editorElement) {
        // Observar apenas o editor, não o body inteiro (mais rápido)
        observer.observe(editorElement, {
          childList: true,
          subtree: true,
        });
      }

      // Limpar ao desmontar
      editor.onDidDispose(() => {
        observer.disconnect();
        clearInterval(interval);
      });
    }
  };

  return (
    <div className={className}>
      <div className="border rounded-md border-gray-300">
        <CodeiumEditor
          language={language}
          theme={theme}
          value={value}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          height={height}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            wrappingIndent: 'indent',
            hover: {
              enabled: true,
              delay: 100,
              sticky: true,
            },
            // 🚫 Desabilitar validação de problemas/erros
            quickSuggestions: false,
            parameterHints: { enabled: false },
            suggestOnTriggerCharacters: false,
            acceptSuggestionOnEnter: 'off',
            tabCompletion: 'off',
            wordBasedSuggestions: 'off',
          }}
        />
      </div>
      {placeholder && !value && (
        <p className="text-xs text-neutral-500 mt-1 italic">
          Exemplo: {placeholder.split('\n')[0]}
        </p>
      )}
    </div>
  );
}
