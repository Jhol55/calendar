import { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { NodeData } from '../../types';
import {
  Settings,
  Type,
  Hash,
  Calendar,
  List,
  Box,
  CheckCircle,
} from 'lucide-react';
import { BaseNode, NodeInfoLine } from '../base-node';
import { useVariableContext, resolveVariable } from '../use-variable-context';

export const TransformationNode = memo(
  ({ data, selected }: NodeProps<NodeData>) => {
    const transformationConfig = data.transformationConfig;
    const steps = transformationConfig?.steps || [];
    const firstStep = steps[0];
    const stepCount = steps.length;
    const context = useVariableContext();

    // Ícone e label por tipo de transformação
    const getTypeInfo = (type: string) => {
      switch (type) {
        case 'string':
          return { icon: <Type className="w-4 h-4" />, label: 'Texto' };
        case 'number':
          return { icon: <Hash className="w-4 h-4" />, label: 'Número' };
        case 'date':
          return { icon: <Calendar className="w-4 h-4" />, label: 'Data' };
        case 'array':
          return { icon: <List className="w-4 h-4" />, label: 'Array' };
        case 'object':
          return { icon: <Box className="w-4 h-4" />, label: 'Objeto' };
        case 'validation':
          return {
            icon: <CheckCircle className="w-4 h-4" />,
            label: 'Validação',
          };
        default:
          return {
            icon: <Settings className="w-4 h-4" />,
            label: 'Transformação',
          };
      }
    };

    const typeInfo = firstStep
      ? getTypeInfo(firstStep.type)
      : getTypeInfo('default');

    const resolvedOutputAs = useMemo(
      () => resolveVariable(transformationConfig?.outputAs, context),
      [transformationConfig?.outputAs, context],
    );

    return (
      <BaseNode
        icon={typeInfo.icon}
        title="Transformação"
        subtitle={
          firstStep ? `${typeInfo.label} • ${firstStep.operation}` : undefined
        }
        badge={
          stepCount > 0
            ? `${stepCount} ${stepCount === 1 ? 'transformação' : 'transformações'}`
            : undefined
        }
        selected={selected}
        themeColor="orange"
        footer={
          resolvedOutputAs && (
            <NodeInfoLine className="truncate">
              📤 Saída: {resolvedOutputAs}
            </NodeInfoLine>
          )
        }
      />
    );
  },
);

TransformationNode.displayName = 'TransformationNode';
