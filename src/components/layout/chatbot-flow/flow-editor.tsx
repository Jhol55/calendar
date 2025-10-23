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
import { MessageNodeConfig } from './nodes/message-node/message-node-config';
import { FlowsListSidebar } from './flows-list-sidebar';
import {
  EndNode,
  MessageNode,
  ConditionNode,
  WebhookNode,
  MemoryNode,
  TransformationNode,
  DatabaseNode,
  LoopNode,
  CodeExecutionNode,
} from './nodes';
import { HttpRequestNode } from './nodes/http-request-node/http-request-node';
import AgentNode from './nodes/agent-node/agent-node';
import {
  NodeType,
  NodeData,
  MessageConfig,
  WebhookConfig,
  MemoryConfig,
  TransformationConfig,
  ConditionConfig,
  DatabaseConfig,
  HttpRequestConfig,
  AgentConfig,
  LoopConfig,
  CodeExecutionConfig,
} from '../../layout/chatbot-flow/types';
import { Save, Download, Upload, Plus, Play, Database, X } from 'lucide-react';
import { ChatbotFlow } from '@/actions/chatbot-flows/flows';
import { useUser } from '@/hooks/use-user';
import { useCreateWorkflow, useUpdateWorkflow } from '@/lib/react-query/hooks';
import { Typography } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { CreateWorkflowDialog } from '@/components/features/dialogs/create-workflow-dialog';
import { WebhookNodeConfig } from './nodes/webhook-node/webhook-node-config';
import { MemoryNodeConfig } from './nodes/memory-node/memory-node-config';
import { TransformationNodeConfig } from './nodes/transformation-node/transformation-node-config';
import { ConditionNodeConfig } from './nodes/condition-node/condition-node-config';
import { DatabaseNodeConfig } from './nodes/database-node/database-node-config';
import { HttpRequestNodeConfig } from './nodes/http-request-node/http-request-node-config';
import AgentNodeConfig from './nodes/agent-node/agent-node-config';
import { LoopNodeConfig } from './nodes/loop-node/loop-node-config';
import { CodeExecutionNodeConfig } from './nodes/code-execution-node/code-execution-node-config';
import { ExecutionsPanel } from './executions-panel';
import { DatabaseSpreadsheet } from '@/components/layout/database-spreadsheet/database-spreadsheet';

const nodeTypes = {
  end: EndNode,
  message: MessageNode,
  condition: ConditionNode,
  webhook: WebhookNode,
  memory: MemoryNode,
  transformation: TransformationNode,
  database: DatabaseNode,
  http_request: HttpRequestNode,
  agent: AgentNode,
  loop: LoopNode,
  code_execution: CodeExecutionNode,
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
  const [memoryConfigDialogOpen, setMemoryConfigDialogOpen] = useState(false);
  const [transformationConfigDialogOpen, setTransformationConfigDialogOpen] =
    useState(false);
  const [conditionConfigDialogOpen, setConditionConfigDialogOpen] =
    useState(false);
  const [databaseConfigDialogOpen, setDatabaseConfigDialogOpen] =
    useState(false);
  const [httpRequestConfigDialogOpen, setHttpRequestConfigDialogOpen] =
    useState(false);
  const [agentConfigDialogOpen, setAgentConfigDialogOpen] = useState(false);
  const [loopConfigDialogOpen, setLoopConfigDialogOpen] = useState(false);
  const [codeExecutionConfigDialogOpen, setCodeExecutionConfigDialogOpen] =
    useState(false);
  const [nodeToConfig, setNodeToConfig] = useState<Node<NodeData> | null>(null);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isExecutionsPanelOpen, setIsExecutionsPanelOpen] = useState(false);
  const [isSpreadsheetOpen, setIsSpreadsheetOpen] = useState(false);
  const [copiedNode, setCopiedNode] = useState<Node<NodeData> | null>(null);
  const [hasExecutionHighlight, setHasExecutionHighlight] = useState(false);
  const { user } = useUser();

  // Mutations
  const createWorkflowMutation = useCreateWorkflow();
  const updateWorkflowMutation = useUpdateWorkflow();

  // Handler para deletar nodes selecionados
  const onNodesDelete = useCallback(
    (nodesToDelete: Node[]) => {
      console.log(
        '🗑️ Deleting nodes:',
        nodesToDelete.map((n) => n.id),
      );
      setNodes((nds) =>
        nds.filter((node) => !nodesToDelete.some((n) => n.id === node.id)),
      );
      // Deletar edges conectadas aos nodes deletados
      setEdges((eds) =>
        eds.filter(
          (edge) =>
            !nodesToDelete.some(
              (n) => n.id === edge.source || n.id === edge.target,
            ),
        ),
      );
    },
    [setNodes, setEdges],
  );

  // Event listener para tecla Delete/Backspace
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Verificar se não está digitando em um input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Delete ou Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();

        // Deletar nodes selecionados
        const selectedNodes = nodes.filter((node) => node.selected);
        if (selectedNodes.length > 0) {
          onNodesDelete(selectedNodes);
          return;
        }

        // Deletar edges selecionadas (se nenhum node estiver selecionado)
        const selectedEdges = edges.filter((edge) => edge.selected);
        if (selectedEdges.length > 0) {
          console.log(
            '🗑️ Deleting edges:',
            selectedEdges.map((e) => e.id),
          );
          setEdges((eds) =>
            eds.filter((edge) => !selectedEdges.some((e) => e.id === edge.id)),
          );
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [nodes, edges, onNodesDelete, setEdges]);

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

      // Mapeamento de labels personalizados para cada tipo de node
      const nodeLabels: Record<NodeType, string> = {
        start: 'Start',
        message: 'Message',
        condition: 'Condition',
        webhook: 'Webhook',
        memory: 'Memory',
        transformation: 'Transformation',
        database: 'Database',
        http_request: 'HTTP Request',
        agent: 'AI Agent',
        loop: 'Loop',
        code_execution: 'Code Execution',
        end: 'End',
      };

      const newNode: Node<NodeData> = {
        id: generateNodeId(),
        type,
        position,
        data: {
          label:
            nodeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1),
          type,
          content: type === 'message' ? 'Digite aqui...' : undefined,
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
    setIsSaving(true);

    try {
      if (currentFlowId) {
        // Atualizar flow existente usando mutation (sem token)
        const flowData = {
          name: flowName,
          description: '',
          nodes: nodes,
          edges: edges,
          isActive: true,
        };

        await updateWorkflowMutation.mutateAsync({
          id: currentFlowId,
          data: flowData,
        });
        console.log('✅ Flow atualizado com sucesso!');
      } else {
        // Criar novo flow usando mutation (sem token - será null)
        const flowData = {
          name: flowName,
          description: '',
          nodes: nodes,
          edges: edges,
          userId: user?.id,
          isActive: true,
        };

        const newFlow = await createWorkflowMutation.mutateAsync(flowData);
        console.log('✅ Flow criado com sucesso!');
        setCurrentFlowId(newFlow.id);
        setFlowName(newFlow.name);
      }
    } catch (error) {
      console.error('Error saving flow:', error);
      alert('Erro ao salvar fluxo');
    } finally {
      setIsSaving(false);
    }
  }, [
    nodes,
    edges,
    flowName,
    currentFlowId,
    user,
    updateWorkflowMutation,
    createWorkflowMutation,
  ]);

  const clearExecutionHighlight = useCallback(() => {
    // Limpar highlight dos nodes
    const clearedNodes = nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        executionStatus: undefined,
      },
      style: {
        ...node.style,
        boxShadow: undefined,
        borderRadius: undefined,
      },
    }));
    setNodes(clearedNodes);

    // Limpar highlight das edges
    const clearedEdges = edges.map((edge) => ({
      ...edge,
      animated: false,
      style: {
        ...edge.style,
        stroke: undefined,
        strokeWidth: undefined,
      },
    }));
    setEdges(clearedEdges);

    // Limpar sessionStorage
    sessionStorage.removeItem('selectedExecution');
    setHasExecutionHighlight(false);
  }, [nodes, edges, setNodes, setEdges]);

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
          description: '',
          nodes: [],
          edges: [],
          token: `flow-${Date.now()}`,
          userId: user?.id,
          isActive: false,
        };

        const newFlow = await createWorkflowMutation.mutateAsync(flowData);

        // Limpar o canvas e definir o novo fluxo como atual
        setNodes([]);
        setEdges([]);
        setFlowName(flowName);
        setCurrentFlowId(newFlow.id);
        setIsCreateDialogOpen(false);
      } catch (error) {
        console.error('Error creating flow:', error);
        alert('Erro ao criar fluxo');
      }
    },
    [setNodes, setEdges, user, createWorkflowMutation],
  );

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Partial<NodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const updatedNode = {
              ...node,
              data: { ...node.data, ...data },
            };
            // Atualizar nodeToConfig se for o node que está sendo editado
            if (nodeToConfig?.id === nodeId) {
              setNodeToConfig(updatedNode);
            }
            return updatedNode;
          }
          return node;
        }),
      );
    },
    [setNodes, nodeToConfig],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      if (node.type === 'message') {
        setNodeToConfig(node);
        setConfigDialogOpen(true);
      } else if (node.type === 'webhook') {
        setNodeToConfig(node);
        setWebhookConfigDialogOpen(true);
      } else if (node.type === 'memory') {
        setNodeToConfig(node);
        setMemoryConfigDialogOpen(true);
      } else if (node.type === 'transformation') {
        setNodeToConfig(node);
        setTransformationConfigDialogOpen(true);
      } else if (node.type === 'condition') {
        setNodeToConfig(node);
        setConditionConfigDialogOpen(true);
      } else if (node.type === 'database') {
        setNodeToConfig(node);
        setDatabaseConfigDialogOpen(true);
      } else if (node.type === 'http_request') {
        setNodeToConfig(node);
        setHttpRequestConfigDialogOpen(true);
      } else if (node.type === 'agent') {
        setNodeToConfig(node);
        setAgentConfigDialogOpen(true);
      } else if (node.type === 'loop') {
        setNodeToConfig(node);
        setLoopConfigDialogOpen(true);
      } else if (node.type === 'code_execution') {
        setNodeToConfig(node);
        setCodeExecutionConfigDialogOpen(true);
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

  const handleSaveMemoryConfig = useCallback(
    (config: MemoryConfig) => {
      if (nodeToConfig) {
        handleNodeUpdate(nodeToConfig.id, { memoryConfig: config });
      }
    },
    [nodeToConfig, handleNodeUpdate],
  );

  const handleSaveTransformationConfig = useCallback(
    (config: TransformationConfig) => {
      if (nodeToConfig) {
        handleNodeUpdate(nodeToConfig.id, { transformationConfig: config });
      }
    },
    [nodeToConfig, handleNodeUpdate],
  );

  const handleSaveConditionConfig = useCallback(
    (config: ConditionConfig) => {
      if (nodeToConfig) {
        handleNodeUpdate(nodeToConfig.id, { conditionConfig: config });
      }
    },
    [nodeToConfig, handleNodeUpdate],
  );

  const handleSaveDatabaseConfig = useCallback(
    (config: DatabaseConfig) => {
      if (nodeToConfig) {
        handleNodeUpdate(nodeToConfig.id, { databaseConfig: config });
      }
    },
    [nodeToConfig, handleNodeUpdate],
  );

  const handleSaveHttpRequestConfig = useCallback(
    (config: HttpRequestConfig) => {
      if (nodeToConfig) {
        handleNodeUpdate(nodeToConfig.id, { httpRequestConfig: config });
      }
    },
    [nodeToConfig, handleNodeUpdate],
  );

  const handleSaveAgentConfig = useCallback(
    (config: AgentConfig) => {
      if (nodeToConfig) {
        handleNodeUpdate(nodeToConfig.id, { agentConfig: config });
      }
    },
    [nodeToConfig, handleNodeUpdate],
  );

  const handleSaveLoopConfig = useCallback(
    (config: LoopConfig) => {
      if (nodeToConfig) {
        handleNodeUpdate(nodeToConfig.id, { loopConfig: config });
      }
    },
    [nodeToConfig, handleNodeUpdate],
  );

  const handleSaveCodeExecutionConfig = useCallback(
    (config: CodeExecutionConfig) => {
      if (nodeToConfig) {
        handleNodeUpdate(nodeToConfig.id, { codeExecutionConfig: config });
      }
    },
    [nodeToConfig, handleNodeUpdate],
  );

  // Copiar node selecionado (Ctrl+C)
  const handleCopyNode = useCallback(() => {
    const selectedNode = nodes.find((node) => node.selected);
    if (selectedNode) {
      setCopiedNode(selectedNode);
      const nodeLabel = selectedNode.data.label || selectedNode.type;
      console.log(`📋 Node "${nodeLabel}" copiado (ID: ${selectedNode.id})`);
    }
  }, [nodes]);

  // Colar node copiado (Ctrl+V)
  const handlePasteNode = useCallback(() => {
    if (!copiedNode) return;

    // Gerar novo ID único
    const newId = generateNodeId();

    // Fazer deep clone do data para evitar compartilhamento de referências
    const clonedData: NodeData = JSON.parse(JSON.stringify(copiedNode.data));

    // Criar novo node com offset na posição
    const newNode: Node<NodeData> = {
      ...copiedNode,
      id: newId,
      position: {
        x: copiedNode.position.x + 50,
        y: copiedNode.position.y + 50,
      },
      selected: true,
      data: clonedData,
    };

    // Desselecionar outros nodes e adicionar o novo
    setNodes((nds) => {
      const updatedNodes = nds.map((node) => ({
        ...node,
        selected: false,
      }));
      return [...updatedNodes, newNode];
    });

    console.log('📌 Node colado:', newId, 'copiado de:', copiedNode.id);
  }, [copiedNode, setNodes]);

  // Listener de teclado para Ctrl+C e Ctrl+V
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorar se estiver em um input, textarea ou elemento editável
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+C ou Cmd+C (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        event.preventDefault();
        handleCopyNode();
      }

      // Ctrl+V ou Cmd+V (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault();
        handlePasteNode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCopyNode, handlePasteNode]);

  const nodeColor = (node: Node) => {
    switch (node.type) {
      case 'start':
        return '#10b981';
      case 'end':
        return '#ef4444';
      case 'message':
        return '#3b82f6';
      case 'condition':
        return '#eab308';
      case 'webhook':
        return '#10b981';
      case 'memory':
        return '#9333ea';
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
          fitViewOptions={{
            padding: 0.2,
            minZoom: 0.05,
            maxZoom: 2,
          }}
          minZoom={0.05}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.1 }}
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
                bgHexColor="#10b981"
                onClick={() => setIsSpreadsheetOpen(true)}
              >
                <Database className="w-4 h-4" />
                <Typography
                  variant="span"
                  className="text-xs text-white whitespace-nowrap"
                >
                  Banco de dados
                </Typography>
              </Button>
              {hasExecutionHighlight && (
                <Button
                  variant="gradient"
                  className="w-full flex items-center justify-center gap-2"
                  bgHexColor="#ef4444"
                  onClick={clearExecutionHighlight}
                >
                  <X className="w-4 h-4" />
                  <Typography
                    variant="span"
                    className="text-xs text-white whitespace-nowrap"
                  >
                    Limpar Visualização
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

      <DatabaseSpreadsheet
        isOpen={isSpreadsheetOpen}
        onClose={() => setIsSpreadsheetOpen(false)}
      />

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
        nodeLabel={nodeToConfig?.data.label}
        onNodeLabelChange={(label) => {
          if (nodeToConfig) {
            handleNodeUpdate(nodeToConfig.id, { label });
          }
        }}
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

      <MemoryNodeConfig
        isOpen={memoryConfigDialogOpen}
        onClose={() => {
          setMemoryConfigDialogOpen(false);
          setNodeToConfig(null);
        }}
        config={nodeToConfig?.data.memoryConfig}
        onSave={handleSaveMemoryConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
        nodeLabel={nodeToConfig?.data.label}
        onNodeLabelChange={(label: string) => {
          if (nodeToConfig) {
            handleNodeUpdate(nodeToConfig.id, { label });
          }
        }}
      />

      <TransformationNodeConfig
        isOpen={transformationConfigDialogOpen}
        onClose={() => {
          setTransformationConfigDialogOpen(false);
          setNodeToConfig(null);
        }}
        config={nodeToConfig?.data.transformationConfig}
        onSave={handleSaveTransformationConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
      />

      <ConditionNodeConfig
        isOpen={conditionConfigDialogOpen}
        onClose={() => {
          setConditionConfigDialogOpen(false);
          setNodeToConfig(null);
        }}
        config={nodeToConfig?.data.conditionConfig}
        onSave={handleSaveConditionConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
      />

      <DatabaseNodeConfig
        isOpen={databaseConfigDialogOpen}
        onClose={() => {
          setDatabaseConfigDialogOpen(false);
          setNodeToConfig(null);
        }}
        config={nodeToConfig?.data.databaseConfig}
        onSave={handleSaveDatabaseConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
      />

      <HttpRequestNodeConfig
        isOpen={httpRequestConfigDialogOpen}
        onClose={() => {
          setHttpRequestConfigDialogOpen(false);
          setNodeToConfig(null);
        }}
        config={nodeToConfig?.data.httpRequestConfig}
        onSave={handleSaveHttpRequestConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
        nodeLabel={nodeToConfig?.data.label}
        onNodeLabelChange={(label) => {
          if (nodeToConfig) {
            handleNodeUpdate(nodeToConfig.id, { label });
          }
        }}
      />

      <AgentNodeConfig
        isOpen={agentConfigDialogOpen}
        onClose={() => {
          setAgentConfigDialogOpen(false);
          setNodeToConfig(null);
        }}
        config={nodeToConfig?.data.agentConfig}
        onSave={handleSaveAgentConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
        nodeLabel={nodeToConfig?.data.label}
        onNodeLabelChange={(label) => {
          if (nodeToConfig) {
            handleNodeUpdate(nodeToConfig.id, { label });
          }
        }}
      />

      <LoopNodeConfig
        isOpen={loopConfigDialogOpen}
        onClose={() => {
          setLoopConfigDialogOpen(false);
          setNodeToConfig(null);
        }}
        config={nodeToConfig?.data.loopConfig}
        onSave={handleSaveLoopConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
        nodeLabel={nodeToConfig?.data.label}
        onNodeLabelChange={(label) => {
          if (nodeToConfig) {
            handleNodeUpdate(nodeToConfig.id, { label });
          }
        }}
      />

      <CodeExecutionNodeConfig
        isOpen={codeExecutionConfigDialogOpen}
        onClose={() => {
          setCodeExecutionConfigDialogOpen(false);
          setNodeToConfig(null);
        }}
        config={nodeToConfig?.data.codeExecutionConfig}
        onSave={handleSaveCodeExecutionConfig}
        nodeId={nodeToConfig?.id}
        flowId={currentFlowId || undefined}
        nodeLabel={nodeToConfig?.data.label}
        onNodeLabelChange={(label) => {
          if (nodeToConfig) {
            handleNodeUpdate(nodeToConfig.id, { label });
          }
        }}
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
            const executedNodeIds = Object.keys(execution.nodeExecutions);

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
                        ? '0 0 0 5px rgba(34, 197, 94, 0.4)'
                        : nodeExecution.status === 'error'
                          ? '0 0 0 5px rgba(239, 68, 68, 0.4)'
                          : '0 0 0 5px rgba(59, 130, 246, 0.4)',
                    borderRadius: '12px',
                  },
                };
              }
              // Limpar highlight de nodes não executados
              return {
                ...node,
                data: {
                  ...node.data,
                  executionStatus: undefined,
                },
                style: {
                  ...node.style,
                  boxShadow: undefined,
                  borderRadius: undefined,
                },
              };
            });
            setNodes(updatedNodes);

            // Destacar edges entre nós executados
            const updatedEdges = edges.map((edge) => {
              const sourceExecuted = executedNodeIds.includes(edge.source);
              const targetExecuted = executedNodeIds.includes(edge.target);

              if (sourceExecuted && targetExecuted) {
                const sourceExecution = execution.nodeExecutions[edge.source];
                const targetExecution = execution.nodeExecutions[edge.target];

                // Determinar a cor baseada no status
                const hasError =
                  sourceExecution?.status === 'error' ||
                  targetExecution?.status === 'error';
                const isRunning =
                  sourceExecution?.status === 'running' ||
                  targetExecution?.status === 'running';

                return {
                  ...edge,
                  animated: true,
                  style: {
                    ...edge.style,
                    stroke: hasError
                      ? '#ef4444'
                      : isRunning
                        ? '#3b82f6'
                        : '#22c55e',
                    strokeWidth: 3,
                  },
                };
              }
              // Limpar highlight de edges não executadas
              return {
                ...edge,
                animated: false,
                style: {
                  ...edge.style,
                  stroke: undefined,
                  strokeWidth: undefined,
                },
              };
            });
            setEdges(updatedEdges);
            setHasExecutionHighlight(true);
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
