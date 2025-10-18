'use client';

import React, { useState, useEffect } from 'react';
import { Typography } from '@/components/ui/typography';
import { ChevronRight, Copy, Check } from 'lucide-react';

interface ExecutionData {
  input?: any;
  output?: any;
}

interface NodeExecutionPanelProps {
  nodeId: string;
  flowId: string;
  mode: 'input' | 'output';
  onVariableSelect?: (variablePath: string) => void;
}

// Componente separado para cada item da árvore (resolve o problema de hooks)
function JsonTreeItem({
  itemKey,
  value,
  parentPath,
  level,
  copiedPath,
  onCopyPath,
  renderJsonTree,
}: {
  itemKey: string;
  value: any;
  parentPath: string;
  level: number;
  copiedPath: string | null;
  onCopyPath: (path: string) => void;
  renderJsonTree: (
    obj: any,
    parentPath: string,
    level: number,
  ) => React.ReactNode;
}) {
  const currentPath = `${parentPath}.${itemKey}`;
  const isObject = typeof value === 'object' && value !== null;
  const [isExpanded, setIsExpanded] = useState(level < 2);

  return (
    <div className="my-1">
      <div className="flex items-center gap-2 group hover:bg-gray-50 rounded px-2 py-1">
        {isObject && (
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-0.5">
            <ChevronRight
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
        <span className="text-sm font-medium text-gray-700">{itemKey}:</span>
        {!isObject && (
          <>
            <span className="text-sm text-blue-600 font-mono">
              {JSON.stringify(value)}
            </span>
            <button
              onClick={() => onCopyPath(currentPath)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded ml-auto"
              title="Copiar variável"
            >
              {copiedPath === currentPath ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400" />
              )}
            </button>
          </>
        )}
      </div>
      {isObject && isExpanded && renderJsonTree(value, currentPath, level + 1)}
    </div>
  );
}

export function NodeExecutionPanel({
  nodeId,
  flowId,
  mode,
  onVariableSelect,
}: NodeExecutionPanelProps) {
  const [executionData, setExecutionData] = useState<ExecutionData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    fetchExecutionData();
  }, [nodeId, flowId]);

  const fetchExecutionData = async () => {
    try {
      setLoading(true);

      // Primeiro, tentar pegar do sessionStorage (execução selecionada)
      const selectedExecutionStr = sessionStorage.getItem('selectedExecution');
      let execution = null;

      if (selectedExecutionStr) {
        try {
          execution = JSON.parse(selectedExecutionStr);
        } catch {
          // Se falhar, buscar do servidor
        }
      }

      // Se não houver execução selecionada, buscar a última
      if (!execution) {
        const response = await fetch(
          `/api/executions?flowId=${flowId}&limit=1`,
        );
        const data = await response.json();

        if (data.executions && data.executions.length > 0) {
          execution = data.executions[0];
        }
      }

      if (execution) {
        const nodeExecutions = execution.nodeExecutions || {};
        const nodeData = nodeExecutions[nodeId];

        setExecutionData({
          input: nodeData?.data || execution.data,
          output: nodeData?.result || null,
        });
      }
    } catch (error) {
      console.error('Error fetching execution data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(`{{${path}}}`);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);

    if (onVariableSelect) {
      onVariableSelect(`{{${path}}}`);
    }
  };

  const renderJsonTree = (
    obj: any,
    parentPath: string = '$node.input',
    level: number = 0,
  ) => {
    if (obj === null || obj === undefined) {
      return <div className="ml-4 text-gray-500 text-sm">null</div>;
    }

    if (typeof obj !== 'object') {
      return (
        <div className="ml-4 text-sm flex items-center gap-2 group">
          <span className="text-blue-600 font-mono">{JSON.stringify(obj)}</span>
          <button
            onClick={() => handleCopyPath(parentPath)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
            title="Copiar variável"
          >
            {copiedPath === parentPath ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3 text-gray-400" />
            )}
          </button>
        </div>
      );
    }

    return (
      <div className={level > 0 ? 'ml-4' : ''}>
        {Object.entries(obj).map(([key, value]) => (
          <JsonTreeItem
            key={key}
            itemKey={key}
            value={value}
            parentPath={parentPath}
            level={level}
            copiedPath={copiedPath}
            onCopyPath={handleCopyPath}
            renderJsonTree={renderJsonTree}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Typography variant="p" className="text-gray-500">
          Carregando execuções...
        </Typography>
      </div>
    );
  }

  if (!executionData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <Typography variant="p" className="text-gray-500 text-center">
          Nenhuma execução encontrada.
        </Typography>
        <Typography variant="small" className="text-gray-400 text-center mt-2">
          Execute o fluxo para ver os dados aqui.
        </Typography>
      </div>
    );
  }

  const data = mode === 'input' ? executionData.input : executionData.output;
  const pathPrefix = mode === 'input' ? '$node.input' : '$node.output';

  return (
    <div className="h-full flex flex-col">
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <Typography variant="small" className="text-gray-500 mb-3">
          {mode === 'input'
            ? 'Clique no ícone de cópia para usar a variável'
            : 'Dados retornados após execução'}
        </Typography>
        {data ? (
          renderJsonTree(data, pathPrefix)
        ) : (
          <Typography variant="p" className="text-gray-400">
            {mode === 'input'
              ? 'Nenhum dado de entrada'
              : 'Nenhum dado de saída'}
          </Typography>
        )}
      </div>
    </div>
  );
}
