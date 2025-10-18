'use client';

import React, { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  Edge,
  Node,
  MiniMap,
  Panel,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Sidebar } from '../../layout/chatbot-flow/sidebar';
import { MessageNodeConfig } from './nodes/message-node-config';
import { FlowsListSidebar } from './flows-list-sidebar';
import {
  EndNode,
  MessageNode,
  QuestionNode,
  ConditionNode,
  ActionNode,
  WebhookNode,
} from './nodes';
import {
  NodeType,
  NodeData,
  MessageConfig,
  WebhookConfig,
} from '../../layout/chatbot-flow/types';
import { Save, Download, Upload, Plus, Play } from 'lucide-react';
import {
  createFlow,
  updateFlow,
  ChatbotFlow,
} from '@/actions/chatbot-flows/flows';
import { useUser } from '@/hooks/use-user';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { CreateWorkflowDialog } from '@/components/features/dialogs/create-workflow-dialog';
import { WebhookNodeConfig } from './nodes/webhook-node-config';
import { ExecutionsPanel } from './executions-panel';

const nodeTypes = {
  end: EndNode,
  message: MessageNode,
  question: QuestionNode,
  condition: ConditionNode,
  action: ActionNode,
  webhook: WebhookNode,
};

// Função para gerar IDs únicos
const generateNodeId = () =>
  `node_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

function FlowEditorContent() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [flowName, setFlowName] = useState('');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [webhookConfigDialogOpen, setWebhookConfigDialogOpen] = useState(false);
  const [nodeToConfig, setNodeToConfig] = useState<Node<NodeData> | null>(null);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isExecutionsPanelOpen, setIsExecutionsPanelOpen] = useState(false);
  const { user, workflows, setWorkflows } = useUser();

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData(
        'application/reactflow',
      ) as NodeType;

      if (typeof type === 'undefined' || !type || !reactFlowWrapper.current) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance?.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      }) || { x: 0, y: 0 };

      const newNode: Node<NodeData> = {
        id: generateNodeId(),
        type,
        position,
        data: {
          label: type.charAt(0).toUpperCase() + type.slice(1),
          type,
          content:
            type === 'message' || type === 'question'
              ? 'Digite aqui...'
              : undefined,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleSave = useCallback(async () => {
    if (!reactFlowInstance) return;

    setIsSaving(true);

    try {
      const flow = reactFlowInstance.toObject();
      const flowData = {
        name: flowName,
        nodes: flow.nodes,
        edges: flow.edges,
        userId: user?.id,
      };

      let result;

      if (currentFlowId) {
        // Atualizar fluxo existente
        result = await updateFlow(currentFlowId, flowData);
      } else {
        // Criar novo fluxo
        result = await createFlow(flowData);
        if (result.success && result.flow) {
          setCurrentFlowId(result.flow.id);
        }
      }

      if (result.success) {
        alert('Fluxo salvo com sucesso!');
      } else {
        alert(`Erro ao salvar fluxo: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving flow:', error);
      alert('Erro ao salvar fluxo');
    } finally {
      setIsSaving(false);
    }
  }, [reactFlowInstance, flowName, currentFlowId, user]);

  const handleExport = useCallback(() => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      const dataStr = JSON.stringify(flow, null, 2);
      const dataUri =
        'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = `${flowName.replace(/\s+/g, '-').toLowerCase()}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    }
  }, [reactFlowInstance, flowName]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const flow = JSON.parse(event.target?.result as string);
            setNodes(flow.nodes || []);
            setEdges(flow.edges || []);
            alert('Fluxo importado com sucesso!');
          } catch {
            alert('Erro ao importar fluxo. Verifique o arquivo.');
          }
        };
        reader.readAsText(file);
      }
    };

    input.click();
  }, [setNodes, setEdges]);

  const handleSelectFlow = useCallback(
    (flow: ChatbotFlow) => {
      // Limpar estado atual primeiro
      setNodes([]);
      setEdges([]);

      // Pequeno delay para garantir que o estado seja limpo
      setTimeout(() => {
        // Garantir que os nodes tenham IDs únicos e válidos
        const processedNodes = (flow.nodes || []).map(
          (node: Node<NodeData>) => ({
            ...node,
            id: node.id || generateNodeId(), // Garantir que tenha ID
            data: {
              ...node.data,
              // Garantir que o tipo esteja correto
              type: node.type || node.data?.type,
            },
          }),
        );

        // Garantir que as edges tenham IDs únicos
        const processedEdges = (flow.edges || []).map((edge: Edge) => ({
          ...edge,
          id:
            edge.id ||
            `edge_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        }));

        console.log('Loading flow:', {
          name: flow.name,
          nodesCount: processedNodes.length,
          edgesCount: processedEdges.length,
          nodes: processedNodes.map((n) => ({ id: n.id, type: n.type })),
        });

        setNodes(processedNodes);
        setEdges(processedEdges);
        setFlowName(flow.name);
        setCurrentFlowId(flow.id);
      }, 100);
    },
    [setNodes, setEdges],
  );

  const handleCreateNewFlow = useCallback(
    async (flowName: string) => {
      try {
        // Criar o fluxo no banco de dados com nodes e edges vazios
        const flowData = {
          name: flowName,
          nodes: [],
          edges: [],
          userId: user?.id,
        };

        const result = await createFlow(flowData);

        if (result.success && result.flow) {
          // Limpar o canvas e definir o novo fluxo como atual
          setNodes([]);
          setEdges([]);
          setFlowName(flowName);
          setCurrentFlowId(result.flow.id);
          setIsCreateDialogOpen(false);
          setWorkflows([...workflows, result.flow]);
        } else {
          alert(`Erro ao criar fluxo: ${result.error}`);
        }
      } catch (error) {
        console.error('Error creating flow:', error);
        alert('Erro ao criar fluxo');
      }
    },
    [setNodes, setEdges, user, workflows, setWorkflows],
  );

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Partial<NodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, ...data },
            };
          }
          return node;
        }),
      );
    },
    [setNodes],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      if (node.type === 'message') {
        setNodeToConfig(node);
        setConfigDialogOpen(true);
      } else if (node.type === 'webhook') {
        setNodeToConfig(node);
        setWebhookConfigDialogOpen(true);
      } else if (node.type === 'start' || node.type === 'end') {
        // Start e End nodes não têm configuração
        return;
      } else {
        // Outros nodes terão suas configs no futuro
        alert(`Configuração para ${node.type} em desenvolvimento`);
      }
    },
    [],
  );

  const handleSaveMessageConfig = useCallback(
    (config: MessageConfig) => {
      if (nodeToConfig) {
        handleNodeUpdate(nodeToConfig.id, { messageConfig: config });
      }
    },
    [nodeToConfig, handleNodeUpdate],
  );

  const handleSaveWebhookConfig = useCallback(
    (config: WebhookConfig) => {
      if (nodeToConfig) {
        handleNodeUpdate(nodeToConfig.id, { webhookConfig: config });
      }
    },
    [nodeToConfig, handleNodeUpdate],
  );

  const nodeColor = (node: Node) => {
    switch (node.type) {
      case 'start':
        return '#10b981';
      case 'end':
        return '#ef4444';
      case 'message':
        return '#3b82f6';
      case 'question':
        return '#a855f7';
      case 'condition':
        return '#eab308';
      case 'action':
        return '#f97316';
      case 'webhook':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="flex h-full">
      <FlowsListSidebar
        onSelectFlow={handleSelectFlow}
        currentFlowId={currentFlowId}
        onCreateNewFlow={handleCreateNewFlow}
      />

      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          className="bg-gray-50"
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls />
          <MiniMap nodeColor={nodeColor} />

          <Panel position="top-left">
            <div className="flex gap-4">
              {flowName ? (
                <div className="bg-white rounded-lg shadow-lg p-4 min-w-24 w-fit">
                  <Typography variant="span" className="text-xs w-24">
                    Workflow
                  </Typography>
                  <Typography variant="h3" className="text-lg font-semibold">
                    {flowName}
                  </Typography>
                </div>
              ) : (
                <div className="bg-transparent p-4 min-w-24 w-fit"></div>
              )}

              <CreateWorkflowDialog
                isOpen={isCreateDialogOpen}
                onClose={() => setIsCreateDialogOpen(false)}
                onSubmit={handleCreateNewFlow}
              />
            </div>
          </Panel>

          <Panel
            position="top-right"
            className="flex gap-2 m-4"
            style={{ zoom: 0.9 }}
          >
            <div className="flex gap-4 h-fit">
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                variant="gradient"
                className="w-full flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <Typography variant="span" className="text-xs text-white">
                  Workflow
                </Typography>
              </Button>
              <Button
                variant="gradient"
                className="w-full flex items-center justify-center gap-2"
                bgHexColor="#66e477"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="w-4 h-4" />
                <Typography variant="span" className="text-xs text-white">
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Typography>
              </Button>
              <Button
                variant="gradient"
                className="w-full flex items-center justify-center gap-2"
                bgHexColor="#77a5f5"
                onClick={handleExport}
              >
                <Download className="w-4 h-4" />
                <Typography variant="span" className="text-xs text-white">
                  Exportar
                </Typography>
              </Button>
              {currentFlowId && (
                <Button
                  variant="gradient"
                  className="w-full flex items-center justify-center gap-2"
                  bgHexColor="#f59e0b"
                  onClick={() => setIsExecutionsPanelOpen(true)}
                >
                  <Play className="w-4 h-4" />
                  <Typography variant="span" className="text-xs text-white">
                    Execuções
                  </Typography>
                </Button>
              )}
              <Button
                variant="gradient"
                className="w-full flex items-center justify-center gap-2"
                bgHexColor="#f047ee"
                onClick={handleImport}
              >
                <Upload className="w-4 h-4" />
                <Typography variant="span" className="text-xs text-white">
                  Importar
                </Typography>
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      <Sidebar onDragStart={onDragStart} />

      <MessageNodeConfig
        isOpen={configDialogOpen}
        onClose={() => {
          setConfigDialogOpen(false);
          setNodeToConfig(null);
        }}
        config={nodeToConfig?.data.messageConfig}
        onSave={handleSaveMessageConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
      />

      <WebhookNodeConfig
        isOpen={webhookConfigDialogOpen}
        onClose={() => {
          setWebhookConfigDialogOpen(false);
          setNodeToConfig(null);
        }}
        config={nodeToConfig?.data.webhookConfig}
        onSave={handleSaveWebhookConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
      />

      <ExecutionsPanel
        flowId={currentFlowId || ''}
        isOpen={isExecutionsPanelOpen}
        onClose={() => setIsExecutionsPanelOpen(false)}
        onExecutionSelect={(execution) => {
          // Salvar execução selecionada no sessionStorage
          sessionStorage.setItem(
            'selectedExecution',
            JSON.stringify(execution),
          );

          // Destacar nós executados
          if (execution.nodeExecutions) {
            const updatedNodes = nodes.map((node) => {
              const nodeExecution = execution.nodeExecutions[node.id];
              if (nodeExecution) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    executionStatus: nodeExecution.status,
                  },
                  style: {
                    ...node.style,
                    boxShadow:
                      nodeExecution.status === 'completed'
                        ? '0 0 0 3px rgba(34, 197, 94, 0.5)'
                        : nodeExecution.status === 'error'
                          ? '0 0 0 3px rgba(239, 68, 68, 0.5)'
                          : '0 0 0 3px rgba(59, 130, 246, 0.5)',
                  },
                };
              }
              return node;
            });
            setNodes(updatedNodes);
          }
        }}
      />
    </div>
  );
}

export default function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowEditorContent />
    </ReactFlowProvider>
  );
}
