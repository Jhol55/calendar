import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../types';
import {
  Settings,
  Type,
  Hash,
  Calendar,
  List,
  Box,
  CheckCircle,
} from 'lucide-react';
import { Typography } from '@/components/ui/typography';

export const TransformationNode = memo(({ data }: NodeProps<NodeData>) => {
  const transformationConfig = data.transformationConfig;
  const steps = transformationConfig?.steps || [];
  const firstStep = steps[0];
  const stepCount = steps.length;

  // Ícones e cores por tipo de transformação
  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'string':
        return {
          icon: <Type className="w-4 h-4" />,
          color: 'bg-green-500',
          label: 'Texto',
        };
      case 'number':
        return {
          icon: <Hash className="w-4 h-4" />,
          color: 'bg-blue-500',
          label: 'Número',
        };
      case 'date':
        return {
          icon: <Calendar className="w-4 h-4" />,
          color: 'bg-orange-500',
          label: 'Data',
        };
      case 'array':
        return {
          icon: <List className="w-4 h-4" />,
          color: 'bg-purple-500',
          label: 'Array',
        };
      case 'object':
        return {
          icon: <Box className="w-4 h-4" />,
          color: 'bg-indigo-500',
          label: 'Objeto',
        };
      case 'validation':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: 'bg-teal-500',
          label: 'Validação',
        };
      default:
        return {
          icon: <Settings className="w-4 h-4" />,
          color: 'bg-gray-500',
          label: 'Transformação',
        };
    }
  };

  const style = firstStep
    ? getTypeStyle(firstStep.type)
    : getTypeStyle('default');

  return (
    <div className="px-4 py-3 shadow-lg rounded-lg border-2 border-amber-600 bg-white min-w-[200px] max-w-[300px]">
      <Handle type="target" position={Position.Left} />

      <div className="flex items-center gap-2 mb-2">
        <div className={`${style.color} p-2 rounded-lg text-white`}>
          {style.icon}
        </div>
        <div className="flex-1 min-w-0">
          <Typography
            variant="h3"
            className="font-semibold text-sm text-gray-800"
          >
            🔧 Transformação
          </Typography>
          {firstStep && (
            <Typography variant="span" className="text-xs text-gray-500 block">
              {style.label} • {firstStep.operation}
            </Typography>
          )}
        </div>
      </div>

      {/* Contador de steps */}
      {stepCount > 0 && (
        <div className="mt-2">
          <Typography
            variant="span"
            className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-medium"
          >
            {stepCount} {stepCount === 1 ? 'transformação' : 'transformações'}
          </Typography>
        </div>
      )}

      {/* Nome da variável de saída (se definido) */}
      {transformationConfig?.outputAs && (
        <Typography
          variant="span"
          className="mt-2 text-xs text-gray-600 truncate block"
        >
          📤 Saída: {transformationConfig.outputAs}
        </Typography>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
});

TransformationNode.displayName = 'TransformationNode';
