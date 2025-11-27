'use client';

import React, { useState, useCallback, useRef, useMemo } from 'react';
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
  NodeProps,
  NodeChange,
  MiniMap,
  Panel,
  ReactFlowInstance,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Sidebar } from './modules-sidebar';
import { MessageNodeConfig } from './nodes/message-node/message-node-config';
import { FlowsListSidebar } from './flow-list-sidebar/flows-list-sidebar';
import {
  MessageNode,
  ConditionNode,
  WebhookNode,
  MemoryNode,
  TransformationNode,
  DatabaseNode,
  LoopNode,
  CodeExecutionNode,
  PlaywrightMcpNode,
  notifyExecutionContextChanged,
} from './nodes';
import { HttpRequestNode } from './nodes/http-request-node/http-request-node';
import AgentNode from './nodes/agent-node/agent-node';
import CustomBezierEdge from './custom-bezier-edge';
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
import { PlaywrightMcpNodeConfig } from './nodes/playwright-mcp-node/playwright-mcp-node-config';
import { usePartialExecution } from '@/hooks/use-partial-execution';
import { withExecuteButton } from './nodes/with-execute-button';
import { getExecution, type Execution } from '@/actions/executions';

// Definir nodeTypes base FORA do componente
const baseNodeTypes = {
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
  'playwright-mcp-node': PlaywrightMcpNode,
};

const edgeTypes = {
  default: CustomBezierEdge,
};

// Função para gerar IDs únicos
const generateNodeId = () =>
  `node_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

// Tipos para execução de nodes
interface NodeExecutionResult {
  status: 'running' | 'completed' | 'error';
  result?: {
    selectedHandle?: string;
    [key: string]: unknown;
  };
  error?: string;
}

interface NodeExecutionsRecord {
  [nodeId: string]: NodeExecutionResult;
}

function FlowEditorContent() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const currentFlowIdRef = useRef<string | null>(null); // ✅ Ref para evitar stale closure
  const flowNameRef = useRef<string>(''); // ✅ Ref para evitar stale closure
  const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Wrapper para onNodesChange com logs apenas para remoções importantes
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Verificar se há remoções não intencionais (não por Delete/Backspace)
      const removals = changes.filter((c) => c.type === 'remove');
      if (removals.length > 0) {
        removals.forEach((removal) => {
          if ('id' in removal) {
            const node = nodes.find((n) => n.id === removal.id);
            // Log apenas se for um node de mensagem sendo removido (pode ser problema)
            if (node?.type === 'message') {
              console.warn(
                '⚠️ [FLOW-EDITOR] Node de mensagem sendo removido:',
                {
                  id: removal.id,
                  type: node.type,
                },
              );
            }
          }
        });
      }

      onNodesChangeBase(changes);
    },
    [onNodesChangeBase, nodes],
  );
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [flowName, setFlowName] = useState('');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [playwrightConfigDialogOpen, setPlaywrightConfigDialogOpen] =
    useState(false);
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

  // Hook para execução parcial
  const { isExecuting, executingNodeId, executeUntilNode } =
    usePartialExecution();

  // Função para remover handlers antes de salvar (para serialização JSON)
  const removeExecutionHandlers = useCallback((nodes: Node<NodeData>[]) => {
    return nodes.map((node) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { onPartialExecute, isNodeExecuting, ...cleanData } = node.data;
      return {
        ...node,
        data: cleanData,
      };
    });
  }, []);

  // Função para destacar nós executados
  const highlightExecutedNodes = useCallback(
    async (execution: Execution & { targetNodeId?: string }) => {
      if (!execution.nodeExecutions) {
        return;
      }

      // ✅ Sempre buscar dados mais recentes do banco para garantir que o highlight está correto
      // Isso evita usar dados antigos do sessionStorage quando o webhook atualiza com erro
      try {
        const { getExecution } = await import('@/actions/executions');
        const result = await getExecution(execution.id);

        if (result.success && result.execution) {
          // Usar execução atualizada do banco
          execution = {
            ...result.execution,
            targetNodeId: execution.targetNodeId,
          };

          // Atualizar sessionStorage com dados mais recentes
          sessionStorage.setItem(
            'selectedExecution',
            JSON.stringify(execution),
          );
        }
      } catch (error) {
        console.error('Erro ao buscar execução atualizada:', error);
        // Continuar com execução original se falhar
      }

      const nodeExecutions = execution.nodeExecutions as NodeExecutionsRecord;
      const executedNodeIds = Object.keys(nodeExecutions);
      const targetNodeId = execution.targetNodeId;

      const pathNodeIds = new Set<string>();
      const pathEdgeIds = new Set<string>();

      // ✅ NOVA LÓGICA: Começar do targetNode e voltar para trás seguindo incoming edges
      // Isso funciona tanto para nodes isolados quanto para nodes conectados
      const nodeToHighlight = targetNodeId || executedNodeIds[0]; // Se não há target, pegar o primeiro

      if (!nodeToHighlight) {
        return;
      }

      // Adicionar o node alvo ao caminho
      pathNodeIds.add(nodeToHighlight);

      // Se tem targetNode (execução parcial), construir caminho para trás
      if (targetNodeId) {
        // DFS reverso: seguir incoming edges recursivamente
        const buildReversePath = (
          nodeId: string,
          visited: Set<string> = new Set(),
        ) => {
          if (visited.has(nodeId)) return;
          visited.add(nodeId);

          // Buscar edges que chegam neste node
          const incomingEdges = edgesRef.current.filter(
            (edge) => edge.target === nodeId,
          );

          incomingEdges.forEach((edge) => {
            const sourceNode = edge.source;

            // Apenas seguir se o source node foi executado
            if (executedNodeIds.includes(sourceNode)) {
              const sourceNodeExecution = nodeExecutions[sourceNode];
              const sourceNodeData = nodesRef.current.find(
                (n) => n.id === sourceNode,
              );

              // ✅ VERIFICAR SE É UM NODE DE CONDIÇÃO/LOOP COM SELECTEDHANDLE
              const isConditionalNode =
                sourceNodeData?.type === 'condition' ||
                sourceNodeData?.type === 'loop';

              if (isConditionalNode && sourceNodeExecution?.result) {
                // Extrair selectedHandle do result
                const selectedHandle =
                  sourceNodeExecution.result &&
                  typeof sourceNodeExecution.result === 'object' &&
                  'selectedHandle' in sourceNodeExecution.result
                    ? (sourceNodeExecution.result.selectedHandle as string)
                    : undefined;

                // Se tem selectedHandle, só adicionar a edge se ela corresponde ao handle usado
                if (selectedHandle) {
                  const edgeWithHandle = edge as {
                    sourceHandle?: string | null;
                  };
                  const edgeSourceHandle = edgeWithHandle.sourceHandle;

                  if (edgeSourceHandle !== selectedHandle) {
                    return; // Não adicionar esta edge
                  }
                }
              }

              pathNodeIds.add(sourceNode);
              pathEdgeIds.add(edge.id);

              // Continuar recursivamente para o source node
              buildReversePath(sourceNode, visited);
            }
          });
        };

        buildReversePath(nodeToHighlight);
      } else {
        // Sem targetNode: destacar todos os nodes executados (execução completa)
        executedNodeIds.forEach((nodeId) => pathNodeIds.add(nodeId));

        // Adicionar edges entre nodes executados, respeitando selectedHandle
        edgesRef.current.forEach((edge) => {
          if (
            executedNodeIds.includes(edge.source) &&
            executedNodeIds.includes(edge.target)
          ) {
            const sourceNodeExecution = nodeExecutions[edge.source];
            const sourceNodeData = nodesRef.current.find(
              (n) => n.id === edge.source,
            );

            // ✅ VERIFICAR SE É UM NODE DE CONDIÇÃO/LOOP COM SELECTEDHANDLE
            const isConditionalNode =
              sourceNodeData?.type === 'condition' ||
              sourceNodeData?.type === 'loop';

            if (isConditionalNode && sourceNodeExecution?.result) {
              // Extrair selectedHandle do result
              const selectedHandle =
                sourceNodeExecution.result &&
                typeof sourceNodeExecution.result === 'object' &&
                'selectedHandle' in sourceNodeExecution.result
                  ? (sourceNodeExecution.result.selectedHandle as string)
                  : undefined;

              // Se tem selectedHandle, só adicionar a edge se ela corresponde ao handle usado
              if (selectedHandle) {
                const edgeWithHandle = edge as { sourceHandle?: string | null };
                const edgeSourceHandle = edgeWithHandle.sourceHandle;

                if (edgeSourceHandle !== selectedHandle) {
                  return; // Não adicionar esta edge
                }
              }
            }

            pathEdgeIds.add(edge.id);
          }
        });
      }

      // Atualizar nodes - destacar apenas nodes no caminho real
      setNodes((currentNodes) => {
        return currentNodes.map((node) => {
          // Só destacar se o nó está no caminho real
          if (pathNodeIds.has(node.id)) {
            const nodeExecution = nodeExecutions[node.id];
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
                    nodeExecution.status === 'error'
                      ? '0 0 0 5px rgba(239, 68, 68, 0.4)' // Vermelho para erro
                      : '0 0 0 5px rgba(34, 197, 94, 0.4)', // Verde para sucesso/running
                  borderRadius: '12px',
                },
              };
            }
          }
          // Limpar highlight de nodes não executados ou fora do caminho
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
      });

      // Atualizar edges - destacar apenas edges no caminho real
      setEdges((currentEdges) => {
        return currentEdges.map((edge) => {
          // Destacar apenas se a edge está no caminho real
          if (pathEdgeIds.has(edge.id)) {
            const sourceExecution = nodeExecutions[edge.source];
            const targetExecution = nodeExecutions[edge.target];

            // Determinar a cor baseada no status (apenas verde ou vermelho)
            const hasError =
              sourceExecution?.status === 'error' ||
              targetExecution?.status === 'error';

            return {
              ...edge,
              animated: true,
              style: {
                ...edge.style,
                stroke: hasError ? '#ef4444' : '#22c55e', // Vermelho para erro, verde para sucesso
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
      });
      setHasExecutionHighlight(true);
    },
    [setNodes, setEdges],
  );

  // Handler para execução parcial
  const handlePartialExecute = useCallback(
    async (targetNodeId: string) => {
      // Buscar nodes e edges atuais do reactFlowInstance (evita stale closure)
      if (!reactFlowInstance) {
        alert('⚠️ Erro: Editor não está pronto. Aguarde um momento.');
        return;
      }

      const currentNodes = reactFlowInstance.getNodes();
      const currentEdges = reactFlowInstance.getEdges();

      if (currentNodes.length === 0) {
        alert(
          '⚠️ Erro: Nenhum node encontrado no editor. Por favor, recarregue a página.',
        );
        return;
      }

      // ✅ SALVAR O FLUXO ANTES DE EXECUTAR (para evitar bugs)
      try {
        const cleanNodesForSave = removeExecutionHandlers(currentNodes);
        const flowIdToSave = currentFlowIdRef.current;
        const flowNameToSave = flowNameRef.current || 'Workflow Sem Nome';

        if (flowIdToSave) {
          // Atualizar flow existente
          const flowData = {
            name: flowNameToSave,
            description: '',
            nodes: cleanNodesForSave,
            edges: currentEdges,
            isActive: true,
          };

          await updateWorkflowMutation.mutateAsync({
            id: flowIdToSave,
            data: flowData,
          });
        } else {
          // Criar novo flow
          const flowData = {
            name: flowNameToSave,
            description: '',
            nodes: cleanNodesForSave,
            edges: currentEdges,
            userId: user?.id,
            isActive: true,
          };

          const newFlow = await createWorkflowMutation.mutateAsync(flowData);
          setCurrentFlowId(newFlow.id);
          setFlowName(newFlow.name);
          currentFlowIdRef.current = newFlow.id;
          flowNameRef.current = newFlow.name;
        }
      } catch (error) {
        console.error('Erro ao salvar fluxo antes da execução:', error);
        // Continuar mesmo se houver erro ao salvar (não bloquear execução)
      }

      // Buscar dados da execução selecionada
      const selectedExecutionStr = sessionStorage.getItem('selectedExecution');
      let triggerData = {};

      if (selectedExecutionStr) {
        try {
          const selectedExecution = JSON.parse(selectedExecutionStr);
          triggerData =
            selectedExecution.data || selectedExecution.triggerData || {};
        } catch {
          // Ignorar erro ao parsear execução selecionada
        }
      }

      // Remover handlers antes de enviar (não podem ser serializados)
      const cleanNodes = removeExecutionHandlers(currentNodes);

      // SEMPRE enviar o flow atual para executar sem salvar
      const flowIdToUse = currentFlowIdRef.current;
      const flowNameToUse = flowNameRef.current;

      const result = await executeUntilNode({
        flowId: flowIdToUse || 'temp', // Se null, API vai buscar ou criar temporário
        targetNodeId,
        executionData: triggerData,
        // Sempre passar o flow completo para executar a versão atual (não salva)
        flow: {
          id: 'temp', // ID temporário para o flow inline
          name: flowNameToUse || 'Workflow Temporário',
          nodes: cleanNodes,
          edges: currentEdges,
          originalFlowId: flowIdToUse, // ✅ Passar o flowId original para buscar execuções anteriores
        },
      });

      if (result?.flowId) {
        setCurrentFlowId(result.flowId);
        currentFlowIdRef.current = result.flowId;
      }

      if (result?.executionId) {
        const waitAndSelect = async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const executionResult = await getExecution(result.executionId);

          if (executionResult.success && executionResult.execution) {
            const execution = executionResult.execution;

            const executionWithTarget = {
              ...execution,
              targetNodeId,
            };

            sessionStorage.setItem(
              'selectedExecution',
              JSON.stringify(executionWithTarget),
            );

            window.dispatchEvent(
              new CustomEvent('executionSelected', {
                detail: executionWithTarget,
              }),
            );

            await highlightExecutedNodes(executionWithTarget);
          } else {
            setTimeout(async () => {
              const retryResult = await getExecution(result.executionId);

              if (retryResult.success && retryResult.execution) {
                const execution = retryResult.execution;

                const executionWithTarget = {
                  ...execution,
                  targetNodeId,
                };

                sessionStorage.setItem(
                  'selectedExecution',
                  JSON.stringify(executionWithTarget),
                );
                window.dispatchEvent(
                  new CustomEvent('executionSelected', {
                    detail: executionWithTarget,
                  }),
                );
                await highlightExecutedNodes(executionWithTarget);
              }
            }, 1000);
          }
        };

        waitAndSelect();
      }
    },
    [
      executeUntilNode,
      removeExecutionHandlers,
      reactFlowInstance,
      highlightExecutedNodes,
      updateWorkflowMutation,
      createWorkflowMutation,
      user,
      setCurrentFlowId,
      setFlowName,
    ],
  );

  // Criar nodeTypes com botão de execução
  const nodeTypes = useMemo(() => {
    return Object.entries(baseNodeTypes).reduce<
      Record<string, React.ComponentType<NodeProps<NodeData>>>
    >((acc, [key, NodeComponent]) => {
      acc[key] = withExecuteButton(NodeComponent);
      return acc;
    }, {});
  }, []);

  // Verificar se um node específico está executando
  const isNodeExecuting = useCallback(
    (nodeId: string) => {
      return isExecuting && executingNodeId === nodeId;
    },
    [isExecuting, executingNodeId],
  );

  // Função para adicionar handlers de execução aos nodes
  const addExecutionHandlers = useCallback(
    (nodes: Node<NodeData>[]) => {
      return nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onPartialExecute: handlePartialExecute,
          isNodeExecuting,
        },
      }));
    },
    [handlePartialExecute, isNodeExecuting],
  );

  // Handler para deletar nodes selecionados
  const onNodesDelete = useCallback(
    (nodesToDelete: Node[]) => {
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
        'playwright-mcp-node': 'Playwright MCP',
        end: 'End',
      };

      const newNode = {
        id: generateNodeId(),
        type,
        position,
        data: {
          label:
            nodeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1),
          type,
          content: type === 'message' ? 'Digite aqui...' : undefined,
          // Adicionar handlers de execução
          onPartialExecute: handlePartialExecute,
          isNodeExecuting,
        },
      } as Node<NodeData>;

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, handlePartialExecute, isNodeExecuting],
  );

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      const cleanNodes = removeExecutionHandlers(nodes);

      if (currentFlowId) {
        // Atualizar flow existente usando mutation (sem token)
        const flowData = {
          name: flowName,
          description: '',
          nodes: cleanNodes,
          edges: edges,
          isActive: true,
        };

        await updateWorkflowMutation.mutateAsync({
          id: currentFlowId,
          data: flowData,
        });
      } else {
        // Criar novo flow usando mutation (sem token - será null)
        const flowData = {
          name: flowName,
          description: '',
          nodes: cleanNodes,
          edges: edges,
          userId: user?.id,
          isActive: true,
        };

        const newFlow = await createWorkflowMutation.mutateAsync(flowData);
        setCurrentFlowId(newFlow.id);
        setFlowName(newFlow.name);
        currentFlowIdRef.current = newFlow.id; // ✅ Atualizar ref
        flowNameRef.current = newFlow.name; // ✅ Atualizar ref
      }
    } catch {
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
    removeExecutionHandlers,
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
          (node: Node<NodeData>): Node<NodeData> => ({
            ...node,
            id: node.id || generateNodeId(), // Garantir que tenha ID
            type: (node.type || node.data?.type) as NodeType,
            data: {
              ...node.data,
              // Garantir que o tipo esteja correto
              type: (node.type || node.data?.type) as NodeType,
            },
          }),
        );

        // Criar um Set com todos os node IDs válidos
        const validNodeIds = new Set(processedNodes.map((n) => n.id));

        // Criar mapa de nodes para validação de handles
        const nodesMap = new Map(processedNodes.map((n) => [n.id, n]));

        // Filtrar edges inválidas (que referenciam nodes que não existem)
        const processedEdges = (flow.edges || [])
          .filter((edge: Edge) => {
            // Verificar se source e target existem
            const hasValidSource = validNodeIds.has(edge.source);
            const hasValidTarget = validNodeIds.has(edge.target);

            if (!hasValidSource || !hasValidTarget) {
              return false;
            }

            // Validação específica para handles de condition nodes
            const sourceNode = nodesMap.get(edge.source);
            if (sourceNode?.type === 'condition' && edge.sourceHandle) {
              const config = sourceNode.data?.conditionConfig;
              const isSwitch = config?.conditionType === 'switch';

              // Se for switch, validar se o handle é um case válido ou default
              if (isSwitch) {
                const validHandles = new Set([
                  ...(config?.cases || []).map(
                    (c: { id: string }) => `case_${c.id}`,
                  ),
                  'default',
                ]);

                if (!validHandles.has(edge.sourceHandle)) {
                  return false;
                }
              }
              // Se não for switch, aceitar apenas true/false
              else if (!['true', 'false'].includes(edge.sourceHandle)) {
                return false;
              }
            }

            return true;
          })
          .map((edge: Edge) => ({
            ...edge,
            id:
              edge.id ||
              `edge_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          }));

        // Adicionar handlers de execução parcial aos nodes
        const nodesWithHandlers = addExecutionHandlers(processedNodes);

        // Renderizar nodes primeiro
        setNodes(nodesWithHandlers);
        setFlowName(flow.name);
        setCurrentFlowId(flow.id);

        currentFlowIdRef.current = flow.id;
        flowNameRef.current = flow.name;

        // Adicionar edges após os nodes serem renderizados (evitar race condition)
        setTimeout(() => {
          setEdges(processedEdges);
        }, 250);
      }, 100);
    },
    [setNodes, setEdges, addExecutionHandlers],
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
          token: null, // null porque não está vinculado a nenhuma instância ainda
          userId: user?.id,
          isActive: true, // Fluxo ativo por padrão
        };

        const newFlow = await createWorkflowMutation.mutateAsync(flowData);

        // Limpar o canvas e definir o novo fluxo como atual
        setNodes([]);
        setEdges([]);
        setFlowName(flowName);
        setCurrentFlowId(newFlow.id);
        flowNameRef.current = flowName; // ✅ Atualizar ref
        currentFlowIdRef.current = newFlow.id; // ✅ Atualizar ref
        setIsCreateDialogOpen(false);
      } catch {
        alert('Erro ao criar fluxo');
      }
    },
    [setNodes, setEdges, user, createWorkflowMutation],
  );

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Partial<NodeData>) => {
      setNodes((nds) => {
        const nodeBefore = nds.find((n) => n.id === nodeId);

        // Se o node não existe no array mas está no nodeToConfig, restaurá-lo
        if (!nodeBefore) {
          if (nodeToConfig && nodeToConfig.id === nodeId) {
            console.warn(
              '⚠️ [FLOW-EDITOR] Node não encontrado no array, restaurando do nodeToConfig:',
              nodeId,
            );
            const restoredNode = {
              ...nodeToConfig,
              data: { ...nodeToConfig.data, ...data },
            };
            return [...nds, restoredNode];
          }
          console.error(
            '🔴 [FLOW-EDITOR] Node não encontrado e não pode ser restaurado:',
            nodeId,
          );
          return nds;
        }

        // Atualizar node existente
        const updated = nds.map((node) => {
          if (node.id === nodeId) {
            const updatedNode = {
              ...node,
              data: { ...node.data, ...data },
            };
            if (nodeToConfig?.id === nodeId) {
              setNodeToConfig(updatedNode);
            }
            return updatedNode;
          }
          return node;
        });

        return updated;
      });
    },
    [setNodes, nodeToConfig],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      if (node.type === 'message') {
        setNodeToConfig(node);
        setConfigDialogOpen(true);
      } else if (node.type === 'playwright-mcp-node') {
        setNodeToConfig(node);
        setPlaywrightConfigDialogOpen(true);
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
      } else {
        console.error(
          '🔴 [FLOW-EDITOR] nodeToConfig é null/undefined ao salvar!',
        );
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

  // ✅ Manter refs atualizados
  React.useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  React.useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // ✅ Listener direto para o evento executionSelected (garante que os nós sejam destacados mesmo se o painel não estiver aberto)
  React.useEffect(() => {
    const handleExecutionSelected = async (event: Event) => {
      const customEvent = event as CustomEvent<Execution>;
      const execution = customEvent.detail;

      // Salvar execução selecionada no sessionStorage
      sessionStorage.setItem('selectedExecution', JSON.stringify(execution));

      // Notificar nodes que o contexto de execução mudou
      notifyExecutionContextChanged();

      // Destacar nós executados (busca dados mais recentes do banco)
      await highlightExecutedNodes(execution);
    };

    const listener = handleExecutionSelected as unknown as EventListener;
    window.addEventListener('executionSelected', listener);

    return () => {
      window.removeEventListener('executionSelected', listener);
    };
  }, [highlightExecutedNodes]);

  // ✅ Listener para atualizar highlight quando webhook atualizar nodeExecution com erro
  // O NodeExecutionPanel dispara o evento 'executionUpdated' quando detecta mudanças
  React.useEffect(() => {
    const handleExecutionUpdated = async (event: Event) => {
      const customEvent = event as CustomEvent<{ executionId: string }>;
      const { executionId } = customEvent.detail;

      // Verificar se a execução atualizada é a que está selecionada
      const selectedExecutionStr = sessionStorage.getItem('selectedExecution');
      if (!selectedExecutionStr) {
        return;
      }

      try {
        const selectedExecution = JSON.parse(selectedExecutionStr) as Execution;
        if (selectedExecution.id !== executionId) {
          return; // Não é a execução selecionada
        }

        // Buscar execução atualizada do servidor
        const { getExecution } = await import('@/actions/executions');
        const result = await getExecution(executionId);

        if (result.success && result.execution) {
          const updatedExecution = result.execution;

          // Atualizar sessionStorage
          sessionStorage.setItem(
            'selectedExecution',
            JSON.stringify(updatedExecution),
          );

          // Preservar targetNodeId se existir
          const executionWithTarget: Execution & { targetNodeId?: string } = {
            ...updatedExecution,
            targetNodeId: (
              selectedExecution as Execution & { targetNodeId?: string }
            ).targetNodeId,
          };

          // Re-aplicar highlight com dados atualizados
          await highlightExecutedNodes(executionWithTarget);
        }
      } catch (error) {
        console.error('Erro ao atualizar highlight:', error);
      }
    };

    window.addEventListener('executionUpdated', handleExecutionUpdated);

    return () => {
      window.removeEventListener('executionUpdated', handleExecutionUpdated);
    };
  }, [highlightExecutedNodes]);

  const nodeColor = useCallback((node: Node) => {
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
  }, []);

  // Memoizar opções do ReactFlow para evitar recriação
  const fitViewOptions = useMemo(
    () => ({
      padding: 0.2,
      minZoom: 0.05,
      maxZoom: 2,
    }),
    [],
  );

  const defaultViewport = useMemo(() => ({ x: 0, y: 0, zoom: 0.1 }), []);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  // Memoizar estilos do Panel para evitar recriação
  const panelTopRightStyle = useMemo(() => ({ zoom: 0.9 }), []);

  // Memoizar array panOnDrag para evitar recriação
  const panOnDragConfig = useMemo(() => [2], []);

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
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.05}
          maxZoom={2}
          defaultViewport={defaultViewport}
          proOptions={proOptions}
          className="bg-gray-50"
          selectionOnDrag
          panOnDrag={panOnDragConfig}
          selectionMode={SelectionMode.Partial}
        >
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          <Controls />
          <MiniMap nodeColor={nodeColor} />

          <Panel
            position="top-left"
            className="flex gap-2"
            style={{ zoom: 0.9 }}
          >
            <div className="flex flex-col gap-2">
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
                  <div className="bg-transparent hidden p-4 min-w-24 w-fit"></div>
                )}
                <CreateWorkflowDialog
                  isOpen={isCreateDialogOpen}
                  onClose={() => setIsCreateDialogOpen(false)}
                  onSubmit={handleCreateNewFlow}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <div className="flex gap-2 w-full" style={{ zoom: 0.9 }}>
                <Button
                  variant="gradient"
                  className="w-fit h-fit flex items-center justify-center gap-2"
                  // bgHexColor="#77a5f5"
                  onClick={handleExport}
                >
                  <Download className="w-4 h-4" />
                  {/* <Typography variant="span" className="text-xs text-white">
                      Exportar
                    </Typography> */}
                </Button>
                <Button
                  variant="gradient"
                  className="w-fit h-fit flex items-center justify-center gap-2"
                  // bgHexColor="#f047ee"
                  onClick={handleImport}
                >
                  <Upload className="w-4 h-4" />
                  {/* <Typography variant="span" className="text-xs text-white">
                      Importar
                    </Typography> */}
                </Button>
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  variant="gradient"
                  className="w-fit h-fit flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {/* <Typography variant="span" className="text-xs text-white">
                    Workflow
                  </Typography> */}
                </Button>
                <Button
                  variant="gradient"
                  className="w-fit h-fit flex items-center justify-center gap-2"
                  // bgHexColor="#66e477"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <Save className="w-4 h-4" />
                  {/* <Typography variant="span" className="text-xs text-white">
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </Typography> */}
                </Button>
                {currentFlowId && (
                  <Button
                    variant="gradient"
                    className="w-fit h-fit flex items-center justify-center gap-2"
                    // bgHexColor="#f59e0b"
                    onClick={() => setIsExecutionsPanelOpen(true)}
                  >
                    <Play className="w-4 h-4" />
                    {/* <Typography variant="span" className="text-xs text-white">
                    Execuções
                  </Typography> */}
                  </Button>
                )}
                {hasExecutionHighlight && (
                  <Button
                    variant="gradient"
                    className="w-full flex items-center justify-center gap-2"
                    bgHexColor="#ef4444"
                    onClick={clearExecutionHighlight}
                  >
                    <X className="w-4 h-4" />
                    {/* <Typography
                    variant="span"
                    className="text-xs text-white whitespace-nowrap"
                  >
                    Limpar Visualização
                  </Typography> */}
                  </Button>
                )}
              </div>
            </div>
          </Panel>
          <Panel
            position="top-right"
            className="flex gap-2 p-4 !bg-transparent -translate-y-4 translate-x-4 rounded-bl-lg"
            style={panelTopRightStyle}
          >
            <div className="flex gap-4 h-fit" style={{ zoom: 0.9 }}>
              <Button
                variant="gradient"
                className="w-fit h-fit flex items-center justify-center gap-2"
                // bgHexColor="#10b981"
                onClick={() => setIsSpreadsheetOpen(true)}
              >
                <Database className="w-4 h-4" />
                {/* <Typography
                  variant="span"
                  className="text-xs text-white whitespace-nowrap"
                >
                  Banco de dados
                </Typography> */}
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

      {configDialogOpen && nodeToConfig?.type === 'message' && (
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
      )}

      {playwrightConfigDialogOpen &&
        nodeToConfig?.type === 'playwright-mcp-node' && (
          <PlaywrightMcpNodeConfig
            isOpen={playwrightConfigDialogOpen}
            onClose={() => {
              setPlaywrightConfigDialogOpen(false);
              setNodeToConfig(null);
            }}
            config={nodeToConfig?.data.playwrightMcpConfig}
            onSave={(cfg) => {
              if (nodeToConfig) {
                handleNodeUpdate(nodeToConfig.id, {
                  playwrightMcpConfig: cfg,
                });
              }
            }}
            nodeId={nodeToConfig?.id}
            flowId={currentFlowId || undefined}
            nodeLabel={nodeToConfig?.data.label}
            onNodeLabelChange={(label) => {
              if (nodeToConfig) {
                handleNodeUpdate(nodeToConfig.id, { label });
              }
            }}
          />
        )}

      {webhookConfigDialogOpen && (
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
      )}

      {memoryConfigDialogOpen && (
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
      )}

      {transformationConfigDialogOpen && (
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
      )}

      {conditionConfigDialogOpen && (
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
      )}

      {databaseConfigDialogOpen && (
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
      )}

      {httpRequestConfigDialogOpen && (
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
      )}

      {agentConfigDialogOpen && (
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
      )}

      {loopConfigDialogOpen && (
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
      )}

      {codeExecutionConfigDialogOpen && (
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
      )}

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

          // Destacar nós executados usando a função centralizada (busca dados mais recentes do banco)
          highlightExecutedNodes(execution).catch((error) => {
            console.error('Erro ao destacar nós executados:', error);
          });
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
