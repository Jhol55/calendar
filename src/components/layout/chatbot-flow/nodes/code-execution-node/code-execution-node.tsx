import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../../types';
import { Code2, Clock } from 'lucide-react';
import { Typography } from '@/components/ui/typography';

export const CodeExecutionNode = memo(({ data }: NodeProps<NodeData>) => {
  const codeConfig = data.codeExecutionConfig;
  const language = codeConfig?.language || 'javascript';
  const timeout = codeConfig?.timeout || 5;

  // Emoji baseado na linguagem
  const getLanguageEmoji = () => {
    switch (language) {
      case 'javascript':
        return '🟨';
      case 'typescript':
        return '🔷';
      case 'python':
        return '🐍';
      default:
        return '💻';
    }
  };

  // Nome formatado da linguagem
  const getLanguageName = () => {
    switch (language) {
      case 'javascript':
        return 'JavaScript';
      case 'typescript':
        return 'TypeScript';
      case 'python':
        return 'Python';
      default:
        return language;
    }
  };

  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-indigo-600 bg-white min-w-[200px] max-w-[300px]">
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center gap-2 mb-2">
        <div className="bg-indigo-500 p-2 rounded-lg text-white">
          <Code2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <Typography
            variant="h3"
            className="font-semibold text-sm text-gray-800"
          >
            {getLanguageEmoji()} Code Execution
          </Typography>
          <Typography variant="span" className="text-xs text-gray-500 block">
            {getLanguageName()}
          </Typography>
        </div>
      </div>

      {/* Informações do código */}
      {codeConfig && (
        <div className="mt-2 space-y-1">
          {/* Número de linhas de código (aproximado) */}
          {codeConfig.code && (
            <Typography
              variant="span"
              className="text-xs text-gray-600 truncate block"
            >
              📝 {codeConfig.code.split('\n').length} linhas
            </Typography>
          )}

          {/* Variável de saída */}
          {codeConfig.outputVariable && (
            <Typography
              variant="span"
              className="text-xs text-gray-600 truncate block"
            >
              📦 Output: {codeConfig.outputVariable}
            </Typography>
          )}

          {/* Timeout */}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-500" />
            <Typography variant="span" className="text-xs text-gray-600">
              {timeout}s timeout
            </Typography>
          </div>

          {/* Badge de segurança */}
          <Typography
            variant="span"
            className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium inline-block"
          >
            🔒 Sandbox isolado
          </Typography>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#4f46e5' }}
      />
    </div>
  );
});

CodeExecutionNode.displayName = 'CodeExecutionNode';
