/**
 * Higher Order Component que adiciona botão de execução aos nodes
 * Aparece no hover e permite executar o workflow até o node
 */

import React, { ComponentType, useState } from 'react';
import { NodeProps } from 'reactflow';
import { NodeData } from '../types';
import { NodeExecuteButton } from './node-execute-button';

interface WithExecuteButtonProps extends NodeProps<NodeData> {
  onPartialExecute?: (nodeId: string) => void | Promise<void>;
  isNodeExecuting?: (nodeId: string) => boolean;
}

export function withExecuteButton<P extends NodeProps<NodeData>>(
  WrappedComponent: ComponentType<P>,
) {
  const ComponentWithExecuteButton = (props: P) => {
    const [isHovered, setIsHovered] = useState(false);

    // Extrair as props do data (onde são armazenadas)
    const onPartialExecute = (props.data as any)?.onPartialExecute;
    const isNodeExecuting = (props.data as any)?.isNodeExecuting;
    const { id } = props;

    const isExecuting = isNodeExecuting ? isNodeExecuting(id) : false;

    const handleExecute = async (nodeId: string) => {
      if (onPartialExecute) {
        await onPartialExecute(nodeId);
      }
    };

    return (
      <div
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Node Original */}
        <WrappedComponent {...props} />

        {/* Botão de Execução (só aparece no hover) */}
        {(isHovered || isExecuting) && onPartialExecute && (
          <NodeExecuteButton
            nodeId={id}
            onExecute={handleExecute}
            isExecuting={isExecuting}
          />
        )}
      </div>
    );
  };

  ComponentWithExecuteButton.displayName = `WithExecuteButton(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return ComponentWithExecuteButton;
}
