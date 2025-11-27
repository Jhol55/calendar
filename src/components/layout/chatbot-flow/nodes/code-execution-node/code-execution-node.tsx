import { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { NodeData } from '../../types';
import { Code2, Clock } from 'lucide-react';
import { BaseNode, NodeInfoLine } from '../base-node';
import { useVariableContext, resolveVariable } from '../use-variable-context';

export const CodeExecutionNode = memo(
  ({ data, selected }: NodeProps<NodeData>) => {
    const codeConfig = data.codeExecutionConfig;
    const language = codeConfig?.language || 'javascript';
    const timeout = codeConfig?.timeout || 5;
    const context = useVariableContext();

    // Nome formatado da linguagem
    const getLanguageName = () => {
      switch (language) {
        case 'javascript':
          return '🟨 JavaScript';
        case 'python':
          return '🐍 Python';
        default:
          return `💻 ${language}`;
      }
    };

    const resolvedOutputVariable = useMemo(
      () => resolveVariable(codeConfig?.outputVariable, context),
      [codeConfig?.outputVariable, context],
    );

    return (
      <BaseNode
        icon={<Code2 className="w-4 h-4" />}
        title="Code Execution"
        subtitle={getLanguageName()}
        selected={selected}
        themeColor="orange"
        footer={
          codeConfig && (
            <div className="space-y-1">
              {codeConfig.code && (
                <NodeInfoLine>
                  📝 {codeConfig.code.split('\n').length} linhas
                </NodeInfoLine>
              )}
              {resolvedOutputVariable && (
                <NodeInfoLine className="truncate">
                  📦 Output: {resolvedOutputVariable}
                </NodeInfoLine>
              )}
              <NodeInfoLine icon={<Clock className="w-3 h-3" />}>
                {timeout}s timeout
              </NodeInfoLine>
            </div>
          )
        }
      />
    );
  },
);

CodeExecutionNode.displayName = 'CodeExecutionNode';
