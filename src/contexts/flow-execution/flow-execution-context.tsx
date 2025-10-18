'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NodeExecution {
  nodeId?: string;
  status: 'running' | 'completed' | 'error';
  startTime: string;
  endTime?: string;
  data?: unknown;
  result?: unknown;
  error?: string;
}

interface ExecutionData {
  id: string;
  status: string;
  nodeExecutions: Record<string, NodeExecution>;
  data?: unknown;
  result?: unknown;
}

interface FlowExecutionContextType {
  selectedExecution: ExecutionData | null;
  setSelectedExecution: (execution: ExecutionData | null) => void;
  isExecutionViewMode: boolean;
  setIsExecutionViewMode: (mode: boolean) => void;
  getNodeExecutionData: (nodeId: string) => NodeExecution | null;
}

const FlowExecutionContext = createContext<
  FlowExecutionContextType | undefined
>(undefined);

export function FlowExecutionProvider({ children }: { children: ReactNode }) {
  const [selectedExecution, setSelectedExecution] =
    useState<ExecutionData | null>(null);
  const [isExecutionViewMode, setIsExecutionViewMode] = useState(false);

  const getNodeExecutionData = (nodeId: string): NodeExecution | null => {
    if (!selectedExecution?.nodeExecutions) return null;
    return selectedExecution.nodeExecutions[nodeId] || null;
  };

  return (
    <FlowExecutionContext.Provider
      value={{
        selectedExecution,
        setSelectedExecution,
        isExecutionViewMode,
        setIsExecutionViewMode,
        getNodeExecutionData,
      }}
    >
      {children}
    </FlowExecutionContext.Provider>
  );
}

export function useFlowExecution() {
  const context = useContext(FlowExecutionContext);
  if (context === undefined) {
    throw new Error(
      'useFlowExecution must be used within FlowExecutionProvider',
    );
  }
  return context;
}
