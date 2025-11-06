'use client';

import React, { useRef } from 'react';
import { Wand2 } from 'lucide-react';

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
}

export function VariableInput({
  value,
  onChange,
  placeholder,
  className = '',
  multiline = false,
  rows = 3,
}: VariableInputProps) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    onChange(e.target.value);
  };

  const containerClasses = `relative ${className}`;
  const inputClasses = `
    w-full px-3 py-2 border rounded-md
    focus:outline-none focus:ring-2 focus:ring-blue-500
    ${multiline ? 'resize-vertical' : ''}
  `;

  return (
    <div className={containerClasses}>
      <div className="relative">
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            rows={rows}
            className={inputClasses}
            style={{
              fontFamily: 'monospace',
            }}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            className={inputClasses}
            style={{
              fontFamily: 'monospace',
            }}
          />
        )}

        {/* Indicador de variáveis */}
        {value.includes('{{') && (
          <div className="absolute right-2 top-2 flex items-center gap-1 text-xs text-purple-600">
            <Wand2 className="w-3 h-3" />
            <span>Variável detectada</span>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="mt-1 text-xs text-gray-500">
        Use{' '}
        <code className="px-1 py-0.5 bg-gray-100 rounded">
          {'{{variavel}}'}
        </code>{' '}
        para valores dinâmicos
      </div>

      <style jsx>{`
        .variable-highlight {
          background-color: rgba(147, 51, 234, 0.1);
          color: rgb(147, 51, 234);
          font-weight: 600;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
