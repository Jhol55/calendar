'use client';

import React from 'react';
import { CodeiumEditor } from '@codeium/react-code-editor';
import { useForm } from '@/hooks/use-form';

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

  // Pegar o valor atual do campo
  const value = (form[fieldName] as string) || '';

  // Handler para mudanças no editor
  const handleChange = (newValue: string | undefined) => {
    setValue(fieldName, newValue || '');
  };

  // Handler para customizar cores quando o editor for montado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorDidMount = (editor: any, monaco: any) => {
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
  };

  return (
    <div className={className}>
      <div className="border rounded-md overflow-hidden border-gray-300">
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
